# MRaiders architecture

## Native forward path
- `CMakeLists.txt` + `native/CMakeLists.txt`: Qt6/C++20 executable and Qt Test suite.
- `native/src/map_repository.*`: validates normalized, unique static marker data.
- `native/src/tracker_repository.*`: validates independent manual checklist content.
- `native/src/map_view.*`: Qt Graphics View map canvas, pan/zoom, markers, image reference.
- `native/src/main_window.*`: tabs, filters, reference image selection, route export, saved checkboxes.
- `native/resources.qrc`: embeds seven map JSON files and progression metadata.
- `data/`: editable inputs. Previously supplied four map files are unverified starter candidates.
- `native/tests/`: deterministic repository validation tests.
- `.github/workflows/`: JSON validation, Linux tests, Windows downloadable artifacts,
  and public-repo CodeQL.

State is stored locally via `QSettings`; there is no server, account integration,
game interface, telemetry, or live observation. Optional private user-supplied
images remain on the user's machine; they are never committed or transmitted.

## Legacy transition
The root `main.js`, `renderer.js`, `index.html`, `lib/`,
`tests/` and `package.json` are the previous Electron implementation.
Keep them untouched while Qt is being verified. Remove or archive only with
a separate, explicit release migration decision.

## Future evolution
See `docs/ROADMAP.md` for a modular map catalogue, provenance tooling,
route editor, offline quest/item/blueprint tables, and second-display support.
