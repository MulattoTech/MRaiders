const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const windowStateKeeper = require('electron-window-state');

let overlayWindow;

function createOverlay() {
  const mainWindowState = windowStateKeeper({
    defaultWidth: 1920,
    defaultHeight: 1080
  });

  overlayWindow = new BrowserWindow({
    width: mainWindowState.width,
    height: mainWindowState.height,
    x: mainWindowState.x,
    y: mainWindowState.y,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    resizable: true,
    focusable: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  overlayWindow.loadFile('index.html');
  overlayWindow.setIgnoreMouseEvents(true); // click-through

  mainWindowState.manage(overlayWindow);

  // Example: detect game window (basic title check - expand with win32 if needed)
  console.log('Overlay ready. Start Arc Raiders and calibrate.');
}

app.whenReady().then(createOverlay);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC for config, hotkeys, etc.
ipcMain.on('toggle-overlay', () => {
  if (overlayWindow) overlayWindow.setIgnoreMouseEvents(!overlayWindow.isIgnoreMouseEvents());
});