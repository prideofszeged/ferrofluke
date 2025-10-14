import { defaultState } from '../state/default-state.js';
import { Magnet } from './magnet.js';
import { ParticleSystem } from './particle-system.js';
import { LifeAutomaton } from './life-automaton.js';

/**
 * Central simulation orchestrator: manages canvas, state, magnet, particles, and Life mode.
 */
export class FerroSimulation {
  constructor(canvas, initialState = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.state = { ...defaultState, ...initialState };

    this.dpr = window.devicePixelRatio || 1;
    this.width = 0;
    this.height = 0;

    this.pointerDown = false;
    this.shiftPressed = false;

    this.magnets = [new Magnet()];
    this.activeMagnet = this.magnets[0];
    this.particles = new ParticleSystem();
    this.life = new LifeAutomaton();
    this.life.applyRule(this.state.lifeRule);

    this.lastTimestamp = 0;
    this.running = false;
    this.screensaver = {
      active: this.state.screensaverEnabled,
      elapsed: 0,
      nextTransition: this.state.screensaverInterval,
      driftSeeds: this.generateDriftSeeds(),
    };

    this.loop = this.loop.bind(this);
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerLeave = this.handlePointerLeave.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);

    this.randomizeLife = this.randomizeLife.bind(this);
    this.clearLife = this.clearLife.bind(this);

