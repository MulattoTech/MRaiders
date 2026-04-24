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
- `lib/window-probe.js` PowerShell wrapper for safe external window bounds lookup
- `scripts/find-arc-raiders-window.ps1` Windows top-level window probe
- `data/*.json` static community-style marker files

## Data Notes

The bundled JSON files are **starter datasets** intended to be safe, editable, and immediately usable. They are based on public community location callouts and should be treated as **possible cache candidates**, not guaranteed live spawns.

## Run

```powershell
npm install
npm start
```

Then use the tray icon to open the calibration panel and line the markers up over the Arc Raiders in-game map.

## Codespaces

This repo includes a basic `.devcontainer` so it can be opened in GitHub Codespaces for cloud-first development.

- Use Codespaces for editing, dependency installs, documentation, and general project work
- Use a local Windows machine for final Electron overlay validation
- Transparent click-through behavior, global hotkeys, and Arc Raiders window alignment should be tested locally

## Packaging

Packaging metadata is already staged in `package.json`. When you later have an install window and want to package the overlay, add `electron-builder`, run `npm install`, then use:

```powershell
npm run build
```
