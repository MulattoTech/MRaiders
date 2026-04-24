const { spawn } = require('child_process');
const path = require('path');

const electronBinary = require('electron');
const {
  buildElectronArgs,
  buildElectronEnvironment
} = require('./electron-runtime');
const projectRoot = path.join(__dirname, '..');
const electronArgs = buildElectronArgs(['.'], process.env, process.platform);

const command =
  process.platform === 'linux' && !process.env.DISPLAY
    ? 'xvfb-run'
    : electronBinary;
const args =
  command === 'xvfb-run'
    ? ['-a', electronBinary, ...electronArgs]
    : electronArgs;

const child = spawn(command, args, {
  cwd: projectRoot,
  env: buildElectronEnvironment(process.env, { ARC_OVERLAY_SMOKE: '1' }),
  stdio: ['ignore', 'pipe', 'pipe']
});

let stdout = '';
let stderr = '';

child.stdout.on('data', (chunk) => {
  stdout += chunk.toString();
});

child.stderr.on('data', (chunk) => {
  stderr += chunk.toString();
});

const timeout = setTimeout(() => {
  child.kill('SIGTERM');
}, 30000);

child.on('exit', (code, signal) => {
  clearTimeout(timeout);

  if (code === 0) {
    const output = [stdout.trim(), stderr.trim()].filter(Boolean).join('\n');
    if (output) {
      console.log(output);
    }
    return;
  }

  if (stdout.trim()) {
    console.error(stdout.trim());
  }

  if (stderr.trim()) {
    console.error(stderr.trim());
  }

  const reason = signal ? `signal ${signal}` : `exit code ${code}`;
  console.error(`Smoke test failed with ${reason}.`);
  process.exit(code || 1);
});
