const { spawn } = require('child_process');
const electronBinary = require('electron');
const {
  buildElectronArgs,
  buildElectronEnvironment
} = require('./electron-runtime');
const shouldUseXvfb = process.platform === 'linux' && !process.env.DISPLAY;
const electronArgs = buildElectronArgs(process.argv.slice(2));

const child = spawn(
  shouldUseXvfb ? 'xvfb-run' : electronBinary,
  shouldUseXvfb ? ['-a', electronBinary, ...electronArgs] : electronArgs,
  {
    env: buildElectronEnvironment(),
    stdio: 'inherit'
  }
);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code || 0);
});
