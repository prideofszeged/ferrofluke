import { InteractiveMode } from './interactive-mode.js';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const SCORE_PER_PARTICLE = 5;
const GOLDEN_BONUS = 20;

/**
 * Magnet Roundup game mode.
 * Extends InteractiveMode to add scoring ring and particle herding mechanics.
 */
export class GameMode extends InteractiveMode {
  constructor(simulation, options = {}) {
    super(simulation);

    this.options = {
      baseThreshold: options.baseThreshold ?? 60,
      baseTime: options.baseTime ?? 24,
      baseRadius: options.baseRadius ?? 120,
    };

    this.goal = null;
    this.round = 0;
    this.score = 0;
    this.bestScore = 0;
    this.streak = 0;
    this.topStreak = 0;
    this.timeRemaining = 0;
    this.timeLimit = 0;
    this.currentCount = 0;
    this.currentGolden = 0;
    this.statusMessage = 'Press start to herd particles into the glowing ring.';
    this.flashSuccess = 0;
    this.flashFail = 0;
    this.uiAccumulator = 0;
    this.cachedAccent = null;
    this.active = false;

    this.lastKnownWidth = 0;
    this.lastKnownHeight = 0;
    this.hud = null;

    this.boundHandleStart = this.handleStartButton.bind(this);
    this.boundHandleEnd = this.handleEndButton.bind(this);
  }

  handleEndButton() {
    // This will be overridden by controls.js to handle mode switching
    this.stopGame('Game ended.');
  }

  showHud() {
    if (this.hud?.root) {
      this.hud.root.style.display = 'flex';
    }
  }

  hideHud() {
    if (this.hud?.root) {
      this.hud.root.style.display = 'none';
    }
  }

  updateStatsDisplay() {
    const bestScoreDisplay = document.querySelector('[data-role="best-score-display"]');
    const topStreakDisplay = document.querySelector('[data-role="top-streak-display"]');

    if (bestScoreDisplay) {
      bestScoreDisplay.textContent = this.bestScore;
    }
    if (topStreakDisplay) {
      topStreakDisplay.textContent = this.topStreak;
    }
  }

  onEnter() {
    // Ensure magnet is enabled for gameplay
    if (!this.simulation.state.magnetEnabled) {
      this.simulation.state.magnetEnabled = true;
      if (this.simulation.updateMagnetToggleUI) {
        this.simulation.updateMagnetToggleUI(true);
      }
    }

    this.lastKnownWidth = this.simulation.width;
    this.lastKnownHeight = this.simulation.height;
    this.bindHud();
    this.placeIdleGoal();
    this.updateHud(true);

    // Show HUD when entering game mode
    this.showHud();
  }

  onExit() {
    if (this.hud?.button) {
      this.hud.button.removeEventListener('click', this.boundHandleStart);
    }
    if (this.hud?.endButton) {
      this.hud.endButton.removeEventListener('click', this.boundHandleEnd);
    }
    this.clearGoldenParticles();
    this.active = false;

    // Hide HUD when exiting game mode
    this.hideHud();

    // Update stats in Games tab
    this.updateStatsDisplay();
  }

  update(dt) {
    // Update particles (from InteractiveMode)
    super.update(dt);

    if (!this.goal) return;

    const { width, height, state } = this.simulation;

    // Handle window resize
    if (width !== this.lastKnownWidth || height !== this.lastKnownHeight) {
      this.lastKnownWidth = width;
      this.lastKnownHeight = height;
      this.ensureGoalWithinBounds();
      if (!this.active) {
        this.placeIdleGoal();
      }
    }

    this.drainFlashes(dt);

    // Idle mode - just count particles
    if (!this.active) {
      this.uiAccumulator += dt;
      if (this.uiAccumulator >= 0.25) {
        const counts = this.countParticles();
        this.currentCount = counts.inside;
        this.currentGolden = counts.goldenInside;
        this.uiAccumulator = 0;
        this.updateHud();
      }
      return;
    }

    // Active game mode
    const counts = this.countParticles();
    this.currentCount = counts.inside;
    this.currentGolden = counts.goldenInside;
    this.timeRemaining = Math.max(0, this.timeRemaining - dt);

    if (this.timeRemaining <= 0 && this.currentCount < this.goal.threshold) {
      this.handleFailure();
      return;
    }

    if (this.currentCount >= this.goal.threshold) {
      this.handleSuccess(this.currentGolden);
      return;
    }

    this.uiAccumulator += dt;
    if (this.uiAccumulator >= 0.1) {
      this.updateHud();
      this.uiAccumulator = 0;
    }
  }

  render(ctx) {
    // Render particles and field lines (from InteractiveMode)
    super.render(ctx);

    // Render goal ring
    this.drawGoal(ctx);
  }

