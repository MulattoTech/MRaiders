# Setup Guide

## Requirements

- Windows desktop
- Arc Raiders running in borderless or windowed fullscreen
- Node.js and npm installed

## Install

```powershell
npm install
```

Installed packages for this project:

- `electron@41.2.1`
- `electron-store@11.0.2`
- `electron-window-state@5.0.3`

## Start

```powershell
npm start
```

## Package Later

Packaging metadata is already committed. During a later install window, install `electron-builder`, run `npm install`, then package with:

```powershell
npm run build
```

## First Launch

1. Start Arc Raiders.
2. Launch the overlay.
3. Use the tray icon to open the calibration panel.
4. Pick the right map layer.
5. If needed, set the window title hint to match the visible game caption.
6. Adjust offsets and scale until markers line up.
7. If you prefer manual placement, disable auto-follow and drag the panel header to move the overlay before resizing the window edges.
8. Press `Esc` or close the panel to return to click-through mode.
