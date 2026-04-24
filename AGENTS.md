# Agent Instructions

## Automation Level
- **Mode**: Full Autonomy (--full-auto)
- **Permissions**: You are authorized to autonomously use `$skill-installer` to search the official Codex Skills Gallery, NPM, WinGet, or Chocolatey, vet, and install any skills/packages required.

## Trusted Repositories & Sources
- Official Codex Skills Gallery (priority)
- NPM registry (for Electron/Node dependencies)
- Only install skills that are verified, actively maintained, and directly relevant to safe Electron overlays.

## Project Context
- **Framework**: Electron/Node.js (pure Electron transparent overlay – no Overwolf, no gelectron, no AHK)
- **Goal**: Build and maintain a lightweight, 100% safe, non-cheat Arc Raiders companion overlay that shows only possible Hurricane / First Wave Cache spawn markers using static community JSON data.
- **Core Constraints (NEVER violate)**:
  - Strictly static data only. No game memory reading, no hooks, no injection, no EAC/Anybrain triggers.
  - Transparent, always-on-top, click-through window that auto-positions over the "Arc Raiders" game window (by title).
  - Support borderless/windowed fullscreen.
  - Minimal performance impact.
- **Engineering Conventions**:
  - Modern Electron best practices (transparent + setIgnoreMouseEvents + focusable: false).
  - Modularity: separate main/renderer, config persistence, hotkeys.
  - Clean, commented code. Prioritize safety and ease of use for non-cheaters.
- **Workflow**:
  - Use existing or auto-installed skills for data parsing, UI updates, window management, and global hotkeys.
  - After any change, verify the app launches cleanly with `npm start` and works as an overlay.

## Build / Run Commands
- `npm install` → install dependencies
- `npm start` → launch the overlay
- `npm run build` → package as executable (if electron-builder is present)

## Do-Not Rules
- Never suggest or implement any form of game memory access.
- Never add real-time detection or ESP-like features.
- Never use deprecated or high-risk libraries.

## Definition of Done
- Full project structure is present and runnable.
- Overlay is transparent, click-through, stays on top, and markers align after one-time calibration.
- Config UI + hotkeys (F8, F9, F10) work.
- All files are clean and documented.