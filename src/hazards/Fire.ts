/**
 * Fire.ts — Per-tile fire system with isometric adjacency spread.
 * Mirrors Lua Fire.lua: intensity-based spread, O2 consumption, citizen ignition,
 * tile damage, wall blocking.
 */

import { GameRules, type TickableSystem } from '../core/GameRules';
import { SpatialAudio } from '../audio/SpatialAudio';

// ── Lua-exact constants ──────────────────────────────────────────────

/** Seconds between fire ticks (Lua Fire.TIME_BETWEEN_UPDATES). */
const TIME_BETWEEN_UPDATES = 1;

/** Spread probability by intensity (Lua Fire.SPREAD_PROBABILITY_*). */
const SPREAD_PROBABILITY_DEFAULT = 0.075;
const SPREAD_PROBABILITY_LOW = 0.025;
const SPREAD_PROBABILITY_HIGH = 0.15;

/** Citizen ignition probability by intensity (Lua Fire.CITIZEN_SPREAD_PROBABILITY_*). */
const CITIZEN_SPREAD_PROBABILITY_DEFAULT = 0.2;
const CITIZEN_SPREAD_PROBABILITY_LOW = 0.1;
const CITIZEN_SPREAD_PROBABILITY_HIGH = 0.3;

/** Tile damage probabilities (Lua Fire.DAMAGE_*_TILE_PROBABILITY). */
const DAMAGE_HEALTHY_TILE_PROBABILITY = 0.85;
const DAMAGE_HURT_TILE_PROBABILITY = 0.15;

/** O2 consumed per second per fire tile (Lua Fire.OXYGEN_PER_SECOND). */
export const FIRE_OXYGEN_PER_SECOND = 200;
/** Low O2 threshold — starts dousing fire (Lua Fire.LOW_OXYGEN_THRESHOLD). */
const LOW_OXYGEN_THRESHOLD = 500;
/** No O2 threshold — rapid dousing (Lua Fire.NO_OXYGEN_THRESHOLD). */
const NO_OXYGEN_THRESHOLD = 25;
/** Douse rate at low O2 (Lua Fire.LOW_OXYGEN_DOUSE_RATE). */
const LOW_OXYGEN_DOUSE_RATE = 10;
/** Douse rate at no O2 (Lua Fire.NO_OXYGEN_DOUSE_RATE). */
const NO_OXYGEN_DOUSE_RATE = 100;

/** Default fire intensity (Lua Fire.INTENSITY_DEFAULT). */
const INTENSITY_DEFAULT = 10;
/** Intensity thresholds for spread probability (Lua Fire.INTENSITY_THRESHOLD_*). */
const INTENSITY_THRESHOLD_LOW = 5;
const INTENSITY_THRESHOLD_HIGH = 15;

/** Fire damage per second to characters (used externally). */
export const FIRE_DAMAGE_PER_SECOND = 5;

// ── Fire state ───────────────────────────────────────────────────────

/** Per-tile heat value; at >= 1 a flame is created (Lua Fire.tTiles). */
interface TileFire {
  x: number;
  y: number;
  nHeat: number;        // Heat accumulation (>= 1 = active flame)
  nIntensity: number;   // Flame intensity (affects spread probability)
}

// ── Adjacency ────────────────────────────────────────────────────────

// Lua Fire uses getAdjacentTile(tx,ty,random(2,9)) which includes all 8 directions.
// On the staggered diamond grid, directions 2-5 are the 4 iso neighbors (NW/NE/SW/SE)
// and directions 6-9 are the 4 cardinal neighbors (N/E/S/W = 2-tile hops).
// Isometric (diagonal) neighbor offsets:
// Even row: NW(-1,-1), NE(0,-1), SW(-1,1), SE(0,1)
// Odd row:  NW(0,-1),  NE(1,-1), SW(0,1),  SE(1,1)
// Cardinal (axis-aligned) neighbor offsets: N(0,-2), E(+1,0), S(0,+2), W(-1,0)
function getIsoNeighbors(x: number, y: number): { x: number; y: number }[] {
  const xLeft = (y & 1) === 0 ? -1 : 0;
  return [
    { x: x + xLeft, y: y - 1 },      // NW
    { x: x + xLeft + 1, y: y - 1 },  // NE
    { x: x + xLeft, y: y + 1 },      // SW
    { x: x + xLeft + 1, y: y + 1 },  // SE
  ];
}

/** All 8 neighbors (Lua directions 2-9): 4 iso + 4 cardinal. */
function getAll8Neighbors(x: number, y: number): { x: number; y: number }[] {
  const xLeft = (y & 1) === 0 ? -1 : 0;
  return [
    { x: x + xLeft, y: y - 1 },      // NW
    { x: x + xLeft + 1, y: y - 1 },  // NE
    { x: x + xLeft, y: y + 1 },      // SW
    { x: x + xLeft + 1, y: y + 1 },  // SE
    { x: x, y: y - 2 },              // N
    { x: x + 1, y: y },              // E
    { x: x, y: y + 2 },              // S
    { x: x - 1, y: y },              // W
  ];
}

