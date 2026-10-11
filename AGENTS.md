# MRaiders development contract (2026-10-11)

## Mission
Build MRaiders, an independent, multi-feature ARC Raiders companion application.
The new native implementation lives under `native/` and is based on C++20,
Qt 6.12 LTS target (Qt >= 6.4 developer API), and CMake. The existing Electron
implementation is preserved as migration reference, not the preferred new app.

## Work method
1. Inspect `docs/ROADMAP.md` and the open issues/PRs before selecting work.
2. Claim a single feature and affected files in a short-lived branch/PR.
3. Preserve existing data and behavior unless replacement is verified.
4. Run data validation, CMake/CTest, and UI testing as applicable.
5. Publish reproducible build/test evidence and known gaps. Never claim PASS
   for an unrun test. Do not force-push, rewrite main, or bypass reviews.
6. Keep source attribution and confirmation status on map data. Older marker
   datasets are starter candidates only. Do not invent map coordinates.

## Boundaries
- No game process/memory access, hooks, DLL injection, packet interception,
  anti-cheat evasion, synthetic player input, or live gameplay computer vision.
- Desktop mapping, manual marker browsing, offline trackers, imported personal
  reference images, and independent second-screen usage are in scope.
- Do not copy assets, proprietary maps, APIs, or datasets from other products
  without clear permission/licensing. Compete on implementation, not scraping.
- Never call the app "100% anti-cheat-safe" or claim Embark endorsement.

## Cloud-first development
- Prefer GitHub Actions/Codespaces for package installs, Qt compilation, tests,
  and Windows artifacts; do not run the game in a VM.
- Treat failure to obtain GitHub administration/Projects privileges as a
  documented blocker rather than silently claiming those settings are enabled.
- Use the PR template. Consult prompts/codex/START.md for Codex handoffs.

## Native checks
```sh
cmake -S . -B build -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build build
ctest --test-dir build --output-on-failure
```
The old `npm test` suite remains available for legacy Electron maintenance.
