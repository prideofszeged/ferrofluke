import { FerroSimulation } from './core/ferro-simulation.js';
import { InteractiveMode } from './modes/interactive-mode.js';
import { setupControls } from './ui/controls.js';

const canvas = document.getElementById('ferro-canvas');
const simulation = new FerroSimulation(canvas);

// Start with Interactive mode
const interactiveMode = new InteractiveMode(simulation);
simulation.setMode(interactiveMode);

simulation.start();

setupControls(simulation);

export { simulation };
