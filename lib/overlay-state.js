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
  platform
}) {
  const activeMapId = getActiveMapId(settings);
  const activeMap =
    mapCache.get(activeMapId) || buildUnavailableMap(MAPS_BY_ID[activeMapId]);

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
      trackingMessage: getTrackingMessage({
        settings,
        trackedWindow,
        calibrationMode,
        platform
      }),
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
  getTrackingMessage
};
