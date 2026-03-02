import { TILE_W, TILE_H, TILE_HALF_W, TILE_HALF_H } from '../config';

/**
 * Convert tile coordinates to screen (pixel) position.
 * Staggered diamond: odd rows shift right by half a tile width.
 */
export function tileToScreen(tx: number, ty: number): { x: number; y: number } {
  const x = tx * TILE_W + (ty & 1) * TILE_HALF_W;
  const y = ty * TILE_HALF_H;
  return { x, y };
}

/**
 * Convert screen (pixel) position to tile coordinates.
 */
export function screenToTile(px: number, py: number): { x: number; y: number } {
  const rowEstimate = Math.floor(py / TILE_HALF_H);

  let bestDist = Infinity;
  let bestTx = 0;
  let bestTy = 0;

  for (let dy = -1; dy <= 1; dy++) {
    const ty = rowEstimate + dy;
    const rowShift = (ty & 1) * TILE_HALF_W;
    const tx = Math.floor((px - rowShift) / TILE_W);

    for (let dx = -1; dx <= 1; dx++) {
      const candidateTx = tx + dx;
      const center = tileToScreen(candidateTx, ty);
      const cx = center.x + TILE_HALF_W;
      const cy = center.y + TILE_HALF_H;

      const ddx = Math.abs(px - cx) / TILE_HALF_W;
      const ddy = Math.abs(py - cy) / TILE_HALF_H;
      const dist = ddx + ddy;

      if (dist < bestDist) {
        bestDist = dist;
        bestTx = candidateTx;
        bestTy = ty;
      }
    }
  }

  return { x: bestTx, y: bestTy };
}

/**
 * Convert offset (col, row) to iso-axial (a, b) coordinates.
 *
 * The (a, b) axes align with the two diagonal directions of the diamond grid:
 *   a-axis: NE direction (Δa=+1 per NE step)
 *   b-axis: NW direction (Δb=+1 per NW step)
 *
 * A rectangle in (a, b) space produces a proper iso-aligned parallelogram on screen.
 */
export function offsetToIso(col: number, row: number): { a: number; b: number } {
  const a = col + ((row + 1) >> 1);
  const b = (row >> 1) - col;
  return { a, b };
}

/**
 * Convert iso-axial (a, b) back to offset (col, row).
 */
export function isoToOffset(a: number, b: number): { x: number; y: number } {
  const row = a + b;
  const col = (a - b - ((a + b) & 1)) / 2;
  return { x: col, y: row };
}
