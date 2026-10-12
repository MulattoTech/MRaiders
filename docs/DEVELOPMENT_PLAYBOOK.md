# MRaiders — Native development and verification playbook

## System of record
- Default branch: `main` (legacy Electron remains untouched until native acceptance).
- Native candidate: PR #1; open P0/P1 work in distinct, non-conflicting branches.
- Requirements: `AGENTS.md`, `docs/ROADMAP.md`, `ARCHITECTURE.md`.
- GitHub Project: *MRaiders Development* (see `docs/PROJECT_ADMIN.md`).

## Fast development loop
1. Read active issues, PRs, workflows and branch ownership before editing.
2. Select highest-impact unowned P0 issue; describe acceptance tests and exact affected files.
3. Use a short-lived branch, one vertical feature with a user-visible result.
4. On every commit run data validation, Qt CMake, CTest and smoke checks.
5. Attach verified logs, screenshots if applicable, data source/license, and known gaps.
6. Merge only after review gates. Rebase/merge main safely; no forced history rewrite.

## Cloud build
`Native CI` automatically runs on a PR (and on `main` after merging), builds
Linux Qt and Windows Qt, runs unit tests, executes `MRaiders.exe --smoke-test`
on a Windows runner, then uploads an **unpacked, unsigned** Windows artifact.

**Qt installer workaround:** As of 2026-10-11, PyPI `aqtinstall 3.3.0`
doesn't understand Qt 6.11+ Windows package folder layout. Native CI pins
the merged upstream fix (miurahr/aqtinstall PR #1000, merge commit
`8c3695d4a4e1ceabf6a74dc6c79681656dc6b74b`). Don't remove this
until a tested published installer version contains the fix.

Run locally with Qt SDK when needed:
```powershell
cmake -S . -B build -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build build --parallel 2
ctest --test-dir build --output-on-failure
```

## Windows acceptance
1. Download `MRaiders-Windows-Qt-6.12` from a green workflow run.
2. Extract the **whole package**, not just `MRaiders.exe`.
3. Launch `MRaiders.exe`; ensure no missing Qt platform/plugin DLL errors.
4. Inspect every registered map, marker labels, search and category filters.
5. Test image import (only user-owned source imagery), pan and scroll zoom.
6. Add, save, export, clear and reload a manual route.
7. Toggle progression checkboxes, close, relaunch, verify persistence.
8. Verify `--smoke-test` exits with code 0 in headless automation.
9. Capture evidence and attach it to the PR; **do not run or modify ARC Raiders**.

## Toolchain hygiene
Prefer GitHub-hosted Windows and Linux runners; their Qt compiler, Python
installer and MSVC tools are ephemeral and discarded after the job. The PC
needs only the extracted Windows app for user-interface acceptance.
No permanent Qt SDK installation or cleanup on the gaming machine is required.

If a local toolchain must be used, install into a dedicated temporary
folder outside global PATH, record paths first, and remove only those newly
created folders after tests. Never remove pre-existing Visual Studio,
Python, CMake, Qt installations, shared caches, or credentials.

## Failure playbook
- **Runner starts without steps:** check Actions account and repo visibility.
- **Qt 6.12 XML checksum failure:** check pinned `aqtsource` fix.
- **Compile failures:** inspect precise Qt/C++ compiler diagnostics.
- **Package fails to start:** inspect `windeployqt` outputs and plugin dependencies.
- **CodeQL fails:** inspect SARIF analysis permissions and CMake build logs.
- **Data validity succeeds:** does *not* establish marker location accuracy.
