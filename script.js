const defaultState = {
  particleCount: 700,
  particleColor: '#1e90ff',
  particleShape: 'circle',
  particleGlow: 12,
  particleSpeed: 1,
  magnetStrength: 220,
  magnetFalloff: 1.6,
  magnetSize: 22,
  magnetColor: '#ff4500',
  showFieldLines: true,
  fieldLineColor: '#ffffff',
  lifeMode: false,
  lifeSpeed: 10,
  lifeCellSize: 16,
  lifeRule: 'B3/S23',
  lifeMagnetBias: 0.4,
  lifeAliveColor: '#1e90ff',
  lifeDeadColor: '#0b1020',
};

class FerroSimulation {
  constructor(canvas, initialState = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.state = { ...defaultState, ...initialState };
    this.dpr = window.devicePixelRatio || 1;
    this.width = 0;
    this.height = 0;

    this.particles = [];
    this.pointerDown = false;
    this.shiftPressed = false;

    this.magnet = {
      x: 0,
      y: 0,
      homeX: 0,
      homeY: 0,
      mode: 1,
      isActive: false,
      anchored: false,
    };

    this.lastTimestamp = 0;
    this.running = false;

    this.life = {
      cols: 0,
      rows: 0,
      cellSize: this.state.lifeCellSize,
      grid: new Uint8Array(0),
      buffer: new Uint8Array(0),
      accumulator: 0,
      birthMask: new Array(9).fill(false),
      surviveMask: new Array(9).fill(false),
      seeded: false,
    };

    this.loop = this.loop.bind(this);
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerLeave = this.handlePointerLeave.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.clampMagnetPosition = this.clampMagnetPosition.bind(this);
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

    this.applyLifeRule(this.state.lifeRule);
    this.attachEvents();
    this.resize();
    this.resetParticles();
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

    this.magnet.homeX = this.width * 0.5;
    this.magnet.homeY = this.height * 0.5;
    if (!this.magnet.anchored) {
      this.magnet.x = this.magnet.homeX;
      this.magnet.y = this.magnet.homeY;
    }
    this.clampMagnetPosition();
    if (this.state.lifeMode) {
      this.ensureLifeGrid(true);
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

    this.updateMagnet(dt);
    if (this.state.lifeMode) {
      this.updateLife(dt);
    } else {
      this.updateParticles(dt);
    }
    this.render();
  }

  updateMagnet(dt) {
    this.magnet.mode = this.shiftPressed ? -1 : 1;
  }

  clampMagnetPosition() {
    const radius = this.state.magnetSize;
    const minX = radius;
    const maxX = this.width - radius;
    const minY = radius;
    const maxY = this.height - radius;

    if (maxX <= minX) {
      this.magnet.x = this.width * 0.5;
    } else {
      this.magnet.x = Math.min(Math.max(this.magnet.x, minX), maxX);
    }

    if (maxY <= minY) {
      this.magnet.y = this.height * 0.5;
    } else {
      this.magnet.y = Math.min(Math.max(this.magnet.y, minY), maxY);
    }
  }

  updateParticles(dt) {
    const particles = this.particles;
    const magnetX = this.magnet.x;
    const magnetY = this.magnet.y;
    const magnetMode = this.magnet.mode;
    const strength = this.state.magnetStrength;
    const falloff = this.state.magnetFalloff;
    const speed = this.state.particleSpeed;
    const magnetRadius = this.state.magnetSize;
    const sizeScale = magnetRadius / 22;

    const dtSeconds = Math.min(0.05, dt) * speed;
    const frameFactor = dtSeconds * 60;
    const damping = Math.pow(0.88, frameFactor);
    const jitterStrength = (18 + strength * 0.15) * dtSeconds;

    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i];
      const dx = magnetX - p.x;
      const dy = magnetY - p.y;
      const distSq = dx * dx + dy * dy + 0.0001;
      const dist = Math.sqrt(distSq);
      const normX = dx / dist;
      const normY = dy / dist;

      const field = strength * 130000 * sizeScale / Math.pow(dist + magnetRadius * 0.9, falloff + 1);
      const force = Math.max(-3000, Math.min(3000, field * magnetMode));
      p.vx += normX * force * dtSeconds;
      p.vy += normY * force * dtSeconds;

      const swirl = (0.52 + strength / 420) * magnetMode;
      const swirlScale = dtSeconds * 140 * sizeScale / (dist / 80 + 1.1);
      p.vx += -normY * swirl * swirlScale;
      p.vy += normX * swirl * swirlScale;

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

  updateLife(dt) {
    this.ensureLifeGrid();
    if (this.life.cols === 0 || this.life.rows === 0) return;
    const speed = Math.max(1, this.state.lifeSpeed);
    const interval = 1 / speed;
    this.life.accumulator += dt;

    while (this.life.accumulator >= interval) {
      this.life.accumulator -= interval;
      this.stepLifeGeneration();
    }
  }

  stepLifeGeneration() {
    const { cols, rows, grid, buffer, cellSize, birthMask, surviveMask } = this.life;
    const magnetX = this.magnet.x;
    const magnetY = this.magnet.y;
    const magnetMode = this.magnet.mode;
    const magnetRadius = this.state.magnetSize * 2.4;
    const magnetBias = this.state.lifeMagnetBias;

    if (grid.length === 0) return;

    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const idx = y * cols + x;
        const alive = grid[idx];

        let neighbors = 0;
        for (let ny = -1; ny <= 1; ny += 1) {
          for (let nx = -1; nx <= 1; nx += 1) {
            if (nx === 0 && ny === 0) continue;
            const cx = (x + nx + cols) % cols;
            const cy = (y + ny + rows) % rows;
            neighbors += grid[cy * cols + cx];
          }
        }

        let nextState = alive ? (surviveMask[neighbors] ? 1 : 0) : (birthMask[neighbors] ? 1 : 0);

        if (magnetBias > 0 && magnetRadius > 0) {
          const cellCenterX = x * cellSize + cellSize * 0.5;
          const cellCenterY = y * cellSize + cellSize * 0.5;
          const dx = magnetX - cellCenterX;
          const dy = magnetY - cellCenterY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < magnetRadius) {
            const influence = (1 - dist / magnetRadius) * magnetBias;
            if (magnetMode > 0) {
              if (Math.random() < influence) {
                nextState = 1;
              }
            } else if (magnetMode < 0) {
              if (Math.random() < influence) {
                nextState = 0;
              }
            }
          }
        }

        buffer[idx] = nextState;
      }
    }

    this.life.grid = buffer;
    this.life.buffer = grid;
  }

  ensureLifeGrid(force = false) {
    const desiredCell = Math.max(6, Math.min(40, this.state.lifeCellSize));
    if (desiredCell !== this.life.cellSize) {
      this.life.cellSize = desiredCell;
      force = true;
    }

    const cols = Math.max(4, Math.floor(this.width / this.life.cellSize));
    const rows = Math.max(4, Math.floor(this.height / this.life.cellSize));

    if (!force && cols === this.life.cols && rows === this.life.rows) {
      return;
    }

    const oldCols = this.life.cols;
    const oldRows = this.life.rows;
    const oldGrid = this.life.grid;

    const newGrid = new Uint8Array(cols * rows);
    const newBuffer = new Uint8Array(cols * rows);

    if (oldGrid && oldGrid.length && oldCols && oldRows) {
      const copyCols = Math.min(cols, oldCols);
      const copyRows = Math.min(rows, oldRows);
      for (let y = 0; y < copyRows; y += 1) {
        for (let x = 0; x < copyCols; x += 1) {
          newGrid[y * cols + x] = oldGrid[y * oldCols + x];
        }
      }
    }

    this.life.cols = cols;
    this.life.rows = rows;
    this.life.grid = newGrid;
    this.life.buffer = newBuffer;
    this.life.seeded = newGrid.some((value) => value === 1);
  }

  applyLifeRule(ruleString) {
    const { rule, birthMask, surviveMask } = FerroSimulation.parseLifeRule(ruleString);
    this.state.lifeRule = rule;
    this.life.birthMask = birthMask;
    this.life.surviveMask = surviveMask;
  }

  static parseLifeRule(ruleString) {
    const defaultRule = {
      rule: 'B3/S23',
      birthMask: (() => {
        const arr = new Array(9).fill(false);
        arr[3] = true;
        return arr;
      })(),
      surviveMask: (() => {
        const arr = new Array(9).fill(false);
        arr[2] = true;
        arr[3] = true;
        return arr;
      })(),
    };

    if (!ruleString) return defaultRule;

    const cleaned = ruleString.trim().toUpperCase();
    const match = cleaned.match(/^B(\d*)\/?S(\d*)$/);
    if (!match) return defaultRule;

    const birthDigits = [...new Set(match[1].split('').map((d) => parseInt(d, 10)).filter((n) => n >= 0 && n <= 8))];
    const surviveDigits = [...new Set(match[2].split('').map((d) => parseInt(d, 10)).filter((n) => n >= 0 && n <= 8))];

    if (birthDigits.length === 0 && surviveDigits.length === 0) {
      return defaultRule;
    }

    const birthMask = new Array(9).fill(false);
    birthDigits.forEach((n) => {
      birthMask[n] = true;
    });

    const surviveMask = new Array(9).fill(false);
    surviveDigits.forEach((n) => {
      surviveMask[n] = true;
    });

    const normalized = `B${birthDigits.join('')}/S${surviveDigits.join('')}`;

    return { rule: normalized, birthMask, surviveMask };
  }

  randomizeLife(density = 0.4) {
    this.ensureLifeGrid();
    const { grid, buffer } = this.life;
    for (let i = 0; i < grid.length; i += 1) {
      grid[i] = Math.random() < density ? 1 : 0;
    }
    if (buffer && buffer.length === grid.length) {
      buffer.fill(0);
    }
    this.life.seeded = true;
  }

  clearLife() {
    const { grid, buffer } = this.life;
    grid.fill(0);
    buffer.fill(0);
    this.life.seeded = false;
  }

  setLifeMode(enabled) {
    if (enabled === this.state.lifeMode) return;
    this.state.lifeMode = enabled;
    this.life.accumulator = 0;
    if (enabled) {
      this.ensureLifeGrid(true);
      if (!this.life.seeded) {
        this.randomizeLife(0.42);
      }
    }
  }

  drawLife() {
    const { cols, rows, cellSize, grid } = this.life;
    if (!cols || !rows || grid.length === 0) return;
    const ctx = this.ctx;
    const aliveColor = this.state.lifeAliveColor;
    const deadColor = this.state.lifeDeadColor;
    const inner = Math.max(cellSize * 0.7, cellSize - 2);
    const margin = (cellSize - inner) * 0.5;

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.shadowBlur = 0;

    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const idx = y * cols + x;
        const colour = grid[idx] ? aliveColor : deadColor;
        ctx.fillStyle = colour;
        const drawX = x * cellSize + margin;
        const drawY = y * cellSize + margin;
        ctx.fillRect(drawX, drawY, inner, inner);
      }
    }

    ctx.restore();
  }

  render() {
    if (this.state.showFieldLines) {
      this.drawFieldLines();
    }
    if (this.state.lifeMode) {
      this.drawLife();
    } else {
      this.drawParticles();
    }
    this.drawMagnet();
  }

  drawParticles() {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = this.state.particleColor;
    ctx.strokeStyle = this.state.particleColor;
    ctx.shadowColor = this.state.particleColor;
    ctx.shadowBlur = this.state.particleGlow;
    const shape = this.state.particleShape;

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

  drawFieldLines() {
    const ctx = this.ctx;
    const magnet = this.magnet;
    const color = this.state.fieldLineColor;
    const radius = this.state.magnetSize;
    const lines = 28;
    const maxSteps = 96;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.22;

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

        stepX += (normX * force * this.magnet.mode * -0.02 + tangentX * swirl * 0.05);
        stepY += (normY * force * this.magnet.mode * -0.02 + tangentY * swirl * 0.05);

        if (stepX < -40 || stepX > this.width + 40 || stepY < -40 || stepY > this.height + 40) {
          break;
        }

        ctx.lineTo(stepX, stepY);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  drawMagnet() {
    const ctx = this.ctx;
    const radius = this.state.magnetSize;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.translate(this.magnet.x, this.magnet.y);
    ctx.fillStyle = this.state.magnetColor;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.globalAlpha = this.magnet.isActive ? 0.9 : 0.6;

    ctx.shadowColor = this.state.magnetColor;
    ctx.shadowBlur = 20;

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.beginPath();
    if (this.magnet.mode > 0) {
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
  }

  handlePointerDown(event) {
    this.pointerDown = true;
    const pos = this.getPointerPosition(event);
    if (pos) {
      this.magnet.x = pos.x;
      this.magnet.y = pos.y;
    }
    this.clampMagnetPosition();
    this.magnet.isActive = true;
    this.magnet.anchored = false;
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
    this.magnet.isActive = false;
    this.magnet.anchored = true;
    if (event && this.canvas.releasePointerCapture) {
      try {
        this.canvas.releasePointerCapture(event.pointerId);
      } catch (err) {
        // ignore release errors
      }
    }
  }

  handlePointerMove(event) {
    if (!this.pointerDown) return;
    const pos = this.getPointerPosition(event);
    if (!pos) return;
    this.magnet.x = pos.x;
    this.magnet.y = pos.y;
    this.clampMagnetPosition();
    this.magnet.isActive = true;
  }

  handlePointerLeave() {
    this.pointerDown = false;
    this.magnet.isActive = false;
    this.magnet.anchored = true;
  }

  handleKeyDown(event) {
    if (event.key === 'Shift') {
      this.shiftPressed = true;
    }
  }

  handleKeyUp(event) {
    if (event.key === 'Shift') {
      this.shiftPressed = false;
    }
  }

  getPointerPosition(event) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left);
    const y = (event.clientY - rect.top);
    if (Number.isNaN(x) || Number.isNaN(y)) {
      return null;
    }
    return { x, y };
  }

  setState(partial) {
    const prevCount = this.state.particleCount;
    this.state = { ...this.state, ...partial };
    if (partial.particleCount !== undefined && partial.particleCount !== prevCount) {
      this.updateParticleCount(this.state.particleCount);
    }
    if (partial.particleGlow !== undefined) {
      this.state.particleGlow = Math.max(0, partial.particleGlow);
    }
    if (partial.particleSpeed !== undefined) {
      this.state.particleSpeed = Math.max(0.2, Math.min(3, partial.particleSpeed));
    }
    if (partial.magnetSize !== undefined) {
      this.state.magnetSize = Math.max(10, Math.min(60, partial.magnetSize));
      this.clampMagnetPosition();
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
        this.ensureLifeGrid(true);
      }
    }
    if (partial.lifeRule !== undefined) {
      this.applyLifeRule(partial.lifeRule);
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
  }

  updateParticleCount(targetCount) {
    const current = this.particles.length;
    if (targetCount === current) return;

    if (targetCount > current) {
      const toAdd = targetCount - current;
      for (let i = 0; i < toAdd; i += 1) {
        this.particles.push(this.createParticle());
      }
    } else {
      this.particles.splice(targetCount);
    }
  }

  resetParticles() {
    this.particles = [];
    for (let i = 0; i < this.state.particleCount; i += 1) {
      this.particles.push(this.createParticle());
    }
  }

  createParticle() {
    const size = 3.5 + Math.random() * 3.5;
    return {
      x: Math.random() * this.width || Math.random() * 400,
      y: Math.random() * this.height || Math.random() * 400,
      vx: (Math.random() - 0.5) * 20,
      vy: (Math.random() - 0.5) * 20,
      size,
      noise: Math.random() * Math.PI * 2,
      rotation: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 2,
    };
  }
}