/** Callback for checking tile type (set from main.ts). */
type TileCheckFn = (x: number, y: number) => number;
/** Callback for getting tile oxygen (set from main.ts). */
type OxygenCheckFn = (x: number, y: number) => number;
/** Callback for checking tile health (set from main.ts). */
type TileHealthFn = (x: number, y: number) => number | undefined;
/** Callback for citizen ignition (Lua: checks all chars at fire tile, calls catchFire). */
type CitizenIgniteFn = (x: number, y: number) => void;
/** Callback when fire starts on a tile — notifies room (bBurning) and env object (destroy). */
type OnFireStartFn = (x: number, y: number) => void;

/** Tile types that block fire spread. */
const WALL_TILE = 4;
const SPACE_TILE = 1;

/** Checks if a tile type counts as floor (Lua g_World.countsAsFloor). */
function countsAsFloor(tileType: number): boolean {
  return tileType !== WALL_TILE && tileType !== SPACE_TILE && tileType !== 0;
}

export class Fire implements TickableSystem {
  private fires: Map<string, TileFire> = new Map();
  private timeUntilNextUpdate = TIME_BETWEEN_UPDATES;

  /** Optional tile check function for wall/space blocking. */
  tileCheck: TileCheckFn | null = null;
  /** Optional oxygen check function. */
  oxygenCheck: OxygenCheckFn | null = null;
  /** Optional tile health check. */
  tileHealthCheck: TileHealthFn | null = null;
  /** Optional citizen ignition callback (Lua: per-fire-tile citizen check). */
  citizenIgnite: CitizenIgniteFn | null = null;
  /** Optional onFire callback — notifies room (bBurning) and env object (destroyed). */
  onFireStart: OnFireStartFn | null = null;
  /** Optional callback when fire extinguished at tile. */
  onFireEnd: ((x: number, y: number) => void) | null = null;

  /** Set of tiles with FirePanel objects (reduces spread). */
  firePanelTiles: Set<string> = new Set();

  init() {
    GameRules.registerSystem(3, this);
  }

  /** Start a fire at a tile (Lua Fire.startFire → _attemptFireTile → _addToTile). */
  startFire(x: number, y: number, nIntensity = INTENSITY_DEFAULT) {
    const key = `${x},${y}`;
    if (this.fires.has(key)) return;

    // Check tile is valid floor
    if (this.tileCheck) {
      const tileType = this.tileCheck(x, y);
      if (!countsAsFloor(tileType)) return;
    }

    this.fires.set(key, { x, y, nHeat: 1, nIntensity: nIntensity });

    // One-shot fire start SFX at tile (Lua: Fire._addToTile plays start sound)
    SpatialAudio.fireStartSfx(x, y);

    // Notify room and env objects (Lua Fire._addToTile: prop:onFire(), rRoom:onFire())
    this.onFireStart?.(x, y);
  }

  /** Douse a fire tile by amount. Returns true if extinguished. */
  douseTile(x: number, y: number, nDouseAmount: number): boolean {
    const key = `${x},${y}`;
    const fire = this.fires.get(key);
    if (!fire) return true;
    fire.nIntensity -= nDouseAmount;
    if (fire.nIntensity <= 0) {
      this.fires.delete(key);
      this.onFireEnd?.(x, y);
      return true;
    }
    return false;
  }

  /** Extinguish a fire at a tile. */
  extinguish(x: number, y: number) {
    if (this.fires.has(`${x},${y}`)) {
      this.fires.delete(`${x},${y}`);
      this.onFireEnd?.(x, y);
    }
  }

  /** Check if a tile is on fire. */
  isOnFire(x: number, y: number): boolean {
    return this.fires.has(`${x},${y}`);
  }

  /** Get fire intensity at a tile (0 if no fire). */
  getIntensity(x: number, y: number): number {
    return this.fires.get(`${x},${y}`)?.nIntensity ?? 0;
  }

  /** Get all active fires. */
  getActiveFires(): { x: number; y: number; intensity: number }[] {
    return Array.from(this.fires.values()).map(f => ({ x: f.x, y: f.y, intensity: f.nIntensity }));
  }

  getFireCount(): number {
    return this.fires.size;
  }

  /** Get tiles currently on fire (for character damage checks). */
  getFireTiles(): Set<string> {
    return new Set(this.fires.keys());
  }

  /** Get nearby fire tile within 1-tile radius (Lua Fire.getNearbyFire — all 8 neighbors). */
  getNearbyFire(x: number, y: number): { x: number; y: number } | null {
    if (this.fires.has(`${x},${y}`)) return { x, y };
    for (const nb of getAll8Neighbors(x, y)) {
      if (this.fires.has(`${nb.x},${nb.y}`)) return nb;
    }
    return null;
  }

  /** Get spread probability based on intensity (Lua Fire:getSpreadProbability). */
  private getSpreadProbability(nIntensity: number): number {
    if (nIntensity < INTENSITY_THRESHOLD_LOW) return SPREAD_PROBABILITY_LOW;
    if (nIntensity > INTENSITY_THRESHOLD_HIGH) return SPREAD_PROBABILITY_HIGH;
    return SPREAD_PROBABILITY_DEFAULT;
  }

