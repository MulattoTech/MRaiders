"""Deterministic, read-only MRaiders delivery planner over GitHub Project #2.

It NEVER launches agents, claims GitHub locks, changes acceptance, or writes worktrees.
Issue bodies and Project fields remain the canonical planning records.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from hashlib import sha256
import re
from typing import Any

REPO = "MulattoTech/MRaiders"
ISSUE_URL = re.compile(r"https://github\.com/MulattoTech/MRaiders/issues/([1-9]\d*)/?$")
REF = re.compile(r"(?<!\w)(?:MR[- ]|#)([1-9]\d*)(?!\w)", re.I)
LOCAL_URL = re.compile(r"https://github\.com/MulattoTech/MRaiders/issues/([1-9]\d*)(?:/?)(?!\S)")
EXTERNAL_URL = re.compile(r"https://github\.com/[\w.-]+/[\w.-]+/issues/\d+", re.I)
SECTION = re.compile(r"^##[ \t]+Dependencies[ \t]*\r?\n(.*?)(?=^##[ \t]+|\Z)", re.M | re.S | re.I)
PRIORITY = {"P0": 0, "P1": 1, "P2": 2}
IMPACT = {"High": 3, "Medium": 2, "Low": 1}
EFFORT = {"Large": 3, "Medium": 2, "Small": 1}


def dependency_text(item: dict[str, Any]) -> tuple[str, str]:
    """Project Dependencies wins; use the issue's Dependencies section as fallback."""
    direct = item.get("dependencies")
    if isinstance(direct, str) and direct.strip():
        return direct.strip(), "project-field"
    body = (item.get("content") or {}).get("body") or ""
    match = SECTION.search(body) if isinstance(body, str) else None
    if match:
        return match.group(1).strip(), "issue-body"
    return "", "not-declared"


def parse_dependencies(text: str) -> tuple[list[int], list[str]]:
    if not text.strip() or text.strip().lower() in {"none", "n/a", "not applicable", "no dependencies", "-"}:
        return [], []
    found = {int(value) for value in REF.findall(text)}
    found.update(int(value) for value in LOCAL_URL.findall(text))
    warnings = []
    external = [url for url in EXTERNAL_URL.findall(text) if not LOCAL_URL.fullmatch(url)]
    if external:
        warnings.append("Cross-repository dependencies require manual verification")
    if not found:
        warnings.append("No machine-readable MR-issue ID in declared dependencies")
    # A numeric-only Project field also counts as a local issue ID.
    if not found and re.fullmatch(r"[1-9]\d*", text.strip()):
        found.add(int(text.strip()))
        warnings = [w for w in warnings if not w.startswith("No machine-readable")]
    return sorted(found), warnings


def _cycles(deps: dict[int, list[int]]) -> list[list[int]]:
    """Tarjan SCC: reports real cycles, including self-dependencies."""
    index = 0
    indices: dict[int, int] = {}
    lowlink: dict[int, int] = {}
    stack: list[int] = []
    on_stack: set[int] = set()
    groups: list[list[int]] = []

    def visit(node: int) -> None:
        nonlocal index
        indices[node] = lowlink[node] = index
        index += 1
        stack.append(node)
        on_stack.add(node)
        for dep in deps.get(node, []):
            if dep not in deps:
                continue
            if dep not in indices:
                visit(dep)
                lowlink[node] = min(lowlink[node], lowlink[dep])
            elif dep in on_stack:
                lowlink[node] = min(lowlink[node], indices[dep])
        if lowlink[node] == indices[node]:
            members = []
            while stack:
                member = stack.pop()
                on_stack.remove(member)
                members.append(member)
                if member == node:
                    break
            if len(members) > 1 or (members and members[0] in deps[members[0]]):
                groups.append(sorted(members))

    for node in sorted(deps):
        if node not in indices:
            visit(node)
    return sorted(groups)


