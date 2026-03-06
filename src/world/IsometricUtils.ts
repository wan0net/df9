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

/**
 * Get diamond-shaped footprint tiles for a multi-tile object.
 * Mirrors Lua World._getDiamondPropFootprint:
 *   outer loop (width steps) goes SE, inner loop (height steps) goes NE.
 *
 * @param tileX  Base tile X
 * @param tileY  Base tile Y
 * @param width  Object width in tiles
 * @param height Object height in tiles
 * @param bFlipX Horizontal flip
 * @param bFlipY Vertical flip
 * @returns Array of {x, y} tile coordinates in the footprint
 */
export function getDiamondFootprint(
  tileX: number,
  tileY: number,
  width: number,
  height: number,
  bFlipX = false,
  bFlipY = false,
): { x: number; y: number }[] {
  let w = width;
  let h = height;

  // Swap width/height when flipped on one axis (matches Lua)
  if ((bFlipX || bFlipY) && !(bFlipX && bFlipY)) {
    w = height;
    h = width;
  }

  const tiles: { x: number; y: number }[] = [];
  let startX = tileX;
  let startY = tileY;

  // Outer loop draws SE, inner loop draws NE
  // Our grid: odd rows shift right (inverted from Lua's even-row shift)
  for (let i = 0; i < w; i++) {
    let curX = startX;
    let curY = startY;
    for (let j = 0; j < h; j++) {
      tiles.push({ x: curX, y: curY });
      if (j < h - 1) {
        // Step NE: y-1, x+1 if odd row
        if (curY & 1) curX++;
        curY--;
      }
    }
    if (i < w - 1) {
      // Step SE: y+1, x+1 if odd row
      if (startY & 1) startX++;
      startY++;
    }
  }

  return tiles;
}
