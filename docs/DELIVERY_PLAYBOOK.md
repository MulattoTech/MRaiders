# MRaiders Project-first feature workflow

1. **Intake:** guided GUI records outcome, testable acceptance, constraints, dependencies and planned model.
2. **Triage:** project fields record P0/P1/P2, workstream, type, impact, risk and effort; manual override requires a reason.
3. **Claim:** use stable MR-<issue number> IDs, one agent owner per scope, short-lived branch and isolated worktree.
4. **Implement:** declare actual model, provider, reasoning, session and UTC time in commit trailers; attach realistic test evidence.
5. **Verify:** use AI provenance CI, GUI tests, native CTest/Windows packaging and security analysis as appropriate.
6. **Accept:** mark Project Acceptance PASS only after full user-facing acceptance criteria are verified, not merely because tests passed.
7. **Reconcile:** link PR, commits and release, resolve dependencies, update board status and choose the next unowned P0/P1.

GitHub Project #2 is the primary management dashboard. Issues are implementation contracts; PR and Git history prove what was changed. Feature Control v1 does not auto-launch agents or autonomously promote acceptance. Issue #15 contains the advanced orchestration design.
