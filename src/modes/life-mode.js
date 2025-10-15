import { SimulationMode } from './simulation-mode.js';

/**
 * Game of Life cellular automaton mode with manual magnet control.
 * Magnets can influence cell birth probability based on proximity.
 */
export class LifeMode extends SimulationMode {
  constructor(simulation) {
    super(simulation);
  }

  onEnter() {
    const { life, state, width, height } = this.simulation;
    life.accumulator = 0;
    life.ensureGrid(state, width, height, true);
    if (!life.seeded) {
      life.randomize(0.42);
    }
  }

  update(dt) {
    const { life, magnets, state, width, height } = this.simulation;
    const activeMagnets = state.magnetEnabled ? magnets : [];
    life.update(dt, state, activeMagnets, width, height);
  }

  render(ctx) {
    const { life, state } = this.simulation;
    life.draw(ctx, state);
  }

  get name() {
    return 'life';
  }
}
