# MRaiders AI audit and source-code traceability

Inspired by MJobs' commit provenance validator, this policy starts for new commits after native PR #1 historical boundary SHA `1ef71480915c677610f8a01715191d7aa7a48090`. Historic commits are exempt, not given fictitious model identities.

## Every newly authored commit
Required metadata fields: Change-Origin (AI, Mixed, Human, Bot); AI-Agent, AI-Provider, AI-Model, AI-Reasoning, AI-Session, AI-UTC-Date, Feature-ID, Validation. For human commits AI-Model must be none and AI-Reasoning n/a. For undisclosed ChatGPT Web reasoning use not-exposed; never invent a setting or passing test.

GitHub Actions computes SHA, author, Git dates, changed file names and exact diff-hunk new-line ranges. It uploads a JSON and Markdown report and comments on the PR once per new head SHA. `git blame -L start,end -- filename` provides line-level history without polluting every line with comments.

**Limit:** model/reasoning info is explicitly self-declared, not cryptographically verified by Git. A planned model in Feature Control is NOT implementation evidence. A commit touching multiple AI agents cannot prove which model authored each line; document ambiguity in the PR.

## Record actual agent context
Install hooks per worktree (once):

```powershell
pwsh -NoProfile -File .\scripts\Install-MRaiders-AuditHooks.ps1
```

Before committing, declare actual model and effort (example only; replace values with your session):

```powershell
python -m tools.audit.provenance context --origin AI --agent "Codex CLI" --provider OpenAI --model gpt-6.1-sol --reasoning high --feature MR-14 --validation "unit tests PASS"
```

The context lives in private Git metadata. The hooks append UTC-time trailers to commit messages and fail missing/invalid entries. GitHub CI performs independent enforcement, even if local hooks were skipped.

For manually authored changes use `--origin Human --feature MR-14 --validation NOT_RUN` (other arguments optional). For ChatGPT Web use `AI-Agent: ChatGPT Web`, `AI-Model: GPT-6` and `AI-Reasoning: not-exposed` when the effort setting is not exposed.

## Local report

```powershell
python -m tools.audit.provenance report --base origin/main --head HEAD --json audit/audit.json --markdown audit/audit.md
```

CI is defined in `.github/workflows/ai-provenance.yml`. Bot commits without self-attested models are reported by their Git bot identity, not attributed to a fictitious AI. Merge commits retain Git history. GitHub artifacts expire by retention policy; GitHub commit hashes/PR notes are long-term references but not an external attestation service.

An audit PASS does not mean user acceptance PASS. Real tests, safety checks and source licenses remain required.