    this.resizeObserver = null;
    this.resizeListener = null;
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.canvas);
    } else {
      this.resizeListener = () => this.resize();
      window.addEventListener('resize', this.resizeListener);
    }

    this.attachEvents();
    this.resize();
    this.particles.reset(this.state.particleCount);
  }

  attachEvents() {
    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('pointerup', this.handlePointerUp);
    this.canvas.addEventListener('pointermove', this.handlePointerMove);
    this.canvas.addEventListener('pointerleave', this.handlePointerLeave);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  detachEvents() {
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    window.removeEventListener('pointerup', this.handlePointerUp);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerleave', this.handlePointerLeave);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
    }
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(rect.width * this.dpr);
    this.canvas.height = Math.round(rect.height * this.dpr);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(this.dpr, this.dpr);
    this.width = rect.width;
    this.height = rect.height;

    this.magnets.forEach((magnet) => {
      magnet.setHome(this.width, this.height);
      magnet.clamp(this.width, this.height, this.state.magnetSize);
    });

    this.particles.setBounds(this.width, this.height);

    if (this.state.lifeMode) {
      this.life.ensureGrid(this.state, this.width, this.height, true);
      if (!this.life.seeded) {
        this.life.randomize(0.42);
      }
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTimestamp = performance.now();
    requestAnimationFrame(this.loop);
  }

  stop() {
    this.running = false;
  }

  loop(timestamp) {
    if (!this.running) return;
    const deltaMs = Math.min(64, Math.max(8, timestamp - this.lastTimestamp || 16));
    this.lastTimestamp = timestamp;
    const dt = deltaMs / 1000;

    this.step(dt);
    requestAnimationFrame(this.loop);
  }

  step(dt) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(4, 6, 10, 0.32)';
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.restore();

    this.updateMagnets(dt);
    if (this.state.lifeMode) {
      this.life.update(dt, this.state, this.magnets, this.width, this.height);
    } else {
      this.particles.update(dt, this.state, this.magnets);
    }
    this.render();
  }

  updateMagnets(dt) {
    const driftEnabled = this.screensaver.active;
    const driftSpeed = this.state.screensaverDrift;
    this.magnets.forEach((magnet, index) => {
      magnet.setShiftPressed(this.shiftPressed);
      if (driftEnabled) {
        const seeds = this.screensaver.driftSeeds[index % this.screensaver.driftSeeds.length];
        const radius = seeds.radius * Math.min(this.width, this.height) * 0.5;
        const speedX = driftSpeed * seeds.speedX;
        const speedY = driftSpeed * seeds.speedY;
        magnet.x = this.width * 0.5 + Math.cos(seeds.phaseX + this.screensaver.elapsed * speedX) * radius;
        magnet.y = this.height * 0.5 + Math.sin(seeds.phaseY + this.screensaver.elapsed * speedY) * radius;
        magnet.clamp(this.width, this.height, this.state.magnetSize);

        if (seeds.flipInterval > 0 && this.screensaver.elapsed % seeds.flipInterval < dt) {
          magnet.mode = magnet.mode > 0 ? -1 : 1;
        }
      }
    });

    if (driftEnabled) {
      this.screensaver.elapsed += dt;
      if (this.screensaver.elapsed >= this.screensaver.nextTransition) {
        this.triggerScreensaverTransition();
        this.screensaver.elapsed = 0;
        this.screensaver.nextTransition = this.state.screensaverInterval;
      }
    }
  }

  render() {
    if (this.state.showFieldLines) {
      this.drawFieldLines();
    }
    if (this.state.lifeMode) {
      this.life.draw(this.ctx, this.state);
    } else {
      this.particles.draw(this.ctx, this.state);
    }
    this.drawMagnet();
  }

  drawFieldLines() {
    const ctx = this.ctx;
    const color = this.state.fieldLineColor;
    const radius = this.state.magnetSize;
    const lines = 28;
    const maxSteps = 96;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.22;

    this.magnets.forEach((magnet) => {
      for (let i = 0; i < lines; i += 1) {
        const angle = (i / lines) * Math.PI * 2;
        let x = magnet.x + Math.cos(angle) * (radius + 4);
        let y = magnet.y + Math.sin(angle) * (radius + 4);
        ctx.beginPath();
        ctx.moveTo(x, y);

        let stepX = x;
        let stepY = y;
        for (let s = 0; s < maxSteps; s += 1) {
          const dx = magnet.x - stepX;
          const dy = magnet.y - stepY;
          const distSq = dx * dx + dy * dy + 0.0001;
          const dist = Math.sqrt(distSq);
          const normX = dx / dist;
          const normY = dy / dist;
          const force = this.state.magnetStrength * (radius / 18) * 50 / Math.pow(dist + radius, this.state.magnetFalloff + 0.3);

          const tangentX = -normY;
          const tangentY = normX;
          const swirl = (18 + radius * 0.4) / (dist / 40 + 1);

          stepX += (normX * force * magnet.mode * -0.02 + tangentX * swirl * 0.05);
          stepY += (normY * force * magnet.mode * -0.02 + tangentY * swirl * 0.05);

          if (stepX < -40 || stepX > this.width + 40 || stepY < -40 || stepY > this.height + 40) {
            break;
          }

          ctx.lineTo(stepX, stepY);
        }
        ctx.stroke();
      }
    });
    ctx.restore();
  }

  drawMagnet() {
    const ctx = this.ctx;
    const radius = this.state.magnetSize;
    this.magnets.forEach((magnet) => {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.translate(magnet.x, magnet.y);
      ctx.fillStyle = this.state.magnetColor;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = magnet === this.activeMagnet ? 3 : 2;
      ctx.globalAlpha = magnet.isActive ? 0.9 : 0.6;

      ctx.shadowColor = this.state.magnetColor;
      ctx.shadowBlur = magnet === this.activeMagnet ? 26 : 18;

      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.beginPath();
      if (magnet.mode > 0) {
        ctx.moveTo(-radius * 0.6, 0);
        ctx.lineTo(radius * 0.6, 0);
        ctx.moveTo(0, -radius * 0.6);
        ctx.lineTo(0, radius * 0.6);
      } else {
        ctx.moveTo(-radius * 0.6, 0);
        ctx.lineTo(radius * 0.6, 0);
      }
      ctx.stroke();
      ctx.restore();
    });
  }

  handlePointerDown(event) {
    const pos = this.getPointerPosition(event);
    if (!pos) return;
    this.pointerDown = true;
    this.activeMagnet = this.findClosestMagnet(pos.x, pos.y) || this.magnets[0];
    this.activeMagnet.beginInteraction(pos.x, pos.y, this.width, this.height, this.state.magnetSize);
    if (this.canvas.setPointerCapture) {
      try {
        this.canvas.setPointerCapture(event.pointerId);
      } catch (err) {
        // ignore pointer capture errors
      }
    }
  }

  handlePointerUp(event) {
    this.pointerDown = false;
    if (this.activeMagnet) {
      this.activeMagnet.endInteraction();
    }
    if (event && this.canvas.releasePointerCapture) {
      try {
        this.canvas.releasePointerCapture(event.pointerId);
      } catch (err) {
        // ignore release errors
      }
    }
  }

  handlePointerMove(event) {
    if (!this.pointerDown || !this.activeMagnet) return;
    const pos = this.getPointerPosition(event);
    if (!pos) return;
    this.activeMagnet.move(pos.x, pos.y, this.width, this.height, this.state.magnetSize);
  }

  handlePointerLeave() {
    this.pointerDown = false;
    if (this.activeMagnet) {
      this.activeMagnet.endInteraction();
    }
  }

  handleKeyDown(event) {
    if (event.key === 'Shift') {
      this.shiftPressed = true;
      this.magnets.forEach((magnet) => magnet.setShiftPressed(true));
    }
  }

  handleKeyUp(event) {
    if (event.key === 'Shift') {
      this.shiftPressed = false;
      this.magnets.forEach((magnet) => magnet.setShiftPressed(false));
    }
  }

  getPointerPosition(event) {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (Number.isNaN(x) || Number.isNaN(y)) {
      return null;
    }
    return { x, y };
  }

  /** Update global state and propagate side-effects. */
  setState(partial) {
    const prevCount = this.state.particleCount;
    this.state = { ...this.state, ...partial };

    if (partial.particleCount !== undefined && partial.particleCount !== prevCount) {
      this.particles.setCount(this.state.particleCount);
    }

    if (partial.particleGlow !== undefined) {
      this.state.particleGlow = Math.max(0, partial.particleGlow);
    }

    if (partial.particleSpeed !== undefined) {
      this.state.particleSpeed = Math.max(0.2, Math.min(3, partial.particleSpeed));
    }

    if (partial.magnetSize !== undefined) {
      this.state.magnetSize = Math.max(10, Math.min(60, partial.magnetSize));
      this.magnets.forEach((magnet) => magnet.clamp(this.width, this.height, this.state.magnetSize));
    }

    if (partial.lifeMode !== undefined) {
      this.setLifeMode(Boolean(partial.lifeMode));
    }

    if (partial.lifeSpeed !== undefined) {
      this.state.lifeSpeed = Math.max(1, Math.min(60, partial.lifeSpeed));
    }

    if (partial.lifeCellSize !== undefined) {
      this.state.lifeCellSize = Math.max(6, Math.min(40, partial.lifeCellSize));
      if (this.state.lifeMode) {
        this.life.ensureGrid(this.state, this.width, this.height, true);
      }
    }

    if (partial.lifeRule !== undefined) {
      this.life.applyRule(partial.lifeRule);
      this.state.lifeRule = this.life.rule;
    }

    if (partial.lifeMagnetBias !== undefined) {
      this.state.lifeMagnetBias = Math.max(0, Math.min(1, partial.lifeMagnetBias));
    }

    if (partial.lifeAliveColor !== undefined) {
      this.state.lifeAliveColor = partial.lifeAliveColor;
    }

    if (partial.lifeDeadColor !== undefined) {
      this.state.lifeDeadColor = partial.lifeDeadColor;
    }

    if (partial.screensaverEnabled !== undefined) {
      this.setScreensaverEnabled(Boolean(partial.screensaverEnabled));
    }

    if (partial.screensaverDrift !== undefined) {
      this.setScreensaverDrift(Number(partial.screensaverDrift));
    }

    if (partial.screensaverInterval !== undefined) {
      this.setScreensaverInterval(Number(partial.screensaverInterval));
    }
  }

  resetParticles() {
    this.particles.reset(this.state.particleCount);
  }

  randomizeLife(density = 0.45) {
    this.life.ensureGrid(this.state, this.width, this.height);
    this.life.randomize(density);
  }

  clearLife() {
    this.life.clear();
  }

  setLifeMode(enabled) {
    if (enabled === this.state.lifeMode) return;
    this.state.lifeMode = enabled;
    this.life.accumulator = 0;
    if (enabled) {
      this.life.ensureGrid(this.state, this.width, this.height, true);
      if (!this.life.seeded) {
        this.life.randomize(0.42);
      }
    }
  }

  addMagnet() {
    const magnet = new Magnet();
    magnet.anchored = true;
    magnet.x = this.width * 0.5;
    magnet.y = this.height * 0.5;
    magnet.setHome(this.width, this.height);
    magnet.clamp(this.width, this.height, this.state.magnetSize);
    magnet.setShiftPressed(this.shiftPressed);
    this.magnets.push(magnet);
    this.activeMagnet = magnet;
  }

  resetMagnets() {
    const first = this.magnets[0] || new Magnet();
    first.anchored = false;
    first.setHome(this.width, this.height);
    first.clamp(this.width, this.height, this.state.magnetSize);
    first.setShiftPressed(this.shiftPressed);
    this.magnets = [first];
    this.activeMagnet = first;
  }

  findClosestMagnet(x, y) {
    let closest = null;
    let bestDist = Infinity;
    const radius = this.state.magnetSize;
    for (let i = 0; i < this.magnets.length; i += 1) {
      const magnet = this.magnets[i];
      const dx = magnet.x - x;
      const dy = magnet.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist) {
        bestDist = dist;
        closest = magnet;
      }
    }
    return bestDist <= radius * 1.2 ? closest : null;
  }

  setScreensaverEnabled(enabled) {
    this.state.screensaverEnabled = enabled;
    this.screensaver.active = enabled;
    this.screensaver.elapsed = 0;
    this.screensaver.nextTransition = this.state.screensaverInterval;
    this.screensaver.driftSeeds = this.generateDriftSeeds();
  }

  setScreensaverDrift(value) {
    this.state.screensaverDrift = Math.max(0, Math.min(60, value));
  }

  setScreensaverInterval(value) {
    this.state.screensaverInterval = Math.max(5, Math.min(120, value));
    this.screensaver.nextTransition = this.state.screensaverInterval;
    this.screensaver.elapsed = 0;
  }

  triggerScreensaverTransition() {
    const theme = FerroSimulation.pickRandomTheme();
    this.setState({
      particleColor: theme.particleColor,
      magnetColor: theme.magnetColor,
      fieldLineColor: theme.fieldColor,
      particleGlow: theme.glow,
    });
    const root = document.documentElement;
    root.style.setProperty('--accent', this.state.particleColor);
    if (this.state.lifeMode && theme.lifeRule) {
      this.setState({ lifeRule: theme.lifeRule });
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

  randomizeScreensaver() {
    this.screensaver.elapsed = 0;
    this.screensaver.nextTransition = this.state.screensaverInterval;
    this.screensaver.driftSeeds = this.generateDriftSeeds();
    this.triggerScreensaverTransition();
  }

  generateDriftSeeds() {
    const count = Math.max(1, this.magnets.length);
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
}