  drawGoal(ctx) {
    if (!this.goal) return;
    const { x, y, radius } = this.goal;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;

    const accent = this.pickAccent();
    const progress = this.goal.threshold ? Math.min(1, this.currentCount / this.goal.threshold) : 0;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(x, y);

    const successBoost = this.flashSuccess > 0 ? 26 * this.flashSuccess : 0;
    const failBoost = this.flashFail > 0 ? 22 * this.flashFail : 0;

    ctx.shadowColor = this.flashFail > 0 ? 'rgba(255, 82, 96, 0.92)' : accent;
    ctx.shadowBlur = (this.active ? 26 : 18) + successBoost + failBoost;
    ctx.lineWidth = 4;
    ctx.globalAlpha = (this.active ? 0.35 : 0.18) + progress * 0.4;
    ctx.strokeStyle = this.flashFail > 0 ? 'rgba(255, 104, 118, 0.85)' : accent;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 0.1 + progress * 0.5;
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(0, 0, radius * (0.62 + progress * 0.28), 0, Math.PI * 2);
    ctx.fill();

    if (this.active && this.timeLimit > 0) {
      const timeRatio = Math.max(0, Math.min(1, this.timeRemaining / this.timeLimit));
      ctx.globalAlpha = 0.48;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(0, 0, radius + 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * timeRatio, false);
      ctx.stroke();
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = '#dff6ff';
    ctx.font = '600 17px "Segoe UI", Tahoma, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const targetText = this.goal ? `${this.currentCount}/${this.goal.threshold}` : '–';
    ctx.fillText(targetText, 0, 2);

    if (this.currentGolden > 0) {
      ctx.font = '500 13px "Segoe UI", Tahoma, sans-serif';
      ctx.fillStyle = '#ffe38a';
      ctx.fillText(`+${this.currentGolden * GOLDEN_BONUS}`, 0, radius * -0.55);
    }

    ctx.restore();
  }

  handleStartButton() {
    this.startGame();
  }

  startGame() {
    // Ensure magnet is on
    if (!this.simulation.state.magnetEnabled) {
      this.simulation.state.magnetEnabled = true;
      if (this.simulation.updateMagnetToggleUI) {
        this.simulation.updateMagnetToggleUI(true);
      }
    }

    this.score = 0;
    this.streak = 0;
    this.timeRemaining = 0;
    this.timeLimit = 0;
    this.round = 0;
    this.active = true;
    this.flashFail = 0;
    this.flashSuccess = 0;
    this.uiAccumulator = 0;
    this.prepareNextRound();
    this.statusMessage = `Round ${this.round}: Herd ${this.goal.threshold} particles into the ring.`;
    this.updateHud(true);
  }

  prepareNextRound() {
    const nextRound = this.round + 1;
    const radius = this.computeRadius(nextRound);
    const threshold = this.computeThreshold(nextRound);
    const timeLimit = this.computeTime(nextRound);
    const goldenCount = this.computeGolden(nextRound);

    this.round = nextRound;
    this.timeLimit = timeLimit;
    this.timeRemaining = timeLimit;
    this.goal = {
      x: this.simulation.width * 0.5,
      y: this.simulation.height * 0.5,
      radius,
      threshold,
      goldenCount,
      goldenValue: GOLDEN_BONUS,
    };
    this.moveGoalRandom();
    this.assignGoldenParticles(goldenCount);
    this.currentCount = 0;
    this.currentGolden = 0;
    this.uiAccumulator = 0;
  }

  computeRadius(round) {
    const base = this.options.baseRadius;
    return Math.max(70, Math.round(base - (round - 1) * 7));
  }

  computeThreshold(round) {
    const base = this.options.baseThreshold;
    return Math.round(base + (round - 1) * 9);
  }

  computeTime(round) {
    const base = this.options.baseTime;
    return Math.max(10, base - (round - 1) * 1.6);
  }

  computeGolden(round) {
    return Math.min(18, 4 + round * 2);
  }

  moveGoalRandom() {
    if (!this.goal) return;
    const { width, height } = this.simulation;
    if (!width || !height) return;
    const margin = this.goal.radius + 36;
    const minX = margin;
    const maxX = Math.max(margin, width - margin);
    const minY = margin;
    const maxY = Math.max(margin, height - margin);
    if (maxX <= minX || maxY <= minY) {
      this.goal.x = width * 0.5;
      this.goal.y = height * 0.5;
      return;
    }
    this.goal.x = minX + Math.random() * (maxX - minX);
    this.goal.y = minY + Math.random() * (maxY - minY);
  }

  ensureGoalWithinBounds() {
    if (!this.goal) return;
    const { width, height } = this.simulation;
    if (!width || !height) return;
    const margin = this.goal.radius + 32;
    const minX = margin;
    const maxX = Math.max(margin, width - margin);
    const minY = margin;
    const maxY = Math.max(margin, height - margin);
    this.goal.x = clamp(this.goal.x, minX, maxX);
    this.goal.y = clamp(this.goal.y, minY, maxY);
  }

  placeIdleGoal() {
    const radius = this.options.baseRadius;
    this.goal = {
      x: this.simulation.width * 0.5,
      y: this.simulation.height * 0.5,
      radius,
      threshold: this.options.baseThreshold,
      goldenCount: 0,
      goldenValue: GOLDEN_BONUS,
    };
    this.ensureGoalWithinBounds();
  }

  assignGoldenParticles(count) {
    const particles = this.simulation?.particles?.particles;
    if (!particles || !particles.length) return;
    particles.forEach((particle) => {
      particle.golden = false;
    });
    const target = Math.min(count, particles.length);
    const chosen = new Set();
    while (chosen.size < target) {
      const index = Math.floor(Math.random() * particles.length);
      if (chosen.has(index)) continue;
      particles[index].golden = true;
      chosen.add(index);
    }
  }

  clearGoldenParticles() {
    const particles = this.simulation?.particles?.particles;
    if (!particles) return;
    particles.forEach((particle) => {
      particle.golden = false;
    });
  }

  countParticles() {
    const particles = this.simulation?.particles?.particles;
    if (!particles || !particles.length || !this.goal) {
      return { inside: 0, goldenInside: 0 };
    }
    const radiusSq = this.goal.radius * this.goal.radius;
    let inside = 0;
    let goldenInside = 0;
    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i];
      const dx = p.x - this.goal.x;
      const dy = p.y - this.goal.y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= radiusSq) {
        inside += 1;
        if (p.golden) {
          goldenInside += 1;
        }
      }
    }
    return { inside, goldenInside };
  }

  drainFlashes(dt) {
    if (this.flashSuccess > 0) {
      this.flashSuccess = Math.max(0, this.flashSuccess - dt * 1.8);
    }
    if (this.flashFail > 0) {
      this.flashFail = Math.max(0, this.flashFail - dt * 1.4);
    }
  }

  handleSuccess(goldenInside) {
    const clearedRound = this.round;
    const timeBonus = Math.round(this.timeRemaining * 12);
    const goldenBonus = goldenInside * GOLDEN_BONUS;
    const roundScore = this.goal.threshold * SCORE_PER_PARTICLE + timeBonus + goldenBonus;
    this.score += roundScore;
    this.bestScore = Math.max(this.bestScore, this.score);
    this.streak += 1;
    this.topStreak = Math.max(this.topStreak, this.streak);
    this.flashSuccess = 0.65;

    this.prepareNextRound();
    this.statusMessage = `Round ${clearedRound} cleared! +${roundScore} pts. Next target: ${this.goal.threshold}.`;
    this.updateHud(true);
  }

  handleFailure(message) {
    this.flashFail = message ? 0 : 0.8;
    this.bestScore = Math.max(this.bestScore, this.score);
    this.topStreak = Math.max(this.topStreak, this.streak);
    this.statusMessage = message ?? `Run over! You gathered ${this.currentCount}/${this.goal.threshold}.`;
    this.active = false;
    this.timeRemaining = 0;
    this.streak = 0;
    this.clearGoldenParticles();
    this.currentGolden = 0;
    this.updateHud(true);
    this.updateStatsDisplay();
  }

  pickAccent() {
    const accent = this.simulation.state?.particleColor;
    if (accent && typeof accent === 'string') {
      this.cachedAccent = accent;
      return accent;
    }
    if (this.cachedAccent) return this.cachedAccent;
    return '#1e90ff';
  }

  bindHud() {
    const root = document.getElementById('game-hud');
    if (!root) return;
    this.hud = {
      root,
      score: root.querySelector('[data-role="score"]'),
      best: root.querySelector('[data-role="best"]'),
      streak: root.querySelector('[data-role="streak"]'),
      topStreak: root.querySelector('[data-role="top-streak"]'),
      timer: root.querySelector('[data-role="timer"]'),
      target: root.querySelector('[data-role="target"]'),
      status: root.querySelector('[data-role="status"]'),
      button: document.querySelector('#game-start'),
      endButton: root.querySelector('#game-end'),
    };
    if (this.hud.button) {
      this.hud.button.addEventListener('click', this.boundHandleStart);
    }
    if (this.hud.endButton) {
      this.hud.endButton.addEventListener('click', this.boundHandleEnd);
    }
    root.classList.add('ready');
  }

  updateHud(force = false) {
    if (!this.hud) return;
    const { score, best, streak, topStreak, timer, target, status } = this.hud;
    if (score) score.textContent = this.score;
    if (best) best.textContent = this.bestScore;
    if (streak) streak.textContent = this.streak;
    if (topStreak) topStreak.textContent = this.topStreak;
    if (target && this.goal) {
      target.textContent = `${this.currentCount}/${this.goal.threshold}`;
    }
    if (timer) {
      timer.textContent = this.active ? this.timeRemaining.toFixed(1) : '--';
    }
    if (status) {
      status.textContent = this.statusMessage;
    }
  }

  get name() {
    return 'game';
  }

  get allowsScreensaver() {
    return false; // Game mode is exclusive
  }
}
