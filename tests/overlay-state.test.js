const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildOverlayState,
  getTrackingMessage
} = require('../lib/overlay-state');
const { MAPS, sanitizeSettings } = require('../lib/defaults');

test('getTrackingMessage explains non-Windows tracking limitations', () => {
  const message = getTrackingMessage({
    settings: sanitizeSettings({}),
    trackedWindow: null,
    calibrationMode: false,
    platform: 'linux'
  });

  assert.match(message, /only available on Windows/i);
});

test('buildOverlayState includes marker counts and status metadata', () => {
  const mapCache = new Map([
    [
      MAPS[0].id,
      {
        ...MAPS[0],
        source: 'Test',
        updatedAt: '2026-04-24',
        spawns: [{ id: 'one', label: 'One', notes: '', x: 0.1, y: 0.2 }],
        loadError: null
      }
    ]
  ]);
  const state = buildOverlayState({
    settings: sanitizeSettings({
      activeMapId: MAPS[0].id,
      companionVisible: true
    }),
    mapCache,
    calibrationMode: false,
    trackedWindow: null,
    dataDirectory: '/tmp/data',
    hotkeys: { toggleVisibility: 'F8', cycleMap: 'F9', reloadData: 'F10' },
    platform: 'win32',
    windowRole: 'companion',
    displayCount: 2
  });

  assert.equal(state.activeMap.id, MAPS[0].id);
  assert.equal(state.maps[0].markerCount, 1);
  assert.equal(state.status.dataDirectory, '/tmp/data');
  assert.equal(state.status.hotkeys.toggleVisibility, 'F8');
  assert.equal(state.status.currentWindowVisible, true);
  assert.equal(state.status.windowRole, 'companion');
  assert.equal(state.status.windowLabel, 'Second Monitor View');
});
