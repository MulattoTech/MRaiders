# MRaiders GitHub administration runbook

_Last revised: October 11, 2026. The source code and GitHub issues are managed via the
connected GitHub App; repository administrative mutations need a separately authorized
GitHub CLI user session with `Administration:write` and `project` scope._

## One-time CLI authorization
From Windows PowerShell 7 (never paste access tokens in chat or logs):

```powershell
gh auth login -h github.com --web -s repo,project,workflow
gh auth status
```

GitHub CLI on the previously inspected PC reported an expired session. Merely being
signed in to Git Credential Manager is **not** the same as an authenticated
`gh` session; don't attempt to extract its secret or print credential output.

## Project and settings (idempotent)
```powershell
cd C:\tools\dev\MRaiders
pwsh -NoProfile -File .\scripts\configure-github.ps1
pwsh -NoProfile -File .\scripts\configure-github.ps1 -Apply
```

The apply pass creates or reuses the *MRaiders Development* Project (public),
links it to this repo, creates Priority and Workstream fields, links PR #1
and issues #2-#8, and enables Projects, issue tracking, auto-merge and
delete-branch-on-merge settings if your account authorizes those actions.

After successful PR checks, add a non-force-push, non-delete, PR-only
branch ruleset requiring Native CI:
```powershell
pwsh -NoProfile -File .\scripts\configure-github.ps1 -Apply -ConfigureRules
```

Optionally add `-RequireCodeQL` only after CodeQL itself passes and GitHub
Security events are available. The script refuses to require a check that
hasn't succeeded on the candidate PR, avoiding a permanently blocked branch.

### Verify from GitHub
- [MRaiders Project list](https://github.com/users/MulattoTech/projects)
- [Repository Settings](https://github.com/MulattoTech/MRaiders/settings)
- [Branch rules](https://github.com/MulattoTech/MRaiders/settings/rules)
- [Security & analysis](https://github.com/MulattoTech/MRaiders/settings/security_analysis)
- [Actions runs](https://github.com/MulattoTech/MRaiders/actions)
- [PR #1](https://github.com/MulattoTech/MRaiders/pull/1)

The GitHub App connector's `admin` metadata does not grant it the
`Administration:write` mutation interface or Projects V2 creation
methods. Do not confuse committed automation scripts with actual remote
settings: verify settings on GitHub after executing.

## Suggested branch / review policy
`main` is stable. Implement features in `feature/<scope>` and bugfixes
in `fix/<scope>`; branch from the most current `main`. Use PRs, do not
force-push or rewrite `main`. Require data validation, Linux Qt CTest,
and Windows packaging checks after they exist and pass reliably.
Enable CodeQL as a required check only when it has proven stable.
Avoid requiring a second reviewer if only one maintainer is available.

## Public repository content and licensing
- Review a source license (MIT/Apache-2.0/GPL etc.) before claiming
  third parties may redistribute MRaiders.
- Qt 6 runtime redistribution must honor the actual applicable Qt license
  (typically LGPL obligations when using LGPL dynamic linking).
- Do not publish unlicensed game imagery, MetaForge databases or guessed spawn
  coordinates as verified, or assert anti-cheat approval.
