# MRaiders MR-15: Dependency-aware execution readiness (v1)

This is a **read-only Feature Control orchestration planner**, not a distributed lock or automatic agent launcher. It is the first usable vertical slice of MR-15.

## Canonical input and supported references

- [Project #2](https://github.com/users/MulattoTech/projects/2) supplies Status, Acceptance, Priority, Effort, Impact, and Dependencies. GitHub issues become graph nodes; PRs are excluded.
- Project Dependencies field wins; if absent, parse the issue-body "## Dependencies" section. No unspecified dependencies are invented.
- References accepted: MR-15, #15, a lone number in the Project field, and full same-repo GitHub issue URLs.
- Unreadable, cross-repository, and missing-Project references are blockers, not assumed resolved.
- Issue-body SHA256 detects changes and a v1 intake marker indicates a schema version. Neither is immutable spec revision history.

## Decision model

- READY: unstarted with valid dependencies all at Acceptance PASS.
- BLOCKED: invalid references, missing linked issues, or non-PASS prerequisites.
- CYCLE: node belongs to a dependency cycle, including self-reference.
- IN_PROGRESS: Project Status In Progress (advisory; NOT an atomic lease).
- REVIEW: Status Done but Acceptance not PASS.
- ACCEPTED: Project Acceptance PASS; its evidence is not independently evaluated by this tool.

Done and green CI do not substitute for Acceptance PASS. The UI retains details about unresolved dependencies even when a feature is In Progress.

Within each priority tier (P0 first), READY work is ranked by **declared** Impact, then **declared** Effort (harder first), then direct downstream unlock count. Unspecified effort/impact is not guessed.

## User-visible behavior

- GET /api/orchestration returns a read-only JSON v1 view using the existing authenticated GitHub CLI.
- Feature Control shows a new Execution readiness panel: readiness counts, candidate ordering, blockers, links, and downstream dependencies.
- No write API, agent launch, worktree claim, hidden credential handling, or silent acceptance promotion is introduced.
- Existing localhost-only, origin, CSRF, and security-header constraints remain intact.

## Tests

Run from the repository root:

    python -m unittest discover -s tests -p test_orchestration.py -v
    python -m unittest discover -s tests -p test_feature_control.py -v
    node --check tools/feature_control/static/app.js

The suites cover complex dependency graphs, missing references, cycle and self-cycle detection, truthful state gates, invalid references, stable ordering, and the actual local HTTP handler.

## Next MR-15 implementation slices

1. Real worktree ownership/conflict detection and an atomic cross-worker claim protocol. An issue comment or Project Status alone is **not** a lock.
2. Immutable/versioned feature-spec revision history (the current SHA-256 fingerprint is change detection only).
3. PR/test evidence collection and human-confirmed acceptance transitions; never auto-PASS.
4. Explicitly authorized, bounded agent launch/cancel with audit trails.
5. Reconcile and merge PR #20 before MR-15; this implementation uses a stacked branch to avoid modifying an agent-owned GUI concurrently.

Do not claim MR-15 is finished from this slice.
