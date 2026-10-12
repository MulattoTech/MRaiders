# MRaiders Codespaces (C++/Qt)

The default Codespace uses Microsoft's maintained C++ development-container
image on Debian 12 and installs the Qt 6.4 API baseline **in the cloud only**.
Qt 6.12 LTS is validated and packaged separately in Windows GitHub Actions.

On first create, the bootstrap configures CMake, builds, and runs Qt CTest.
Subsequent checks:

```bash
cmake --build build --parallel 2
ctest --test-dir build --output-on-failure
QT_QPA_PLATFORM=offscreen ./build/native/MRaiders --smoke-test
```

This does not install SDKs or compilers on your Windows PC. No game execution
or live capture is part of Codespaces testing.

For legacy Electron experiments only, install Node in the container and run
`MRAIDERS_BOOTSTRAP_LEGACY=1 bash scripts/bootstrap-codespace.sh`.
Do not trigger a Codespaces rebuild mid-task unless an environment dependency
requires it; preserve work and run checks first.
