/**
 * WorldGen.ts — Procedural world generation.
 *
 * Original flow (GameRules.randomSetup):
 *  1. Player picks landing zone on galaxy map
 *  2. A starting module (.sav) loads at center — small pressurized station
 *  3. 3 crew spawn inside
 *  4. Asteroids scatter (16-40 based on galaxy seed)
 *  5. Derelicts placed at edges (7-9)
 *
 * Since we don't have the .sav module files, we procedurally generate
 * a small starting module that matches the original starting modules:
 * a single sealed room (about 4x4 floor) with a reactor and O2 recycler inside.
 * The BaseSeed object sits outside the room as a landmark.
 */

import { TileGrid } from './TileGrid';
import { TileType } from './TileTypes';
import { WallAutoGen } from './WallAutoGen';
import { ASTEROID_VALUE_START } from './Asteroid';
import { GRID_W, GRID_H } from '../config';

export interface LandingZoneData {
  x: number;
  y: number;
  density: number;
}

/**
 * Generate the starting world.
 */
export function generateWorld(
  grid: TileGrid,
  wallAutoGen: WallAutoGen,
  landingZone?: LandingZoneData,
) {
  const cx = Math.floor(GRID_W / 2);
  const cy = Math.floor(GRID_H / 2);

  // Place starting module at center
  placeStartingModule(grid, wallAutoGen, cx, cy);

  // Scatter asteroids based on landing zone density
  const asteroidSeed = landingZone?.density ?? 0.5;
  spawnAsteroids(grid, cx, cy, asteroidSeed);
}

/**
 * Place a small starting module — sealed room with basic equipment.
 * Matches the original starting modules: a 4x4 room sealed with walls.
 */
function placeStartingModule(
  grid: TileGrid,
  wallAutoGen: WallAutoGen,
  cx: number,
  cy: number,
) {
  const placed: { x: number; y: number }[] = [];

  // 4x4 floor for the starting room
  for (let dy = 0; dy < 4; dy++) {
    for (let dx = 0; dx < 4; dx++) {
      const tx = cx - 2 + dx;
      const ty = cy - 2 + dy;
      grid.set(tx, ty, TileType.FLOOR);
      placed.push({ x: tx, y: ty });
    }
  }

  // Auto-generate walls around the module
  wallAutoGen.update(placed);
}

/**
 * Spawn asteroid clusters.
 * Original: 16-40 based on galaxy seed, avoiding safe zone at center.
 */
function spawnAsteroids(
  grid: TileGrid,
  cx: number,
  cy: number,
  asteroidSeed: number,
) {
  // Scale count by seed: low density → 16, high → 40
  const numAsteroids = Math.floor(16 + asteroidSeed * 24);
  const safeRadius = 10;
  let placed = 0;
  let attempts = 0;

  while (placed < numAsteroids && attempts < numAsteroids * 3) {
    attempts++;

    const tx = 10 + Math.floor(Math.random() * (GRID_W - 20));
    const ty = 10 + Math.floor(Math.random() * (GRID_H - 20));

    if (Math.abs(tx - cx) < safeRadius && Math.abs(ty - cy) < safeRadius) continue;
    if (grid.get(tx, ty) !== TileType.SPACE) continue;

    const clusterSize = 1 + Math.floor(Math.random() * 3);
    placeAsteroidCluster(grid, tx, ty, clusterSize);
    placed++;
  }
}

function placeAsteroidCluster(grid: TileGrid, tx: number, ty: number, size: number) {
  grid.set(tx, ty, ASTEROID_VALUE_START);
  if (size <= 1) return;

  const offsets = [
    { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
  ];
  for (let i = 1; i < size && i < offsets.length; i++) {
    const nx = tx + offsets[i].x;
    const ny = ty + offsets[i].y;
    if (grid.get(nx, ny) === TileType.SPACE) {
      grid.set(nx, ny, ASTEROID_VALUE_START);
    }
  }
}
