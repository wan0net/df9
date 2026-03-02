/**
 * Fire.ts — Per-tile fire system.
 * Mirrors Fire.lua: spread, damage, extinguish.
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
/** Fire damage per second. */
const FIRE_DAMAGE_PER_SECOND = 2;

export class Fire implements TickableSystem {
  private fires: Map<string, TileFire> = new Map();

  init() {
    // Register at slot 3 (Fire.onTick in Lua tick order)
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

  /** Get all active fires. */
  getActiveFires(): TileFire[] {
    return Array.from(this.fires.values());
  }

  getFireCount(): number {
    return this.fires.size;
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
        // Spread chance to adjacent tiles (will use grid neighbors in full implementation)
        if (Math.random() < FIRE_SPREAD_CHANCE) {
          // Placeholder: spread to a random adjacent offset
          const dx = Math.floor(Math.random() * 3) - 1;
          const dy = Math.floor(Math.random() * 3) - 1;
          if (dx !== 0 || dy !== 0) {
            toSpread.push({ x: fire.x + dx, y: fire.y + dy });
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
