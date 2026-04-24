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
  shell
} = require('electron');
const windowStateKeeper = require('electron-window-state');
const {
  MAPS,
  MAPS_BY_ID,
  SETTINGS_SCHEMA,
  buildInitialSettings,
  sanitizeSettings
} = require('./lib/defaults');
const { getArcRaidersWindow } = require('./lib/window-probe');

const APP_ID = 'com.openai.arc-raiders-static-cache-overlay';
const DATA_DIRECTORY = path.join(__dirname, 'data');
const TRACKING_INTERVAL_MS = 2500;
const HOTKEYS = {
  toggleVisibility: 'F8',
  cycleMap: 'F9',
  reloadData: 'F10'
};

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
let tray = null;
let store = null;
let mapCache = new Map();
let calibrationMode = false;
let trackedWindow = null;
let trackerTimer = null;
let lastBroadcastSignature = '';

async function createStore() {
  const { default: Store } = await import('electron-store');

  store = new Store({
    name: 'overlay-settings',
    schema: SETTINGS_SCHEMA,
    defaults: buildInitialSettings(__dirname)
  });
}

function getSettings() {
  return sanitizeSettings(store ? store.store : buildInitialSettings(__dirname));
}

function getActiveMapId() {
  const settings = getSettings();
  return MAPS_BY_ID[settings.activeMapId] ? settings.activeMapId : MAPS[0].id;
}

function sanitizeSpawn(map, spawn, index) {
  const x = Number(spawn.x);
  const y = Number(spawn.y);

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return {
    id: typeof spawn.id === 'string' && spawn.id.trim() ? spawn.id.trim() : `${map.id}-${index + 1}`,
    label:
      typeof spawn.label === 'string' && spawn.label.trim()
        ? spawn.label.trim()
        : `Marker ${index + 1}`,
    notes: typeof spawn.notes === 'string' ? spawn.notes.trim() : '',
    x: Math.max(0, Math.min(1, x)),
    y: Math.max(0, Math.min(1, y))
  };
}

function loadMapFile(map) {
  const filePath = path.join(DATA_DIRECTORY, `${map.id}_caches.json`);

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    const spawns = Array.isArray(parsed.spawns)
      ? parsed.spawns.map((spawn, index) => sanitizeSpawn(map, spawn, index)).filter(Boolean)
      : [];

    return {
      id: map.id,
      name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim() : map.name,
      description:
        typeof parsed.description === 'string' && parsed.description.trim()
          ? parsed.description.trim()
          : map.description,
      accentColor:
        typeof parsed.accentColor === 'string' && parsed.accentColor.trim()
          ? parsed.accentColor.trim()
          : map.accentColor,
      updatedAt:
        typeof parsed.updatedAt === 'string' && parsed.updatedAt.trim() ? parsed.updatedAt.trim() : null,
      source:
        typeof parsed.source === 'string' && parsed.source.trim()
          ? parsed.source.trim()
          : 'Static community reference points',
      spawns,
      loadError: null
    };
  } catch (error) {
    return {
      id: map.id,
      name: map.name,
      description: map.description,
      accentColor: map.accentColor,
      updatedAt: null,
      source: 'Unavailable',
      spawns: [],
      loadError: error.message
    };
  }
}

function loadMapData() {
  const nextMapCache = new Map();

  for (const map of MAPS) {
    nextMapCache.set(map.id, loadMapFile(map));
  }

  mapCache = nextMapCache;
}

function buildOverlayState() {
  const settings = getSettings();
  const activeMapId = getActiveMapId();
  const activeMap = mapCache.get(activeMapId) || loadMapFile(MAPS_BY_ID[activeMapId]);

  return {
    settings,
    maps: MAPS.map((map) => ({
      ...map,
      markerCount: mapCache.get(map.id)?.spawns.length ?? 0
    })),
    activeMap,
    status: {
      calibrationMode,
      visible: settings.visible,
      followGameWindow: settings.followGameWindow,
      gameWindowTitle: settings.windowTitleHint,
      trackedWindow,
      trackingMessage: getTrackingMessage(settings),
      dataDirectory: DATA_DIRECTORY
    }
  };
}

function getTrackingMessage(settings) {
  const titleHint = settings.windowTitleHint || 'Arc Raiders';

  if (calibrationMode) {
    return `Calibration mode is open. Close the panel to reattach using "${titleHint}".`;
  }

  if (!settings.followGameWindow) {
    return 'Auto-follow is disabled. Using the saved overlay bounds.';
  }

  if (trackedWindow) {
    return `Following "${trackedWindow.title}" at ${trackedWindow.width}x${trackedWindow.height}.`;
  }

  return `Waiting for a visible window title containing "${titleHint}".`;
}

