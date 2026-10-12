"""Offline tests for intake, planning, and commit provenance."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

from tools.feature_control.core import Feature,suggest_priority
from tools.feature_control.github import create_feature
from tools.audit.provenance import validate_message,report,trailers

PAYLOAD={
 "title":"Add independent feature backlog UX",
 "outcome":"A user can describe intended MRaiders changes through guided questions.",
 "acceptance":"Create linked GitHub work item\nSet priority and acceptance field",
 "constraints":"No game hooks, no browser tokens",
 "workstream":"Planning","category":"Feature","impact":"High",
 "urgency":"Medium","effort":"Small","risk":"Low",
 "dependencies":"MR-13","target_model":"GPT-6","target_reasoning":"high"
}
STAMP="2026-10-11T21:00:00Z"
AI_MSG=("feat: provenance proof\n\nChange-Origin: AI\nAI-Agent: ChatGPT Web\n"
        "AI-Provider: OpenAI\nAI-Model: GPT-6\nAI-Reasoning: not-exposed\n"
        "AI-Session: trial-001\nAI-UTC-Date: "+STAMP+"\n"
        "Feature-ID: MR-13\nValidation: unit tests PASS\n")

class FeatureTests(unittest.TestCase):
    def test_priority(self):
        self.assertEqual(suggest_priority("High","High","Small","Low","Feature")[0],"P0")
        self.assertEqual(suggest_priority("Low","Low","Large","High","Feature")[0],"P2")
    def test_feature_body(self):
        f=Feature.parse(PAYLOAD)
        self.assertEqual(f.priority,"P1")
        self.assertIn("- [ ] Create linked GitHub work item",f.body_for_issue())
    def test_override_needs_reason(self):
        with self.assertRaises(ValueError):
            Feature.parse({**PAYLOAD,"priority":"P0"})
        self.assertEqual(Feature.parse({**PAYLOAD,"priority":"P0",
             "justification":"Blocks all native development"}).priority,"P0")
    def test_rejects_invalid(self):
        with self.assertRaises(ValueError):Feature.parse({})
        with self.assertRaises(ValueError):Feature.parse({**PAYLOAD,"workstream":"Inject"})
        with self.assertRaises(ValueError):Feature.parse({**PAYLOAD,"target_model":"$(evil)"})
    @patch("tools.feature_control.github.ensure_label")
    @patch("tools.feature_control.github.gh")
    def test_issue_creates_project_item(self,gh,label):
        calls=[]
        def fake(*args,**kw):
            calls.append(args)
            if "POST" in args and args[-1].endswith("/issues"):
                return {"number":16,"html_url":"https://github.com/MulattoTech/MRaiders/issues/16"}
            return {}
        gh.side_effect=fake
        result=create_feature(Feature.parse(PAYLOAD))
        self.assertTrue(result["ok"],result)
        self.assertEqual(result["feature_id"],"MR-16")
        self.assertTrue(any("item-add" in x for x in calls))
        self.assertTrue(any("Priority" in x for x in calls))
class AuditTests(unittest.TestCase):
    def test_good_ai_commit(self):
        good,problems,t=validate_message(AI_MSG)
        self.assertTrue(good,problems)
        self.assertEqual(t["AI-Model"],"GPT-6")
    def test_required_model(self):
        good,errors,_=validate_message(AI_MSG.replace("AI-Model: GPT-6\n",""))
        self.assertFalse(good)
        self.assertIn("Missing AI-Model",errors)
    def test_fake_human_declared_model(self):
        self.assertFalse(validate_message(AI_MSG.replace("Change-Origin: AI","Change-Origin: Human"))[0])
    def test_bad_date(self):
        self.assertFalse(validate_message(AI_MSG.replace(STAMP,"2026-99-99T00:00:00Z"))[0])
    def test_real_git_diff_ranges_and_metadata(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)
            def run(*args):
                return subprocess.run(["git",*args],cwd=path,check=True,
                        text=True,capture_output=True).stdout.strip()
            run("init");run("config","user.name","Test Agent")
            run("config","user.email","agent@example.invalid")
            (path/"demo.cpp").write_text("line one\nline two\n",encoding="utf-8")
            run("add","demo.cpp");run("commit","-m","old")
            base=run("rev-parse","HEAD")
            (path/"demo.cpp").write_text("line one\nmodified\nnew third\n",encoding="utf-8")
            run("add","demo.cpp");run("commit","-m",AI_MSG)
            previous=os.getcwd()
            try:
                os.chdir(path)
                results=report(base,"HEAD",base)
            finally:os.chdir(previous)
            self.assertTrue(results["pass"],results["errors"])
            self.assertEqual(len(results["entries"]),1)
            ranges=results["entries"][0]["hunks"]
            self.assertTrue(any(x["file"]=="demo.cpp" and x["added_lines"]==2 for x in ranges),ranges)

if __name__=="__main__":unittest.main()
