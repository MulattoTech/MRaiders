# Data Format

Each file in `/data` represents one map layer.

## Example

```json
{
  "name": "Dam Battlegrounds",
  "description": "Starter Hurricane and First Wave cache candidates for Dam Battlegrounds.",
  "accentColor": "#ff7b57",
  "updatedAt": "2026-04-20",
  "source": "Public community callouts adapted into static overlay markers.",
  "spawns": [
    {
      "id": "dam-broken-bridge",
      "label": "Broken Bridge",
      "notes": "Possible cache spot near the bridge approach.",
      "x": 0.312,
      "y": 0.294
    }
  ]
}
```

## Rules

- `x` and `y` are normalized values from `0` to `1`
- markers are drawn against the full overlay bounds
- `label` is optional but recommended
- `notes` are optional metadata for future editing
- the app ignores any unsupported fields

## Editing Workflow

1. Edit the relevant JSON file in `/data`.
2. Save the file.
3. Press `F10` or choose **Reload Data** from the tray menu.

Because the overlay is static-data-only, modifying JSON is the only supported way to change marker positions.
