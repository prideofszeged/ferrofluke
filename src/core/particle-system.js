/**
 * Handles particle integration and rendering for ferrofluid mode.
 */
export class ParticleSystem {
  constructor() {
    this.particles = [];
    this.width = 0;
    this.height = 0;
  }

  setBounds(width, height) {
    this.width = width;
    this.height = height;
  }

  /** Reset with a fresh set of particles. */
  reset(count) {
    this.particles = [];
    for (let i = 0; i < count; i += 1) {
      this.particles.push(this.createParticle());
    }
  }

  /** Ensure number of particles matches requested count. */
  setCount(count) {
    const target = Math.max(0, count);
    const current = this.particles.length;
    if (target === current) return;
    if (target > current) {
      for (let i = 0; i < target - current; i += 1) {
        this.particles.push(this.createParticle());
      }
    } else {
      this.particles.splice(target);
    }
  }

  /** Integrate velocities under magnet forces. */
  update(dt, state, magnets) {
    const particles = this.particles;
    if (!particles.length || !magnets || !magnets.length) return;

    const strength = state.magnetStrength;
    const falloff = state.magnetFalloff;
    const speed = state.particleSpeed;
    const magnetRadius = state.magnetSize;
    const sizeScale = magnetRadius / 22;

    const dtSeconds = Math.min(0.05, dt) * speed;
    const frameFactor = dtSeconds * 60;
    const damping = Math.pow(0.88, frameFactor);
    const jitterStrength = (18 + strength * 0.15) * dtSeconds;

    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i];
      let accumVx = 0;
      let accumVy = 0;

      magnets.forEach((magnet) => {
        const dx = magnet.x - p.x;
        const dy = magnet.y - p.y;
        const distSq = dx * dx + dy * dy + 0.0001;
        const dist = Math.sqrt(distSq);
        const normX = dx / dist;
        const normY = dy / dist;

        const field = strength * 130000 * sizeScale / Math.pow(dist + magnetRadius * 0.9, falloff + 1);
        const force = Math.max(-3000, Math.min(3000, field * magnet.mode));
        accumVx += normX * force * dtSeconds;
        accumVy += normY * force * dtSeconds;

        const swirl = (0.52 + strength / 420) * magnet.mode;
        const swirlScale = dtSeconds * 140 * sizeScale / (dist / 80 + 1.1);
        accumVx += -normY * swirl * swirlScale;
        accumVy += normX * swirl * swirlScale;
      });

      p.vx += accumVx;
      p.vy += accumVy;

      p.vx *= damping;
      p.vy *= damping;

      const jitter = (Math.sin(p.noise) + Math.cos(p.noise * 0.37)) * 0.5;
      p.vx += Math.sin(p.noise * 1.7) * jitterStrength * jitter;
      p.vy += Math.cos(p.noise * 1.3) * jitterStrength * jitter;
      p.noise += frameFactor * (0.005 + Math.random() * 0.004);

      p.x += p.vx * dtSeconds;
      p.y += p.vy * dtSeconds;
      p.rotation += p.spin * dt * speed;

      if (p.x < -20 || p.x > this.width + 20 || p.y < -20 || p.y > this.height + 20) {
        p.x = Math.random() * this.width;
        p.y = Math.random() * this.height;
        p.vx *= 0.2;
        p.vy *= 0.2;
      }
    }
  }

  /** Draw current particles. */
  draw(ctx, state) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = state.particleColor;
    ctx.strokeStyle = state.particleColor;
    ctx.shadowColor = state.particleColor;
    ctx.shadowBlur = state.particleGlow;
    const shape = state.particleShape;

    for (let i = 0; i < this.particles.length; i += 1) {
      const p = this.particles[i];
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      switch (shape) {
        case 'square':
          ctx.fillRect(-p.size * 0.5, -p.size * 0.5, p.size, p.size);
          break;
        case 'triangle':
          ctx.beginPath();
          ctx.moveTo(0, -p.size * 0.65);
          ctx.lineTo(p.size * 0.6, p.size * 0.5);
          ctx.lineTo(-p.size * 0.6, p.size * 0.5);
          ctx.closePath();
          ctx.fill();
          break;
        default:
          ctx.beginPath();
          ctx.arc(0, 0, p.size * 0.5, 0, Math.PI * 2);
          ctx.fill();
      }
      ctx.restore();
    }

    ctx.restore();
  }

  createParticle() {
    const size = 3.5 + Math.random() * 3.5;
    return {
      x: Math.random() * (this.width || 400),
      y: Math.random() * (this.height || 400),
      vx: (Math.random() - 0.5) * 20,
      vy: (Math.random() - 0.5) * 20,
      size,
      noise: Math.random() * Math.PI * 2,
      rotation: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 2,
    };
  }
}
