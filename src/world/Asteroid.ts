/**
 * Asteroid.ts — Asteroid tiles for mining.
 * Mirrors Asteroid.lua: value, mining, matter yields.
 */

import { MAT_MINE_ROCK_MIN, MAT_MINE_ROCK_MAX } from '../core/GameRules';

/** Tile type range for asteroids (from WorldConstants.lua). */
export const ASTEROID_VALUE_START = 1024;
export const ASTEROID_VALUE_END = 1124;

/** Check if a tile value represents an asteroid. */
export function isAsteroid(tileValue: number): boolean {
  return tileValue >= ASTEROID_VALUE_START && tileValue <= ASTEROID_VALUE_END;
}

/** Get the remaining matter in an asteroid tile. */
export function getAsteroidValue(tileValue: number): number {
  if (!isAsteroid(tileValue)) return 0;
  return tileValue - ASTEROID_VALUE_START;
}

/** Calculate matter yield from mining an asteroid. */
export function getMiningYield(minerLevel = 1): number {
  const min = minerLevel >= 2 ? 40 : MAT_MINE_ROCK_MIN;
  const max = minerLevel >= 2 ? 60 : MAT_MINE_ROCK_MAX;
  return min + Math.floor(Math.random() * (max - min + 1));
}
