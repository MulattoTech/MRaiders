# MRaiders — project-wide development and audit contract

**Priority:** All new feature and fix work must be tracked in [MRaiders Development Project #2](https://github.com/users/MulattoTech/projects/2). Read docs/DELIVERY_PLAYBOOK.md, docs/FEATURE_CONTROL.md, and docs/AI_PROVENANCE.md.

## Feature workflow
1. Guided intake first: user outcome, constraints, measurable acceptance, dependencies, priority (P0/P1/P2), workstream, category, impact, effort, risk.
2. Project is the management board; GitHub issues are stable MR-<issue-number> implementation contracts. Never use "Done" as equivalent to accepted PASS.
3. One active scope owner, isolated worktree/feature branch. Follow branch protections; use small reviewable PRs; no force push or unsafe main resets.
4. Every newly authored non-merge commit must include the auditable trailers defined in docs/AI_PROVENANCE.md; never invent model, reasoning effort or validation. Set per-session provenance context and use repository-local hooks.
5. Run appropriate Python feature-control tests, native CMake/CTest or Electron tests and GitHub Actions. Record PASS/FAIL/NOT_RUN truthfully.
6. Associate exact SHA, changed file/line hunks, model/session metadata and PR reviews with the feature's evidence. Securely handle existing GitHub credentials; never copy a token into code or logs.

## Product scope
MRaiders is an independent ARC Raiders reference companion. The existing Electron app is historical and the parallel C++20/Qt6 native modernization is PR #1. Do not claim anti-cheat approval. No game memory access, hooks, injected overlays, live gameplay CV, packet interception or detection evasion. Do not distribute MetaForge databases or copyrighted game assets without a license.

## Developer environment
Prefer GitHub Actions and Codespaces for package installation/builds, minimizing permanent changes to the workstation. Feature Control's Python standard-library server runs on 127.0.0.1 only and uses the locally authenticated GitHub CLI. Never expose it to an untrusted LAN/public interface.

## Source of truth
- Project board: priorities, workstream, risk, status, acceptance.
- GitHub issue: user outcome and acceptance contract.
- Git commits: authorship declaration; Git SHA and diff are verifiable, AI identity is not independently proven.
- PR/CI: implementation evidence, review, code hunk audit artifacts.
- Tests: running tests is not equivalent to acceptance.
