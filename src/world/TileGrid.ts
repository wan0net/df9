import { GRID_W, GRID_H, TILE_STARTING_HIT_POINTS, TILE_HEAL_OVER_TIME } from '../config';
import { TileType } from './TileTypes';

// ── Direction enum (mirrors WorldConstants.lua World.directions) ─────

export const Direction = {
  SAME: 1,
  NW: 2,
  NE: 3,
  SW: 4,
  SE: 5,
  N: 6,
  E: 7,
  S: 8,
  W: 9,
} as const;

export type DirectionType = (typeof Direction)[keyof typeof Direction];

/** Opposite direction lookup (Lua World.oppositeDirections). */
const OPPOSITE: Record<number, number> = {
  [Direction.SAME]: Direction.SAME,
  [Direction.NW]: Direction.SE,
  [Direction.NE]: Direction.SW,
  [Direction.SW]: Direction.NE,
  [Direction.SE]: Direction.NW,
  [Direction.N]: Direction.S,
  [Direction.E]: Direction.W,
  [Direction.S]: Direction.N,
  [Direction.W]: Direction.E,
};

/** Perpendicular direction lookup (Lua World.getPerpindicularDirection). */
const PERPENDICULAR: Record<number, number> = {
  [Direction.SAME]: Direction.SAME,
  [Direction.NW]: Direction.NE,
  [Direction.NE]: Direction.NW,
  [Direction.SW]: Direction.SE,
  [Direction.SE]: Direction.SW,
  [Direction.N]: Direction.W,
  [Direction.E]: Direction.S,
  [Direction.S]: Direction.E,
  [Direction.W]: Direction.N,
};

/** Direction vectors (normalized, Lua World.directionVectors). */
const DIR_VECTORS: [number, number][] = [
  [0, 0],              // 0: unused (1-indexed in Lua)
  [0, 0],              // SAME
  [-0.70711, 0.70711], // NW
  [0.70711, 0.70711],  // NE
  [-0.70711, -0.70711],// SW
  [0.70711, -0.70711], // SE
  [0, 1],              // N
  [1, 0],              // E
  [0, -1],             // S
  [-1, 0],             // W
];

/** Adjacency offset tables (Lua World._getAdjacentTile). */
const _X_OFFSET   = [0, 0, 0, 1, 0, 1, 0, 1, 0, -1];
const _Y_OFFSET   = [0, 0, 1, 1, -1, -1, 2, 0, -2, 0];
const _NEED_XLEFT = [0, 0, 1, 1, 1, 1, 0, 0, 0, 0];

export function getOppositeDirection(d: number): number {
  return OPPOSITE[d] ?? Direction.SAME;
}

export function getPerpindicularDirection(d: number): number {
  return PERPENDICULAR[d] ?? Direction.SAME;
}

/** Get adjacent tile in direction d from (x, y). Returns [nx, ny]. */
export function getAdjacentTile(x: number, y: number, d: number): [number, number] {
  const xLeft = (y & 1) === 0 ? -1 : 0;
  return [
    x + xLeft * _NEED_XLEFT[d] + _X_OFFSET[d],
    y + _Y_OFFSET[d],
  ];
}

/** Find direction that best matches vector (vx, vy) using cosine similarity. */
export function getCardinalOrOrdinalDirectionToVector(vx: number, vy: number): number {
  if (vx === 0 && vy === 0) return Direction.SAME;
  const srcLen = Math.sqrt(vx * vx + vy * vy);
  let bestDir: number = Direction.SAME;
  let bestSim = -Infinity;
  for (let d = Direction.NW; d <= Direction.W; d++) {
    const [dx, dy] = DIR_VECTORS[d];
    const dirLen = Math.sqrt(dx * dx + dy * dy);
    if (dirLen === 0) continue;
    const sim = (vx * dx + vy * dy) / (srcLen * dirLen);
    if (sim > bestSim) {
      bestSim = sim;
      bestDir = d;
    }
  }
  return bestDir;
}

/** Check if two tiles are adjacent. bThroughCorners includes all 8 neighbors (vs just 4 iso). */
export function areTilesAdjacent(
  x0: number, y0: number, x1: number, y1: number,
  bThroughCorners = false, bOrEqual = false,
): boolean {
  if (bOrEqual && x0 === x1 && y0 === y1) return true;
  const maxDir = bThroughCorners ? Direction.W : Direction.SE;
  for (let d = Direction.NW; d <= maxDir; d++) {
    const [nx, ny] = getAdjacentTile(x0, y0, d);
    if (nx === x1 && ny === y1) return true;
  }
  return false;
}

/** Test adjacency using a custom function. Returns [x, y, direction] or null. */
export function isAdjacentToFn(
  grid: TileGrid, x: number, y: number,
  testFn: (tx: number, ty: number) => boolean,
  bThroughCorners = false, bIncludeSame = false,
): [number, number, number] | null {
  const startDir = bIncludeSame ? Direction.SAME : Direction.NW;
  const maxDir = bThroughCorners ? Direction.W : Direction.SE;
  for (let d = startDir; d <= maxDir; d++) {
    const [nx, ny] = d === Direction.SAME ? [x, y] : getAdjacentTile(x, y, d);
    if (grid.inBounds(nx, ny) && testFn(nx, ny)) return [nx, ny, d];
  }
  return null;
}

