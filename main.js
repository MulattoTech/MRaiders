const fs = require('fs');
const path = require('path');
const {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Menu,
  Tray,
  nativeImage,
  screen,
  shell
} = require('electron');
const windowStateKeeper = require('electron-window-state');
const {
  MAPS,
  SETTINGS_SCHEMA,
  buildInitialSettings,
  sanitizeSettings
} = require('./lib/defaults');
const { loadAllMapData } = require('./lib/map-data');
const { buildOverlayState, getActiveMapId } = require('./lib/overlay-state');
const { getArcRaidersWindow } = require('./lib/window-probe');

const APP_ID = 'com.openai.arc-raiders-static-cache-overlay';
const DATA_DIRECTORY = path.join(__dirname, 'data');
const TRACKING_INTERVAL_MS = 2500;
const HOTKEYS = {
  toggleVisibility: 'F8',
  cycleMap: 'F9',
  reloadData: 'F10'
};
const IS_SMOKE_TEST = process.env.ARC_OVERLAY_SMOKE === '1';

if (IS_SMOKE_TEST) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('disable-dev-shm-usage');
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

app.setAppUserModelId(APP_ID);
app.on('second-instance', () => {
  if (!overlayWindow) {
    return;
  }

  setOverlayVisibility(true);
  setCalibrationMode(true);
});

let overlayWindow = null;
let companionWindow = null;
let tray = null;
let store = null;
let mapCache = new Map();
let calibrationMode = false;
let trackedWindow = null;
let trackerTimer = null;
let isQuitting = false;
let lastBroadcastSignatures = {
  overlay: '',
  companion: ''
};

async function createStore() {
  const { default: Store } = await import('electron-store');

  store = new Store({
    name: 'overlay-settings',
    schema: SETTINGS_SCHEMA,
    defaults: buildInitialSettings(__dirname)
  });
}

function getSettings() {
  return sanitizeSettings(
    store ? store.store : buildInitialSettings(__dirname)
  );
}

function loadMapData() {
  mapCache = loadAllMapData(DATA_DIRECTORY);
}

function getStatePayload(windowRole) {
  return buildOverlayState({
    settings: getSettings(),
    mapCache,
    calibrationMode,
    trackedWindow,
    dataDirectory: DATA_DIRECTORY,
    hotkeys: HOTKEYS,
    platform: process.platform,
    windowRole,
    displayCount: screen.getAllDisplays().length
  });
}

function getActiveMap(settings = getSettings()) {
  return MAPS.find((map) => map.id === getActiveMapId(settings)) || MAPS[0];
}

function refreshTray() {
  if (!tray) {
    return;
  }

  const settings = getSettings();
  const activeMap = getActiveMap(settings);
  const trackingLabel = trackedWindow
    ? `Overlay tracking: ${trackedWindow.title}`
    : settings.followGameWindow
      ? `Overlay tracking: waiting for ${settings.windowTitleHint}`
      : 'Overlay tracking: manual positioning';
  const viewLabel = [
    settings.visible ? 'game overlay on' : 'game overlay off',
    settings.companionVisible ? 'second monitor on' : 'second monitor off'
  ].join(' · ');

  tray.setToolTip(
    `Arc Raiders Cache Companion\n${activeMap.name}\n${trackingLabel}\n${viewLabel}`
  );
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: `${activeMap.name} (${mapCache.get(activeMap.id)?.spawns.length ?? 0} markers)`,
        enabled: false
      },
      {
        label: trackingLabel,
        enabled: false
      },
      {
        label: `Views: ${viewLabel}`,
        enabled: false
      },
      { type: 'separator' },
      {
        label: settings.visible
          ? `Hide Game Overlay (${HOTKEYS.toggleVisibility})`
          : `Show Game Overlay (${HOTKEYS.toggleVisibility})`,
        click: () => setOverlayVisibility(!getSettings().visible)
      },
      {
        label: settings.companionVisible
          ? 'Hide Second Monitor View'
          : 'Show Second Monitor View',
        click: () => setCompanionVisibility(!getSettings().companionVisible)
      },
      {
        label: calibrationMode
          ? 'Close Calibration Panel'
          : 'Open Calibration Panel',
        click: () => setCalibrationMode(!calibrationMode)
      },
      {
        label: `Cycle Map Layer (${HOTKEYS.cycleMap})`,
        click: () => cycleMap()
      },
      {
        label: `Reload Data (${HOTKEYS.reloadData})`,
        click: async () => {
          await reloadData();
        }
      },
      {
        label: 'Follow Matching Game Window',
        type: 'checkbox',
        checked: settings.followGameWindow,
        click: async (menuItem) => {
          await updateSettings({ followGameWindow: menuItem.checked });
        }
      },
      {
        label: 'Map Layer',
        submenu: MAPS.map((map) => ({
          label: map.name,
          type: 'radio',
          checked: map.id === activeMap.id,
          click: async () => {
            await updateSettings({ activeMapId: map.id });
          }
        }))
      },
      { type: 'separator' },
      {
        label: 'Open Data Folder',
        click: () => {
          shell.openPath(DATA_DIRECTORY);
        }
      },
      {
        label: 'Quit',
        click: () => {
          app.quit();
        }
      }
    ])
  );
}

