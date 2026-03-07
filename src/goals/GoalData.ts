/**
 * GoalData.ts — Goal/achievement definitions.
 * Mirrors GoalData.lua: 16 goals using GOALSS linecodes.
 */

import { line } from '../localization/Localization';

export interface GoalDef {
  sName: string;
  /** Linecode key for friendly name — resolved at display time. */
  sNameLC: string;
  /** Linecode key for description — resolved at display time. */
  sDescLC: string;
  get friendlyName(): string;
  get description(): string;
  /** Check function key — matched in GoalSystem. */
  checkType: string;
  /** Threshold value for completion (if applicable). */
  nThreshold: number;
}

// ── Targets — GoalData.lua:6-21 ─────────────────────────────────────────────
export const TARGET_CITIZENS = 50;
export const TARGET_MATTER = 50000;
export const TARGET_HOSTILES_KILLED = 50;
export const TARGET_BASE_TILES = 3000;
export const TARGET_MEALS = 1000;
export const TARGET_CURES = 10;
export const TARGET_HAPPY_CITIZENS = 30;
export const TARGET_HAPPY_MORALE = 90;
export const TARGET_BREACH_SHIPS = 5;
export const TARGET_RAIDERS_CONVERTED = 10;
export const TARGET_HOSTILES_ASPHYXIATED = 10;
export const TARGET_HOSTILE_TURRET_KILLS = 20;
export const TARGET_BODIES = 100;
export const TARGET_HOSTILE_MONSTER_KILLS = 10;

/** Create a goal def with lazy linecode resolution via getters. */
function goal(sName: string, sNameLC: string, sDescLC: string, checkType: string, nThreshold: number): GoalDef {
  return {
    sName, sNameLC, sDescLC, checkType, nThreshold,
    get friendlyName() { return line(sNameLC); },
    get description() { return line(sDescLC, { TARGET: String(nThreshold) }); },
  };
}

export const GOAL_DEFS: GoalDef[] = [
  goal('Citizens', 'GOALSS001TEXT', 'GOALSS002TEXT', 'citizens', TARGET_CITIZENS),
  goal('Matter', 'GOALSS003TEXT', 'GOALSS004TEXT', 'matter', TARGET_MATTER),
  goal('BuiltEverything', 'GOALSS005TEXT', 'GOALSS006TEXT', 'builtEverything', 1),
  goal('HostilesKilled', 'GOALSS007TEXT', 'GOALSS008TEXT', 'hostilesKilled', TARGET_HOSTILES_KILLED),
  goal('BaseTiles', 'GOALSS010TEXT', 'GOALSS011TEXT', 'baseTiles', TARGET_BASE_TILES),
  goal('MealsServed', 'GOALSS017TEXT', 'GOALSS018TEXT', 'mealsServed', TARGET_MEALS),
  goal('CuresResearched', 'GOALSS015TEXT', 'GOALSS016TEXT', 'curesResearched', TARGET_CURES),
  goal('AllTechs', 'GOALSS019TEXT', 'GOALSS020TEXT', 'allTechs', 1),
  goal('HappyCitizens', 'GOALSS021TEXT', 'GOALSS022TEXT', 'happyCitizens', TARGET_HAPPY_CITIZENS),
  goal('BreachShipsDestroyed', 'GOALSS023TEXT', 'GOALSS024TEXT', 'breachShipsDestroyed', TARGET_BREACH_SHIPS),
  goal('AllPossessions', 'GOALSS025TEXT', 'GOALSS026TEXT', 'allPossessions', 1),
  goal('RaidersConverted', 'GOALSS027TEXT', 'GOALSS028TEXT', 'raidersConverted', TARGET_RAIDERS_CONVERTED),
  goal('HostilesAsphyxiated', 'GOALSS029TEXT', 'GOALSS030TEXT', 'hostilesAsphyxiated', TARGET_HOSTILES_ASPHYXIATED),
  goal('HostilesKilledByTurrets', 'GOALSS035TEXT', 'GOALSS036TEXT', 'hostilesKilledByTurrets', TARGET_HOSTILE_TURRET_KILLS),
  goal('BodiesRefined', 'GOALSS031TEXT', 'GOALSS032TEXT', 'bodiesRefined', TARGET_BODIES),
  goal('FinalSiege', 'GOALSS037TEXT', 'GOALSS038TEXT', 'finalSiege', 1),
];
