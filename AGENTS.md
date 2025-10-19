# Repository Guidelines

## Project Structure & Module Organization

- `src/main.js` – app entry; wires the simulation and UI.
- `src/core/` – engine pieces: `ferro-simulation`, `particle-system`, `life-automaton`, `magnet`, `life-rule`.
- `src/modes/` – runtime modes: interactive, life, game, star‑monster, screensaver.
- `src/ui/` – UI wiring (`controls.js`, `tab-manager.js`).
- `src/state/` – shared defaults (`default-state.js`).
- `index.dev.html` – module-based dev page; `styles.css` holds all styles.
- Generated: `index.html` and `dist/index.html` (single-file bundle). Do not edit generated files.

## Build, Test, and Development Commands

- Serve for development: `python3 -m http.server 8000` then open `http://localhost:8000/index.dev.html`.
- Build standalone bundle: `node build.js` (writes `dist/index.html` and overwrites root `index.html`).
- Static preview: open `index.html` directly in a browser (no server).

## Coding Style & Naming Conventions

- JavaScript ES modules, 2‑space indentation, semicolons, single quotes.
- File names: kebab‑case (`particle-system.js`). Classes: PascalCase. Functions/vars: camelCase.
- Prefer named exports; keep modules side‑effect‑free beyond export definitions.
- Performance: avoid allocations in hot update/render paths; reuse arrays/objects in the simulation loop.

## Testing Guidelines

- No formal unit tests yet. Perform manual smoke tests:
  - Dev page: interact with magnet (drag, Shift for repulsion), toggle modes, screensaver, and mini‑game.
  - Resize window; verify canvas resizes and performance remains smooth at default particle counts.
- Before PR, test in a Chromium‑based browser; Firefox should also behave correctly.

## Commit & Pull Request Guidelines

- Commits: short, imperative summaries (e.g., "fix tab focus", "add screensaver drift").
- PRs: clear description of behavior change, linked issues, and a short video/GIF or screenshots for UI changes.
- Do not hand‑edit `index.html` or files under `dist/`; run `node build.js` and include regenerated outputs in the PR.

## Agent‑Specific Notes

- Module order for bundling lives in `build.js` (`moduleOrder`). Update it if you add/move modules.
- Keep source of truth under `src/` and `index.dev.html`; treat generated files as artifacts.
- Avoid introducing external build tooling unless discussed; the project intentionally stays dependency‑light.

