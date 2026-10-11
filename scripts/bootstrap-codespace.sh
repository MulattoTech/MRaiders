#!/usr/bin/env bash
set -euo pipefail

# Qt 6.4 API baseline in Debian bookworm; distribution packages are intentionally
# separate from the Qt 6.12 Windows runtime used by release packaging.
sudo apt-get update
sudo apt-get install -y --no-install-recommends \
  cmake ninja-build build-essential \
  qt6-base-dev qt6-base-dev-tools libgl1-mesa-dev xvfb

cmake -S . -B build -G Ninja -DCMAKE_BUILD_TYPE=Debug
printf '\nMRaiders cloud workspace prepared. Run: cmake --build build && ctest --test-dir build --output-on-failure\n'

# Legacy Electron is opt-in; do not download its packages in a native workspace.
if [[ "${MRAIDERS_BOOTSTRAP_LEGACY:-0}" == "1" ]]; then
  npm ci
fi
