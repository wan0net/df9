/**
 * WorldGen.ts — Procedural world generation.
 *
 * Original flow (GameRules.randomSetup + ModuleData "emptySpace"):
 *  1. Player picks landing zone on galaxy map
 *  2. "DeepSpace" module loads — NO room, just open space
 *  3. A BaseSeed (seed pod) object placed at center
 *  4. 3 spacewalking settlers spawn near center in open space
 *  5. Asteroids scatter (16-40 based on galaxy seed)
 *  6. Player must build their first room from scratch
 *
 * The starting module "emptySpace" from ModuleData.lua:
 *   filename="DeepSpace", crew={Citizen1-3: SpacewalkingSettler}
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

/** Spawn point for a crew member in world-grid coords. */
export interface CrewSpawnPoint {
  x: number;
  y: number;
}

/** Result of world generation — includes crew spawn locations. */
export interface WorldGenResult {
  /** Seed pod position (center of map). */
  seedPodX: number;
  seedPodY: number;
  /** Spawn points for the initial 3 settlers (in open space near center). */
  crewSpawns: CrewSpawnPoint[];
}

/**
 * Generate the starting world.
 * Returns spawn data so CharacterManager can place crew.
 */
export function generateWorld(
  grid: TileGrid,
  wallAutoGen: WallAutoGen,
  landingZone?: LandingZoneData,
): WorldGenResult {
  const cx = Math.floor(GRID_W / 2);
  const cy = Math.floor(GRID_H / 2);

  // NO starting room — the original "emptySpace" / DeepSpace.sav is all open space.
  // The player must construct their first room.

  // Scatter asteroids based on landing zone density
  const asteroidSeed = landingZone?.density ?? 0.5;
  spawnAsteroids(grid, cx, cy, asteroidSeed);

  // Crew spawn points spread around center (matching DeepSpace.sav Spawner positions).
  // Original .sav has spawners at varied distances; we place 3 near the seed pod.
  const crewSpawns: CrewSpawnPoint[] = [
    { x: cx + 1, y: cy - 1 },
    { x: cx - 2, y: cy + 1 },
    { x: cx + 2, y: cy + 2 },
  ];

  return {
    seedPodX: cx,
    seedPodY: cy,
    crewSpawns,
  };
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
