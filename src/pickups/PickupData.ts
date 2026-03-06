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
  /** Leave 3D model/sprite on ground after pickup (Lua bLeaveEnvObject). */
  bLeaveEnvObject?: boolean;
}

export const PICKUP_DEFS: Record<string, PickupDef> = {
  Corpse: {
    sName: 'Corpse',
    friendlyName: 'Corpse',
    spriteName: 'corpse',
    bPickupable: true,
    nMatterValue: 150,
    bLeaveEnvObject: true,
  },
  Debris: {
    sName: 'Debris',
    friendlyName: 'Debris',
    spriteName: 'debris',
    bPickupable: true,
    nMatterValue: 10,
  },
  Rock: {
    sName: 'Rock',
    friendlyName: 'Mined Rock',
    spriteName: 'rock',
    bPickupable: true,
    nMatterValue: 50,
    bLeaveEnvObject: true,
  },
  Food: {
    sName: 'Food',
    friendlyName: 'Food',
    spriteName: 'food',
    bPickupable: true,
    nMatterValue: 5,
  },
  ResearchDatacube: {
    sName: 'ResearchDatacube',
    friendlyName: 'Research Datacube',
    spriteName: 'data_pickup',
    bPickupable: true,
    nMatterValue: 0,
  },
};
