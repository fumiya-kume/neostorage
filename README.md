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

Build and run the compiled CLI:

```sh
npm run build
npm start
```

On Windows, the default (no `--path`) shows drive roots (e.g. `C:\`).
On macOS, the default (no `--path`) starts at `/Volumes`.

## Run from GitHub (no clone)

Using npx:

```sh
npx -y github:fumiya-kume/neostorage
```

Using bun:

```sh
bunx github:fumiya-kume/neostorage
```

Optional root path:

```sh
npx -y github:fumiya-kume/neostorage -- --path /
bunx github:fumiya-kume/neostorage -- --path /
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
