# Plan: neostorage (Ink storage visualizer)

## Goals
- Visualize local filesystem storage in a single-screen Ink dashboard.
- Minimal aesthetic, keyboard-first navigation.
- Fast enough for large volumes, with clear feedback on errors.

## Core UX
- One screen, vertical split:
  - Top: ranking list (files + directories) for the current path, sorted by size desc.
  - Bottom: details for the selected entry (full path, size GB, % of parent, type, warnings).
- Breadcrumbs at top for current path.
- Status bar with key hints + last refresh time + warning count.

## Navigation / Keys
- Up/Down: move selection
- Enter: drill into selected directory (one level)
- Backspace or Left: go up
- r: refresh
- q: quit
- ?: toggle help

## Data Acquisition
- Use `du` for size data.
- Default (BSD/macOS): `du -a -k -d 1 <path>`
- Fallback (GNU): `du -a -k --max-depth=1 <path>`
- Parse output into records `{ sizeKb, path }`.
- Convert KB → GB (10^9) with one decimal.
- Ignore the parent path row so only direct children are listed.
- Collect stderr lines, classify permission errors for warning count.

## Defaults / Assumptions
- Start path: `/` (volume-wide view), with CLI option to set a custom root.
- Display depth: 1 level (direct children only).
- Sorting: size descending.
- Size unit: GB (10^9) with one decimal.
- Manual refresh only.

## Aesthetic Direction
- Minimal: muted palette, strong hierarchy, generous spacing.
- Subtle accent for selected row and size column emphasis.
- No heavy borders; use whitespace and alignment for structure.

---

# Detailed Plan (Small Phases)

## Phase 0: Decisions + Constraints
- Confirm runtime: Node + Ink.
- Target OS: macOS first; GNU fallback supported.
- Confirm default start path: `/`.
- Confirm no exclude patterns in v1.
- Output: a short “Decisions” block added to README.

## Phase 1: Repository Scaffold
- Add `package.json` with scripts:
  - `dev`: run Ink app
  - `build`: (if TS) compile
  - `start`: run compiled output
- Add `src/` and CLI entrypoint.
- Add `README.md` quick-start placeholder.
- Acceptance: `node ./dist/cli.js --help` works (or `pnpm dev`).

## Phase 2: CLI Surface (Minimal)
- Flags:
  - `--path <path>` (default `/`)
  - `--help`, `--version`
- Validate path exists and is a directory.
- Normalize and resolve path.
- Acceptance: running with invalid path prints a clear error and exits.

## Phase 3: `du` Capability Detection
- Implement a small probe:
  - Try BSD syntax first: `du -a -k -d 1 <path>`
  - If exit code non-zero or stderr shows “illegal option”, fallback to GNU `--max-depth=1`.
- Cache detected flavor for subsequent runs.
- Acceptance: detection works on macOS and GNU (simulate by stubbing in tests if available).

## Phase 4: `du` Runner + Parser
- Run `du` with `spawn` and capture stdout/stderr.
- Parse stdout line by line: `<kb>\t<path>`.
- Convert KB → GB (float, 1 decimal).
- Filter out the root row (path equals the requested path).
- Normalize paths to avoid duplicates.
- Collect stderr lines into `warnings[]`.
- Acceptance: sample outputs parse into deterministic entries.

## Phase 5: File Type Resolution
- For each entry path, detect `isDir` via `fs.lstat`.
- Mark unknown/failed stat as `isDir: false` and attach error.
- Acceptance: list shows correct file/dir icons or labels.

## Phase 6: State Model
- App state shape:
  - `currentPath`
  - `entries[]` (name, fullPath, sizeGb, isDir, warnings?)
  - `selectedIndex`
  - `lastRefreshAt`
  - `warnings[]`
  - `history[]` (stack for back)
- Helpers:
  - `computePercent(size, total)`
  - `formatSizeGb` (1 decimal)
- Acceptance: navigating keeps selection valid.

## Phase 7: UI Skeleton (Static)
- Layout components:
  - Header: breadcrumbs
  - List pane: columns (rank, name, size)
  - Details pane: key fields
  - Footer: key hints + last refresh + warnings
- Columns widths with truncation/ellipsis for long names.
- Empty state: “No entries” message.
- Acceptance: renders without data.

## Phase 8: Interaction Wiring
- Keyboard handling via Ink:
  - Up/Down: selection move
  - Enter: drill if `isDir`
  - Backspace/Left: pop history
  - r: refresh data
  - q: exit
  - ?: help overlay
- Keep selection on refresh if item still exists.
- Acceptance: simple manual navigation works.

## Phase 9: Styling / Minimal Theme
- Define a small theme module:
  - text: muted gray
  - accent: subtle cyan/green
  - selection: inverted or soft background
- Use spacing rather than borders.
- Keep consistent alignment of size column.
- Acceptance: visual hierarchy is clear on a narrow terminal.

## Phase 10: Error + Warning UX
- Permission errors in stderr increment warning count.
- Show warning count in footer; show last warning in details pane.
- Non-directory selection: Enter does nothing (or show message in footer).
- Acceptance: running on `/` shows warning count if any.

## Phase 11: Performance + Resilience
- Show loading state/spinner during `du` run.
- Avoid blocking UI: run `du` async.
- Guard against huge lists: limit render rows to terminal height.
- Acceptance: UI stays responsive while scanning.

## Phase 12: Documentation
- README:
  - Install + run
  - Key bindings
  - Known limitations
- Add short “Design principles” section for minimal aesthetic.
- Acceptance: README enables first run.

## Phase 13: Optional Enhancements (Later)
- Exclude patterns (`--exclude`, defaults for node_modules/.git).
- Depth control (`--depth`)
- Toggle sort (size/name)
- Search filter

---

## Open Questions (Optional)
- Confirm whether default start path should be `/` or current working directory.
- Confirm whether you want default exclude patterns in v1.