/** Check if any adjacent tile is a wall. */
export function isAdjacentToWall(grid: TileGrid, x: number, y: number, bThroughCorners = false): boolean {
  return isAdjacentToFn(grid, x, y, (tx, ty) => grid.get(tx, ty) === TileType.WALL, bThroughCorners) !== null;
}

/** Check if any adjacent tile is a floor. */
export function isAdjacentToFloor(grid: TileGrid, x: number, y: number, bThroughCorners = false): boolean {
  return isAdjacentToFn(grid, x, y, (tx, ty) => {
    const t = grid.get(tx, ty);
    return t === TileType.FLOOR || t === TileType.DOOR;
  }, bThroughCorners) !== null;
}

/** Check if any adjacent tile is space. */
export function isAdjacentToSpace(grid: TileGrid, x: number, y: number, bThroughCorners = false): boolean {
  return isAdjacentToFn(grid, x, y, (tx, ty) => grid.get(tx, ty) === TileType.SPACE, bThroughCorners) !== null;
}

/** Find best open neighbor in direction (vx, vy) using dot product. */
export function getBestOpenNeighbor(
  grid: TileGrid, x: number, y: number, vx: number, vy: number,
  bThroughCorners = false,
): [number, number, number] | null {
  const maxDir = bThroughCorners ? Direction.W : Direction.SE;
  const options: { d: number; nx: number; ny: number; dp: number }[] = [];
  for (let d = Direction.NW; d <= maxDir; d++) {
    const [dx, dy] = DIR_VECTORS[d];
    const dp = vx * dx + vy * dy;
    if (dp > 0.1) {
      const [nx, ny] = getAdjacentTile(x, y, d);
      if (grid.inBounds(nx, ny)) {
        const t = grid.get(nx, ny);
        if (t === TileType.FLOOR || t === TileType.DOOR) {
          options.push({ d, nx, ny, dp });
        }
      }
    }
  }
  if (options.length === 0) return null;
  options.sort((a, b) => b.dp - a.dp);
  return [options[0].nx, options[0].ny, options[0].d];
}

export class TileGrid {
  readonly width = GRID_W;
  readonly height = GRID_H;
  private data: Uint16Array;
  private dirty: Set<number> = new Set();

  /**
   * Sparse per-tile HP tracking — only populated when a tile takes damage.
   * Mirrors World.tileHealth in World.lua. Key = tile index.
   */
  private tileHP: Map<number, number> = new Map();

  /** Called when a WALL tile is destroyed (HP → 0) and becomes WALL_DESTROYED. */
  onWallDestroyed: ((x: number, y: number) => void) | null = null;

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

  /**
   * Apply damage to a tile — mirrors World.damageTile().
   * Only WALL tiles can be destroyed; damage to other types is a no-op.
   * Returns true if the tile was destroyed (HP reached 0).
   */
  damageTile(x: number, y: number, amount: number): boolean {
    if (!this.inBounds(x, y)) return false;
    const current = this.get(x, y);
    if (current !== TileType.WALL) return false;

    const idx = this.idx(x, y);
    const hp = this.tileHP.get(idx) ?? TILE_STARTING_HIT_POINTS;
    const newHP = Math.max(0, hp - amount);
    this.tileHP.set(idx, newHP);

    if (newHP === 0) {
      this.set(x, y, TileType.WALL_DESTROYED);
      this.tileHP.delete(idx);
      this.onWallDestroyed?.(x, y);
      return true;
    }
    return false;
  }

  /**
   * Get HP for a tile (TILE_STARTING_HIT_POINTS = 100 if undamaged).
   */
  getTileHP(x: number, y: number): number {
    if (!this.inBounds(x, y)) return 0;
    return this.tileHP.get(this.idx(x, y)) ?? TILE_STARTING_HIT_POINTS;
  }

  /**
   * Get health state (4=healthy, 3=light, 2=heavy, 1=destroyed, 0=gone).
   * Mirrors World.lua nHealth calculation.
   */
  getTileHealthState(x: number, y: number): number {
    const hp = this.getTileHP(x, y);
    return Math.floor((hp / TILE_STARTING_HIT_POINTS) * 4);
  }

  /**
   * Passive wall healing tick — mirrors World.TILE_HEAL_OVER_TIME.
   * Call each game frame with dt in seconds.
   * In the original, healing only occurs in powered rooms; for now applies to all damaged walls.
   */
  healTick(dt: number) {
    if (this.tileHP.size === 0) return;
    const healAmount = TILE_HEAL_OVER_TIME * dt;
    for (const [idx, hp] of this.tileHP) {
      const newHP = Math.min(TILE_STARTING_HIT_POINTS, hp + healAmount);
      if (newHP >= TILE_STARTING_HIT_POINTS) {
        this.tileHP.delete(idx);
      } else {
        this.tileHP.set(idx, newHP);
      }
    }
  }

  /** Serialise tile HP for save/load. */
  getTileHPData(): [number, number][] {
    return Array.from(this.tileHP.entries());
  }

  /** Restore tile HP from save data. */
  loadTileHPData(data: [number, number][]) {
    this.tileHP.clear();
    for (const [idx, hp] of data) this.tileHP.set(idx, hp);
  }
}
