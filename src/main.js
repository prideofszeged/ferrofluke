import { FerroSimulation } from './core/ferro-simulation.js';
import { setupControls } from './ui/controls.js';

const canvas = document.getElementById('ferro-canvas');
const simulation = new FerroSimulation(canvas);
simulation.start();

setupControls(simulation);

export { simulation };
