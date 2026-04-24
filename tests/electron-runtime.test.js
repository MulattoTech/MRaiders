const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildElectronArgs,
  buildElectronEnvironment,
  CONTAINER_FLAGS
} = require('../scripts/electron-runtime');

test('buildElectronArgs adds container flags in Codespaces on Linux', () => {
  const args = buildElectronArgs(['.'], { CODESPACES: 'true' }, 'linux');

  assert.deepEqual(args, [...CONTAINER_FLAGS, '.']);
});

test('buildElectronEnvironment strips ELECTRON_RUN_AS_NODE', () => {
  const env = buildElectronEnvironment(
    { ELECTRON_RUN_AS_NODE: '1', PATH: '/tmp/bin' },
    { ARC_OVERLAY_SMOKE: '1' }
  );

  assert.equal(env.ELECTRON_RUN_AS_NODE, undefined);
  assert.equal(env.PATH, '/tmp/bin');
  assert.equal(env.ARC_OVERLAY_SMOKE, '1');
});
