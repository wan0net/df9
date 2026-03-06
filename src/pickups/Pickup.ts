/**
 * Pickup.ts — Base pickup class.
 * Mirrors Pickups/Pickup.lua.
 */

import { PICKUP_DEFS, type PickupDef } from './PickupData';

export class Pickup {
  readonly sName: string;
  readonly def: PickupDef;
  tileX: number;
  tileY: number;
  bPickedUp = false;
  /** Room this pickup is in (set on creation). */
  rRoom: { id: number } | null | undefined = null;

  constructor(sName: string, tileX: number, tileY: number) {
    this.sName = sName;
    const d = PICKUP_DEFS[sName];
    if (!d) throw new Error(`Unknown pickup: ${sName}`);
    this.def = d;
    this.tileX = tileX;
    this.tileY = tileY;
  }

  pickUp() {
    this.bPickedUp = true;
  }
}
