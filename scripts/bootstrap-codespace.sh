#!/usr/bin/env bash
set -euo pipefail

# Reproducible and isolated native toolchain inside the Codespace container.
# Qt 6.4+ API baseline here; Windows CI uses Qt 6.12 LTS.
sudo apt-get update
sudo apt-get install -y --no-install-recommends \
  cmake ninja-build build-essential \
  qt6-base-dev qt6-base-dev-tools libgl1-mesa-dev xvfb

cmake -S . -B build -G Ninja -DCMAKE_BUILD_TYPE=Debug
cmake --build build --parallel 2
ctest --test-dir build --output-on-failure
printf '\nMRaiders native cloud development ready: build and CTest completed.\n'

# Legacy Electron dependencies are explicitly opt-in.
if [[ "${MRAIDERS_BOOTSTRAP_LEGACY:-0}" == "1" ]]; then
  if ! command -v npm >/dev/null 2>&1; then
    echo "Legacy npm support is absent from the C++ base image. Install Node manually in Codespaces if needed." >&2
    exit 1
  fi
  npm ci
fi
