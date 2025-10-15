import { SimulationMode } from './simulation-mode.js';

/**
 * Screensaver mode that wraps another mode (Interactive or Life) and adds autonomous magnet drift.
 * Uses the decorator pattern to add behavior without modifying the base mode.
 */
export class ScreensaverMode extends SimulationMode {
  constructor(simulation, baseMode) {
    super(simulation);
    this.baseMode = baseMode;
    this.baseMode.simulation = simulation;

    this.elapsed = 0;
    this.nextTransition = simulation.state.screensaverInterval;
    this.driftSeeds = this.generateDriftSeeds();
  }

  onEnter() {
    this.elapsed = 0;
    this.nextTransition = this.simulation.state.screensaverInterval;
    this.driftSeeds = this.generateDriftSeeds();

    // Let base mode initialize
    if (this.baseMode.onEnter) {
      this.baseMode.onEnter();
    }
  }

  onExit() {
    // Let base mode cleanup
    if (this.baseMode.onExit) {
      this.baseMode.onExit();
    }
  }

  update(dt) {
    // Update magnet positions with autonomous drift
    this.updateMagnetDrift(dt);

    // Handle theme transitions
    this.elapsed += dt;
    if (this.elapsed >= this.nextTransition) {
      this.triggerScreensaverTransition();
      this.elapsed = 0;
      this.nextTransition = this.simulation.state.screensaverInterval;
    }

    // Delegate to base mode for particle/life updates
    if (this.baseMode.update) {
      this.baseMode.update(dt);
    }
  }

  render(ctx) {
    // Delegate rendering to base mode
    if (this.baseMode.render) {
      this.baseMode.render(ctx);
    }
  }

  updateMagnetDrift(dt) {
    const { magnets, state, width, height } = this.simulation;
    const driftSpeed = state.screensaverDrift;

    magnets.forEach((magnet, index) => {
      magnet.setShiftPressed(this.simulation.shiftPressed);
      if (!state.magnetEnabled) return;

      const seeds = this.driftSeeds[index % this.driftSeeds.length];
      const radius = seeds.radius * Math.min(width, height) * 0.5;
      const speedX = driftSpeed * seeds.speedX;
      const speedY = driftSpeed * seeds.speedY;

      magnet.x = width * 0.5 + Math.cos(seeds.phaseX + this.elapsed * speedX) * radius;
      magnet.y = height * 0.5 + Math.sin(seeds.phaseY + this.elapsed * speedY) * radius;
      magnet.clamp(width, height, state.magnetSize);

      // Periodic polarity flip
      if (seeds.flipInterval > 0 && this.elapsed % seeds.flipInterval < dt) {
        magnet.mode = magnet.mode > 0 ? -1 : 1;
      }
    });
  }

  triggerScreensaverTransition() {
    const theme = ScreensaverMode.pickRandomTheme();
    this.simulation.state.particleColor = theme.particleColor;
    this.simulation.state.magnetColor = theme.magnetColor;
    this.simulation.state.fieldLineColor = theme.fieldColor;
    this.simulation.state.particleGlow = theme.glow;

    const root = document.documentElement;
    root.style.setProperty('--accent', this.simulation.state.particleColor);

    // Apply Life rule if in Life mode
    if (this.baseMode.name === 'life' && theme.lifeRule) {
      this.simulation.life.applyRule(theme.lifeRule);
      this.simulation.state.lifeRule = this.simulation.life.rule;
    }
  }

  static pickRandomTheme() {
    const themes = [
      {
        name: 'Solar Storm',
        particleColor: '#ffb347',
        magnetColor: '#ff4e50',
        fieldColor: '#ffe29f',
        glow: 22,
        lifeRule: 'B36/S23',
      },
      {
        name: 'Ethereal Lagoon',
        particleColor: '#48d1cc',
        magnetColor: '#00aaff',
        fieldColor: '#a1f7ff',
        glow: 18,
        lifeRule: 'B3/S23',
      },
      {
        name: 'Cyber Grid',
        particleColor: '#9d60ff',
        magnetColor: '#ff2bd6',
        fieldColor: '#f7a1ff',
        glow: 24,
        lifeRule: 'B3678/S34678',
      },
      {
        name: 'Aurora Drift',
        particleColor: '#7fffb8',
        magnetColor: '#3c91ff',
        fieldColor: '#c9ffe5',
        glow: 20,
        lifeRule: 'B2/S',
      },
    ];
    return themes[Math.floor(Math.random() * themes.length)];
  }

  generateDriftSeeds() {
    const count = Math.max(1, this.simulation.magnets.length);
    const seeds = [];
    for (let i = 0; i < count; i += 1) {
      seeds.push({
        phaseX: Math.random() * Math.PI * 2,
        phaseY: Math.random() * Math.PI * 2,
        speedX: 0.04 + Math.random() * 0.06,
        speedY: 0.05 + Math.random() * 0.07,
        radius: 0.25 + Math.random() * 0.35,
        flipInterval: Math.random() > 0.7 ? 8 + Math.random() * 10 : 0,
      });
    }
    return seeds;
  }

  randomize() {
    this.elapsed = 0;
    this.nextTransition = this.simulation.state.screensaverInterval;
    this.driftSeeds = this.generateDriftSeeds();
    this.triggerScreensaverTransition();
  }

  // Override event handlers to prevent manual magnet control
  handlePointerDown(event) {
    return true; // Block pointer control
  }

  handlePointerMove(event) {
    return true; // Block pointer control
  }

  handlePointerUp(event) {
    return true; // Block pointer control
  }

  get name() {
    return `screensaver(${this.baseMode.name})`;
  }

  get allowsMagnetControl() {
    return false; // Disable manual control
  }

  get allowsScreensaver() {
    return false; // Already in screensaver mode
  }

  // Provide access to the base mode
  get wrappedMode() {
    return this.baseMode;
  }
}
