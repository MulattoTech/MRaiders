"""MR-15 deterministic dependency planning, missing references and safe status gates."""
import json
import threading
import unittest
from unittest.mock import patch
from urllib.request import urlopen

from tools.feature_control.orchestration import (
    analyze_project, dependency_text, parse_dependencies,
)
from tools.feature_control import github
from tools.feature_control.server import FeatureControlServer


def task(number, *, dependency="", status="Todo", acceptance="NOT_RUN",
         priority="P1", impact="Medium", effort="Medium", body=""):
    return {
        "content": {
            "type": "Issue",
            "number": number,
            "url": f"https://github.com/MulattoTech/MRaiders/issues/{number}",
            "body": body,
            "title": f"Task {number}",
        },
        "title": f"Task {number}",
        "priority": priority,
        "impact": impact,
        "effort": effort,
        "acceptance": acceptance,
        "status": status,
        "dependencies": dependency,
        "workstream": "Planning",
    }


def by_num(plan, number):
    return next(x for x in plan["features"] if x["number"] == number)


class DependencyTests(unittest.TestCase):
    def test_refs_and_literal_numeric(self):
        refs, warnings = parse_dependencies(
            "MR-15, #4, https://github.com/MulattoTech/MRaiders/issues/7")
        self.assertEqual(refs, [4, 7, 15])
        self.assertFalse(warnings)
        self.assertEqual(parse_dependencies("18"), ([18], []))
        self.assertEqual(parse_dependencies("None"), ([], []))

    def test_unparseable_and_cross_repo_refs_are_not_implicitly_ready(self):
        ids, warnings = parse_dependencies("Investigate external component before starting")
        self.assertEqual(ids, [])
        self.assertTrue(warnings)
        ids, warnings = parse_dependencies(
            "https://github.com/example/other/issues/5")
        self.assertEqual(ids, [])
        self.assertIn("Cross-repository", " ".join(warnings))

    def test_project_field_overrides_issue_body_fallback(self):
        item = task(1, dependency="MR-4", body="## Dependencies\nMR-9\n\n## Goal\n...")
        self.assertEqual(dependency_text(item), ("MR-4", "project-field"))
        item["dependencies"] = ""
        self.assertEqual(dependency_text(item), ("MR-9", "issue-body"))
        self.assertEqual(dependency_text(task(3)), ("", "not-declared"))

    def test_project_blockers_and_pass_only_unblocks(self):
        entries = [task(4, acceptance="NOT_RUN", status="Done"),
                   task(5, dependency="MR-4"),
                   task(9, dependency="MR-5")]
        plan = analyze_project(entries)
        self.assertEqual(by_num(plan, 4)["readiness"], "REVIEW")
        self.assertEqual(by_num(plan, 5)["readiness"], "BLOCKED")
        self.assertEqual(by_num(plan, 9)["readiness"], "BLOCKED")
        self.assertIn("MR-4", by_num(plan, 5)["blocked_by"][0])
        entries[0]["acceptance"] = "PASS"
        plan = analyze_project(entries)
        self.assertEqual(by_num(plan, 5)["readiness"], "READY")
        self.assertEqual(by_num(plan, 9)["readiness"], "BLOCKED")
        self.assertEqual(plan["recommended"], ["MR-5"])

    def test_cycles_self_cycles_and_missing(self):
        data = [task(1, dependency="MR-2"),
                task(2, dependency="MR-1"),
                task(3, dependency="MR-3"),
                task(4, dependency="MR-999")]
        plan = analyze_project(data)
        self.assertEqual(plan["cycles"], [["MR-1", "MR-2"], ["MR-3"]])
        self.assertEqual(by_num(plan, 1)["readiness"], "CYCLE")
        self.assertEqual(by_num(plan, 3)["readiness"], "CYCLE")
        self.assertEqual(by_num(plan, 4)["readiness"], "BLOCKED")
        self.assertIn("missing", " ".join(by_num(plan, 4)["blocked_by"]))

    def test_in_progress_is_not_success(self):
        plan = analyze_project([task(15, status="In Progress")])
        self.assertEqual(by_num(plan, 15)["readiness"], "IN_PROGRESS")
        self.assertEqual(plan["summary"]["ACCEPTED"], 0)

    def test_priority_then_declared_complexity(self):
        data = [task(1, impact="Medium", effort="Small"),
                task(2, priority="P0", impact="Low", effort="Small"),
                task(3, impact="High", effort="Large"),
                task(4, impact="High", effort="Medium")]
        plan = analyze_project(data)
        self.assertEqual(plan["recommended"], ["MR-2", "MR-3", "MR-4", "MR-1"])
        self.assertEqual(plan["schema_version"], 1)

    def test_ignores_prs_and_tracks_spec_digest(self):
        item = task(15, body="<!-- MRaiders guided intake v1 -->\n## Outcome\n...")
        pr = task(20)
        pr["content"]["type"] = "PullRequest"
        pr["content"]["url"] = "https://github.com/MulattoTech/MRaiders/pull/20"
        first = analyze_project([item, pr])
        self.assertEqual(len(first["features"]), 1)
        self.assertEqual(first["summary"]["untracked_project_items"], 1)
        self.assertEqual(by_num(first, 15)["spec_version"], 1)
        old_digest = by_num(first, 15)["issue_sha256"]
        item["content"]["body"] += "Changed requirements"
        self.assertNotEqual(old_digest, by_num(analyze_project([item]), 15)["issue_sha256"])

    @patch("tools.feature_control.github.gh")
    def test_execution_adapter_uses_project_not_guesswork(self, mock_gh):
        mock_gh.return_value = {"items": [task(15), task(16, dependency="MR-15")]}
        result = github.execution_plan()
        self.assertEqual(result["summary"]["READY"], 1)
        self.assertEqual(result["summary"]["BLOCKED"], 1)
        self.assertEqual(mock_gh.call_args.args[:2], ("project", "item-list"))


class HttpTests(unittest.TestCase):
    @patch("tools.feature_control.server.github.execution_plan")
    def test_read_only_endpoint_and_no_fake_acceptance(self, mock_plan):
        mock_plan.return_value = analyze_project([task(15)])
        http = FeatureControlServer(0)
        worker = threading.Thread(target=http.serve_forever, daemon=True)
        worker.start()
        try:
            with urlopen(f"http://127.0.0.1:{http.server_port}/api/orchestration",
                         timeout=5) as response:
                self.assertEqual(response.status, 200)
                payload = json.loads(response.read())
                self.assertEqual(payload["recommended"], ["MR-15"])
                self.assertEqual(payload["summary"]["ACCEPTED"], 0)
                self.assertTrue(response.headers["Content-Security-Policy"])
        finally:
            http.shutdown()
            http.server_close()
            worker.join(timeout=3)


if __name__ == "__main__":
    unittest.main()