const canvas = document.getElementById('ferro-canvas');
const simulation = new FerroSimulation(canvas);
simulation.start();

const controlsForm = document.getElementById('controls-form');

function updateRangeTooltip(input, formatter = (value) => value) {
  if (!input) return;
  const formatted = formatter(input.value);
  input.title = formatted;
  input.setAttribute('aria-valuetext', formatted);
}

function setupControls(sim) {
  if (!controlsForm) return;
  controlsForm.addEventListener('submit', (event) => event.preventDefault());

  const root = document.documentElement;
  const get = (id) => document.getElementById(id);

  const particleCount = get('particle-count');
  const particleShape = get('particle-shape');
  const particleColor = get('particle-color');
  const particleGlow = get('particle-glow');
  const particleSpeed = get('particle-speed');
  const magnetStrength = get('magnet-strength');
  const magnetFalloff = get('magnet-falloff');
  const magnetSize = get('magnet-size');
  const magnetColor = get('magnet-color');
  const showFieldLines = get('show-field-lines');
  const fieldLineColor = get('field-line-color');
  const resetButton = get('reset-button');
  const lifeMode = get('life-mode');
  const lifeSpeed = get('life-speed');
  const lifeCellSize = get('life-cell-size');
  const lifeRule = get('life-rule');
  const lifePreset = get('life-preset');
  const lifeMagnetBias = get('life-magnet-bias');
  const lifeAliveColor = get('life-alive-color');
  const lifeDeadColor = get('life-dead-color');
  const lifeRandomize = get('life-randomize');
  const lifeClear = get('life-clear');

  const syncLifeToggleState = () => {
    if (!lifeMode) return;
    lifeMode.checked = sim.state.lifeMode;
    const particleControls = [particleCount, particleShape, particleGlow, particleSpeed];
    particleControls.forEach((input) => {
      if (!input) return;
      input.disabled = sim.state.lifeMode;
    });
  };

  const syncLifePresetSelector = () => {
    if (!lifePreset) return;
    const currentRule = sim.state.lifeRule;
    const option = Array.from(lifePreset.options).find((opt) => opt.value === currentRule);
    lifePreset.value = option ? option.value : 'custom';
  };

  if (particleCount) {
    particleCount.value = sim.state.particleCount;
    const formatter = (value) => `${value} particles`;
    updateRangeTooltip(particleCount, formatter);
    particleCount.addEventListener('input', (event) => {
      const value = Number(event.target.value);
      sim.setState({ particleCount: value });
      updateRangeTooltip(event.target, formatter);
    });
  }

  if (particleShape) {
    particleShape.value = sim.state.particleShape;
    particleShape.addEventListener('change', (event) => {
      sim.setState({ particleShape: event.target.value });
    });
  }

  if (particleColor) {
    particleColor.value = sim.state.particleColor;
    root.style.setProperty('--accent', sim.state.particleColor);
    particleColor.addEventListener('input', (event) => {
      const color = event.target.value;
      sim.setState({ particleColor: color });
      root.style.setProperty('--accent', color);
    });
  }

  if (particleGlow) {
    particleGlow.value = sim.state.particleGlow;
    const formatter = (value) => `${value}px glow`;
    updateRangeTooltip(particleGlow, formatter);
    particleGlow.addEventListener('input', (event) => {
      const value = Number(event.target.value);
      sim.setState({ particleGlow: value });
      updateRangeTooltip(event.target, formatter);
    });
  }

  if (particleSpeed) {
    particleSpeed.value = sim.state.particleSpeed;
    const formatter = (value) => `${Number(value).toFixed(2)}× speed`;
    updateRangeTooltip(particleSpeed, formatter);
    particleSpeed.addEventListener('input', (event) => {
      const value = Number(event.target.value);
      sim.setState({ particleSpeed: value });
      updateRangeTooltip(event.target, formatter);
    });
  }

  if (magnetStrength) {
    magnetStrength.value = sim.state.magnetStrength;
    const formatter = (value) => `Strength ${value}`;
    updateRangeTooltip(magnetStrength, formatter);
    magnetStrength.addEventListener('input', (event) => {
      const value = Number(event.target.value);
      sim.setState({ magnetStrength: value });
      updateRangeTooltip(event.target, formatter);
    });
  }

  if (magnetFalloff) {
    magnetFalloff.value = sim.state.magnetFalloff;
    const formatter = (value) => `Falloff ${Number(value).toFixed(1)}`;
    updateRangeTooltip(magnetFalloff, formatter);
    magnetFalloff.addEventListener('input', (event) => {
      const value = Number(event.target.value);
      sim.setState({ magnetFalloff: value });
      updateRangeTooltip(event.target, formatter);
    });
  }

  if (magnetSize) {
    magnetSize.value = sim.state.magnetSize;
    const formatter = (value) => `${Math.round(value)}px radius`;
    updateRangeTooltip(magnetSize, formatter);
    magnetSize.addEventListener('input', (event) => {
      const value = Number(event.target.value);
      sim.setState({ magnetSize: value });
      updateRangeTooltip(event.target, formatter);
    });
  }

  if (magnetColor) {
    magnetColor.value = sim.state.magnetColor;
    magnetColor.addEventListener('input', (event) => {
      const color = event.target.value;
      sim.setState({ magnetColor: color });
    });
  }

  if (lifeMode) {
    syncLifeToggleState();
    lifeMode.addEventListener('change', (event) => {
      sim.setState({ lifeMode: event.target.checked });
      syncLifeToggleState();
    });
  }

  if (lifeSpeed) {
    lifeSpeed.value = sim.state.lifeSpeed;
    const formatter = (value) => `${value} gen/s`;
    updateRangeTooltip(lifeSpeed, formatter);
    lifeSpeed.addEventListener('input', (event) => {
      const value = Number(event.target.value);
      sim.setState({ lifeSpeed: value });
      updateRangeTooltip(event.target, formatter);
    });
  }

  if (lifeCellSize) {
    lifeCellSize.value = sim.state.lifeCellSize;
    const formatter = (value) => `${value}px cells`;
    updateRangeTooltip(lifeCellSize, formatter);
    lifeCellSize.addEventListener('input', (event) => {
      const value = Number(event.target.value);
      sim.setState({ lifeCellSize: value });
      updateRangeTooltip(event.target, formatter);
    });
  }

  if (lifeRule) {
    lifeRule.value = sim.state.lifeRule;
    lifeRule.addEventListener('change', (event) => {
      sim.setState({ lifeRule: event.target.value });
      lifeRule.value = sim.state.lifeRule;
      syncLifePresetSelector();
    });
  }

  if (lifePreset) {
    syncLifePresetSelector();
    lifePreset.addEventListener('change', (event) => {
      if (event.target.value === 'custom') return;
      sim.setState({ lifeRule: event.target.value });
      if (lifeRule) {
        lifeRule.value = sim.state.lifeRule;
      }
      syncLifePresetSelector();
    });
  }

  if (lifeMagnetBias) {
    lifeMagnetBias.value = sim.state.lifeMagnetBias;
    const formatter = (value) => `${Number(value).toFixed(2)} magnet bias`;
    updateRangeTooltip(lifeMagnetBias, formatter);
    lifeMagnetBias.addEventListener('input', (event) => {
      const value = Number(event.target.value);
      sim.setState({ lifeMagnetBias: value });
      updateRangeTooltip(event.target, formatter);
    });
  }

  if (lifeAliveColor) {
    lifeAliveColor.value = sim.state.lifeAliveColor;
    lifeAliveColor.addEventListener('input', (event) => {
      sim.setState({ lifeAliveColor: event.target.value });
    });
  }

  if (lifeDeadColor) {
    lifeDeadColor.value = sim.state.lifeDeadColor;
    lifeDeadColor.addEventListener('input', (event) => {
      sim.setState({ lifeDeadColor: event.target.value });
    });
  }

  if (lifeRandomize) {
    lifeRandomize.addEventListener('click', () => {
      sim.randomizeLife(0.45);
    });
  }

  if (lifeClear) {
    lifeClear.addEventListener('click', () => {
      sim.clearLife();
    });
  }

  if (showFieldLines) {
    showFieldLines.checked = sim.state.showFieldLines;
    if (fieldLineColor) {
      fieldLineColor.disabled = !showFieldLines.checked;
    }
    showFieldLines.addEventListener('change', (event) => {
      const checked = event.target.checked;
      sim.setState({ showFieldLines: checked });
      if (fieldLineColor) {
        fieldLineColor.disabled = !checked;
      }
    });
  }

  if (fieldLineColor) {
    fieldLineColor.value = sim.state.fieldLineColor;
    fieldLineColor.addEventListener('input', (event) => {
      const color = event.target.value;
      sim.setState({ fieldLineColor: color });
    });
  }

  if (resetButton) {
    resetButton.addEventListener('click', () => {
      sim.resetParticles();
    });
  }
}

setupControls(simulation);
