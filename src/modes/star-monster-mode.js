import { InteractiveMode } from './interactive-mode.js';

/**
 * Feed the Star Monster game mode.
 * Feed particles to a growing star monster, but don't let it get too big or it explodes!
 */
export class StarMonsterMode extends InteractiveMode {
  constructor(simulation) {
    super(simulation);

    // Star monster state
    this.monster = {
      x: 0,
      y: 0,
      size: 40,
      maxSize: 200,
      growthPerParticle: 2.5,
      attractionRadius: 150,
      attractionStrength: 180,
    };

    // Game state
    this.score = 0;
    this.bestScore = 0;
    this.particlesEaten = 0;
    this.active = false;
    this.exploding = false;
    this.explosionTime = 0;
    this.fireworks = [];

    this.hud = null;
    this.boundHandleStart = this.handleStartButton.bind(this);
    this.boundHandleEnd = this.handleEndButton.bind(this);
  }

  onEnter() {
    this.monster.x = this.simulation.width * 0.5;
    this.monster.y = this.simulation.height * 0.5;
    this.bindHud();
    this.showHud();
  }

  onExit() {
    if (this.hud?.button) {
      this.hud.button.removeEventListener('click', this.boundHandleStart);
    }
    if (this.hud?.endButton) {
      this.hud.endButton.removeEventListener('click', this.boundHandleEnd);
    }
    this.hideHud();
    this.updateStatsDisplay();
  }

  handleStartButton() {
    this.startGame();
  }

  handleEndButton() {
    this.stopGame();
  }

  startGame() {
    this.score = 0;
    this.particlesEaten = 0;
    this.monster.size = 40;
    this.active = true;
    this.exploding = false;
    this.fireworks = [];
    this.monster.x = this.simulation.width * 0.5;
    this.monster.y = this.simulation.height * 0.5;
    this.updateHud();
  }

  stopGame() {
    this.active = false;
    this.exploding = false;
    this.bestScore = Math.max(this.bestScore, this.score);
    this.updateHud();
    this.updateStatsDisplay();
  }

  update(dt) {
    // Always update particles with normal physics (includes magnets)
    super.update(dt);

    // Add monster-specific behavior if active
    if (this.active && !this.exploding) {
      this.applyMonsterAttraction(dt);
      this.checkCollisions();
    }

    // Update explosion animation
    if (this.exploding) {
      this.updateExplosion(dt);
    }

    // Check for explosion
    if (this.active && !this.exploding && this.monster.size >= this.monster.maxSize) {
      this.triggerExplosion();
    }
  }

  applyMonsterAttraction(dt) {
    const particleArray = this.simulation.particles.particles;
    if (!particleArray || !particleArray.length) return;

    const speed = this.simulation.state.particleSpeed;
    const dtSeconds = Math.min(0.05, dt) * speed;

    // Apply additional monster attraction force to each particle
    for (let i = 0; i < particleArray.length; i += 1) {
      const p = particleArray[i];
      const dx = this.monster.x - p.x;
      const dy = this.monster.y - p.y;
      const distSq = dx * dx + dy * dy + 0.0001;
      const dist = Math.sqrt(distSq);

      if (dist < this.monster.attractionRadius) {
        const normX = dx / dist;
        const normY = dy / dist;
        const attractionForce = this.monster.attractionStrength * (1 - dist / this.monster.attractionRadius);
        p.vx += normX * attractionForce * dtSeconds;
        p.vy += normY * attractionForce * dtSeconds;
      }
    }
  }

