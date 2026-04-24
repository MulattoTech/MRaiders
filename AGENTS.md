# Agent Instructions

## Operating environment

This project is developed in GitHub Codespaces. Treat the Codespace container as the active development environment.

## Automation Level

- **Mode**: Full Autonomy (--full-auto)
- **Permissions**: You are authorized to autonomously use `$skill-installer` to search the official Codex Skills Gallery, NPM, WinGet, or Chocolatey, vet, and install any skills/packages required.
- Work autonomously. Do not ask for approval for normal development tasks such as reading files, editing files, installing dependencies, running commands, adding tests, fixing build errors, or improving configuration.
- You may install needed tools, packages, dependencies, browser drivers, linters, formatters, test frameworks, VS Code extensions, and development utilities inside the Codespace.
- You may update source code, documentation, configuration, devcontainer files, package files, test files, scripts, and project structure when it improves the project.

## Trusted Repositories & Sources

- Official Codex Skills Gallery (priority)
- NPM registry (for Electron/Node dependencies)
- Only install skills that are verified, actively maintained, and directly relevant to safe Electron overlays.

## Project Context

- **Framework**: Electron/Node.js (pure Electron transparent overlay – no Overwolf, no gelectron, no AHK)
- **Goal**: Build and maintain a lightweight, 100% safe, non-cheat ARC Raiders companion overlay that shows only possible Hurricane / First Wave Cache spawn markers using static community JSON data as well as visual confirmation for on-screen Cache spawns via undetectable AI screen image analyzation.
- **Core Constraints (NEVER violate)**:
  - Strictly non-game memory data only. No game memory reading, no hooks, no injection, no EAC/Anybrain triggers. Analyzation of the current screen view for Cache detection purposes are allowed.
  - Transparent, always-on-top, click-through window that auto-positions over the "Arc Raiders" game window (by title).
  - Support borderless/windowed fullscreen.
  - Minimal performance impact.
  - Supports a second monitor feature, which will run a live map of the player with confirmed Cache spawns based on game vision interpretation.
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
- Never use deprecated or high-risk libraries.

## Quality checks

After meaningful changes, run the most relevant available checks, such as:

- install check
- lint
- format
- typecheck
- unit tests
- integration tests
- build
- smoke test

## Blocker handling

If blocked, try at least two reasonable fixes before stopping. If still blocked, document the blocker with:

- exact command
- exact error
- what was tried
- what user action is needed
- what can still be done next
  Continue with any unblocked work.

## Definition of Done

- Full project structure is present and runnable.
- Overlay is transparent, click-through, stays on top, and markers align after one-time calibration.
- Config UI + hotkeys (F8, F9, F10) work.
- All files are clean and documented.