  /** Get citizen spread probability based on intensity (Lua Fire:getCitizenSpreadProbability). */
  getCitizenSpreadProbability(nIntensity: number): number {
    if (nIntensity < INTENSITY_THRESHOLD_LOW) return CITIZEN_SPREAD_PROBABILITY_LOW;
    if (nIntensity > INTENSITY_THRESHOLD_HIGH) return CITIZEN_SPREAD_PROBABILITY_HIGH;
    return CITIZEN_SPREAD_PROBABILITY_DEFAULT;
  }

  onTick(dt: number) {
    this.timeUntilNextUpdate -= dt;
    if (this.timeUntilNextUpdate > 0) return;
    this.timeUntilNextUpdate = TIME_BETWEEN_UPDATES;

    const toSpread: { x: number; y: number }[] = [];

    for (const [key, fire] of this.fires) {
      // O2 dousing check (Lua: oxygen < NO_OXYGEN_THRESHOLD or < LOW_OXYGEN_THRESHOLD)
      if (this.oxygenCheck) {
        const oxygen = this.oxygenCheck(fire.x, fire.y);
        if (oxygen < NO_OXYGEN_THRESHOLD) {
          if (this.douseTile(fire.x, fire.y, NO_OXYGEN_DOUSE_RATE * dt)) {
            continue;
          }
        } else if (oxygen < LOW_OXYGEN_THRESHOLD) {
          if (this.douseTile(fire.x, fire.y, LOW_OXYGEN_DOUSE_RATE * dt)) {
            continue;
          }
        }
      }

      // Spread to adjacent tile (Lua: random(2,9) = all 8 neighbors)
      if (Math.random() < this.getSpreadProbability(fire.nIntensity)) {
        const neighbors = getAll8Neighbors(fire.x, fire.y);
        const nb = neighbors[Math.floor(Math.random() * neighbors.length)];

        if (this.tileCheck) {
          const tileType = this.tileCheck(nb.x, nb.y);
          // Lua: only spread to floor tiles (wall/door spread disabled in Lua: "MTF TEMP")
          if (countsAsFloor(tileType)) {
            const nbKey = `${nb.x},${nb.y}`;
            if (!this.fires.has(nbKey)) {
              toSpread.push(nb);
            }
          }
        } else {
          const nbKey = `${nb.x},${nb.y}`;
          if (!this.fires.has(nbKey)) {
            toSpread.push(nb);
          }
        }
      }

      // Citizen ignition (Lua: check all chars at fire tile, call catchFire)
      if (this.citizenIgnite && Math.random() < this.getCitizenSpreadProbability(fire.nIntensity)) {
        this.citizenIgnite(fire.x, fire.y);
      }

      // Tile damage accumulation (Lua: fire.tTiles[addr] += .4 with probability)
      let probDamage = DAMAGE_HEALTHY_TILE_PROBABILITY;
      if (this.tileHealthCheck) {
        const health = this.tileHealthCheck(fire.x, fire.y);
        if (health !== undefined && health < 100) {
          probDamage = DAMAGE_HURT_TILE_PROBABILITY;
        }
      }
      if (Math.random() < probDamage) {
        fire.nHeat += 0.4;
      }
    }

    // Spread fires (Lua: only spread 1 fire per tick via early return)
    if (toSpread.length > 0) {
      const pos = toSpread[0]; // Lua returns after first successful spread
      this.startFire(pos.x, pos.y, INTENSITY_DEFAULT);
    }

    // Update the single global fire loop position (Lua: ONE loop at average of all fires)
    const allFires: { x: number; y: number }[] = [];
    for (const fire of this.fires.values()) {
      allFires.push({ x: fire.x, y: fire.y });
    }
    SpatialAudio.updateFireLoop(allFires);
  }

  // ── Save/Load (mirrors Lua Fire.getSaveTable / fromSaveTable) ────

  /** Get save data: heat map + flame intensities. */
  getSaveData(): { tTiles: Record<string, number>; tFlames: Record<string, number> } {
    const tTiles: Record<string, number> = {};
    const tFlames: Record<string, number> = {};
    for (const [key, fire] of this.fires) {
      tTiles[key] = fire.nHeat;
      if (fire.nIntensity > 0) {
        tFlames[key] = fire.nIntensity;
      }
    }
    return { tTiles, tFlames };
  }

  /** Load from save data. */
  loadSaveData(data: { tTiles: Record<string, number>; tFlames: Record<string, number> }) {
    this.fires.clear();
    // Restore from flame intensities (tFlames has the visible fires)
    for (const [key, intensity] of Object.entries(data.tFlames)) {
      const [xStr, yStr] = key.split(',');
      const x = parseInt(xStr, 10);
      const y = parseInt(yStr, 10);
      const heat = data.tTiles[key] ?? 1;
      this.fires.set(key, { x, y, nHeat: heat, nIntensity: intensity });
    }
  }

  /** Clear all fires (for new game / load). */
  clearAll() {
    this.fires.clear();
    // Stop the global fire loop immediately
    SpatialAudio.updateFireLoop([]);
  }
}
