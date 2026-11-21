"""GitHub Project V2 adapter using authenticated gh; never reads tokens."""
from __future__ import annotations
import json
import subprocess
from .core import Feature

REPO="MulattoTech/MRaiders"
OWNER="MulattoTech"
PROJECT="2"

def gh(*args,payload=None):
    cmd=["gh",*args]
    if payload is not None: cmd.extend(["--input","-"])
    p=subprocess.run(cmd,input=json.dumps(payload) if payload is not None else None,
                     text=True,capture_output=True,encoding="utf-8",errors="replace",
                     timeout=45,check=False)
    if p.returncode:
        # Do not propagate full stdout containing user records or secret values.
        message=(p.stderr or "").strip().splitlines()
        raise RuntimeError(f"GitHub operation failed: {args[0]} ({message[-1][:180] if message else 'unknown'})")
    if not p.stdout.strip(): return {}
    try: return json.loads(p.stdout)
    except ValueError as e: raise RuntimeError("Unexpected GitHub response") from e

def health():
    return {"signed_in_as":gh("api","user").get("login"),
            "project":"https://github.com/users/MulattoTech/projects/2",
            "repository":REPO}

def board():
    listing=gh("project","item-list",PROJECT,"--owner",OWNER,
               "--limit","200","--format","json")
    return [{"title":i.get("title",""),"url":(i.get("content") or {}).get("url",""),
             "status":i.get("status","Todo"),"priority":i.get("priority") or "Untriaged",
             "workstream":i.get("workstream") or "Unassigned",
             "category":i.get("category") or "Unassigned",
             "acceptance":i.get("acceptance") or "NOT_RUN"}
            for i in listing.get("items",[])]

def ensure_label(name):
    try: gh("api",f"repos/{REPO}/labels/{name}"); return
    except RuntimeError: pass
    try:
        gh("api","--method","POST",f"repos/{REPO}/labels",
           payload={"name":name,"color":"2563eb"})
    except RuntimeError:
        gh("api",f"repos/{REPO}/labels/{name}") # concurrent creation is okay

def create_feature(spec:Feature):
    labels=[f"priority:{spec.priority}",f"area:{spec.workstream.lower()}",
            f"category:{spec.category.lower()}","workflow:feature-intake"]
    for label in labels: ensure_label(label)
    issue=gh("api","--method","POST",f"repos/{REPO}/issues",
             payload={"title":spec.title_for_issue(),"body":spec.body_for_issue(),"labels":labels})
    url=issue.get("html_url");number=issue.get("number")
    if not url or not number: raise RuntimeError("GitHub did not confirm issue creation")
    updates=[("Priority",spec.priority),("Workstream",spec.workstream),
             ("Category",spec.category),("Impact",spec.impact),
             ("Effort",spec.effort),("Risk",spec.risk),
             ("Acceptance","NOT_RUN"),("Status","Todo"),
             ("Target Model",spec.target_model),
             ("Dependencies",spec.dependencies or "None")]
    try:
        gh("project","item-add",PROJECT,"--owner",OWNER,"--url",url,"--format","json")
        for field,value in updates:
            gh("project","item-edit",PROJECT,"--owner",OWNER,"--url",url,
               "--field",field,"--value",value,"--format","json")
    except (RuntimeError,subprocess.TimeoutExpired) as e:
        return {"ok":False,"issue_url":url,"issue_number":number,
                "warning":f"Issue created; Project reconciliation needed: {e}"}
    return {"ok":True,"issue_url":url,"issue_number":number,"feature_id":f"MR-{number}",
            "project_url":"https://github.com/users/MulattoTech/projects/2"}

def audit_health():
    """Read-only dashboard of exact main commit checks; no inferred acceptance."""
    branch=gh("api",f"repos/{REPO}/branches/main")
    sha=(branch.get("commit") or {}).get("sha","")
    if not sha:
        raise RuntimeError("Could not identify the main branch revision")
    response=gh("api",f"repos/{REPO}/commits/{sha}/check-runs?per_page=100")
    targets={
        "MRaiders Quality Gate",
        "Validate AI provenance",
        "Feature Control tests",
        "Qt/Linux build and CTest",
        "Qt 6.12/Windows package",
        "analyze-cpp"
    }
    runs=[]
    for item in response.get("check_runs",[]):
        if item.get("name") not in targets: continue
        runs.append({
            "name":item["name"],
            "status":item.get("status","unknown"),
            "conclusion":item.get("conclusion") or "NOT_RUN",
            "url":item.get("html_url") or "",
            "completed_at":item.get("completed_at")
        })
    return {"branch":"main","sha":sha,"checks":runs,
            "audit_declared_only":True,
            "note":"CI verifies required declaration format and changed-line hunks, not actual AI identity or user acceptance."}
