"""Schema, deterministic priority suggestion, and feature-to-issue renderer."""
from __future__ import annotations
from dataclasses import dataclass, asdict
import re

WORKSTREAMS=("Infrastructure","Native","Maps","Data","UX","Progression","Planning")
CATEGORIES=("Feature","Bug","Security","Infrastructure","Quality","Documentation")
LEVELS=("High","Medium","Low")
SIZES=("Small","Medium","Large")
EFFORTS=("unassigned","low","medium","high","xhigh","not-exposed")
PRIORITIES=("P0","P1","P2")
MODEL_PATTERN=re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9 _./+:-]{0,119}$")

def string(raw,key,minimum=0,maximum=4000):
    value=raw.get(key,"")
    if not isinstance(value,str) or not minimum<=len(value.strip())<=maximum or "\x00" in value:
        raise ValueError(f"{key}: expected {minimum}-{maximum} characters of text")
    return value.strip()

def choice(raw,key,allowed,default):
    value=raw.get(key,default)
    if value not in allowed: raise ValueError(f"{key}: must be one of {', '.join(allowed)}")
    return value

def suggest_priority(impact,urgency,effort,risk,category):
    score={"High":4,"Medium":2,"Low":0}[impact]+{"High":4,"Medium":2,"Low":0}[urgency]
    score-={"Small":0,"Medium":1,"Large":2}[effort]
    if category=="Security" and impact=="High": score+=2
    if risk=="High": score-=1  # Extra review, not automatic urgency.
    return ("P0" if score>=7 else "P1" if score>=3 else "P2",
            f"Transparent score={score} from impact, urgency, effort, category and delivery risk.")

@dataclass(frozen=True)
class Feature:
    title:str; outcome:str; acceptance:str; constraints:str; workstream:str
    category:str; impact:str; urgency:str; effort:str; risk:str
    dependencies:str; target_model:str; target_reasoning:str; priority:str; justification:str

    @classmethod
    def parse(cls,raw):
        if not isinstance(raw,dict): raise ValueError("Expected feature JSON object")
        fields={
          "title":string(raw,"title",8,140),
          "outcome":string(raw,"outcome",16,3000),
          "acceptance":string(raw,"acceptance",12,4000),
          "constraints":string(raw,"constraints",0,3000),
          "dependencies":string(raw,"dependencies",0,500),
          "workstream":choice(raw,"workstream",WORKSTREAMS,"Planning"),
          "category":choice(raw,"category",CATEGORIES,"Feature"),
          "impact":choice(raw,"impact",LEVELS,"Medium"),
          "urgency":choice(raw,"urgency",LEVELS,"Medium"),
          "effort":choice(raw,"effort",SIZES,"Medium"),
          "risk":choice(raw,"risk",LEVELS,"Medium"),
          "target_model":string(raw,"target_model",1,120),
          "target_reasoning":choice(raw,"target_reasoning",EFFORTS,"unassigned"),
        }
        if fields["target_model"]!="Unassigned" and not MODEL_PATTERN.fullmatch(fields["target_model"]):
            raise ValueError("target_model contains unsupported characters")
        proposed, rationale=suggest_priority(*(fields[n] for n in
            ("impact","urgency","effort","risk","category")))
        fields["priority"]=choice(raw,"priority",PRIORITIES,proposed)
        provided=string(raw,"justification",0,500)
        if fields["priority"]!=proposed and len(provided)<12:
            raise ValueError("A priority override requires at least 12 characters of justification")
        fields["justification"]=provided or rationale
        return cls(**fields)

    def title_for_issue(self):
        return f"[{self.priority}][{self.workstream}] {self.title}"

    def body_for_issue(self):
        checks=[line.strip().removeprefix("- ").strip() for line in self.acceptance.splitlines()
                if line.strip()]
        checkboxes="\n".join("- [ ] "+x for x in checks)
        return (
            "<!-- MRaiders guided intake v1 -->\n"
            f"## User outcome\n{self.outcome}\n\n"
            f"## Measurable acceptance\n{checkboxes}\n\n"
            f"## Safety, privacy and compatibility\n{self.constraints or 'None recorded'}\n\n"
            f"## Dependencies\n{self.dependencies or 'None recorded'}\n\n"
            f"## Priority / rationale\n- Priority: **{self.priority}**\n"
            f"- Impact: {self.impact}; Urgency: {self.urgency}; Effort: {self.effort}; Risk: {self.risk}\n"
            f"- Rationale: {self.justification}\n- Workstream: {self.workstream}; Category: {self.category}\n\n"
            "## Planned assignment — NOT actual authorship evidence\n"
            f"- Requested model: {self.target_model}\n- Requested reasoning: {self.target_reasoning}\n\n"
            "## Delivery contract\nUse source-commit provenance trailers with actual agent/model,"
            " reasoning effort, UTC time, linked GitHub feature number, and real validation."
            " Mark acceptance PASS only after user-facing checks truly pass.\n"
        )

    def payload(self):
        return {"schema_version":1,**asdict(self)}
