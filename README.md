# Arc Raiders Hurricane / First Wave Cache Overlay

This project is a lightweight Electron companion overlay for **Arc Raiders** that shows only **static, community-style cache candidate markers**. It does **not** read memory, hook the game, inject code, scrape packets, or do any real-time detection.

## Safety Model

- Transparent external overlay only
- Title-based window alignment only
- Static JSON data loaded from `/data`
- No process memory access
- No DLL injection or graphics hooks
- Intended for borderless and windowed fullscreen use

## Features

- Transparent, click-through, always-on-top overlay window
- Auto-follow for a visible matching Arc Raiders game window on Windows
- Configurable window-title hint if the game caption differs on your setup
- Searchable marker directory with notes and coordinate references inside the calibration panel
- Keyboard calibration nudging with arrow keys and `Shift` for larger steps
- Global hotkeys:
  - `F8` toggle overlay visibility
  - `F9` cycle the active map layer
  - `F10` reload JSON data from disk
- Tray menu for calibration, data reload, map switching, and quitting
- In-overlay calibration panel for:
  - opacity
  - marker size
  - X/Y offsets
  - X/Y scale
  - label visibility
  - map selection
  - editable window-title hint
  - quick close with `Esc`
- Settings persistence via `electron-store`

## Project Structure

- `main.js` Electron main process, tray, hotkeys, persistence, and title-based tracking
- `preload.js` safe IPC bridge for the renderer
- `renderer.js` lightweight marker drawing and calibration UI logic
- `styles.css` transparent overlay and panel styling
- `assets/app-icon.svg` tray and future packaging icon source
- `lib/defaults.js` shared map metadata and settings schema
- `lib/map-data.js` static JSON normalization and loading
- `lib/overlay-state.js` renderer/main shared state assembly
- `lib/window-probe.js` PowerShell wrapper for safe external window bounds lookup
- `scripts/find-arc-raiders-window.ps1` Windows top-level window probe
- `scripts/launch-electron.js` Codespaces-safe Electron launcher
- `scripts/smoke.js` headless Electron smoke check for Codespaces
- `scripts/validate-data.js` static marker data validation
- `tests/*.test.js` Node test suite for settings, data loading, and runtime helpers
- `data/*.json` static community-style marker files

## Data Notes

The bundled JSON files are **starter datasets** intended to be safe, editable, and immediately usable. They are based on public community location callouts and should be treated as **possible cache candidates**, not guaranteed live spawns.

## Run

```powershell
npm install
npm start
```

Then use the tray icon to open the calibration panel and line the markers up over the Arc Raiders in-game map.

## Checks

```powershell
npm run lint
npm test
npm run validate:data
npm run smoke
npm run build
```

- `npm run smoke` launches Electron headlessly in Codespaces with container-only compatibility flags
- `npm run build` produces a host-platform unpacked build for verification in the current environment
- `npm run build:win` creates the Windows portable build when run on a Windows-capable packaging machine

## Codespaces

This repo includes a basic `.devcontainer` so it can be opened in GitHub Codespaces for cloud-first development.

- Use Codespaces for editing, dependency installs, documentation, and general project work
- `npm start` launches Electron through a Codespaces-aware wrapper that clears `ELECTRON_RUN_AS_NODE`
- The devcontainer post-create step installs the Linux libraries Electron needs for `npm start` and `npm run smoke`
- Use a local Windows machine for final Electron overlay validation
- Transparent click-through behavior, global hotkeys, and Arc Raiders window alignment should be tested locally

## Packaging

Packaging metadata is staged in `package.json` and `electron-builder` is installed.

Use the host-platform directory build for container verification:

```powershell
npm run build
```

Use the Windows portable target for actual overlay distribution:

```powershell
npm run build:win
```
