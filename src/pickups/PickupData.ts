/**
 * PickupData.ts — Pickup definitions.
 * Mirrors Pickups/PickupData.lua.
 */

export interface PickupDef {
  sName: string;
  friendlyName: string;
  spriteName: string;
  /** Can be picked up by characters. */
  bPickupable: boolean;
  /** Matter value if recycled. */
  nMatterValue: number;
}

export const PICKUP_DEFS: Record<string, PickupDef> = {
  Corpse: {
    sName: 'Corpse',
    friendlyName: 'Corpse',
    spriteName: 'corpse',
    bPickupable: true,
    nMatterValue: 150,
  },
  Debris: {
    sName: 'Debris',
    friendlyName: 'Debris',
    spriteName: 'debris',
    bPickupable: true,
    nMatterValue: 10,
  },
};
