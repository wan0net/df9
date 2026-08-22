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
import { ZoneType } from './ZoneType';

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
  /** Tutorial settlers start inside the Box module, without spacesuits. */
  crewSpacewalking: boolean;
  /** Built objects supplied by the selected starting module. */
  initialObjects: InitialWorldObject[];
  /** Original zone values keyed by tile for restoring room zoning after flood fill. */
  initialZones: Map<string, ZoneType>;
}

export interface InitialWorldObject {
  sName: string;
  x: number;
  y: number;
  bFlipX?: boolean;
  condition?: number;
}

// ── Asteroid density tiers (Lua: Asteroid.lua lines 10-16) ──────────────
const MIN_NUM_TO_SPAWN = [16, 24, 32]; // [low, med, high]
const MAX_NUM_TO_SPAWN = [24, 32, 40];
const THRESHOLD_MED_LOW  = 0.33;
const THRESHOLD_MED_HIGH = 0.66;
const VARIANCE_PER_LEVEL = [1, 2, 3];

// ── Asteroid module templates ───────────────────────────────────────────
// Mirrors Lua ModuleData.lua asteroidModules — 17 templates with weights.
// Original loads from .sav files; we approximate with tile offset patterns.
// Each template is an array of (dx, dy) offsets from placement origin.
interface AsteroidTemplate {
  weight: number;
  tiles: { dx: number; dy: number }[];
  tileWidth: number;
  tileHeight: number;
}

const ASTEROID_TEMPLATES: AsteroidTemplate[] = [
  // Small single-tile (asteroid01, weight=1)
  { weight: 1, tileWidth: 1, tileHeight: 1, tiles: [{ dx: 0, dy: 0 }] },
  // Small 2-tile horizontal (asteroid02, weight=2)
  { weight: 2, tileWidth: 2, tileHeight: 1, tiles: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }] },
  // Small 2-tile vertical (asteroid03, weight=2)
  { weight: 2, tileWidth: 1, tileHeight: 2, tiles: [{ dx: 0, dy: 0 }, { dx: 0, dy: 1 }] },
  // 3-tile L-shape (asteroid04, weight=3)
  { weight: 3, tileWidth: 2, tileHeight: 2, tiles: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }] },
  // 3-tile line (asteroid05, weight=2)
  { weight: 2, tileWidth: 3, tileHeight: 1, tiles: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 2, dy: 0 }] },
  // 4-tile square (asteroid06, weight=3)
  { weight: 3, tileWidth: 2, tileHeight: 2, tiles: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }] },
  // 3-tile vertical line (asteroid07, weight=2)
  { weight: 2, tileWidth: 1, tileHeight: 3, tiles: [{ dx: 0, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: 2 }] },
  // 4-tile T-shape (asteroid08, weight=2)
  { weight: 2, tileWidth: 3, tileHeight: 2, tiles: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 2, dy: 0 }, { dx: 1, dy: 1 }] },
  // 5-tile plus (asteroid09, weight=1)
  { weight: 1, tileWidth: 3, tileHeight: 3, tiles: [{ dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }, { dx: 2, dy: 1 }, { dx: 1, dy: 2 }] },
  // 2-tile diagonal (asteroid10, weight=4 — most common)
  { weight: 4, tileWidth: 2, tileHeight: 2, tiles: [{ dx: 0, dy: 0 }, { dx: 1, dy: 1 }] },
  // Large 6-tile blob (asteroid11, weight=1)
  { weight: 1, tileWidth: 3, tileHeight: 2, tiles: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 2, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }, { dx: 2, dy: 1 }] },
  // 3-tile reverse L (asteroid12, weight=2)
  { weight: 2, tileWidth: 2, tileHeight: 2, tiles: [{ dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }] },
  // 4-tile zigzag (asteroid13, weight=2)
  { weight: 2, tileWidth: 3, tileHeight: 2, tiles: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 1, dy: 1 }, { dx: 2, dy: 1 }] },
  // 5-tile L (asteroid14, weight=3)
  { weight: 3, tileWidth: 3, tileHeight: 2, tiles: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 2, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }] },
  // 4-tile S-shape (asteroid15, weight=2)
  { weight: 2, tileWidth: 2, tileHeight: 3, tiles: [{ dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }, { dx: 0, dy: 2 }] },
  // 5-tile U-shape (asteroid16, weight=3)
  { weight: 3, tileWidth: 3, tileHeight: 2, tiles: [{ dx: 0, dy: 0 }, { dx: 2, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }, { dx: 2, dy: 1 }] },
  // 4-tile vertical Z (asteroid17, weight=2)
  { weight: 2, tileWidth: 2, tileHeight: 3, tiles: [{ dx: 0, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }, { dx: 1, dy: 2 }] },
];

