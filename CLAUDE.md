# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Serving locally for development
```bash
python3 -m http.server 8000
```
Then browse to `http://localhost:8000/index.dev.html`

**Important:** The project uses ES modules, so files must be served over HTTP (not opened directly as `file://`) to avoid CORS errors.

### Building production bundle
```bash
node build.js
```
This generates a standalone single-file bundle at `dist/index.html` and overwrites the root `index.html`. The build process strips ES module syntax (`import`/`export`) and inlines all JavaScript and CSS.

## Architecture Overview

### Core Design Pattern
**Ferrofluid Playground** uses a **mode-based architecture** with the Strategy Pattern. The simulation can operate in different modes (Interactive, Life, Game, Screensaver), each encapsulating specific behavior without cluttering the core simulation class.

### Module Structure

#### Entry Point
- **`src/main.js`**: Bootstraps `FerroSimulation`, initializes with `InteractiveMode`, starts the animation loop, and wires up UI controls.

#### Core Simulation (`src/core/`)
- **`ferro-simulation.js`**: Thin orchestrator (~466 lines, down from 640). Manages:
  - Canvas infrastructure and rendering pipeline
  - Mode lifecycle (`setMode`, delegates to `currentMode.update/render`)
  - Shared resources: magnets, particles, Life automaton, state
  - Event handling (delegates to mode first, then default behavior)
  - Magnet rendering (shared across all modes)

- **`particle-system.js`**: Manages particle array with velocity integration, magnetic forces, swirl effects, damping, jitter, and rendering (circle/square/triangle shapes, glow effects, golden particle highlighting).

- **`magnet.js`**: Represents individual magnet state (position, mode [+1 attract, -1 repel], interaction state).

- **`life-automaton.js`**: Conway's Game of Life implementation with configurable B/S rules, magnet bias for cell birth probability, double-buffering, grid resizing, and randomization.

- **`life-rule.js`**: Parses and validates B/S notation (e.g., `B3/S23`).

#### Mode System (`src/modes/`) **NEW**
Modes encapsulate specific simulation behaviors using the Strategy Pattern. Each mode implements lifecycle hooks and can override event handling.

- **`simulation-mode.js`**: Base class defining mode interface:
  - Lifecycle: `onEnter()`, `onExit()`
  - Update: `update(dt)`, `render(ctx)`
  - Events: `handlePointerDown/Move/Up`, `handleKeyDown/Up` (return true to block default)
  - Metadata: `name`, `allowsMagnetControl`, `allowsScreensaver`

- **`interactive-mode.js`**: Default mode (~120 lines)
  - Updates particles with magnet forces
  - Renders particles and field lines
  - Allows manual magnet control

- **`life-mode.js`**: Game of Life mode (~130 lines)
  - Updates Life automaton (magnets influence cell birth)
  - Renders Life grid
  - Allows manual magnet control
  - Initializes grid on enter

- **`game-mode.js`**: Magnet Roundup mini-game (~460 lines)
  - Extends `InteractiveMode` (particles + manual control)
  - Adds scoring ring, particle counting, timer, golden particles
  - Manages game state (rounds, score, streaks)
  - Updates HUD overlay (`#game-hud`)
  - Exclusive mode (`allowsScreensaver: false`)

- **`screensaver-mode.js`**: Autonomous drift wrapper (~170 lines)
  - **Decorator Pattern**: wraps `InteractiveMode` or `LifeMode`
  - Overrides magnet control with autonomous Lissajous curve drift
  - Periodically cycles color themes and Life rules
  - Blocks manual pointer input
  - Access wrapped mode via `wrappedMode` property

#### UI (`src/ui/`)
- **`controls.js`**: Wires HTML form inputs to simulation. Mode switching:
  - Life checkbox: `simulation.setMode(new LifeMode(simulation))`
  - Screensaver checkbox: Wraps current mode in `ScreensaverMode`
  - Game start button: Handled by `GameMode.onEnter()` binding
  - Handles mode combinations (e.g., Life + Screensaver)

#### State (`src/state/`)
- **`default-state.js`**: Shared default configuration for particles, magnets, Life mode, and screensaver.

### Mode System Details

#### Mode Lifecycle
```javascript
// Switching modes
simulation.setMode(newMode);  // Calls oldMode.onExit() → newMode.onEnter()

// Mode delegation
simulation.step(dt) → currentMode.update(dt) → currentMode.render(ctx)
```

#### Mode Hierarchy
```
SimulationMode (base)
├── InteractiveMode (particles + manual control)
├── LifeMode (Life automaton + manual control)
├── GameMode extends InteractiveMode (exclusive game)
└── ScreensaverMode (decorator wrapping Interactive/Life)
```

#### Mode Transitions
- **Interactive ↔ Life**: Direct switch via `setMode()`
- **Screensaver wrapping**: Wraps any base mode, unwraps on disable
- **Game mode**: Exclusive, can't be wrapped by screensaver
- Mode exclusivity enforced via `allowsScreensaver` property

#### Event Handling Chain
1. Mode's `handleEvent()` called first
2. If mode returns `true`, event handled (stop)
3. Otherwise, FerroSimulation default behavior runs

### State Management
State lives in `simulation.state` and is updated via `simulation.setState(partial)`. This method handles side-effects like:
- Resetting particles when count changes
- Rebuilding Life grid when cell size changes
- Clamping magnets to canvas bounds

**Note**: Modes are **not** stored in state. Mode switching is done via `setMode()`, not `setState()`.

### Key Interactions
- **Magnet control**: Click/drag canvas to move nearest magnet. Hold Shift for repulsion mode. Press M to toggle magnet on/off.
- **Multi-magnets**: "Add Magnet" spawns additional magnets. "Reset Magnets" returns to single magnet.
- **Mode switching**: Life checkbox switches between Interactive and Life modes. Screensaver checkbox wraps current mode.
- **Game mode**: "Start Roundup" button activates game, managed by GameMode's HUD binding.

### Build Process Details
`build.js` concatenates modules in dependency order, strips `import`/`export` statements, wraps in an IIFE, and inlines into `index.dev.html` to produce a standalone bundle.

### Module Load Order (for build)
1. `default-state.js`
2. `life-rule.js`
3. `life-automaton.js`
4. `magnet.js`
5. `particle-system.js`
6. `ferro-simulation.js`
7. **Mode files** (simulation-mode → interactive → life → game → screensaver)
8. `controls.js`
9. `main.js`

This order ensures dependencies are available before use in the stripped bundle.

## Code Size Improvements

**Before refactoring:**
- `ferro-simulation.js`: 640 lines (God class)
- `magnet-roundup.js` (plugin): 456 lines
- **Total:** 1096 lines in 2 files

**After refactoring:**
- `ferro-simulation.js`: 466 lines (orchestrator only)
- Mode files: ~970 lines across 5 focused classes
- **Total:** ~1436 lines in 6 files (modes) + 1 orchestrator

**Benefits:**
- 27% reduction in ferro-simulation.js complexity
- Each mode is 100-170 lines, single responsibility
- Easy to add new modes without touching core
- Clear mode boundaries prevent conflicts
- Much easier to test individual modes
