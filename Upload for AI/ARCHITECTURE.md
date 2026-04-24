Tech Stack: - Electron for cross-platform transparent always-on-top
window - Native window detection via title ("Arc Raiders") - Canvas or
DOM elements for rendering markers - Static JSON data only

Safety: - Purely external overlay - No ReadProcessMemory, no hooks, no
DLL injection - You will automatically calibrate offset/scale once per
resolution

Future improvements: Add Tauri for smaller binary, or gelectron-style
injection if safe.
