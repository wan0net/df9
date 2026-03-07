/**
 * FoodData.ts — Food type definitions matching Lua FoodData.lua.
 */

export interface FoodDef {
  friendlyNameLinecode: string;
}

export const tFoods: Record<string, FoodDef> = {
  Corn: { friendlyNameLinecode: 'FOODSX001TEXT' },
  Pod: { friendlyNameLinecode: 'FOODSX002TEXT' },
  Glowfruit: { friendlyNameLinecode: 'FOODSX003TEXT' },
  CandyCane: { friendlyNameLinecode: 'FOODSX004TEXT' },
};
