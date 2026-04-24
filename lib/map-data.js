const fs = require('fs');
const path = require('path');
const { MAPS } = require('./defaults');

const DEFAULT_SOURCE = 'Static community reference points';

function sanitizeSpawn(map, spawn, index) {
  const x = Number(spawn?.x);
  const y = Number(spawn?.y);

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return {
    id:
      typeof spawn?.id === 'string' && spawn.id.trim()
        ? spawn.id.trim()
        : `${map.id}-${index + 1}`,
    label:
      typeof spawn?.label === 'string' && spawn.label.trim()
        ? spawn.label.trim()
        : `Marker ${index + 1}`,
    notes: typeof spawn?.notes === 'string' ? spawn.notes.trim() : '',
    x: clamp(x, 0, 1),
    y: clamp(y, 0, 1)
  };
}

function loadMapFile(dataDirectory, map) {
  const filePath = path.join(dataDirectory, `${map.id}_caches.json`);

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    const spawns = Array.isArray(parsed.spawns)
      ? parsed.spawns
          .map((spawn, index) => sanitizeSpawn(map, spawn, index))
          .filter(Boolean)
      : [];

    return {
      id: map.id,
      name:
        typeof parsed.name === 'string' && parsed.name.trim()
          ? parsed.name.trim()
          : map.name,
      description:
        typeof parsed.description === 'string' && parsed.description.trim()
          ? parsed.description.trim()
          : map.description,
      accentColor:
        typeof parsed.accentColor === 'string' && parsed.accentColor.trim()
          ? parsed.accentColor.trim()
          : map.accentColor,
      updatedAt:
        typeof parsed.updatedAt === 'string' && parsed.updatedAt.trim()
          ? parsed.updatedAt.trim()
          : null,
      source:
        typeof parsed.source === 'string' && parsed.source.trim()
          ? parsed.source.trim()
          : DEFAULT_SOURCE,
      spawns,
      filePath,
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
      filePath,
      loadError: error.message
    };
  }
}

function loadAllMapData(dataDirectory, maps = MAPS) {
  const cache = new Map();

  for (const map of maps) {
    cache.set(map.id, loadMapFile(dataDirectory, map));
  }

  return cache;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

module.exports = {
  DEFAULT_SOURCE,
  loadAllMapData,
  loadMapFile,
  sanitizeSpawn
};
