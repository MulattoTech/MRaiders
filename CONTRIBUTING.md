# Contributing to MRaiders

MRaiders is early in its native rewrite. Open an issue describing the feature,
expected behavior, data provenance, and license rights before substantial changes.
Use a short-lived branch and a reviewable PR; never force-push main.

Native checks: `cmake -S . -B build -G Ninja -DCMAKE_BUILD_TYPE=Release`,
`cmake --build build`, `ctest --test-dir build --output-on-failure`.

Map contributions must include: independently verified source, rights to share,
map name, stable marker ID, category, label, notes, and normalized x/y values
between 0 and 1. Mark guesses explicitly; do not claim spawn guarantees.

No game hooks, gameplay screen analysis, anti-cheat evasion, or proprietary
third-party data extraction. We do not provide security or anti-cheat approval.
This repository currently has no selected public code license; contact the
maintainer about contribution licensing before making large submissions.
