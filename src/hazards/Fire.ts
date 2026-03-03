/**
 * Fire.ts — Per-tile fire system with isometric adjacency spread.
 * Mirrors Fire.lua: spread, damage, extinguish, blocked by walls.
 */

import { GameRules, type TickableSystem } from '../core/GameRules';

/** Fire state for a tile. */
interface TileFire {
  x: number;
  y: number;
  intensity: number; // 0-100
  spreadTimer: number;
}

/** Fire spread interval in seconds. */
const FIRE_SPREAD_INTERVAL = 5;
/** Fire spread chance per adjacent tile. */
const FIRE_SPREAD_CHANCE = 0.15;
/** Fire damage per second to characters on fire tiles. */
export const FIRE_DAMAGE_PER_SECOND = 5;
/** Fire panel reduces spread chance by this factor. */
const FIRE_PANEL_SPREAD_REDUCTION = 0.5;

// Isometric diamond grid adjacency offsets:
// Even row: NW(-1,-1), NE(0,-1), SW(-1,1), SE(0,1)
// Odd row:  NW(0,-1),  NE(1,-1), SW(0,1),  SE(1,1)
function getIsoNeighbors(x: number, y: number): { x: number; y: number }[] {
  const xLeft = (y & 1) === 0 ? -1 : 0;
  return [
    { x: x + xLeft, y: y - 1 },      // NW
    { x: x + xLeft + 1, y: y - 1 },  // NE
    { x: x + xLeft, y: y + 1 },      // SW
    { x: x + xLeft + 1, y: y + 1 },  // SE
  ];
}

/** Callback for checking tile type (set from main.ts). */
type TileCheckFn = (x: number, y: number) => number;
/** Tile types that block fire spread (walls). */
const WALL_TILE = 4;
const SPACE_TILE = 1;

export class Fire implements TickableSystem {
  private fires: Map<string, TileFire> = new Map();

  /** Optional tile check function for wall/space blocking. */
  tileCheck: TileCheckFn | null = null;

  /** Set of tiles with FirePanel objects (reduces spread). */
  firePanelTiles: Set<string> = new Set();

  init() {
    GameRules.registerSystem(3, this);
  }

  /** Start a fire at a tile. */
  startFire(x: number, y: number, intensity = 50) {
    const key = `${x},${y}`;
    if (this.fires.has(key)) return;
    this.fires.set(key, { x, y, intensity, spreadTimer: 0 });
  }

  /** Extinguish a fire at a tile. */
  extinguish(x: number, y: number) {
    this.fires.delete(`${x},${y}`);
  }

  /** Check if a tile is on fire. */
  isOnFire(x: number, y: number): boolean {
    return this.fires.has(`${x},${y}`);
  }

  /** Get fire intensity at a tile (0 if no fire). */
  getIntensity(x: number, y: number): number {
    return this.fires.get(`${x},${y}`)?.intensity ?? 0;
  }

  /** Get all active fires. */
  getActiveFires(): { x: number; y: number; intensity: number }[] {
    return Array.from(this.fires.values()).map(f => ({ x: f.x, y: f.y, intensity: f.intensity }));
  }

  getFireCount(): number {
    return this.fires.size;
  }

  /** Get tiles currently on fire (for character damage checks). */
  getFireTiles(): Set<string> {
    return new Set(this.fires.keys());
  }

  onTick(dt: number) {
    const toRemove: string[] = [];
    const toSpread: { x: number; y: number }[] = [];

    for (const [key, fire] of this.fires) {
      // Decay intensity over time
      fire.intensity -= dt * 0.5;
      if (fire.intensity <= 0) {
        toRemove.push(key);
        continue;
      }

      // Spread timer
      fire.spreadTimer += dt;
      if (fire.spreadTimer >= FIRE_SPREAD_INTERVAL) {
        fire.spreadTimer = 0;

        // Use isometric neighbors for spread
        const neighbors = getIsoNeighbors(fire.x, fire.y);
        for (const nb of neighbors) {
          // Check if fire is blocked by walls
          if (this.tileCheck) {
            const tileType = this.tileCheck(nb.x, nb.y);
            if (tileType === WALL_TILE || tileType === SPACE_TILE) continue;
          }

          // Fire panel reduction
          let chance = FIRE_SPREAD_CHANCE;
          const nbKey = `${nb.x},${nb.y}`;
          if (this.firePanelTiles.has(nbKey)) {
            chance *= FIRE_PANEL_SPREAD_REDUCTION;
          }

          if (Math.random() < chance && !this.fires.has(nbKey)) {
            toSpread.push(nb);
          }
        }
      }
    }

    // Remove extinguished fires
    for (const key of toRemove) {
      this.fires.delete(key);
    }

    // Spread fires
    for (const pos of toSpread) {
      this.startFire(pos.x, pos.y, 30);
    }
  }
}
