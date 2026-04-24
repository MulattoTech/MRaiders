# Overlay Calibration Guide

1. Launch **Arc Raiders** in **borderless windowed** mode.
2. Run the overlay with `npm start`.
3. Use the tray icon and choose **Open Calibration Panel**.
4. Select the matching map layer:
   - `Dam Battlegrounds`
   - `Blue Gate`
   - `Buried City`
   - `Spaceport`
5. Adjust **Scale X**, **Scale Y**, **Offset X**, and **Offset Y** until the dot markers line up with the in-game map.
6. Tune **Opacity** and **Marker Size** for readability.
7. If the overlay does not latch onto the game window, set **Window Title Hint** to the exact visible game caption.
8. If you need manual fallback, keep auto-follow off and drag the panel header to move the overlay window, then resize the frameless window edges to fit.
9. Press `Esc` or click **Close** to exit calibration mode.
10. The overlay returns to click-through mode and your settings stay saved.

## Hotkeys

- `F8` toggle overlay visibility
- `F9` cycle map layers
- `F10` reload JSON data

## Notes

- If Arc Raiders is not found, the overlay stays at its last saved size and position.
- True exclusive fullscreen is not supported. Borderless/windowed fullscreen is the intended mode.
- The overlay never reads or hooks the game process.
