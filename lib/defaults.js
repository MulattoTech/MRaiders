const fs = require('fs');
const path = require('path');

const MAPS = [
  {
    id: 'dam_battlegrounds',
    name: 'Dam Battlegrounds',
    accentColor: '#ff7b57',
    description:
      'Starter Hurricane and First Wave cache candidates for Dam Battlegrounds.'
  },
  {
    id: 'blue_gate',
    name: 'Blue Gate',
    accentColor: '#59c8ff',
    description:
      'Starter Hurricane and First Wave cache candidates for Blue Gate.'
  },
  {
    id: 'buried_city',
    name: 'Buried City',
    accentColor: '#f8b44c',
    description:
      'Starter Hurricane and First Wave cache candidates for Buried City.'
  },
  {
    id: 'spaceport',
    name: 'Spaceport',
    accentColor: '#96ff8f',
    description:
      'Starter Hurricane and First Wave cache candidates for Spaceport.'
  }
];

const MAPS_BY_ID = Object.fromEntries(MAPS.map((map) => [map.id, map]));

const DEFAULT_SETTINGS = {
  activeMapId: MAPS[0].id,
  opacity: 0.78,
  markerSize: 10,
  showLabels: true,
  followGameWindow: true,
  windowTitleHint: 'Arc Raiders',
  visible: true,
  xOffset: 0,
  yOffset: 0,
  scaleX: 1,
  scaleY: 1
};

const SETTINGS_SCHEMA = {
  activeMapId: {
    type: 'string',
    enum: MAPS.map((map) => map.id),
    default: DEFAULT_SETTINGS.activeMapId
  },
  opacity: {
    type: 'number',
    minimum: 0.2,
    maximum: 1,
    default: DEFAULT_SETTINGS.opacity
  },
  markerSize: {
    type: 'number',
    minimum: 4,
    maximum: 24,
    default: DEFAULT_SETTINGS.markerSize
  },
  showLabels: {
    type: 'boolean',
    default: DEFAULT_SETTINGS.showLabels
  },
  followGameWindow: {
    type: 'boolean',
    default: DEFAULT_SETTINGS.followGameWindow
  },
  windowTitleHint: {
    type: 'string',
    default: DEFAULT_SETTINGS.windowTitleHint
  },
  visible: {
    type: 'boolean',
    default: DEFAULT_SETTINGS.visible
  },
  xOffset: {
    type: 'number',
    minimum: -1500,
    maximum: 1500,
    default: DEFAULT_SETTINGS.xOffset
  },
  yOffset: {
    type: 'number',
    minimum: -1500,
    maximum: 1500,
    default: DEFAULT_SETTINGS.yOffset
  },
  scaleX: {
    type: 'number',
    minimum: 0.25,
    maximum: 2.5,
    default: DEFAULT_SETTINGS.scaleX
  },
  scaleY: {
    type: 'number',
    minimum: 0.25,
    maximum: 2.5,
    default: DEFAULT_SETTINGS.scaleY
  }
};

function loadSeedConfig(projectRoot) {
  const configPath = path.join(projectRoot, 'config.json');

  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function sanitizeSettings(input = {}) {
  const next = { ...DEFAULT_SETTINGS };

  if (typeof input.activeMapId === 'string' && MAPS_BY_ID[input.activeMapId]) {
    next.activeMapId = input.activeMapId;
  }

  if (Number.isFinite(Number(input.opacity))) {
    next.opacity = clamp(Number(input.opacity), 0.2, 1);
  }

  if (Number.isFinite(Number(input.markerSize))) {
    next.markerSize = clamp(Number(input.markerSize), 4, 24);
  }

  if (typeof input.showLabels === 'boolean') {
    next.showLabels = input.showLabels;
  }

  if (typeof input.followGameWindow === 'boolean') {
    next.followGameWindow = input.followGameWindow;
  }

  if (
    typeof input.windowTitleHint === 'string' &&
    input.windowTitleHint.trim()
  ) {
    next.windowTitleHint = input.windowTitleHint.trim().slice(0, 120);
  }

  if (typeof input.visible === 'boolean') {
    next.visible = input.visible;
  }

  if (Number.isFinite(Number(input.xOffset))) {
    next.xOffset = clamp(Number(input.xOffset), -1500, 1500);
  }

  if (Number.isFinite(Number(input.yOffset))) {
    next.yOffset = clamp(Number(input.yOffset), -1500, 1500);
  }

  if (Number.isFinite(Number(input.scaleX))) {
    next.scaleX = clamp(Number(input.scaleX), 0.25, 2.5);
  }

  if (Number.isFinite(Number(input.scaleY))) {
    next.scaleY = clamp(Number(input.scaleY), 0.25, 2.5);
  }

  return next;
}

function buildInitialSettings(projectRoot) {
  return sanitizeSettings({
    ...DEFAULT_SETTINGS,
    ...loadSeedConfig(projectRoot)
  });
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

module.exports = {
  MAPS,
  MAPS_BY_ID,
  DEFAULT_SETTINGS,
  SETTINGS_SCHEMA,
  buildInitialSettings,
  sanitizeSettings
};
