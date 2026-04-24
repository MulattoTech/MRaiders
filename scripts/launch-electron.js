const { spawn } = require('child_process');
const electronBinary = require('electron');
const {
  buildElectronArgs,
  buildElectronEnvironment
} = require('./electron-runtime');

const child = spawn(electronBinary, buildElectronArgs(process.argv.slice(2)), {
  env: buildElectronEnvironment(),
  stdio: 'inherit'
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code || 0);
});
