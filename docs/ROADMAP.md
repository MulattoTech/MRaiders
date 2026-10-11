# MRaiders roadmap — October 11, 2026

## Current verified scope
Seven map records and an offline manual checklist. Four historical
candidate-location datasets exist but are **not verified game locations**.
Native Qt code is a work-in-progress until CI and Windows smoke tests pass.

## P0 — Native foundation
- [x] CMake C++20 and Qt6 native skeleton
- [x] Preserve legacy Electron files without deleting history
- [x] Domain validation tests for JSON and stable IDs
- [x] Manual map zoom, pan, label toggle, search and category filtering
- [x] Manual route JSON export; offline progress checkbox persistence
- [x] Frozen Trail/Pendola Pass declared without invented coordinates
- [ ] Verify Linux CTest and Windows Qt 6.12 packaging CI
- [ ] Run a manual Windows UI acceptance test
- [ ] Create trustworthy map provenance and image calibration flow

## P1 — MetaForge-inspired independent companion features
- [ ] First-class map image import/calibration using reference anchors
- [ ] Marker editor, user-owned exports/imports and community review process
- [ ] Quest/blueprint/item searchable offline reference database (licensed data only)
- [ ] Needed-items and crafting planner with per-account manual counts
- [ ] Event calendar and user-configurable reminders; do not invent live schedules
- [ ] Skill/loadout planning with verified 2.0 rules
- [ ] Independent second-screen window and optional read-only LAN web view
- [ ] Local profile backup/restore and schema migrations
- [ ] Accessible UI, keyboard navigation and performance regression checks

## P2 — Advanced
- [ ] Modular plugin SDK with declarative, permission-controlled data packs
- [ ] Privacy-preserving opt-in sync and updates (no game account scraping)
- [ ] Offline community content validation, source trust scores and moderation
- [ ] Signed Windows releases, SBOM, reproducible release manifest

## Administration / release gates
- [ ] Verify requested public repository visibility in GitHub Settings
- [ ] Create dedicated MRaiders GitHub Project and attach prioritized issues
- [ ] Enable safe main branch ruleset, required successful CI, and auto-merge
- [ ] Confirm GitHub Actions and CodeQL entitlements on the chosen repo visibility
- [ ] Choose source license and comply with Qt dynamically linked LGPL obligations
- [ ] Review Embark policies; no guarantee of game-approved overlay behavior

Do not check a gate merely because configuration code exists; verify it with
a GitHub setting/readback, Actions run, or application test.