function refreshTray() {
  if (!tray) {
    return;
  }

  const settings = getSettings();
  const activeMapId = getActiveMapId();
  const activeMap = MAPS_BY_ID[activeMapId];
  const trackingLabel = trackedWindow
    ? `Tracking: ${trackedWindow.title}`
    : settings.followGameWindow
      ? `Tracking: waiting for ${settings.windowTitleHint}`
      : 'Tracking: manual positioning';

  tray.setToolTip(`Arc Raiders Cache Overlay\n${activeMap.name}\n${trackingLabel}`);
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
      { type: 'separator' },
      {
        label: settings.visible ? `Hide Overlay (${HOTKEYS.toggleVisibility})` : `Show Overlay (${HOTKEYS.toggleVisibility})`,
        click: () => setOverlayVisibility(!getSettings().visible)
      },
      {
        label: calibrationMode ? 'Close Calibration Panel' : 'Open Calibration Panel',
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
          checked: map.id === activeMapId,
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

function broadcastState(force = false) {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    return;
  }

  const state = buildOverlayState();
  const signature = JSON.stringify({
    settings: state.settings,
    activeMapId: state.activeMap.id,
    markerCounts: state.maps.map((map) => map.markerCount),
    trackedWindow: state.status.trackedWindow,
    calibrationMode: state.status.calibrationMode
  });

  if (!force && signature === lastBroadcastSignature) {
    return;
  }

  lastBroadcastSignature = signature;
  refreshTray();
  overlayWindow.webContents.send('overlay:state', state);
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
    overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

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

  if (calibrationMode && !getSettings().visible) {
    if (store) {
      store.set('visible', true);
    }
  }

  applyInteractivityMode();
  broadcastState(true);

  if (!calibrationMode) {
    void refreshTrackedWindow(true);
  }

  return calibrationMode;
}

function cycleMap() {
  const activeMapId = getActiveMapId();
  const currentIndex = MAPS.findIndex((map) => map.id === activeMapId);
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % MAPS.length : 0;

  return updateSettings({ activeMapId: MAPS[nextIndex].id });
}

async function reloadData() {
  loadMapData();
  broadcastState(true);
  return buildOverlayState();
}

async function updateSettings(partial) {
  if (!store) {
    return buildOverlayState();
  }

  const previousSettings = getSettings();
  const merged = sanitizeSettings({ ...previousSettings, ...partial });

  for (const [key, value] of Object.entries(partial)) {
    if (Object.prototype.hasOwnProperty.call(merged, key)) {
      store.set(key, merged[key]);
    }
  }

  if (Object.prototype.hasOwnProperty.call(partial, 'visible')) {
    setOverlayVisibility(merged.visible);
  } else {
    broadcastState(true);
  }

  if (
    Object.prototype.hasOwnProperty.call(partial, 'followGameWindow') &&
    merged.followGameWindow
  ) {
    await refreshTrackedWindow(true);
  }

  if (
    Object.prototype.hasOwnProperty.call(partial, 'windowTitleHint') &&
    merged.followGameWindow
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

  return buildOverlayState();
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

  return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
}

function createTray() {
  tray = new Tray(createTrayIcon());
  tray.on('double-click', () => {
    setCalibrationMode(!calibrationMode);
  });
  refreshTray();
}

function registerShortcuts() {
  const shortcutHandlers = [
    [HOTKEYS.toggleVisibility, () => setOverlayVisibility(!getSettings().visible)],
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

  if (calibrationMode || !settings.followGameWindow) {
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
  stopTrackingLoop();
  void refreshTrackedWindow(true);
  trackerTimer = setInterval(() => {
    void refreshTrackedWindow();
  }, TRACKING_INTERVAL_MS);
}

function stopTrackingLoop() {
  if (trackerTimer) {
    clearInterval(trackerTimer);
    trackerTimer = null;
  }
}

function createOverlayWindow() {
  const primaryDisplayDefaults = windowStateKeeper({
    defaultWidth: 1600,
    defaultHeight: 900,
    file: 'overlay-window-state.json'
  });

  overlayWindow = new BrowserWindow({
    title: 'First Wave Cache Overlay',
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
      devTools: true
    }
  });

  primaryDisplayDefaults.manage(overlayWindow);
  overlayWindow.setMenuBarVisibility(false);
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  overlayWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  overlayWindow.loadFile(path.join(__dirname, 'index.html'));

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
    void refreshTrackedWindow(true);
  });
}

ipcMain.handle('overlay:get-bootstrap', () => buildOverlayState());
ipcMain.handle('overlay:update-settings', async (_event, partial) => updateSettings(partial));
ipcMain.handle('overlay:toggle-panel', async (_event, nextMode) => {
  setCalibrationMode(nextMode);
  return buildOverlayState();
});
ipcMain.handle('overlay:reset-calibration', async () => {
  await updateSettings({
    xOffset: 0,
    yOffset: 0,
    scaleX: 1,
    scaleY: 1
  });
  return buildOverlayState();
});
ipcMain.handle('overlay:cycle-map', async () => cycleMap());
ipcMain.handle('overlay:reload-data', async () => reloadData());
ipcMain.handle('overlay:set-visibility', async (_event, nextVisible) => {
  setOverlayVisibility(nextVisible);
  return buildOverlayState();
});

app.whenReady().then(async () => {
  await createStore();
  loadMapData();
  createOverlayWindow();
  createTray();
  registerShortcuts();
  startTrackingLoop();
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
    return;
  }

  setOverlayVisibility(true);
  setCalibrationMode(true);
});
