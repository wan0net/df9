/**
 * Corpse.ts — Character corpse pickup.
 * Mirrors Pickups/Corpse.lua.
 */

import { Pickup } from './Pickup';
import { MAT_CORPSE_MIN, MAT_CORPSE_MAX } from '../core/GameRules';

/** Corpse decay timer in seconds (Lua CORPSE_DURATION = 600). */
export const CORPSE_DURATION = 600;

export class Corpse extends Pickup {
  /** Name of the deceased. */
  deceasedName: string;
  /** Cause of death. */
  causeOfDeath: number;
  /** Matter yield if recycled. */
  matterYield: number;
  /** Decay timer in seconds — corpse disappears when this reaches CORPSE_DURATION. */
  nDecayTimer = 0;

  constructor(tileX: number, tileY: number, deceasedName: string, causeOfDeath: number) {
    super('Corpse', tileX, tileY);
    this.deceasedName = deceasedName;
    this.causeOfDeath = causeOfDeath;
    this.matterYield = MAT_CORPSE_MIN + Math.floor(Math.random() * (MAT_CORPSE_MAX - MAT_CORPSE_MIN + 1));
  }

  /** Tick decay timer. Returns true if corpse should be removed. */
  tickDecay(dt: number): boolean {
    this.nDecayTimer += dt;
    return this.nDecayTimer >= CORPSE_DURATION;
  }
}
