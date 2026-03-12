import { Direction, getAdjacentTile, TileGrid } from '../world/TileGrid';

export const VACUUM_THRESHOLD = 50;
export const VACUUM_THRESHOLD_END = 40;
export const VACUUM_VEC_RESET = 180;

const VACUUM_THRESHOLD_END2 = VACUUM_THRESHOLD_END * VACUUM_THRESHOLD_END;

const DIR_VECTORS: Record<number, [number, number]> = {
  [Direction.SAME]: [0, 0],
  [Direction.NW]: [-0.70711, 0.70711],
  [Direction.NE]: [0.70711, 0.70711],
  [Direction.SW]: [-0.70711, -0.70711],
  [Direction.SE]: [0.70711, -0.70711],
  [Direction.N]: [0, 1],
  [Direction.E]: [1, 0],
  [Direction.S]: [0, -1],
  [Direction.W]: [-1, 0],
};

export type VacuumVec = {
  vx: number;
  vy: number;
  magnitude: number;
};

const ZERO_VEC: VacuumVec = Object.freeze({ vx: 0, vy: 0, magnitude: 0 });

export class VacuumSystem {
  private readonly grid: TileGrid;
  private readonly vectors: Map<number, VacuumVec> = new Map();
  private readonly tickIntervalMs: number;
  private tickAccumulatorMs = 0;

  constructor(grid: TileGrid, tickIntervalMs = 1000) {
    this.grid = grid;
    this.tickIntervalMs = Math.max(1, tickIntervalMs);
  }

  update(deltaMs: number): void {
    this.tickAccumulatorMs += deltaMs;
    while (this.tickAccumulatorMs >= this.tickIntervalMs) {
      this.tickAccumulatorMs -= this.tickIntervalMs;
      this.tick(this.tickIntervalMs / 1000);
    }
  }

  getVacuumVec(tx: number, ty: number): VacuumVec {
    if (!this.grid.inBounds(tx, ty)) return ZERO_VEC;
    return this.vectors.get(this.idx(tx, ty)) ?? ZERO_VEC;
  }

  isVacuumTile(tx: number, ty: number): boolean {
    return this.grid.inBounds(tx, ty) && this.grid.getO2(tx, ty) < VACUUM_THRESHOLD;
  }

  private tick(dtSeconds: number): void {
    const activeVacuumTiles = new Set<number>();
    const alpha = this.getSmoothingAlpha(dtSeconds);

    for (let y = 0; y < this.grid.height; y++) {
      for (let x = 0; x < this.grid.width; x++) {
        const centerO2 = this.grid.getO2(x, y);
        if (centerO2 >= VACUUM_THRESHOLD) continue;

        const idx = this.idx(x, y);
        activeVacuumTiles.add(idx);

        let lowestNeighborO2 = centerO2;
        let lowestDir: number = Direction.SAME;

        for (let d = Direction.NW; d <= Direction.W; d++) {
          const [nx, ny] = getAdjacentTile(x, y, d);
          const neighborO2 = this.grid.inBounds(nx, ny) ? this.grid.getO2(nx, ny) : 0;
          if (neighborO2 < lowestNeighborO2) {
            lowestNeighborO2 = neighborO2;
            lowestDir = d;
          }
        }

        const diff = Math.max(0, centerO2 - lowestNeighborO2);
        const dirVec = DIR_VECTORS[lowestDir] ?? DIR_VECTORS[Direction.SAME];
        const targetVx = dirVec[0] * diff;
        const targetVy = dirVec[1] * diff;

        const prev = this.vectors.get(idx) ?? ZERO_VEC;
        const nextVx = prev.vx + (targetVx - prev.vx) * alpha;
        const nextVy = prev.vy + (targetVy - prev.vy) * alpha;
        const nextMagnitude = Math.hypot(nextVx, nextVy);

        this.vectors.set(idx, { vx: nextVx, vy: nextVy, magnitude: nextMagnitude });
      }
    }

    for (const [idx, prev] of this.vectors) {
      if (activeVacuumTiles.has(idx)) continue;

      const nextVx = prev.vx * (1 - alpha);
      const nextVy = prev.vy * (1 - alpha);
      const nextMagnitude = Math.hypot(nextVx, nextVy);

      if (nextMagnitude * nextMagnitude < VACUUM_THRESHOLD_END2) {
        this.vectors.delete(idx);
      } else {
        this.vectors.set(idx, { vx: nextVx, vy: nextVy, magnitude: nextMagnitude });
      }
    }
  }

  private idx(x: number, y: number): number {
    return y * this.grid.width + x;
  }

  private getSmoothingAlpha(dtSeconds: number): number {
    if (VACUUM_VEC_RESET <= 0) return 1;
    return 1 - Math.exp(-dtSeconds / VACUUM_VEC_RESET);
  }
}
