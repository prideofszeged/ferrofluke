# Performance Optimisation Plan

This checklist captures pragmatic steps to stabilise frame time and reduce GPU/CPU load while preserving visuals. Target: steady 60 fps on typical laptops; comfortable 30–60 fps on low‑end.

## Quick Wins (toggle defaults)
- [ ] Disable field lines by default: set `showFieldLines: false` in `src/state/default-state.js`.
- [ ] Lower particle count: `particleCount: 500` (from 700).
- [ ] Lower glow: `particleGlow: 8` (from 12).
- [ ] Prefer circles: `particleShape: 'circle'`.

## Rendering Optimisations
- [ ] Batched circle draw in `src/core/particle-system.js`:
  - Build one `beginPath()`/`arc()` path for all circles; `fill()` once.
  - Move golden outlines to a second batched path.
  - Avoid per‑particle `save/restore/rotate` when using circles.
- [ ] Offscreen sprite atlas (all shapes):
  - Pre‑render glow on an offscreen canvas per shape/size bucket; replace shadows with `drawImage()`.
  - Removes `shadowBlur` and multiple path ops per particle.
- [ ] Lower internal resolution option:
  - Render at ~0.75–0.85× DPR in `ferro-simulation.resize()` and scale up; add a user toggle.

## Simulation Loop Improvements
- [ ] Replace `magnets.forEach` with indexed `for` in `particle-system.update()`.
- [ ] Hoist constants out of loops (e.g., `falloff + 1`, `sizeScale`, strength scales).
- [ ] Reduce RNG pressure: update jitter every other frame or use a tiny PRNG table.

## Field Line Cost Controls (`src/modes/interactive-mode.js`)
- [ ] Draw on cadence (e.g., every 3rd frame) with trail fade.
- [ ] Reduce samples: `lines` 28 → 16; `maxSteps` 96 → 48.
- [ ] Optional: cache to a layer and composite with low alpha.

## Adaptive Performance Governor
- [ ] Track moving average frame time (~120 frames).
- [ ] If > 18 ms for 15 frames: `particleCount -= 50`, `particleGlow = max(0, glow - 2)`.
- [ ] If < 14 ms for 120 frames: `particleCount += 25` up to a cap (user default).
- [ ] Expose a UI toggle to enable/disable auto‑tuning.

## Verification & Rollback
- [ ] DevTools Performance: confirm fewer canvas state changes and lower CPU.
- [ ] Visual parity check for glow/lines vs. pre‑change.
- [ ] Keep feature flags for each optimisation; revert by toggling defaults in `default-state.js`.

Notes
- If adding sprite code, update bundling order in `build.js` (`moduleOrder`).
- Do not hand‑edit generated `index.html` or files in `dist/`.
