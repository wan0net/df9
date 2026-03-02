/**
 * BrigZone.ts — Brig zone subclass.
 * Mirrors Zones/BrigZone.lua: prisoner assignment tracking.
 */

import { Zone } from './Zone';
import { ZoneType } from '../world/ZoneType';

/** Static registry of all brig zones. */
const allBrigs: BrigZone[] = [];

export class BrigZone extends Zone {
  /** Assigned prisoner character IDs */
  private prisoners: Set<number> = new Set();

  constructor() {
    super(ZoneType.BRIG);
    allBrigs.push(this);
  }

  protected generateUniqueName(): string {
    const num = Math.floor(Math.random() * 99) + 1;
    return `Brig Zone ${num}`;
  }

  /** Assign a character as a prisoner. */
  assignChar(charId: number): boolean {
    if (this.prisoners.has(charId)) return false;
    this.prisoners.add(charId);
    return true;
  }

  /** Unassign a prisoner. */
  unassignChar(charId: number) {
    this.prisoners.delete(charId);
  }

  /** Check if a character is assigned to this brig. */
  isCharAssigned(charId: number): boolean {
    return this.prisoners.has(charId);
  }

  /** Get all prisoner IDs. */
  getPrisoners(): number[] {
    return Array.from(this.prisoners);
  }

  /** Static: get all brig zones. */
  static getAllBrigs(): BrigZone[] {
    return allBrigs;
  }

  /** Static: find which brig a character is in, if any. */
  static findBrigForChar(charId: number): BrigZone | null {
    for (const brig of allBrigs) {
      if (brig.isCharAssigned(charId)) return brig;
    }
    return null;
  }
}
