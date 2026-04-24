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

## Dev container rebuild policy

This project runs in GitHub Codespaces.

Avoid interrupting active development with unnecessary dev container rebuilds.

Only modify `.devcontainer/`, `devcontainer.json`, Dockerfiles, Codespaces features, or container-level setup when the change is truly needed for repeatable project setup, missing system dependencies, browser automation dependencies, build tooling, test tooling, or long-term developer environment stability.

Prefer this order:

1. First install or test tools in the current Codespace session when possible.
2. If the tool/dependency is clearly required long-term, then persist it into `.devcontainer/devcontainer.json`, a Dockerfile, or a setup script.
3. Batch dev container changes together instead of making many small rebuild-triggering edits.
4. Do not request or trigger a rebuild in the middle of active work unless the current task cannot continue without it.
5. Before requesting a rebuild:
   - save all files,
   - run any safe checks that do not require the rebuild,
   - commit completed work if appropriate,
   - write a short note explaining why the rebuild is required.
6. If a rebuild can wait, continue working and leave a note in `DEVCONTAINER_REBUILD_REQUIRED.md`.

When a rebuild is required, create or update `DEVCONTAINER_REBUILD_REQUIRED.md` with:

- why the rebuild is needed,
- which file changed,
- what the rebuild will enable,
- whether it is required now or can wait,
- what command/check should be run after rebuild.

Do not ask the user to rebuild unless the rebuild is needed now.

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
