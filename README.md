# neostorage

Minimal Ink storage visualizer for local filesystems.

## Quick start

```sh
npm install
npm run dev
```

Optional root path:

```sh
npm run dev -- --path /
```

## Controls

- Up/Down: move selection
- Enter: drill into directory
- Backspace or Left: go up
- r: refresh
- ?: help
- q: quit

## Notes

- Uses `du` to collect sizes (files + directories).
- Displays direct children only (depth = 1).
- Size is shown in GB (base10) with one decimal.
