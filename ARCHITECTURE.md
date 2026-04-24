# Architecture Overview

## Main Process

`main.js` owns the overlay lifecycle:

- creates the transparent Electron window
- keeps it always on top with `screen-saver` priority
- enables click-through by default with `setIgnoreMouseEvents(true, { forward: true })`
- registers global hotkeys for `F8`, `F9`, and `F10`
- persists calibration and visibility settings through `electron-store`
- loads static map JSON files from `/data`
- exposes a minimal IPC surface to the renderer

## Window Tracking

The overlay never touches the game process. On Windows it only checks for a visible top-level window whose title contains the configured title hint, then mirrors that window's bounds.

Implementation:

- `lib/window-probe.js` runs a short PowerShell script
- `scripts/find-arc-raiders-window.ps1` calls basic `user32.dll` window APIs
- no hooks, no injection, no memory reads, no frame capture

## Renderer

`renderer.js` only draws static dots and optional labels on a transparent canvas. There is no animation loop beyond browser repaint scheduling when state changes, which keeps GPU/CPU usage very low.

## Calibration Flow

1. Launch the overlay.
2. Open the tray menu and choose **Open Calibration Panel**.
3. Update the window title hint if Arc Raiders uses a different visible caption on your system.
4. Adjust offsets and scale so the dots line up with your map reference.
5. Close the panel to return to click-through mode.

## Safe-by-Design Boundaries

- No `ReadProcessMemory`
- No process injection
- No overlay hooks into DirectX/OpenGL/Vulkan
- No radar, ESP, enemy detection, loot detection, or gameplay automation
- Static community JSON only
