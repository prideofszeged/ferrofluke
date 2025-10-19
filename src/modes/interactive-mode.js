import { SimulationMode } from './simulation-mode.js';

/**
 * Interactive particle mode with manual magnet control.
 * Users can click and drag magnets to affect the ferrofluid particles.
 */
export class InteractiveMode extends SimulationMode {
  constructor(simulation) {
    super(simulation);
    this._frame = 0;
  }

  update(dt) {
    const { particles, magnets, state } = this.simulation;
    const activeMagnets = state.magnetEnabled ? magnets : [];
    particles.update(dt, state, activeMagnets);
    this._frame += 1;
  }

  render(ctx) {
    const { state, particles } = this.simulation;

    // Draw field lines if enabled
    if (state.showFieldLines && state.magnetEnabled) {
      this.drawFieldLines(ctx);
    }

    // Draw particles
    particles.draw(ctx, state);
  }

  drawFieldLines(ctx) {
    const { magnets, state, width, height } = this.simulation;
    const color = state.fieldLineColor;
    const radius = state.magnetSize;
    // Throttle drawing to reduce cost and samples
    if ((this._frame % 3) !== 0) return;
    const lines = 16;
    const maxSteps = 64;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.22;

    magnets.forEach((magnet) => {
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
          const force = state.magnetStrength * (radius / 18) * 50 / Math.pow(dist + radius, state.magnetFalloff + 0.3);

          const tangentX = -normY;
          const tangentY = normX;
          const swirl = (18 + radius * 0.4) / (dist / 40 + 1);

          stepX += (normX * force * magnet.mode * -0.02 + tangentX * swirl * 0.05);
          stepY += (normY * force * magnet.mode * -0.02 + tangentY * swirl * 0.05);

          if (stepX < -40 || stepX > width + 40 || stepY < -40 || stepY > height + 40) {
            break;
          }

          ctx.lineTo(stepX, stepY);
        }
        ctx.stroke();
      }
    });
    ctx.restore();
  }

  get name() {
    return 'interactive';
  }
}
