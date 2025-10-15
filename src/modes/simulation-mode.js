/**
 * Base class for simulation modes.
 * Each mode encapsulates specific update logic, rendering, and event handling.
 */
export class SimulationMode {
  constructor(simulation) {
    this.simulation = simulation;
  }

  /**
   * Called when this mode becomes active.
   * Use this for initialization and setup.
   */
  onEnter() {}

  /**
   * Called when switching away from this mode.
   * Use this for cleanup.
   */
  onExit() {}

  /**
   * Update simulation state for this mode.
   * @param {number} dt Delta time in seconds
   */
  update(dt) {}

  /**
   * Render mode-specific visuals.
   * @param {CanvasRenderingContext2D} ctx Canvas context
   */
  render(ctx) {}

  /**
   * Handle pointer down event.
   * @param {PointerEvent} event
   * @returns {boolean} True if event was handled and should stop propagation
   */
  handlePointerDown(event) {
    return false;
  }

  /**
   * Handle pointer move event.
   * @param {PointerEvent} event
   * @returns {boolean} True if event was handled and should stop propagation
   */
  handlePointerMove(event) {
    return false;
  }

  /**
   * Handle pointer up event.
   * @param {PointerEvent} event
   * @returns {boolean} True if event was handled and should stop propagation
   */
  handlePointerUp(event) {
    return false;
  }

  /**
   * Handle pointer leave event.
   * @returns {boolean} True if event was handled and should stop propagation
   */
  handlePointerLeave() {
    return false;
  }

  /**
   * Handle key down event.
   * @param {KeyboardEvent} event
   * @returns {boolean} True if event was handled and should stop propagation
   */
  handleKeyDown(event) {
    return false;
  }

  /**
   * Handle key up event.
   * @param {KeyboardEvent} event
   * @returns {boolean} True if event was handled and should stop propagation
   */
  handleKeyUp(event) {
    return false;
  }

  /**
   * Mode identifier for logging and debugging.
   * @returns {string}
   */
  get name() {
    return 'base';
  }

  /**
   * Whether this mode allows manual magnet control via pointer.
   * @returns {boolean}
   */
  get allowsMagnetControl() {
    return true;
  }

  /**
   * Whether this mode can be wrapped with screensaver mode.
   * @returns {boolean}
   */
  get allowsScreensaver() {
    return true;
  }
}
