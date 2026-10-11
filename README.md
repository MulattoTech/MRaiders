# MRaiders

**MRaiders** is an independent ARC Raiders companion application developed by MulattoTech.
The project is being modernized from its original Hurricane Cache Electron overlay
into a **native, offline-first C++20 / Qt desktop app** with a broader feature set.

> **Work in progress.** Native development is on the refactor PR; existing Electron
> sources remain preserved. MRaiders is not affiliated with or endorsed by Embark Studios.

## Current native functionality

- Seven registered map areas: Dam Battlegrounds, Blue Gate, Buried City,
  Spaceport, Stella Montis, Riven Tides, and **Pendola Pass** (Frozen Trail 2.0).
- Pan/zoom map canvas with searchable, filterable candidate markers.
- User-imported local reference map images (no copyrighted images distributed).
- Select markers, maintain map-specific manual routes, and export route JSON.
- Persistent manual progression checklist for Frozen Trail milestones.
- Offline application; **no game interaction, screen capture, memory reading,
  network interception, input automation, or injected overlay**.
- CMake build, QtTest data checks, and GitHub Actions Windows build artifact workflow.

### Data accuracy
The four original cache JSON datasets are **unverified starter candidate data**,
not confirmed spawn locations. The three newer map files deliberately contain
empty spawn arrays until independently verified, licensed community contributions
are received. Marker coordinates use normalized 0..1 image-space values.
Images require matching map boundaries or additional calibration work.

## Build native (Qt 6.12 recommended)

Install a Qt 6 Widgets developer kit (minimum supported CMake API version 6.4),
CMake 3.22+, C++20 compiler, and Ninja:

```sh
cmake -S . -B build -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build build --parallel 2
ctest --test-dir build --output-on-failure
```

Windows releases are built in **GitHub Actions** rather than requiring a Qt
installation on your PC. Download the `MRaiders-Windows-Qt-6.12` artifact from
a successful Native CI run and open `MRaiders.exe` inside its extracted folder.
It is not a signed installer or certified public release.

For the previous Electron version, `npm ci && npm test` remains available
from the repository root. Do not assume the old Electron overlay is permitted
by the game just because it does not access process memory.

## Work and collaboration

- [Roadmap](docs/ROADMAP.md)
- [Agent contract](AGENTS.md)
- [Architecture](ARCHITECTURE.md)
- [Contribution guide](CONTRIBUTING.md)
- [Codex continuation prompt](prompts/codex/START.md)
- [Official Frozen Trail 2.0 notes](https://id.embark.games/arc-raiders/support/faq/282-2-0-frozen-trail-update)

External content, commercial maps, and third-party product databases are not
bundled. Qt licensing obligations apply to redistributed Qt runtime libraries.
A project source-code license has not yet been selected; verify licensing before
accepting external code contributions or publishing a redistributed release.

*ARC Raiders and related names are trademarks of their respective owners.*
