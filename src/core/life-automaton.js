import { parseLifeRule } from './life-rule.js';

/**
 * Grid-based Game of Life engine with optional magnet influence.
 */
export class LifeAutomaton {
  constructor() {
    this.cols = 0;
    this.rows = 0;
    this.cellSize = 16;
    this.grid = new Uint8Array(0);
    this.buffer = new Uint8Array(0);
    this.birthMask = new Array(9).fill(false);
    this.surviveMask = new Array(9).fill(false);
    this.rule = 'B3/S23';
    this.accumulator = 0;
    this.seeded = false;
  }

  /**
   * Update simulation state.
   * @param {number} dt Seconds since last frame.
   * @param {object} state Global settings containing lifeSpeed, lifeMagnetBias, etc.
   * @param {Array<object>} magnets Active magnets influencing the grid.
   * @param {number} canvasWidth
   * @param {number} canvasHeight
   */
  update(dt, state, magnets, canvasWidth, canvasHeight) {
    this.ensureGrid(state, canvasWidth, canvasHeight);
    if (!this.cols || !this.rows) return;

    const speed = Math.max(1, state.lifeSpeed);
    const interval = 1 / speed;
    this.accumulator += dt;

    while (this.accumulator >= interval) {
      this.accumulator -= interval;
      this.stepGeneration(state, magnets);
    }
  }

  /**
   * Render the grid.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} state
   */
  draw(ctx, state) {
    if (!this.cols || !this.rows || this.grid.length === 0) return;

    const aliveColor = state.lifeAliveColor;
    const deadColor = state.lifeDeadColor;
    const cellSize = this.cellSize;
    const inner = Math.max(cellSize * 0.7, cellSize - 2);
    const margin = (cellSize - inner) * 0.5;

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';

    for (let y = 0; y < this.rows; y += 1) {
      for (let x = 0; x < this.cols; x += 1) {
        const idx = y * this.cols + x;
        ctx.fillStyle = this.grid[idx] ? aliveColor : deadColor;
        const drawX = x * cellSize + margin;
        const drawY = y * cellSize + margin;
        ctx.fillRect(drawX, drawY, inner, inner);
      }
    }

    ctx.restore();
  }

  /**
   * Ensure grid fits the current canvas/setting configuration.
   * @param {object} state
   * @param {number} width
   * @param {number} height
   * @param {boolean} force
   */
  ensureGrid(state, width, height, force = false) {
    const safeWidth = Number.isFinite(width) ? width : this.cols * this.cellSize || 0;
    const safeHeight = Number.isFinite(height) ? height : this.rows * this.cellSize || 0;
    const desiredCell = Math.max(6, Math.min(40, state.lifeCellSize));
    if (desiredCell !== this.cellSize) {
      this.cellSize = desiredCell;
      force = true;
    }

    const cols = Math.max(4, Math.floor(safeWidth / this.cellSize)) || 4;
    const rows = Math.max(4, Math.floor(safeHeight / this.cellSize)) || 4;

    if (!force && cols === this.cols && rows === this.rows) {
      return;
    }

    const oldCols = this.cols;
    const oldRows = this.rows;
    const oldGrid = this.grid;

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

    this.cols = cols;
    this.rows = rows;
    this.grid = newGrid;
    this.buffer = newBuffer;
    this.seeded = newGrid.some((value) => value === 1);
  }

  /**
   * Advance Life by one generation.
   * @param {object} state
   * @param {object} magnet
   */
  stepGeneration(state, magnets) {
    const { cols, rows, grid, buffer, cellSize, birthMask, surviveMask } = this;
    if (!grid.length) return;

    const magnetRadius = state.magnetSize * 2.4;
    const magnetBias = state.lifeMagnetBias;

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

        if (magnetBias > 0 && magnetRadius > 0 && magnets && magnets.length) {
          const cellCenterX = x * cellSize + cellSize * 0.5;
          const cellCenterY = y * cellSize + cellSize * 0.5;

          let attractInfluence = 0;
          let repelInfluence = 0;

          magnets.forEach((magnet) => {
            const dx = magnet.x - cellCenterX;
            const dy = magnet.y - cellCenterY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < magnetRadius) {
              const influence = (1 - dist / magnetRadius) * magnetBias;
              if (magnet.mode > 0) {
                attractInfluence = Math.max(attractInfluence, influence);
              } else if (magnet.mode < 0) {
                repelInfluence = Math.max(repelInfluence, influence);
              }
            }
          });

          if (attractInfluence > 0 && Math.random() < attractInfluence) {
            nextState = 1;
          }
          if (repelInfluence > 0 && Math.random() < repelInfluence) {
            nextState = 0;
          }
        }

        buffer[idx] = nextState;
      }
    }

    this.grid = buffer;
    this.buffer = grid;
  }

  /** Randomise the grid. */
  randomize(density = 0.4) {
    if (!this.grid.length) return;
    for (let i = 0; i < this.grid.length; i += 1) {
      this.grid[i] = Math.random() < density ? 1 : 0;
    }
    if (this.buffer && this.buffer.length === this.grid.length) {
      this.buffer.fill(0);
    }
    this.seeded = true;
  }

  /** Clear all cells. */
  clear() {
    if (this.grid) this.grid.fill(0);
    if (this.buffer) this.buffer.fill(0);
    this.seeded = false;
  }

  /** Apply a Life rule string. */
  applyRule(ruleString) {
    const { rule, birthMask, surviveMask } = parseLifeRule(ruleString);
    this.rule = rule;
    this.birthMask = birthMask;
    this.surviveMask = surviveMask;
  }
}
