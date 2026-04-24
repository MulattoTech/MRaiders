const { MAPS, MAPS_BY_ID } = require('./defaults');

function getActiveMapId(settings) {
  return MAPS_BY_ID[settings.activeMapId] ? settings.activeMapId : MAPS[0].id;
}

function buildOverlayState({
  settings,
  mapCache,
  calibrationMode,
  trackedWindow,
  dataDirectory,
  hotkeys,
  platform,
  windowRole,
  displayCount
}) {
  const activeMapId = getActiveMapId(settings);
  const activeMap =
    mapCache.get(activeMapId) || buildUnavailableMap(MAPS_BY_ID[activeMapId]);
  const currentWindowVisible =
    windowRole === 'companion' ? settings.companionVisible : settings.visible;

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
      overlayVisible: settings.visible,
      companionVisible: settings.companionVisible,
      currentWindowVisible,
      followGameWindow: settings.followGameWindow,
      gameWindowTitle: settings.windowTitleHint,
      trackedWindow,
      windowRole,
      windowLabel:
        windowRole === 'companion' ? 'Second Monitor View' : 'Game Overlay',
      displayCount,
      multipleDisplaysAvailable: displayCount > 1,
      trackingMessage: getTrackingMessage({
        settings,
        trackedWindow,
        calibrationMode,
        platform
      }),
      companionMessage: getCompanionMessage({ displayCount }),
      supportsWindowTracking: platform === 'win32',
      dataDirectory,
      hotkeys
    }
  };
}

function getTrackingMessage({
  settings,
  trackedWindow,
  calibrationMode,
  platform
}) {
  const titleHint = settings.windowTitleHint || 'Arc Raiders';

  if (calibrationMode) {
    return `Calibration mode is open. Close the panel to reattach using "${titleHint}".`;
  }

  if (!settings.followGameWindow) {
    return 'Auto-follow is disabled. Using the saved overlay bounds.';
  }

  if (platform !== 'win32') {
    return 'Auto-follow window tracking is only available on Windows. Use Codespaces for development and validate tracking on a local Windows machine.';
  }

  if (trackedWindow) {
    return `Following "${trackedWindow.title}" at ${trackedWindow.width}x${trackedWindow.height}.`;
  }

  return `Waiting for a visible window title containing "${titleHint}".`;
}

function getCompanionMessage({ displayCount }) {
  if (displayCount > 1) {
    return 'Multiple displays detected. Move the second monitor window to the display you want to use for the companion view.';
  }

  return 'Only one display is currently detected. You can still open the second monitor window now and move it later when another display is connected.';
}

function buildUnavailableMap(map) {
  return {
    id: map.id,
    name: map.name,
    description: map.description,
    accentColor: map.accentColor,
    updatedAt: null,
    source: 'Unavailable',
    spawns: [],
    loadError: 'Map data is not loaded yet.'
  };
}

module.exports = {
  buildOverlayState,
  getActiveMapId,
  getCompanionMessage,
  getTrackingMessage
};
