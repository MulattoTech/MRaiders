# Required Skills / Packages for This Project

Checked on **April 20, 2026**.

## Codex Skills Gallery Search

- No curated Codex skill named `electron-safe-overlay` or `transparent-game-overlay` was available from the gallery listing at build time.
- The experimental gallery listing endpoint was unavailable during the check, so the overlay uses the in-repo Electron implementation instead.

## Installed NPM Packages

1. `electron@41.2.1`
   - core transparent overlay shell
2. `electron-store@11.0.2`
   - persistent settings for opacity, offsets, scale, active map, and visibility
3. `electron-window-state@5.0.3`
   - fallback position and size persistence when Arc Raiders is not detected

## Built-In Electron APIs Used Instead of Extra Packages

- `globalShortcut`
  - preferred over third-party hotkey packages for `F8`, `F9`, and `F10`
- `Tray`
  - safe settings access without needing an injected in-game control layer

## Extra Package Policy

No other NPM packages were installed. Window detection is handled by a small local PowerShell script that only reads top-level window titles and bounds.

Packaging metadata for `electron-builder` is staged in `package.json`, but the package itself was not installed during the read/edit-only pass.