function broadcastWindowState(window, windowRole, force = false) {
  if (!window || window.isDestroyed()) {
    return;
  }

  const state = getStatePayload(windowRole);
  const signature = JSON.stringify({
    settings: state.settings,
    activeMapId: state.activeMap.id,
    markerCounts: state.maps.map((map) => map.markerCount),
    trackedWindow: state.status.trackedWindow,
    calibrationMode: state.status.calibrationMode,
    currentWindowVisible: state.status.currentWindowVisible,
    windowRole
  });

  if (!force && signature === lastBroadcastSignatures[windowRole]) {
    return;
  }

  lastBroadcastSignatures[windowRole] = signature;
  window.webContents.send('overlay:state', state);
}

function broadcastState(force = false) {
  refreshTray();
  broadcastWindowState(overlayWindow, 'overlay', force);
  broadcastWindowState(companionWindow, 'companion', force);
}

function setOverlayVisibility(nextVisible) {
  const visible = Boolean(nextVisible);

  if (store) {
    store.set('visible', visible);
  }

  if (!overlayWindow || overlayWindow.isDestroyed()) {
    return visible;
  }

  if (!visible) {
    calibrationMode = false;
    overlayWindow.hide();
  } else {
    overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    overlayWindow.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true
    });

    if (calibrationMode) {
      overlayWindow.show();
      overlayWindow.focus();
    } else {
      overlayWindow.showInactive();
      overlayWindow.blur();
    }
  }

  applyInteractivityMode();
  broadcastState(true);
  return visible;
}

function setCompanionVisibility(nextVisible) {
  const visible = Boolean(nextVisible);

  if (store) {
    store.set('companionVisible', visible);
  }

  if (!companionWindow || companionWindow.isDestroyed()) {
    return visible;
  }

  if (!visible) {
    companionWindow.hide();
  } else {
    companionWindow.show();
    companionWindow.focus();
  }

  broadcastState(true);
  return visible;
}

function applyInteractivityMode() {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    return;
  }

  const { visible } = getSettings();

  overlayWindow.setFocusable(calibrationMode);
  overlayWindow.setIgnoreMouseEvents(!calibrationMode, { forward: true });
  overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  if (!visible) {
    return;
  }

  if (calibrationMode) {
    overlayWindow.show();
    overlayWindow.focus();
  } else {
    overlayWindow.showInactive();
    overlayWindow.blur();
  }
}

function setCalibrationMode(nextMode) {
  calibrationMode = Boolean(nextMode);

  if (calibrationMode && !getSettings().visible && store) {
    store.set('visible', true);
  }

  applyInteractivityMode();
  broadcastState(true);

  if (!calibrationMode) {
    void refreshTrackedWindow(true);
  }

  return calibrationMode;
}

function cycleMap() {
  const activeMapId = getActiveMapId(getSettings());
  const currentIndex = MAPS.findIndex((map) => map.id === activeMapId);
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % MAPS.length : 0;

  return updateSettings({ activeMapId: MAPS[nextIndex].id });
}

async function reloadData() {
  loadMapData();
  broadcastState(true);
  return getStatePayload('overlay');
}

async function updateSettings(partial) {
  if (!store) {
    return getStatePayload('overlay');
  }

  const merged = sanitizeSettings({ ...getSettings(), ...partial });

  for (const key of Object.keys(partial)) {
    if (Object.prototype.hasOwnProperty.call(merged, key)) {
      store.set(key, merged[key]);
    }
  }

  if (Object.prototype.hasOwnProperty.call(partial, 'visible')) {
    setOverlayVisibility(merged.visible);
  }

  if (Object.prototype.hasOwnProperty.call(partial, 'companionVisible')) {
    setCompanionVisibility(merged.companionVisible);
  }

  if (
    (Object.prototype.hasOwnProperty.call(partial, 'followGameWindow') &&
      merged.followGameWindow) ||
    (Object.prototype.hasOwnProperty.call(partial, 'windowTitleHint') &&
      merged.followGameWindow)
  ) {
    await refreshTrackedWindow(true);
  }

  if (
    Object.prototype.hasOwnProperty.call(partial, 'followGameWindow') &&
    !merged.followGameWindow
  ) {
    trackedWindow = null;
    broadcastState(true);
  }

  if (
    !Object.prototype.hasOwnProperty.call(partial, 'visible') &&
    !Object.prototype.hasOwnProperty.call(partial, 'companionVisible')
  ) {
    broadcastState(true);
  }

  return getStatePayload('overlay');
}

