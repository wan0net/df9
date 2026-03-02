/**
 * Malady.ts — Active malady/disease on a character.
 * Mirrors Malady.lua: infection, spread, cure.
 */

import { MALADY_DEFS, type MaladyDef } from './MaladyData';

export class Malady {
  readonly def: MaladyDef;
  elapsedTime = 0;
  bCured = false;

  constructor(sName: string) {
    const d = MALADY_DEFS[sName];
    if (!d) throw new Error(`Unknown malady: ${sName}`);
    this.def = d;
  }

  /** Update the malady. Returns damage to apply. */
  update(dt: number): number {
    if (this.bCured) return 0;
    this.elapsedTime += dt;

    // Check natural duration expiry
    if (this.def.nDuration > 0 && this.elapsedTime >= this.def.nDuration) {
      this.bCured = true;
      return 0;
    }

    return this.def.nDamagePerSecond * dt;
  }

  /** Attempt to cure. Returns true if successful. */
  attemptCure(doctorSkill: number): boolean {
    if (!this.def.bCurable) return false;
    if (Math.random() < doctorSkill - this.def.nCureDifficulty + 0.5) {
      this.bCured = true;
      return true;
    }
    return false;
  }

  isExpired(): boolean {
    return this.bCured;
  }
}
