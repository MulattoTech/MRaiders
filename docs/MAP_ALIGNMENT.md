# Native map calibration — MR-4

MRaiders is an independent, offline-first reference-map companion. Imported map
images must be user-supplied with appropriate usage rights. Original bundled
candidate marker coordinates are **unverified starter data**, and alignment
does not make those locations authoritative or reveal live spawns.

## Why anchor alignment matters

Map marker coordinates are normalized to [0,1] × [0,1] over a logical map
space. A user-provided reference image may be rotated, cropped, or stretched.
The engine maps logical marker positions into reference-image pixel fractions.

- **2 anchor pairs:** similarity transform (translation + rotation + uniform scale).
- **3 non-collinear anchor pairs:** full affine transform (including shear).
- Invalid, duplicate, collinear, non-finite, or out-of-range anchors are rejected.
- A failed fit never replaces the last valid transform.

## Interactive workflow

1. Open Interactive Maps in the native Qt application.
2. Load a user-owned reference image.
3. Select a marker with *independently verified* logical coordinates.
4. Click **Align Selected Marker to Image...**, then click its matching image
   position. Right-click cancels picking.
5. Select a second distinct known landmark and repeat; the app fits and saves
   a similarity transform.
6. Optionally add a third non-collinear known landmark for an affine transform.
7. Use **Reset Map Alignment** to clear the current map and restart.

The current workflow selects source anchors from existing marker entries. That
does NOT verify them. A fully independent source-landmark editor is still a
later MR-4 task.

Calibration is persisted per map through QSettings using schemaVersion 1 JSON
containing two or three paired coordinates. No reference-image bytes are stored.
Changing the image path clears the old alignment to prevent stale matches.
Corrupt stored calibrations are rejected and identity alignment is retained.

## Testing and release gates

The map_calibration QtTest target verifies similarity, affine, invalid data,
collinear anchors, and versioned JSON serialization. Existing Qt GUI tests,
Windows packaging and smoke tests still apply.

Automated calibration math tests do NOT establish successful visible alignment,
accurate game coordinates, reference-image licensing or player-facing acceptance.

## Remaining MR-4 scope

- Per-marker source/license/verification metadata and vetted contributions
- Exact source reference-point editor not limited to candidate spawn markers
- Explicit import/export of independently validated calibration packages
- Perspective/nonlinear distortion if supported by actual sample data
- Windows graphical usability test and image-alignment regression evidence

## Independent source anchors and portable alignment

Use **Pick Independent Map Coordinate...** to enter known X/Y fractions
without selecting an existing approximate cache marker. Click the matching
position on the imported image. This avoids relying on unverified bundled
spawn candidates when you have authoritative reference coordinates.

Use **Export Alignment JSON...** to save a portable v1 package containing the
mapId, two/three anchor pairs, and an explicit user-supplied/unverified flag.
No image bytes, game account data, or computer-specific paths are exported.
Use **Import Alignment JSON...** after loading your local reference image;
the importer requires a matching mapId, valid normalized numeric points,
a supported schema, and a bounded input size (64 KiB). Invalid imports never
replace existing valid alignment.
