import { GRID_W, GRID_H } from '../config';
import { TileType } from './TileTypes';

export class TileGrid {
  readonly width = GRID_W;
  readonly height = GRID_H;
  private data: Uint16Array;
  private dirty: Set<number> = new Set();

  constructor() {
    this.data = new Uint16Array(GRID_W * GRID_H);
    this.data.fill(TileType.SPACE);
  }

  private idx(x: number, y: number): number {
    return y * this.width + x;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  get(x: number, y: number): number {
    if (!this.inBounds(x, y)) return TileType.SPACE;
    return this.data[this.idx(x, y)];
  }

  set(x: number, y: number, value: number) {
    if (!this.inBounds(x, y)) return;
    const i = this.idx(x, y);
    if (this.data[i] !== value) {
      this.data[i] = value;
      this.dirty.add(i);
    }
  }

  isDirty(): boolean {
    return this.dirty.size > 0;
  }

  consumeDirty(): Set<number> {
    const d = new Set(this.dirty);
    this.dirty.clear();
    return d;
  }

  /** Get diagonal neighbors (edge-sharing in iso diamond grid) — used for flood fill + pathfinding */
  getDiagonalNeighbors(x: number, y: number): { x: number; y: number }[] {
    const odd = y & 1;
    const xLeft = odd ? 0 : -1;
    return [
      { x: x + xLeft, y: y + 1 },       // NW
      { x: x + xLeft + 1, y: y + 1 },   // NE
      { x: x + xLeft, y: y - 1 },       // SW
      { x: x + xLeft + 1, y: y - 1 },   // SE
    ].filter(n => this.inBounds(n.x, n.y));
  }

  /** Get cardinal neighbors (vertex-sharing in iso diamond grid) — used for wall detection */
  getCardinalNeighbors(x: number, y: number): { x: number; y: number }[] {
    return [
      { x: x, y: y + 2 },   // N
      { x: x + 1, y: y },   // E
      { x: x, y: y - 2 },   // S
      { x: x - 1, y: y },   // W
    ].filter(n => this.inBounds(n.x, n.y));
  }

  /** Get all 8 neighbors */
  getAllNeighbors(x: number, y: number): { x: number; y: number }[] {
    return [...this.getDiagonalNeighbors(x, y), ...this.getCardinalNeighbors(x, y)];
  }
}
