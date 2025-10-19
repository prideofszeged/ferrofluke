// Simple fireworks effect for Interactive mode.
// When nearby particles "touch", spawn spark fragments and respawn the particles.

export class FireworksEffect {
  constructor() {
    this.sparks = [];
    this.maxExplosionsPerFrame = 8;
    this.cooldownMs = 140; // minimal time before a particle can explode again
    this._lastExplodedAt = new WeakMap();
  }

  onEnter(sim) {
    // no-op for now
  }

  onExit(sim) {
    this.sparks.length = 0;
  }

  update(dt, sim) {
    const { particles } = sim;
    const list = particles.particles;
    if (!list || list.length < 2) return;

    // Update sparks
    this._updateSparks(dt, sim);

    // Build a simple spatial grid for neighbor checks
    const cellSize = 10; // ~ particle size scale
    const grid = new Map();
    const width = particles.width;
    const height = particles.height;

    for (let i = 0; i < list.length; i += 1) {
      const p = list[i];
      const cx = ((p.x / cellSize) | 0);
      const cy = ((p.y / cellSize) | 0);
      const key = (cx << 16) ^ cy;
      let bucket = grid.get(key);
      if (!bucket) {
        bucket = [];
        grid.set(key, bucket);
      }
      bucket.push(p);
    }

    let explosions = 0;
    const now = performance.now();
    const neighborOffsets = [
      [0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
    ];

    // Detect simple pairwise contacts within neighboring cells
    outer: for (const [key, bucket] of grid.entries()) {
      const cx = key >> 16;
      const cy = (key & 0xffff) << 16 >> 16; // sign-extend
      for (let b = 0; b < neighborOffsets.length; b += 1) {
        const nx = cx + neighborOffsets[b][0];
        const ny = cy + neighborOffsets[b][1];
        const nkey = (nx << 16) ^ ny;
        const nb = grid.get(nkey);
        if (!nb) continue;

        for (let i = 0; i < bucket.length; i += 1) {
          const a = bucket[i];
          const lastA = this._lastExplodedAt.get(a) || 0;
          if (now - lastA < this.cooldownMs) continue;
          for (let j = 0; j < nb.length; j += 1) {
            const bPart = nb[j];
            if (a === bPart) continue;
            const lastB = this._lastExplodedAt.get(bPart) || 0;
            if (now - lastB < this.cooldownMs) continue;

            const dx = bPart.x - a.x;
            const dy = bPart.y - a.y;
            const r = (a.size + bPart.size) * 0.5 * 0.55; // conservative touch threshold
            if (dx * dx + dy * dy <= r * r) {
              this._explode((a.x + bPart.x) * 0.5, (a.y + bPart.y) * 0.5, sim);
              this._respawnParticle(a, particles, width, height);
              this._respawnParticle(bPart, particles, width, height);
              this._lastExplodedAt.set(a, now);
              this._lastExplodedAt.set(bPart, now);
              explosions += 1;
              if (explosions >= this.maxExplosionsPerFrame) break outer;
            }
          }
        }
      }
    }
  }

  _respawnParticle(p, particles, width, height) {
    p.x = Math.random() * width;
    p.y = Math.random() * height;
    p.vx = (Math.random() - 0.5) * 8;
    p.vy = (Math.random() - 0.5) * 8;
    p.rotation = Math.random() * Math.PI * 2;
    p.spin = (Math.random() - 0.5) * 2;
    p.golden = false;
  }

  _explode(x, y, sim) {
    const sparks = this.sparks;
    const count = 14 + (Math.random() * 10 | 0);
    const baseHue = 40 + Math.random() * 40; // warm fireworks
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.2;
      const speed = 60 + Math.random() * 180;
      const life = 0.5 + Math.random() * 0.4;
      const size = 1 + Math.random() * 2.2;
      const sat = 70 + (Math.random() * 30 | 0);
      const light = 55 + (Math.random() * 25 | 0);
      sparks.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life,
        age: 0,
        size,
        color: `hsl(${(baseHue + i * 3) | 0} ${sat}% ${light}%)`,
      });
    }
  }

  _updateSparks(dt, sim) {
    const drag = Math.pow(0.86, dt * 60);
    const g = 50; // mild gravity
    for (let i = this.sparks.length - 1; i >= 0; i -= 1) {
      const s = this.sparks[i];
      s.age += dt;
      s.vx *= drag;
      s.vy = s.vy * drag + g * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.age >= s.life) {
        this.sparks.splice(i, 1);
      }
    }
  }

  render(ctx, sim) {
    if (this.sparks.length === 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.sparks.length; i += 1) {
      const s = this.sparks[i];
      const t = 1 - Math.min(1, s.age / s.life);
      ctx.globalAlpha = Math.max(0, t) * 0.9;
      ctx.fillStyle = s.color;
      ctx.shadowColor = s.color;
      ctx.shadowBlur = 6 + t * 10;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

