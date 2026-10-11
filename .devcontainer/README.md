# MRaiders cloud workspace

New Codespaces use the native Qt development flow by default (Debian bookworm
Qt 6.4 developer packages for compatibility; Windows CI targets Qt 6.12 LTS).

After Codespaces creation:
```bash
cmake --build build --parallel 2
ctest --test-dir build --output-on-failure
QT_QPA_PLATFORM=offscreen timeout 5s ./build/native/MRaiders || true
```

The GUI timeout line is a launch diagnostic **only**, not a full application
acceptance test. Never represent it as proof that the Windows GUI passed.

This bootstraps inside the cloud container, not the user's local PC. For
the previous Electron dependencies, set `MRAIDERS_BOOTSTRAP_LEGACY=1` before
running bootstrap manually. Avoid rebuilding an active Codespace unnecessarily.
