#!/usr/bin/env bash
set -euo pipefail

if ! command -v xvfb-run >/dev/null 2>&1 || ! dpkg -s libnspr4 >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y \
    xvfb \
    libnspr4 \
    libnss3 \
    libgtk-3-0 \
    libasound2 \
    libxss1 \
    libgbm1 \
    libatk-bridge2.0-0 \
    libdrm2
fi

npm install

if [ -f node_modules/electron/dist/chrome-sandbox ]; then
  sudo chown root:root node_modules/electron/dist/chrome-sandbox
  sudo chmod 4755 node_modules/electron/dist/chrome-sandbox
fi
