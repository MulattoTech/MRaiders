const { execFile } = require('child_process');
const path = require('path');

const SCRIPT_PATH = path.join(__dirname, '..', 'scripts', 'find-arc-raiders-window.ps1');

function getArcRaidersWindow(windowTitlePattern = 'Arc Raiders') {
  if (process.platform !== 'win32') {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      [
        '-NoLogo',
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        SCRIPT_PATH,
        '-WindowTitlePattern',
        windowTitlePattern
      ],
      {
        windowsHide: true,
        timeout: 4000,
        maxBuffer: 64 * 1024
      },
      (error, stdout) => {
        if (error) {
          resolve(null);
          return;
        }

        const trimmed = stdout.trim();

        if (!trimmed) {
          resolve(null);
          return;
        }

        try {
          const parsed = JSON.parse(trimmed);
          resolve(normalizeWindowBounds(parsed));
        } catch {
          resolve(null);
        }
      }
    );
  });
}

function normalizeWindowBounds(value) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const x = Number(value.x);
  const y = Number(value.y);
  const width = Number(value.width);
  const height = Number(value.height);

  if (![x, y, width, height].every(Number.isFinite)) {
    return null;
  }

  return {
    handle: value.handle,
    title: typeof value.title === 'string' ? value.title : 'Arc Raiders',
    x,
    y,
    width,
    height
  };
}

module.exports = {
  getArcRaidersWindow
};
