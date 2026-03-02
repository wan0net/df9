/**
 * MaladyData.ts — Disease/condition definitions.
 * Mirrors NewMaladyData.lua.
 */

export interface MaladyDef {
  sName: string;
  friendlyName: string;
  description: string;
  /** Damage per second. */
  nDamagePerSecond: number;
  /** Can spread to other characters. */
  bContagious: boolean;
  /** Spread chance per proximity tick. */
  nSpreadChance: number;
  /** Duration in seconds (0 = permanent until cured). */
  nDuration: number;
  /** Can be cured by doctors. */
  bCurable: boolean;
  /** Difficulty to cure (higher = more doctor skill needed). */
  nCureDifficulty: number;
}

export const MALADY_DEFS: Record<string, MaladyDef> = {
  SpaceFlu: {
    sName: 'SpaceFlu',
    friendlyName: 'Space Flu',
    description: 'Common space illness',
    nDamagePerSecond: 0.1,
    bContagious: true,
    nSpreadChance: 0.05,
    nDuration: 300,
    bCurable: true,
    nCureDifficulty: 0.2,
  },
  Parasite: {
    sName: 'Parasite',
    friendlyName: 'Space Parasite',
    description: 'Alien parasite infection',
    nDamagePerSecond: 0.5,
    bContagious: false,
    nSpreadChance: 0,
    nDuration: 0,
    bCurable: true,
    nCureDifficulty: 0.6,
  },
  Anxiety: {
    sName: 'Anxiety',
    friendlyName: 'Anxiety',
    description: 'Stress-related condition',
    nDamagePerSecond: 0,
    bContagious: false,
    nSpreadChance: 0,
    nDuration: 120,
    bCurable: false,
    nCureDifficulty: 0,
  },
  FoodPoisoning: {
    sName: 'FoodPoisoning',
    friendlyName: 'Food Poisoning',
    description: 'Bad meal effects',
    nDamagePerSecond: 0.2,
    bContagious: false,
    nSpreadChance: 0,
    nDuration: 180,
    bCurable: true,
    nCureDifficulty: 0.1,
  },
};