function nudgeCalibration(delta) {
  const settings = getSettings();

  return updateSettings({
    xOffset: settings.xOffset + Number(delta?.xOffset || 0),
    yOffset: settings.yOffset + Number(delta?.yOffset || 0)
  });
}

function canCreateTray() {
  if (IS_SMOKE_TEST) {
    return false;
  }

  if (process.platform !== 'linux') {
    return true;
  }

  return Boolean(
    process.env.XDG_CURRENT_DESKTOP || process.env.DESKTOP_SESSION
  );
}

function createTrayIcon() {
  const assetIconPath = path.join(__dirname, 'assets', 'app-icon.svg');

  if (fs.existsSync(assetIconPath)) {
    const assetIcon = nativeImage.createFromPath(assetIconPath);
    if (!assetIcon.isEmpty()) {
      return assetIcon;
    }
  }

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <rect width="64" height="64" rx="14" fill="#10151f"/>
      <circle cx="32" cy="32" r="18" fill="#ff7b57" opacity="0.9"/>
      <circle cx="32" cy="32" r="8" fill="#f4efe3"/>
      <path d="M32 10v10M32 44v10M10 32h10M44 32h10" stroke="#f4efe3" stroke-width="4" stroke-linecap="round"/>
    </svg>
  `.trim();

  return nativeImage.createFromDataURL(
    `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
  );
}

function createTray() {
  if (!canCreateTray()) {
    return;
  }

  tray = new Tray(createTrayIcon());
  tray.on('double-click', () => {
    setCalibrationMode(!calibrationMode);
  });
  refreshTray();
}

function registerShortcuts() {
  if (IS_SMOKE_TEST) {
    return;
  }

  const shortcutHandlers = [
    [
      HOTKEYS.toggleVisibility,
      () => setOverlayVisibility(!getSettings().visible)
    ],
    [HOTKEYS.cycleMap, () => cycleMap()],
    [HOTKEYS.reloadData, () => reloadData()]
  ];

  for (const [accelerator, handler] of shortcutHandlers) {
    if (!globalShortcut.register(accelerator, handler)) {
      console.warn(`Failed to register global shortcut: ${accelerator}`);
    }
  }
}

async function refreshTrackedWindow(force = false) {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    return;
  }

  const settings = getSettings();
  const previousTrackedWindow = trackedWindow;

  if (
    calibrationMode ||
    !settings.followGameWindow ||
    process.platform !== 'win32'
  ) {
    trackedWindow = null;

    if (force || previousTrackedWindow) {
      broadcastState(true);
    }

    return;
  }

  const nextTrackedWindow = await getArcRaidersWindow(settings.windowTitleHint);
  trackedWindow = nextTrackedWindow;

  if (nextTrackedWindow) {
    const nextBounds = {
      x: nextTrackedWindow.x,
      y: nextTrackedWindow.y,
      width: nextTrackedWindow.width,
      height: nextTrackedWindow.height
    };
    const currentBounds = overlayWindow.getBounds();
    const boundsChanged =
      currentBounds.x !== nextBounds.x ||
      currentBounds.y !== nextBounds.y ||
      currentBounds.width !== nextBounds.width ||
      currentBounds.height !== nextBounds.height;

    if (force || boundsChanged) {
      overlayWindow.setBounds(nextBounds, false);
      overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1);
      if (settings.visible) {
        overlayWindow.showInactive();
      }
    }
  }

  const trackingChanged =
    JSON.stringify(previousTrackedWindow) !== JSON.stringify(nextTrackedWindow);

  if (force || trackingChanged) {
    broadcastState(true);
  }
}

function startTrackingLoop() {
  if (trackerTimer || IS_SMOKE_TEST) {
    return;
  }

  trackerTimer = setInterval(() => {
    void refreshTrackedWindow(false);
  }, TRACKING_INTERVAL_MS);
}

function stopTrackingLoop() {
  if (trackerTimer) {
    clearInterval(trackerTimer);
    trackerTimer = null;
  }
}

function getCompanionDefaultBounds() {
  const displays = screen.getAllDisplays();
  const preferredDisplay = displays[1] || displays[0];
  const workArea = preferredDisplay.workArea || preferredDisplay.bounds;
  const width = Math.max(900, Math.min(1600, workArea.width - 80));
  const height = Math.max(600, Math.min(1000, workArea.height - 80));

  return {
    x: workArea.x + 40,
    y: workArea.y + 40,
    width,
    height
  };
}

