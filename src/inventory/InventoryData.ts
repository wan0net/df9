/**
 * InventoryData.ts — Item definitions.
 * Mirrors InventoryData.lua.
 */

export interface ItemDef {
  sName: string;
  friendlyName: string;
  description: string;
  nStackMax: number;
}

export const ITEM_DEFS: Record<string, ItemDef> = {
  MatterChunk: {
    sName: 'MatterChunk',
    friendlyName: 'Matter Chunk',
    description: 'Raw matter from mining',
    nStackMax: 99,
  },
  Food: {
    sName: 'Food',
    friendlyName: 'Food Ration',
    description: 'Basic meal',
    nStackMax: 10,
  },
  Drink: {
    sName: 'Drink',
    friendlyName: 'Beverage',
    description: 'Refreshing drink',
    nStackMax: 10,
  },
  MedKit: {
    sName: 'MedKit',
    friendlyName: 'Medical Kit',
    description: 'First aid supplies',
    nStackMax: 5,
  },
  ResearchSample: {
    sName: 'ResearchSample',
    friendlyName: 'Research Sample',
    description: 'Scientific sample for research',
    nStackMax: 10,
  },
};
