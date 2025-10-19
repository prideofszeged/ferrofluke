import { defaultState } from '../state/default-state.js';
import { Magnet } from './magnet.js';
import { ParticleSystem } from './particle-system.js';
import { LifeAutomaton } from './life-automaton.js';

/**
 * Central simulation orchestrator: manages canvas, state, magnets, and mode switching.
 * Delegates update/render logic to the current mode.
 */
export class FerroSimulation {
  constructor(canvas, initialState = {}, initialMode = null) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.state = { ...defaultState, ...initialState };

    this.dpr = window.devicePixelRatio || 1;
    this.width = 0;
    this.height = 0;

    this.pointerDown = false;
    this.shiftPressed = false;

    // Shared resources available to all modes
    this.magnets = [new Magnet()];
    this.activeMagnet = this.magnets[0];
    this.particles = new ParticleSystem();
    this.life = new LifeAutomaton();
    this.life.applyRule(this.state.lifeRule);

    // Mode management
    this.currentMode = initialMode;

    this.lastTimestamp = 0;
    this.running = false;

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

    // Simple performance governor state
    this.autoTuneEnabled = true;
    this.baseParticleTarget = this.state.particleCount;
    this.minParticleCount = 200;
    this._ftWindow = 60;
    this._ftIndex = 0;
    this._ftSum = this._ftWindow * 16;
    this._ft = new Array(this._ftWindow).fill(16);
    this._badFrames = 0;
    this._goodFrames = 0;
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

    // Ensure Life grid is sized correctly if in Life mode
    if (this.currentMode && this.currentMode.name === 'life') {
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
    this.tunePerformance(deltaMs);
    requestAnimationFrame(this.loop);
  }

  step(dt) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(4, 6, 10, 0.32)';
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.restore();

    // Delegate to current mode for update and render
    if (this.currentMode) {
      this.currentMode.update(dt);
    }

    this.render();
  }

  tunePerformance(frameMs) {
    if (!this.autoTuneEnabled) return;
    // Maintain rolling average of frame time
    const idx = this._ftIndex;
    this._ftSum -= this._ft[idx];
    this._ft[idx] = frameMs;
    this._ftSum += frameMs;
    this._ftIndex = (idx + 1) % this._ftWindow;
    const avg = this._ftSum / this._ftWindow;

    if (avg > 18) {
      this._badFrames += 1;
      this._goodFrames = 0;
    } else if (avg < 14) {
      this._goodFrames += 1;
      this._badFrames = 0;
    } else {
      this._badFrames = 0;
      this._goodFrames = 0;
    }

    // Step down quickly on sustained slow frames
    if (this._badFrames >= 15) {
      this._badFrames = 0;
      const nextCount = Math.max(this.minParticleCount, this.state.particleCount - 50);
      if (nextCount !== this.state.particleCount) {
        this.setState({ particleCount: nextCount });
      }
      if (this.state.particleGlow > 0) {
        this.setState({ particleGlow: Math.max(0, this.state.particleGlow - 2) });
      }
    }

    // Step up gently on sustained fast frames
    if (this._goodFrames >= 120) {
      this._goodFrames = 0;
      const nextCount = Math.min(this.baseParticleTarget, this.state.particleCount + 25);
      if (nextCount !== this.state.particleCount) {
        this.setState({ particleCount: nextCount });
      }
    }
  }

  render() {
    const ctx = this.ctx;

    // Delegate rendering to current mode
    if (this.currentMode) {
      this.currentMode.render(ctx);
    }

    // Always draw magnets on top if enabled
    if (this.state.magnetEnabled) {
      this.drawMagnet();
    }
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
    // Let mode handle event first
    if (this.currentMode && this.currentMode.handlePointerDown(event)) {
      return; // Mode handled it
    }

    // Default magnet control
    if (!this.state.magnetEnabled) return;
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
    // Let mode handle event first
    if (this.currentMode && this.currentMode.handlePointerUp(event)) {
      return;
    }

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
    // Let mode handle event first
    if (this.currentMode && this.currentMode.handlePointerMove(event)) {
      return;
    }

    if (!this.state.magnetEnabled) return;
    if (!this.pointerDown || !this.activeMagnet) return;
    const pos = this.getPointerPosition(event);
    if (!pos) return;
    this.activeMagnet.move(pos.x, pos.y, this.width, this.height, this.state.magnetSize);
  }

  handlePointerLeave() {
    // Let mode handle event first
    if (this.currentMode && this.currentMode.handlePointerLeave()) {
      return;
    }

    this.pointerDown = false;
    if (this.activeMagnet) {
      this.activeMagnet.endInteraction();
    }
  }

  handleKeyDown(event) {
    // Let mode handle event first
    if (this.currentMode && this.currentMode.handleKeyDown(event)) {
      return;
    }

    if (event.key === 'Shift') {
      this.shiftPressed = true;
      this.magnets.forEach((magnet) => magnet.setShiftPressed(true));
    }
    if (typeof event.key === 'string' && event.key.toLowerCase() === 'm') {
      if (this.isEventFromInteractiveElement(event)) return;
      event.preventDefault();
      this.toggleMagnetEnabled();
    }
  }

  handleKeyUp(event) {
    // Let mode handle event first
    if (this.currentMode && this.currentMode.handleKeyUp(event)) {
      return;
    }

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

  /**
   * Switch to a new simulation mode.
   * @param {SimulationMode} newMode The mode to switch to
   */
  setMode(newMode) {
    if (this.currentMode === newMode) return;

    // Exit current mode
    if (this.currentMode && this.currentMode.onExit) {
      this.currentMode.onExit();
    }

    // Switch mode
    this.currentMode = newMode;

    // Enter new mode
    if (this.currentMode && this.currentMode.onEnter) {
      this.currentMode.onEnter();
    }
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

    if (partial.magnetEnabled !== undefined) {
      this.setMagnetEnabled(Boolean(partial.magnetEnabled));
    }

    if (partial.magnetSize !== undefined) {
      this.state.magnetSize = Math.max(10, Math.min(60, partial.magnetSize));
      this.magnets.forEach((magnet) => magnet.clamp(this.width, this.height, this.state.magnetSize));
    }

    if (partial.lifeSpeed !== undefined) {
      this.state.lifeSpeed = Math.max(1, Math.min(60, partial.lifeSpeed));
    }

    if (partial.lifeCellSize !== undefined) {
      this.state.lifeCellSize = Math.max(6, Math.min(40, partial.lifeCellSize));
      if (this.currentMode && this.currentMode.name === 'life') {
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

    if (partial.screensaverDrift !== undefined) {
      this.state.screensaverDrift = Math.max(0, Math.min(60, partial.screensaverDrift));
    }

    if (partial.screensaverInterval !== undefined) {
      this.state.screensaverInterval = Math.max(5, Math.min(120, partial.screensaverInterval));
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

  setMagnetEnabled(enabled) {
    const next = Boolean(enabled);
    if (this.state.magnetEnabled === next) return;
    this.state.magnetEnabled = next;
    if (!next) {
      this.pointerDown = false;
      if (this.activeMagnet) {
        this.activeMagnet.endInteraction();
      }
    }
    if (this.updateMagnetToggleUI) {
      this.updateMagnetToggleUI(next);
    }
  }

  toggleMagnetEnabled() {
    this.setMagnetEnabled(!this.state.magnetEnabled);
  }

  isEventFromInteractiveElement(event) {
    const target = event.target;
    if (!target || !(target instanceof Element)) return false;
    if (target.closest('input, select, textarea, button, [contenteditable="true"]')) {
      return true;
    }
    return false;
  }
}
