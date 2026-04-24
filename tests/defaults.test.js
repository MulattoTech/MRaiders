const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MAPS,
  buildInitialSettings,
  sanitizeSettings
} = require('../lib/defaults');

test('sanitizeSettings clamps numeric values and keeps known maps', () => {
  const settings = sanitizeSettings({
    activeMapId: MAPS[1].id,
    opacity: 99,
    markerSize: 1,
    companionVisible: true,
    xOffset: 9999,
    yOffset: -9999,
    scaleX: 5,
    scaleY: 0.1
  });

  assert.equal(settings.activeMapId, MAPS[1].id);
  assert.equal(settings.opacity, 1);
  assert.equal(settings.markerSize, 4);
  assert.equal(settings.companionVisible, true);
  assert.equal(settings.xOffset, 1500);
  assert.equal(settings.yOffset, -1500);
  assert.equal(settings.scaleX, 2.5);
  assert.equal(settings.scaleY, 0.25);
});

test('buildInitialSettings falls back to defaults when config is missing', () => {
  const settings = buildInitialSettings('/tmp/non-existent-overlay-root');

  assert.equal(settings.activeMapId, MAPS[0].id);
  assert.equal(settings.windowTitleHint, 'Arc Raiders');
  assert.equal(settings.visible, true);
  assert.equal(settings.companionVisible, false);
});
