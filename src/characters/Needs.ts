/**
 * Needs.ts — Character needs system.
 * Mirrors CharacterConstants.lua needs: Hunger, Energy, Amusement, Social, Duty.
 * Plus Oxygen as a survival need (synced from room).
 */

import { NEEDS_REDUCE_TICK, MORALE_MAX, MORALE_MIN, MORALE_TICK } from './CharacterConstants';

export type NeedName = 'oxygen' | 'hunger' | 'energy' | 'amusement' | 'social' | 'duty';

export class Needs {
  // ── Survival ──────────────────────────────────────────────────
  /** Oxygen: synced from room O2 level (0-100 display scale) */
  oxygen = 100;

  // ── Lua needs (decay every NEEDS_REDUCE_TICK = 14.4 seconds) ─
  /** Hunger need (100 = full, decays over time) */
  hunger = 100;
  /** Energy need (100 = rested, decays over time) */
  energy = 100;
  /** Amusement/fun need */
  amusement = 100;
  /** Social interaction need */
  social = 100;
  /** Duty/work fulfillment need */
  duty = 100;

  /** Time accumulator for need decay (in seconds) */
  private needTickAccum = 0;

  /** Decay needs over time. dt in seconds (game-scaled). */
  decay(dt: number) {
    this.needTickAccum += dt;

    // Needs reduce every NEEDS_REDUCE_TICK seconds (14.4s in Lua)
    if (this.needTickAccum >= NEEDS_REDUCE_TICK) {
      this.needTickAccum -= NEEDS_REDUCE_TICK;

      // Each need decays by a fixed amount per tick
      this.hunger = Math.max(-100, this.hunger - 5);
      this.energy = Math.max(-100, this.energy - 4);
      this.amusement = Math.max(-100, this.amusement - 3);
      this.social = Math.max(-100, this.social - 2);
      this.duty = Math.max(-100, this.duty - 1);
    }
  }

  /** Update oxygen need based on room O2 level (0-255) */
  updateOxygen(roomO2: number) {
    this.oxygen = (roomO2 / 255) * 100;
  }

  /** Satisfy a need by adding value. */
  satisfy(need: NeedName, amount: number) {
    switch (need) {
      case 'hunger': this.hunger = Math.min(100, this.hunger + amount); break;
      case 'energy': this.energy = Math.min(100, this.energy + amount); break;
      case 'amusement': this.amusement = Math.min(100, this.amusement + amount); break;
      case 'social': this.social = Math.min(100, this.social + amount); break;
      case 'duty': this.duty = Math.min(100, this.duty + amount); break;
    }
  }

  /** Get most urgent need (lowest value) */
  getMostUrgent(): { need: NeedName; value: number } {
    const needs: { need: NeedName; value: number }[] = [
      { need: 'oxygen', value: this.oxygen },
      { need: 'hunger', value: this.hunger },
      { need: 'energy', value: this.energy },
      { need: 'amusement', value: this.amusement },
      { need: 'social', value: this.social },
      { need: 'duty', value: this.duty },
    ];
    needs.sort((a, b) => a.value - b.value);
    return needs[0];
  }

  /** Get all needs as array, sorted by urgency. */
  getAllNeeds(): { need: NeedName; value: number }[] {
    const needs: { need: NeedName; value: number }[] = [
      { need: 'oxygen' as NeedName, value: this.oxygen },
      { need: 'hunger' as NeedName, value: this.hunger },
      { need: 'energy' as NeedName, value: this.energy },
      { need: 'amusement' as NeedName, value: this.amusement },
      { need: 'social' as NeedName, value: this.social },
      { need: 'duty' as NeedName, value: this.duty },
    ];
    return needs.sort((a, b) => a.value - b.value);
  }
}
