/**
 * Represents a single magnet that can attract or repel particles/Life cells.
 */
export class Magnet {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.homeX = 0;
    this.homeY = 0;
    this.mode = 1;
    this.isActive = false;
    this.anchored = false;
  }

  setHome(width, height) {
    this.homeX = width * 0.5;
    this.homeY = height * 0.5;
    if (!this.anchored) {
      this.x = this.homeX;
      this.y = this.homeY;
    }
  }

  clamp(width, height, radius) {
    const minX = radius;
    const maxX = Math.max(radius, width - radius);
    const minY = radius;
    const maxY = Math.max(radius, height - radius);
    this.x = Math.min(Math.max(this.x, minX), maxX);
    this.y = Math.min(Math.max(this.y, minY), maxY);
  }

  beginInteraction(x, y, width, height, radius) {
    this.isActive = true;
    this.anchored = false;
    this.setPosition(x, y, width, height, radius);
  }

  move(x, y, width, height, radius) {
    this.setPosition(x, y, width, height, radius);
    this.isActive = true;
  }

  endInteraction() {
    this.isActive = false;
    this.anchored = true;
  }

  setPosition(x, y, width, height, radius) {
    this.x = x;
    this.y = y;
    this.clamp(width, height, radius);
  }

  setShiftPressed(pressed) {
    this.mode = pressed ? -1 : 1;
  }
}
