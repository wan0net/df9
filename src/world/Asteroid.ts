/**
 * Asteroid.ts — Asteroid tiles for mining.
 * Mirrors Asteroid.lua: value, decay levels, mining, matter yields.
 */

import { MAT_MINE_ROCK_MIN, MAT_MINE_ROCK_MAX, MAT_MINE_ROCK_MIN_LVL2, MAT_MINE_ROCK_MAX_LVL2 } from '../core/GameRules';
import { TileType } from './TileTypes';
import type { TileGrid } from './TileGrid';

/** Tile type range for asteroids (from WorldConstants.lua). */
export const ASTEROID_VALUE_START = 1024;
export const ASTEROID_VALUE_END = 1124;

/** Number of decay levels before asteroid becomes SPACE (Asteroid.lua:18). */
export const NUM_DECAY_LEVELS = 2;

/** Check if a tile value represents an asteroid. */
export function isAsteroid(tileValue: number): boolean {
  return tileValue >= ASTEROID_VALUE_START && tileValue <= ASTEROID_VALUE_END;
}

/** Get the remaining matter in an asteroid tile. */
export function getAsteroidValue(tileValue: number): number {
  if (!isAsteroid(tileValue)) return 0;
  return tileValue - ASTEROID_VALUE_START;
}

/** Calculate matter yield from mining an asteroid.
 *  Lua DropOffRocks.lua: DFMath.lerp(MIN, MAX, competency).
 *  The yield is computed at drop-off time (DropOffRocks task), not at mine time.
 *  This function remains for legacy callers — returns a random value in [min, max]. */
export function getMiningYield(minerLevel = 1): number {
  const min = minerLevel >= 2 ? MAT_MINE_ROCK_MIN_LVL2 : MAT_MINE_ROCK_MIN;
  const max = minerLevel >= 2 ? MAT_MINE_ROCK_MAX_LVL2 : MAT_MINE_ROCK_MAX;
  return min + Math.floor(Math.random() * (max - min + 1));
}

/**
 * Vaporize (mine) an asteroid tile. Mirrors Asteroid.vaporizeTile():
 *  - bCompletely=true: tile becomes SPACE immediately
 *  - bCompletely=false: tile decays by 1 level; becomes SPACE after NUM_DECAY_LEVELS
 * Returns { removed: boolean, newValue: number }.
 */
export function vaporizeTile(grid: TileGrid, tx: number, ty: number, bCompletely: boolean): { removed: boolean; newValue: number } {
  const tileValue = grid.get(tx, ty);
  if (!isAsteroid(tileValue)) return { removed: false, newValue: tileValue };

  let newVal: number;
  if (bCompletely) {
    newVal = TileType.SPACE;
  } else {
    newVal = tileValue + 1;
    if (newVal >= ASTEROID_VALUE_START + NUM_DECAY_LEVELS) {
      newVal = TileType.SPACE;
    }
  }
  grid.set(tx, ty, newVal);
  return { removed: newVal === TileType.SPACE, newValue: newVal };
}