// Precompute cumulative weights for weighted random selection
const TOTAL_WEIGHT = ASTEROID_TEMPLATES.reduce((s, t) => s + t.weight, 0);

function pickRandomTemplate(): AsteroidTemplate {
  let r = Math.random() * TOTAL_WEIGHT;
  for (const t of ASTEROID_TEMPLATES) {
    r -= t.weight;
    if (r <= 0) return t;
  }
  return ASTEROID_TEMPLATES[ASTEROID_TEMPLATES.length - 1];
}

/**
 * Check if two axis-aligned rectangles overlap.
 * Mirrors Lua DFMath.overlaps.
 */
function overlaps(
  ax1: number, ay1: number, ax2: number, ay2: number,
  bx1: number, by1: number, bx2: number, by2: number,
): boolean {
  return ax1 < bx2 && ax2 > bx1 && ay1 < by2 && ay2 > by1;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
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
    crewSpacewalking: true,
    initialObjects: [{ sName: 'BaseSeed', x: cx, y: cy }],
    initialZones: new Map(),
  };
}

// Exact logical tile layout from the original Data/Modules/Box.sav used by
// ModuleData.lua's tutorialModules.easyMode. Columns are tiles 120..135 and
// rows are 111..145. # wall, D door, . plain, L life support, P power,
// A airlock, R refinery.
const TUTORIAL_BOX_ROWS = [
  '       .        ',
  '      ..        ',
  '      ...       ',
  '     ....       ',
  '     ....#      ',
  '    #....#      ',
  '    #.....#     ',
  '   #.....##     ',
  '   #.....#R#    ',
  '  #.....#RR#    ',
  '  #.....#RRR#   ',
  ' #. ...#RRRR#   ',
  ' #. ...D#RRR##  ',
  '#.  ..#.#RR#A#  ',
  '#.  ..#..DR#AA# ',
  '#.  .##..##AA#  ',
  ' #. .#L#..#AA#  ',
  ' #..#LLD..#A#   ',
  '  #.#LLL#..##   ',
  '  ##LLLL#..#    ',
  '   #LLLLL#..#   ',
  '   #LLLL#..##   ',
  '    #LLL#..DP#  ',
  '    #LLD..#PP#  ',
  '     #L#..#PPP# ',
  '     ##..DPPPP# ',
  '      #..#PPPPP#',
  '      #.#PPPPPP#',
  '       ###PPPPP#',
  '       # #PPPP# ',
  '          #PPP# ',
  '          #PP#  ',
  '           #P#  ',
  '           ##   ',
  '            #   ',
] as const;

const TUTORIAL_ZONE_BY_CHAR: Partial<Record<string, ZoneType>> = {
  '.': ZoneType.PLAIN,
  L: ZoneType.LIFESUPPORT,
  P: ZoneType.POWER,
  A: ZoneType.AIRLOCK,
  R: ZoneType.REFINERY,
};

// Box.sav uses Lua's xLeft=-(y%2) diamond coordinates. Rendering in this
// project shifts odd rows right, so imported original-module coordinates need
// the established odd-row translation from AGENTS.md.
const tutorialX = (originalX: number, y: number) => originalX - (y & 1);