def analyze_project(items: list[dict[str, Any]]) -> dict[str, Any]:
    """Return truthful execution readiness and complexity-first candidates."""
    nodes: dict[int, dict[str, Any]] = {}
    excluded = 0
    for item in items:
        content = item.get("content") or {}
        url = content.get("url") or ""
        match = ISSUE_URL.fullmatch(url)
        if content.get("type") not in (None, "Issue") or not match:
            excluded += 1
            continue
        number = int(match.group(1))
        raw, declared_from = dependency_text(item)
        dependencies, warnings = parse_dependencies(raw)
        body = content.get("body") or ""
        nodes[number] = {
            "id": f"MR-{number}",
            "number": number,
            "url": url,
            "title": item.get("title") or content.get("title") or f"Issue #{number}",
            "priority": item.get("priority") or "Untriaged",
            "status": item.get("status") or "Todo",
            "acceptance": item.get("acceptance") or "NOT_RUN",
            "workstream": item.get("workstream") or "Unassigned",
            "impact": item.get("impact") or "Unspecified",
            "effort": item.get("effort") or "Unspecified",
            "risk": item.get("risk") or "Unspecified",
            "owner": item.get("owner") or "Unassigned",
            "dependencies": dependencies,
            "dependency_source": declared_from,
            "warnings": warnings,
            "spec_version": 1 if "<!-- MRaiders guided intake v1 -->" in body else 0,
            "issue_sha256": sha256(body.encode("utf-8")).hexdigest(),
            "blocked_by": [],
            "readiness": "UNKNOWN",
            "unlocks": [],
        }

    deps = {n: value["dependencies"] for n, value in nodes.items()}
    cycles = _cycles(deps)
    in_cycle = {n for group in cycles for n in group}
    dependent = defaultdict(list)
    for number, item in nodes.items():
        for dependency in item["dependencies"]:
            if dependency in nodes:
                dependent[dependency].append(number)

    for number, item in nodes.items():
        problems = list(item["warnings"])
        if number in in_cycle:
            problems.append("Cycle detected in dependency graph")
        for dependency in item["dependencies"]:
            if dependency not in nodes:
                problems.append(f"MR-{dependency} is missing from Project #2")
            elif nodes[dependency]["acceptance"] != "PASS":
                problems.append(f"MR-{dependency} has not reached Acceptance PASS")
        item["blocked_by"] = problems
        item["unlocks"] = [f"MR-{i}" for i in sorted(dependent[number])]
        if number in in_cycle:
            item["readiness"] = "CYCLE"
        elif item["acceptance"] == "PASS":
            item["readiness"] = "ACCEPTED"
        elif item["status"] == "In Progress":
            item["readiness"] = "IN_PROGRESS"
        elif problems:
            item["readiness"] = "BLOCKED"
        elif item["status"] == "Done":
            item["readiness"] = "REVIEW"
            item["blocked_by"].append("Project says Done but Acceptance is not PASS")
        else:
            item["readiness"] = "READY"

    def ordering(item: dict[str, Any]) -> tuple[int, int, int, int, int]:
        # Highest impact and complexity go first within each declared priority.
        return (
            PRIORITY.get(item["priority"], 3),
            -IMPACT.get(item["impact"], 0),
            -EFFORT.get(item["effort"], 0),
            -len(item["unlocks"]),
            item["number"],
        )

    ordered = sorted(nodes.values(), key=ordering)
    ready = [item for item in ordered if item["readiness"] == "READY"]
    summary = {state: sum(item["readiness"] == state for item in nodes.values())
               for state in ("READY", "BLOCKED", "CYCLE", "IN_PROGRESS", "REVIEW", "ACCEPTED")}
    return {
        "schema_version": 1,
        "generated_at_utc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "source": "GitHub Project #2",
        "features": ordered,
        "recommended": [item["id"] for item in ready],
        "cycles": [[f"MR-{num}" for num in group] for group in cycles],
        "summary": {**summary, "untracked_project_items": excluded},
        "limitations": [
            "GitHub Project Status is not Acceptance PASS.",
            "In Progress is an advisory claim, not an atomic distributed lease.",
            "Missing project issues and unclear dependencies block readiness.",
            "This planner does not launch agents, alter worktrees, or promote acceptance.",
            "Priority and complexity use declared Project fields, not inferred effort estimates.",
        ],
    }