function createOverlayWindow() {
  const primaryDisplayDefaults = windowStateKeeper({
    defaultWidth: 1600,
    defaultHeight: 900,
    file: 'overlay-window-state.json'
  });

  overlayWindow = new BrowserWindow({
    title: 'Arc Raiders Game Overlay',
    x: primaryDisplayDefaults.x,
    y: primaryDisplayDefaults.y,
    width: primaryDisplayDefaults.width,
    height: primaryDisplayDefaults.height,
    show: false,
    transparent: true,
    frame: false,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    fullscreenable: false,
    focusable: false,
    resizable: true,
    movable: true,
    skipTaskbar: true,
    thickFrame: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      devTools: !IS_SMOKE_TEST
    }
  });

  primaryDisplayDefaults.manage(overlayWindow);
  overlayWindow.setMenuBarVisibility(false);
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  overlayWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  overlayWindow.loadFile(path.join(__dirname, 'index.html'), {
    query: { display: 'overlay' }
  });

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });

  overlayWindow.on('focus', () => {
    if (!calibrationMode && overlayWindow) {
      overlayWindow.blur();
    }
  });

  overlayWindow.webContents.on('did-finish-load', () => {
    applyInteractivityMode();

    if (getSettings().visible) {
      overlayWindow.showInactive();
    }

    broadcastState(true);

    if (IS_SMOKE_TEST) {
      setTimeout(() => {
        app.quit();
      }, 1200);
      return;
    }

    void refreshTrackedWindow(true);
  });
}

function createCompanionWindow() {
  const defaultBounds = getCompanionDefaultBounds();
  const companionWindowState = windowStateKeeper({
    defaultWidth: defaultBounds.width,
    defaultHeight: defaultBounds.height,
    file: 'companion-window-state.json'
  });

  companionWindow = new BrowserWindow({
    title: 'Arc Raiders Second Monitor View',
    x: Number.isFinite(companionWindowState.x)
      ? companionWindowState.x
      : defaultBounds.x,
    y: Number.isFinite(companionWindowState.y)
      ? companionWindowState.y
      : defaultBounds.y,
    width: companionWindowState.width,
    height: companionWindowState.height,
    show: false,
    transparent: false,
    frame: true,
    backgroundColor: '#0b1220',
    alwaysOnTop: false,
    fullscreenable: true,
    focusable: true,
    resizable: true,
    movable: true,
    skipTaskbar: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      devTools: !IS_SMOKE_TEST
    }
  });

  companionWindowState.manage(companionWindow);
  companionWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  companionWindow.loadFile(path.join(__dirname, 'index.html'), {
    query: { display: 'companion' }
  });

  companionWindow.on('close', (event) => {
    if (isQuitting || companionWindow?.isDestroyed()) {
      return;
    }

    event.preventDefault();
    setCompanionVisibility(false);
  });

  companionWindow.on('closed', () => {
    companionWindow = null;
  });

  companionWindow.webContents.on('did-finish-load', () => {
    if (getSettings().companionVisible) {
      companionWindow.show();
    }

    broadcastState(true);
  });
}

function getSenderRole(webContents) {
  return webContents === companionWindow?.webContents ? 'companion' : 'overlay';
}

ipcMain.handle('overlay:get-bootstrap', (event) =>
  getStatePayload(getSenderRole(event.sender))
);
ipcMain.handle('overlay:update-settings', async (event, partial) => {
  await updateSettings(partial);
  return getStatePayload(getSenderRole(event.sender));
});
ipcMain.handle('overlay:toggle-panel', async (event, nextMode) => {
  setCalibrationMode(nextMode);
  return getStatePayload(getSenderRole(event.sender));
});
ipcMain.handle('overlay:reset-calibration', async (event) => {
  await updateSettings({
    xOffset: 0,
    yOffset: 0,
    scaleX: 1,
    scaleY: 1
  });
  return getStatePayload(getSenderRole(event.sender));
});
ipcMain.handle('overlay:nudge-calibration', async (event, delta) => {
  await nudgeCalibration(delta);
  return getStatePayload(getSenderRole(event.sender));
});
ipcMain.handle('overlay:cycle-map', async (event) => {
  await cycleMap();
  return getStatePayload(getSenderRole(event.sender));
});
ipcMain.handle('overlay:reload-data', async (event) => {
  await reloadData();
  return getStatePayload(getSenderRole(event.sender));
});
ipcMain.handle('overlay:set-visibility', async (event, nextVisible) => {
  setOverlayVisibility(nextVisible);
  return getStatePayload(getSenderRole(event.sender));
});

app.whenReady().then(async () => {
  await createStore();
  loadMapData();
  createOverlayWindow();
  createCompanionWindow();
  createTray();
  registerShortcuts();
  startTrackingLoop();
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  stopTrackingLoop();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (!overlayWindow) {
    createOverlayWindow();
  }

  if (!companionWindow) {
    createCompanionWindow();
  }

  setOverlayVisibility(true);
  setCalibrationMode(true);
});
