# Ferrofluid Playground

A lightweight, browser-based ferrofluid simulation that reacts to a magnet you can move with your pointer. Adjust the look and behaviour in real-time to create hypnotic particle art.

## Getting started

1. Open `index.html` in a modern desktop browser (Chrome, Edge, Firefox, or Safari). No build step or dependencies required.
2. Click and drag to position the magnet. Release to leave it hovering; grab it again any time. Hold **Shift** to flip to repulsion mode.

## Controls

- **Particles** – tune the count, pick between circle, square, or triangle sprites, set a base colour, amplify the glow, and scale the swarm speed.
- **Magnet** – change field strength, falloff, radius, and the colour of the magnet indicator.
- **Field lines** – toggle the stylised field visualiser and choose its colour.
- **Game of Life** – flip into a cellular automaton mode, tune step speed, cell size, pick a B/S rule (or apply a preset), magnet bias, and the alive/dead colours. Seed the grid with **Randomize Life** or wipe it with **Clear Life**.
- **Reset particles** – respawn the swarm if you want to start afresh.

## Tips

- Strong magnets with a low falloff create dramatic spikes. Try pairing that with squares or triangles for shard-like formations.
- Lower particle counts work best on slower machines. The default (700) balances performance and detail on most laptops.
- Reduce particle speed if you want smoother, slower waves; crank it up for more aggressive spikes.
- Increasing magnet size widens the area of influence and fattens the marker, handy when you want sweeping motion without upping strength.
- In Life mode, try HighLife (`B36/S23`) or Seeds (`B2/S`) with a high magnet bias—the magnet acts like a catalyst in attraction mode or a disintegration pulse in repulsion mode.
- Because everything runs on the GPU-backed 2D canvas, resizing the window adapts the simulation instantly.

Have fun exploring magnetic fluid art!
