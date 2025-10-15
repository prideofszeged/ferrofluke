# Ferrofluid Playground

A lightweight, browser-based ferrofluid simulation that reacts to a magnet you can move with your pointer. Adjust the look and behaviour in real-time to create hypnotic particle art.

## Getting started

1. Serve the folder locally for development (modules need HTTP). The quickest option is `python3 -m http.server 8000` and browse to `http://localhost:8000/index.dev.html`.
2. Click and drag to position the magnet. Release to leave it hovering; grab it again any time. Hold **Shift** to flip to repulsion mode.

## Controls

- **Particles** – tune the count, pick between circle, square, or triangle sprites, set a base colour, amplify the glow, and scale the swarm speed.
- **Magnet** – change field strength, falloff, radius, the colour of the indicator, drop extra magnets with **Add Magnet** (use **Reset Magnets** to go back to one), and flip the field off entirely with the **Enable magnet** toggle (or press `M`).
- **Field lines** – toggle the stylised field visualiser and choose its colour.
- **Game of Life** – flip into a cellular automaton mode, tune step speed, cell size, pick a B/S rule (or apply a preset), magnet bias, and the alive/dead colours. Seed the grid with **Randomize Life** or wipe it with **Clear Life**.
- **Screensaver** – unleash autonomous mode: magnets drift, presets swap, and the palette breathes on its own. Control drift speed/preset interval or tap **Shuffle Screensaver** for a fresh combo.
- **Reset particles** – respawn the swarm if you want to start afresh.

## Tips

- Strong magnets with a low falloff create dramatic spikes. Try pairing that with squares or triangles for shard-like formations.
- Lower particle counts work best on slower machines. The default (700) balances performance and detail on most laptops.
- Reduce particle speed if you want smoother, slower waves; crank it up for more aggressive spikes.
- Increasing magnet size widens the area of influence and fattens the marker, handy when you want sweeping motion without upping strength.
- In Life mode, try HighLife (`B36/S23`) or Seeds (`B2/S`) with a high magnet bias—the magnet acts like a catalyst in attraction mode or a disintegration pulse in repulsion mode.
- Run `FEATURES.md` for a backlog of visual experiments we want to chase next (multi-magnets, screensaver, colour choreography, etc.).

## Magnet Roundup mini-game

- Click **Start Roundup** on the canvas overlay to spawn a glowing scoring ring.
- Herd the target number of particles into the ring before the timer expires; streaks shorten the clock but ramp up rewards.
- Golden particles (outlined in amber) add hefty bonuses when they finish inside the goal.
- Miss a round and your run ends—hit Restart any time for another attempt.
- The magnet automatically flicks back on when a round begins; press `M` if you need to pause magnet influence mid-run.

## Project layout

The app now uses ES modules so it is easy to grow new systems.

- `src/main.js` - entry point that boots the simulation and hooks up the control panel.
- `src/core/` - simulation building blocks (`ferro-simulation`, `particle-system`, `life-automaton`, `magnet`, `life-rule`).
- `src/ui/controls.js` - form wiring that maps UI elements onto simulation setters.
- `src/state/default-state.js` - shared defaults for both UI and simulation.

Serve the files over HTTP (see step 1 above) so module imports resolve without CORS warnings.

### Building a single-file bundle

Run `node build.js` to generate `dist/index.html` and overwrite the root-level `index.html` with the standalone bundle. Open `index.html` directly (no server) when you just want the packaged experience.

Because everything runs on the GPU-backed 2D canvas, resizing the window adapts the simulation instantly.

Have fun exploring magnetic fluid art!
