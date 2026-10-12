"""MRaiders code-provenance validator, context helper, and diff-line audit ledger.

Git proves author/commit/timestamp/diff, NOT the truth of self-declared model.
No intrusive line comments are inserted. Git diff hunks attribute code ranges
to individual commit declarations; git blame remains available for exact lines.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone, timedelta
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import sys

BASELINE = "1ef71480915c677610f8a01715191d7aa7a48090"
FIELDS = ("Change-Origin","AI-Agent","AI-Provider","AI-Model","AI-Reasoning",
          "AI-Session","AI-UTC-Date","Feature-ID","Validation")
ORIGINS = {"AI","Human","Mixed","Bot"}
NON_AI = {"none","n/a"}
MODEL_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.:/+ -]{0,119}$")
DATE_PATTERN = re.compile(r"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$")
HUNK = re.compile(r"^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@")
FILE = re.compile(r"^\+\+\+ b/(.+)$")

def git(*args, cwd=None, check=True):
    cmd=["git",*map(str,args)]
    p=subprocess.run(cmd,cwd=cwd,text=True,encoding="utf-8",errors="replace",
                     capture_output=True,check=False,timeout=30)
    if check and p.returncode:
        raise RuntimeError(f"Git error ({args[0]}): {(p.stderr or '').strip()[-250:]}")
    return p.stdout.strip() if check else p

def trailers(message):
    # Last trailer wins, preserving audit visibility of duplicate declarations.
    found={}
    for line in message.splitlines():
        match=re.match(r"^([A-Za-z][A-Za-z-]+):[ \t]*(.+?)[ \t]*$",line)
        if match and match.group(1) in FIELDS: found[match.group(1)]=match.group(2)
    return found

def validate_message(message, *, bot=False):
    t=trailers(message)
    if bot and not t:
        return True,["Bot-authored change; Git identity is recorded, model metadata not claimed."],{}
    errors=[]
    for name in FIELDS:
        if not t.get(name): errors.append(f"Missing {name}")
    if errors: return False, errors, t
    origin=t["Change-Origin"]
    if origin not in ORIGINS: errors.append("Change-Origin must be AI, Human, Mixed, or Bot")
    is_ai=origin in ("AI","Mixed")
    if is_ai:
        if t["AI-Model"].lower() in ("none","unknown","unassigned","n/a") or not MODEL_PATTERN.fullmatch(t["AI-Model"]):
            errors.append("AI-Model must name the actual declared model; never invent one")
        if t["AI-Provider"].lower() in ("none","unknown","n/a"):
            errors.append("AI-Provider must identify the provider")
    else:
        if t["AI-Model"].lower() not in NON_AI: errors.append("Non-AI commits must set AI-Model: none")
        if t["AI-Reasoning"].lower() not in NON_AI: errors.append("Non-AI commits must set AI-Reasoning: n/a")
    if not DATE_PATTERN.fullmatch(t.get("AI-UTC-Date","")):
        errors.append("AI-UTC-Date must be UTC yyyy-mm-ddThh:mm:ssZ")
    else:
        try:
            stamp=datetime.strptime(t["AI-UTC-Date"],"%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
            if stamp>datetime.now(timezone.utc)+timedelta(minutes=10):
                errors.append("AI-UTC-Date is too far in the future")
        except ValueError:
            errors.append("AI-UTC-Date is not a real calendar date")
    if not re.fullmatch(r"(?:MR-\d+|MAINT|GOVERNANCE)",t.get("Feature-ID","")):
        errors.append("Feature-ID must be MR-<GitHub issue number>, MAINT, or GOVERNANCE")
    for key in FIELDS:
        if len(t.get(key,""))>320: errors.append(f"{key} is unreasonably long")
    return not errors,errors,t

def is_ancestor(sha, descendant):
    if not sha: return False
    return git("merge-base","--is-ancestor",sha,descendant,check=False).returncode==0

def commit_details(sha):
    fmt="%H%x00%P%x00%an%x00%aI%x00%cI%x00%B"
    raw=git("show","-s",f"--format={fmt}",sha)
    parts=raw.split("\x00",5)
    if len(parts)!=6: raise RuntimeError("Unexpected commit metadata")
    h,parents,author,authored,committed,body=parts
    return {"sha":h,"parents":parents.split(),"author":author,
            "authored_at":authored,"committed_at":committed,"message":body}

def diff_ranges(sha):
    # Each hunk denotes all added/changed lines of the resulting file,
    # including zero-length deletions. No inference about AI-written lines.
    diff=git("show","--format=","--unified=0","--no-ext-diff","--no-renames",sha,"--")
    name=None;ranges=[]
    for line in diff.splitlines():
        f=FILE.match(line)
        if line.startswith("+++ /dev/null"):
            name=None
        elif f:
            name=f.group(1)
        elif name and (m:=HUNK.match(line)):
            start,count=int(m.group(3)),int(m.group(4) or "1")
            ranges.append({"file":name,"line_start":start,
                           "line_end":start+count-1 if count else start-1,
                           "added_lines":count})
    return ranges

def report(base,head="HEAD",baseline=BASELINE):
    base_sha=git("rev-parse",base);head_sha=git("rev-parse",head)
    merge_base=git("merge-base",base_sha,head_sha)
    commits=git("rev-list","--reverse",f"{merge_base}..{head_sha}").splitlines()
    entries=[];errors=[];legacy=0;bots=0
    for sha in commits:
        info=commit_details(sha)
        if len(info["parents"])>1:
            continue
        if is_ancestor(sha,baseline):
            legacy+=1
            continue
        bot=info["author"].lower().endswith("[bot]") or info["author"].lower() in ("dependabot","github-actions[bot]")
        ok,failures,t=validate_message(info["message"],bot=bot)
        hunks=diff_ranges(sha)
        if bot and not t: bots+=1
        title=info["message"].splitlines()[0]
        entry={
            "commit":sha,"subject":title,"author":info["author"],
            "authored_at":info["authored_at"],"committed_at":info["committed_at"],
            "declaration":{k:t.get(k) for k in FIELDS},
            "verification":"declaration validated, model identity not independently attestable" if t else "bot metadata from Git only",
            "hunks":hunks,"diff_hunk_count":len(hunks),
            "valid":ok,"problems":failures if not ok else []
        }
        entries.append(entry)
        for problem in entry["problems"]:errors.append(f"{sha[:12]} {problem}")
    return {
        "version":1,"repository":"MulattoTech/MRaiders",
        "base":base_sha,"head":head_sha,"merge_base":merge_base,
        "generated_at":datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "baseline":baseline,"legacy_commits_exempted":legacy,"bot_commits_observed":bots,
        "entries":entries,"errors":errors,"pass":not errors,
        "notes":"AI provider, model, effort and session are self-declared; Git content/sha/hunks and dates are independently computable. Historic commits are not retroactively attributed."
    }

def markdown(doc):
    rows=["<!-- mraiders-audit:"+doc["head"]+" -->",
          "### MRaiders AI/Commit Audit — "+doc["head"][:12],
          f"Result: **{'PASS' if doc['pass'] else 'FAIL'}**. "
          f"Audited: {len(doc['entries'])}; historical baseline exempted: {doc['legacy_commits_exempted']}.",
          "Model and reasoning metadata are **declared**, not cryptographically verified.",
          "| Commit | Origin | Agent / Model | Reasoning | Feature | Code hunks | Git authored UTC |",
          "|---|---|---|---|---|---:|---|"]
    for entry in doc["entries"]:
        t=entry["declaration"]
        rows.append("| [`"+entry["commit"][:10]+"`](https://github.com/MulattoTech/MRaiders/commit/"+entry["commit"]+")"
                    f" | {t.get('Change-Origin') or 'Bot'} | {t.get('AI-Agent') or entry['author']} / {t.get('AI-Model') or 'none'}"
                    f" | {t.get('AI-Reasoning') or 'n/a'} | {t.get('Feature-ID') or 'BOT'}"
                    f" | {entry['diff_hunk_count']} | {entry['authored_at'][:19]} |")
    rows+=["",f"Audited line ranges and full metadata are available in the artifact `mraiders-ai-provenance` for head `{doc['head']}`. ",
           "Use `git blame` for line-by-line history; merges and pre-policy commits are not attributed to a fictional model."]
    if doc["errors"]:rows+=["","**Validation errors:**",*["- "+x for x in doc["errors"]]]
    return "\n".join(rows)+"\n"

def context_path():
    p=Path(git("rev-parse","--git-path","mraiders-agent-context.json"))
    return p if p.is_absolute() else Path.cwd()/p

def set_context(args):
    origin=args.origin
    if origin not in ORIGINS: raise ValueError("Invalid origin")
    ctx={
        "Change-Origin":origin,
        "AI-Agent":args.agent if origin in ("AI","Mixed") else "Human",
        "AI-Provider":args.provider if origin in ("AI","Mixed") else "none",
        "AI-Model":args.model if origin in ("AI","Mixed") else "none",
        "AI-Reasoning":args.reasoning if origin in ("AI","Mixed") else "n/a",
        "AI-Session":args.session or ("agent-"+secrets.token_hex(6) if origin in ("AI","Mixed") else "human"),
        "Feature-ID":args.feature,
        "Validation":args.validation,
    }
    if origin in ("AI","Mixed") and (not ctx["AI-Model"] or not ctx["AI-Provider"]):
        raise ValueError("Provide --model and --provider for actual AI work")
    valid,errs,_=validate_message("\n".join(f"{k}: {v}" for k,v in {
        **ctx,"AI-UTC-Date":datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    }.items()))
    if not valid: raise ValueError("; ".join(errs))
    path=context_path();path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(ctx,indent=2)+"\n",encoding="utf-8")
    print(f"Provenance context set for {origin} / {args.feature}. Saved inside private Git metadata, not tracked.")

def append_context(message_file):
    path=context_path()
    if not path.is_file():
        print("MRaiders provenance context absent: run python -m tools.audit.provenance context ...",file=sys.stderr)
        return 1
    ctx=json.loads(path.read_text(encoding="utf-8"))
    ctx["AI-UTC-Date"]=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    msg=Path(message_file);body=msg.read_text(encoding="utf-8-sig",errors="replace")
    if trailers(body): return 0
    with msg.open("a",encoding="utf-8") as stream:
        stream.write("\n" if body.endswith("\n") else "\n\n")
        for key in FIELDS: stream.write(f"{key}: {ctx[key]}\n")
    return 0

def main(argv=None):
    ap=argparse.ArgumentParser(description=__doc__)
    sub=ap.add_subparsers(dest="cmd",required=True)
    p=sub.add_parser("report")
    p.add_argument("--base",required=True)
    p.add_argument("--head",default="HEAD")
    p.add_argument("--baseline",default=BASELINE)
    p.add_argument("--json",default="audit.json")
    p.add_argument("--markdown",default="audit.md")
    c=sub.add_parser("context")
    c.add_argument("--origin",choices=sorted(ORIGINS),default="AI")
    c.add_argument("--agent",default="Codex CLI")
    c.add_argument("--provider",default="OpenAI")
    c.add_argument("--model",default="")
    c.add_argument("--reasoning",default="not-exposed")
    c.add_argument("--session",default="")
    c.add_argument("--feature",required=True)
    c.add_argument("--validation",default="NOT_RUN")
    a=sub.add_parser("append-context");a.add_argument("file")
    m=sub.add_parser("check-message");m.add_argument("file")
    args=ap.parse_args(argv)
    if args.cmd=="context":set_context(args);return 0
    if args.cmd=="append-context":return append_context(args.file)
    if args.cmd=="check-message":
        ok,errors,_=validate_message(Path(args.file).read_text(encoding="utf-8-sig"))
        if not ok:
            for err in errors: print("AUDIT FAIL: "+err,file=sys.stderr)
            print("Set a valid context: python -m tools.audit.provenance context --feature MR-13 --model ...",file=sys.stderr)
        return 0 if ok else 1
    doc=report(args.base,args.head,args.baseline)
    Path(args.json).parent.mkdir(parents=True,exist_ok=True)
    Path(args.markdown).parent.mkdir(parents=True,exist_ok=True)
    Path(args.json).write_text(json.dumps(doc,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    Path(args.markdown).write_text(markdown(doc),encoding="utf-8")
    print(f"AUDIT {'PASS' if doc['pass'] else 'FAIL'}: {len(doc['entries'])} new commits, {doc['legacy_commits_exempted']} historical exempt")
    for error in doc["errors"]: print(" - "+error,file=sys.stderr)
    return 0 if doc["pass"] else 1

if __name__=="__main__":
    try:sys.exit(main())
    except (ValueError,RuntimeError,OSError) as e:
        print(f"MRaiders provenance error: {e}",file=sys.stderr);sys.exit(1)
