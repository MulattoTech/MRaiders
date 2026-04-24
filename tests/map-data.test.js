const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  sanitizeSpawn,
  loadMapFile,
  loadAllMapData
} = require('../lib/map-data');
const { MAPS } = require('../lib/defaults');

test('sanitizeSpawn normalizes ids, labels, notes, and coordinates', () => {
  const spawn = sanitizeSpawn(
    MAPS[0],
    { x: 1.2, y: -0.2, label: '  Bridge  ', notes: '  north  ' },
    2
  );

  assert.deepEqual(spawn, {
    id: `${MAPS[0].id}-3`,
    label: 'Bridge',
    notes: 'north',
    x: 1,
    y: 0
  });
});

test('loadMapFile reports JSON errors without throwing', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arc-overlay-'));
  const badFile = path.join(tempDir, `${MAPS[0].id}_caches.json`);
  fs.writeFileSync(badFile, '{"broken":', 'utf8');

  const loadedMap = loadMapFile(tempDir, MAPS[0]);

  assert.equal(loadedMap.id, MAPS[0].id);
  assert.equal(loadedMap.spawns.length, 0);
  assert.equal(typeof loadedMap.loadError, 'string');
});

test('loadAllMapData loads every configured map file', () => {
  const dataDirectory = path.join(__dirname, '..', 'data');
  const mapCache = loadAllMapData(dataDirectory);

  assert.equal(mapCache.size, MAPS.length);
  for (const map of MAPS) {
    const loadedMap = mapCache.get(map.id);
    assert.ok(loadedMap);
    assert.equal(loadedMap.loadError, null);
    assert.ok(loadedMap.spawns.length > 0);
  }
});
