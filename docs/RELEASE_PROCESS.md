# Native release checklist

1. Native CI must pass on an exact commit SHA: data, Linux CTest, Windows build.
2. Test extracted Windows artifact on a supported Windows system:
   launch, all seven maps, pan/zoom, image import, filtering, route
   persistence/export, tracker persistence, window close/reopen.
3. Scan the artifact and inventory Qt runtime components. Record the exact
   Qt build and comply with the relevant licensing/notices.
4. Select MRaiders source code license. Do not distribute game-owned map art
   or third-party data without permission.
5. Require a reviewed PR, tag, release notes, checksums, and release assets.
6. Do not publish signed/certified/anti-cheat-approved claims without evidence.

GitHub Actions build artifacts are temporary development downloads, not a signed release.