  checkCollisions() {
    const particleArray = this.simulation.particles.particles;
    if (!particleArray) return;

    const eatRadius = this.monster.size * 0.5;

    // Check each particle
    for (let i = particleArray.length - 1; i >= 0; i--) {
      const p = particleArray[i];
      const dx = p.x - this.monster.x;
      const dy = p.y - this.monster.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < eatRadius * eatRadius) {
        // Particle eaten!
        this.eatParticle(i);
      }
    }
  }

  eatParticle(index) {
    const particleArray = this.simulation.particles.particles;

    // Remove particle
    particleArray.splice(index, 1);

    // Grow monster
    this.monster.size += this.monster.growthPerParticle;
    this.particlesEaten += 1;
    this.score += 10;

    this.updateHud();
  }

  triggerExplosion() {
    this.exploding = true;
    this.explosionTime = 0;
    this.active = false;
    this.bestScore = Math.max(this.bestScore, this.score);

    // Create fireworks
    this.fireworks = [];
    const fireworkCount = 20;
    for (let i = 0; i < fireworkCount; i++) {
      const angle = (i / fireworkCount) * Math.PI * 2;
      const speed = 150 + Math.random() * 100;
      this.fireworks.push({
        x: this.monster.x,
        y: this.monster.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: 0.3 + Math.random() * 0.4,
        color: this.getRandomColor(),
        size: 4 + Math.random() * 4,
      });
    }

    // Reset particles
    this.simulation.particles.reset(this.simulation.state.particleCount);
    this.updateHud();
  }

  updateExplosion(dt) {
    this.explosionTime += dt;

    // Update fireworks
    for (let i = this.fireworks.length - 1; i >= 0; i--) {
      const fw = this.fireworks[i];
      fw.x += fw.vx * dt;
      fw.y += fw.vy * dt;
      fw.vy += 200 * dt; // Gravity
      fw.life -= fw.decay * dt;

      if (fw.life <= 0) {
        this.fireworks.splice(i, 1);
      }
    }

    // End explosion after fireworks fade
    if (this.explosionTime > 3 && this.fireworks.length === 0) {
      this.exploding = false;
      this.monster.size = 40;
    }
  }

  getRandomColor() {
    const colors = ['#ff4e50', '#ffb347', '#48d1cc', '#9d60ff', '#7fffb8', '#ffe38a'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  render(ctx) {
    // Render particles and field lines (from InteractiveMode)
    super.render(ctx);

    // Render star monster
    if (!this.exploding) {
      this.drawMonster(ctx);
    }

    // Render fireworks
    if (this.exploding) {
      this.drawFireworks(ctx);
    }
  }

  drawMonster(ctx) {
    ctx.save();
    ctx.translate(this.monster.x, this.monster.y);

    // Pulsing effect
    const pulse = 1 + Math.sin(Date.now() * 0.003) * 0.05;
    const size = this.monster.size * pulse;

    // Warning color when near explosion
    const dangerRatio = this.monster.size / this.monster.maxSize;
    let color = '#ffeb3b';
    if (dangerRatio > 0.8) {
      color = dangerRatio > 0.95 ? '#ff1744' : '#ff9800';
    }

    // Draw star shape
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 30;

    const spikes = 5;
    const outerRadius = size * 0.5;
    const innerRadius = size * 0.25;

    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const angle = (i * Math.PI) / spikes - Math.PI / 2;
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.fill();

    // Draw eyes
    ctx.globalCompositeOperation = 'source-over';
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#000000';
    const eyeSize = size * 0.08;
    const eyeOffset = size * 0.15;
    ctx.beginPath();
    ctx.arc(-eyeOffset, -eyeOffset * 0.3, eyeSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(eyeOffset, -eyeOffset * 0.3, eyeSize, 0, Math.PI * 2);
    ctx.fill();

    // Draw mouth
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = size * 0.04;
    ctx.beginPath();
    ctx.arc(0, eyeOffset * 0.5, size * 0.2, 0, Math.PI);
    ctx.stroke();

    ctx.restore();
  }

  drawFireworks(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (let i = 0; i < this.fireworks.length; i++) {
      const fw = this.fireworks[i];
      ctx.fillStyle = fw.color;
      ctx.globalAlpha = fw.life;
      ctx.shadowColor = fw.color;
      ctx.shadowBlur = 20;

      ctx.beginPath();
      ctx.arc(fw.x, fw.y, fw.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  bindHud() {
    const root = document.getElementById('star-monster-hud');
    if (!root) return;
    this.hud = {
      root,
      score: root.querySelector('[data-role="star-score"]'),
      size: root.querySelector('[data-role="star-size"]'),
      eaten: root.querySelector('[data-role="star-eaten"]'),
      button: document.querySelector('#star-monster-start'),
      endButton: root.querySelector('#star-monster-end'),
    };
    if (this.hud.button) {
      this.hud.button.addEventListener('click', this.boundHandleStart);
    }
    if (this.hud.endButton) {
      this.hud.endButton.addEventListener('click', this.boundHandleEnd);
    }
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

  updateHud() {
    if (!this.hud) return;
    const { score, size, eaten } = this.hud;

    if (score) {
      score.textContent = this.score;
    }
    if (size) {
      const sizePercent = Math.round((this.monster.size / this.monster.maxSize) * 100);
      size.textContent = `${sizePercent}%`;
      // Change color based on danger
      if (sizePercent > 95) {
        size.style.color = '#ff1744';
      } else if (sizePercent > 80) {
        size.style.color = '#ff9800';
      } else {
        size.style.color = '#f2faff';
      }
    }
    if (eaten) {
      eaten.textContent = this.particlesEaten;
    }
  }

  updateStatsDisplay() {
    const bestScoreDisplay = document.querySelector('[data-role="star-best-score-display"]');
    if (bestScoreDisplay) {
      bestScoreDisplay.textContent = this.bestScore;
    }
  }

  get name() {
    return 'star-monster';
  }

  get allowsScreensaver() {
    return false; // Game mode is exclusive
  }
}
