# MRaiders Feature Control GUI

[GitHub Project #2](https://github.com/users/MulattoTech/projects/2) is the management board. Linked GitHub issues are durable implementation specifications, while PRs and tests are evidence.

## Launch (Python standard library, existing gh login)

```powershell
cd C:\tools\dev\MRaiders
pwsh -NoProfile -File .\scripts\Start-MRaiders-FeatureControl.ps1
```

Open http://127.0.0.1:8765/ and stop with Ctrl+C. Requires Python 3.11+ and authenticated GitHub CLI with project/repo scopes. No added packages or browser tokens.

The GUI has four steps: outcome and acceptance; priority/risk/effort; dependencies and desired model; review and submit. It suggests P0/P1/P2 transparently, allows an explained override, creates a GitHub issue, links Project #2, and fills priority, workstream, category, impact, effort, risk, acceptance, target model and dependencies. The board reads these back from GitHub, not a separate database.

The submission never launches an AI agent. Planned model selection is not evidence of the model that eventually wrote code. Project stages (Todo, In Progress, Done) and acceptance states (NOT_RUN, PARTIAL, PASS, FAIL) are distinct.

Security: the HTTP server listens on 127.0.0.1 only, requires same-origin/host and CSRF protection, rejects oversized non-JSON requests, renders GitHub data as text (not HTML), and uses the already signed-in local gh CLI. It stores no personal token. Run only on a trusted developer computer.

This is **working intake + prioritization + live project board**, not yet the larger multi-repository LLM-driven orchestration system. Dynamic probing, repository analysis, agent launch, dependent worktree scheduling, and auto acceptance are planned in issue #15.

**Pre-merge launch path:** while PR #17 remains unmerged, run the launcher from
`C:\tools\dev\MRaiders-AuditControl\scripts\Start-MRaiders-FeatureControl.ps1`.
After safe integration into main, switch to the regular MRaiders repository path.

## Audit & CI health panel (MR-16)

The GUI reads GitHub's actual check-runs at the current **main** commit and
displays the exact SHA, required governance checks, native checks (when available),
and links to check results. Missing checks display `MISSING`, not green.
Click **Refresh audit** to update without submitting a feature. This does not
claim a green check is acceptance PASS. AI model and effort remain self-reported
through commit trailers, and the audit panel explicitly notes that limitation.