/** Generate the original easyMode tutorial start (ModuleData.lua -> Box.sav). */
export function generateTutorialWorld(
  grid: TileGrid,
  wallAutoGen: WallAutoGen,
  landingZone?: LandingZoneData,
): WorldGenResult {
  const cx = Math.floor(GRID_W / 2);
  const cy = Math.floor(GRID_H / 2);

  // Lua scatters asteroids before placing the module; module tiles overwrite
  // anything beneath its exact footprint.
  spawnAsteroids(grid, cx, cy, landingZone?.density ?? 0.5);

  const initialZones = new Map<string, ZoneType>();
  for (let row = 0; row < TUTORIAL_BOX_ROWS.length; row++) {
    const y = 111 + row;
    const encoded = TUTORIAL_BOX_ROWS[row];
    for (let col = 0; col < encoded.length; col++) {
      const x = tutorialX(120 + col, y);
      const token = encoded[col];
      if (token === '#') {
        grid.set(x, y, TileType.WALL);
      } else if (token === 'D') {
        grid.set(x, y, TileType.DOOR);
      } else if (TUTORIAL_ZONE_BY_CHAR[token]) {
        grid.set(x, y, TileType.FLOOR);
        initialZones.set(`${x},${y}`, TUTORIAL_ZONE_BY_CHAR[token]!);
      } else {
        // Box.sav contains intentional space gaps inside its rectangular bounds.
        grid.set(x, y, TileType.SPACE);
      }
    }
  }

  // The parameter is retained because both generators share the same call
  // shape and WallAutoGen owns subsequent player construction updates.
  void wallAutoGen;

  return {
    seedPodX: tutorialX(131, 139),
    seedPodY: 139,
    crewSpawns: [
      { x: tutorialX(126, 129), y: 129 }, // Oxygen1
      { x: 128, y: 136 }, // Hall1
      { x: tutorialX(130, 131), y: 131 }, // Hall2
      { x: 127, y: 126 }, // Hall3
      { x: 133, y: 138 }, // Power1
    ],
    crewSpacewalking: false,
    initialZones,
    initialObjects: [
      { sName: 'BaseSeed', x: tutorialX(131, 139), y: 139 },
      { sName: 'RefineryDropoff', x: 129, y: 122, condition: 20 },
      { sName: 'OxygenRecycler', x: tutorialX(126, 133), y: 133 },
      { sName: 'Door', x: tutorialX(127, 123), y: 123, bFlipX: true },
      { sName: 'Door', x: tutorialX(129, 125), y: 125 },
      { sName: 'Door', x: 127, y: 128 },
      { sName: 'Door', x: tutorialX(131, 133), y: 133, bFlipX: true },
      { sName: 'Door', x: 127, y: 134, bFlipX: true },
      { sName: 'Door', x: 129, y: 136, bFlipX: true },
    ],
  };
}

/**
 * Spawn asteroids using density tiers and module templates.
 * Mirrors Lua Asteroid.spawnAsteroids(asteroidSeed).
 */
function spawnAsteroids(
  grid: TileGrid,
  cx: number,
  cy: number,
  asteroidSeed: number,
) {
  // Step 1: Determine density tier (Lua: nThreshold)
  let tier = 0; // low
  if (asteroidSeed > THRESHOLD_MED_HIGH) {
    tier = 2; // high
  } else if (asteroidSeed > THRESHOLD_MED_LOW) {
    tier = 1; // medium
  }

  // Step 2: Calculate interpolation parameter 't' within tier
  let t: number;
  if (tier === 0) {
    t = asteroidSeed / Math.max(THRESHOLD_MED_LOW, 0.01);
  } else if (tier === 1) {
    t = (asteroidSeed - THRESHOLD_MED_LOW) / (THRESHOLD_MED_HIGH - THRESHOLD_MED_LOW);
  } else {
    t = (asteroidSeed - THRESHOLD_MED_HIGH) / (1 - THRESHOLD_MED_HIGH);
  }

  // Step 3: Lerp between min/max, add variance
  let numToSpawn = lerp(MIN_NUM_TO_SPAWN[tier], MAX_NUM_TO_SPAWN[tier], t);
  numToSpawn = Math.round(
    numToSpawn + lerp(-VARIANCE_PER_LEVEL[tier], VARIANCE_PER_LEVEL[tier], Math.random()),
  );

  // Step 4: Place asteroids, avoiding center safe zone (8x8 at center)
  const safeX = Math.floor(GRID_W * 0.5 - 4);
  const safeY = Math.floor(GRID_H * 0.5 - 4);
  let nMaxTries = numToSpawn * 3;
  let placed = 0;

  while (placed < numToSpawn && nMaxTries > 0) {
    nMaxTries--;

    const template = pickRandomTemplate();
    const tx = 1 + Math.floor(Math.random() * (GRID_W - 1 - template.tileWidth));
    const ty = 1 + Math.floor(Math.random() * (GRID_H - 1 - template.tileHeight));

    // Reject if overlaps with safe zone
    if (overlaps(safeX, safeY, safeX + 8, safeY + 8,
                 tx, ty, tx + template.tileWidth, ty + template.tileHeight)) {
      continue;
    }

    // Check all template tiles are empty space
    let canPlace = true;
    for (const tile of template.tiles) {
      if (grid.get(tx + tile.dx, ty + tile.dy) !== TileType.SPACE) {
        canPlace = false;
        break;
      }
    }
    if (!canPlace) continue;

    // Place all template tiles
    for (const tile of template.tiles) {
      grid.set(tx + tile.dx, ty + tile.dy, ASTEROID_VALUE_START);
    }
    placed++;
  }
}
