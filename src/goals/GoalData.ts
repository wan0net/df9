/**
 * GoalData.ts — Goal/achievement definitions.
 * Mirrors GoalData.lua: 16 goals (15 active + 1 commented out in Lua).
 */

export interface GoalDef {
  sName: string;
  friendlyName: string;
  description: string;
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

export const GOAL_DEFS: GoalDef[] = [
  {
    sName: 'Citizens',
    friendlyName: 'Populace',
    description: `Have ${TARGET_CITIZENS} citizens`,
    checkType: 'citizens',
    nThreshold: TARGET_CITIZENS,
  },
  {
    sName: 'Matter',
    friendlyName: 'Stockpiled',
    description: `Accumulate ${TARGET_MATTER} matter`,
    checkType: 'matter',
    nThreshold: TARGET_MATTER,
  },
  {
    sName: 'BuiltEverything',
    friendlyName: 'Master Builder',
    description: 'Build one of every object type',
    checkType: 'builtEverything',
    nThreshold: 1,
  },
  {
    sName: 'HostilesKilled',
    friendlyName: 'Exterminator',
    description: `Kill ${TARGET_HOSTILES_KILLED} hostiles`,
    checkType: 'hostilesKilled',
    nThreshold: TARGET_HOSTILES_KILLED,
  },
  {
    sName: 'BaseTiles',
    friendlyName: 'Empire Builder',
    description: `Own ${TARGET_BASE_TILES} base tiles`,
    checkType: 'baseTiles',
    nThreshold: TARGET_BASE_TILES,
  },
  {
    sName: 'MealsServed',
    friendlyName: 'Master Chef',
    description: `Serve ${TARGET_MEALS} meals`,
    checkType: 'mealsServed',
    nThreshold: TARGET_MEALS,
  },
  {
    sName: 'CuresResearched',
    friendlyName: 'Plague Doctor',
    description: `Research ${TARGET_CURES} disease cures`,
    checkType: 'curesResearched',
    nThreshold: TARGET_CURES,
  },
  {
    sName: 'AllTechs',
    friendlyName: 'Technologist',
    description: 'Research all available technologies',
    checkType: 'allTechs',
    nThreshold: 1,
  },
  {
    sName: 'HappyCitizens',
    friendlyName: 'Utopia',
    description: `Have ${TARGET_HAPPY_CITIZENS} citizens with morale above ${TARGET_HAPPY_MORALE}`,
    checkType: 'happyCitizens',
    nThreshold: TARGET_HAPPY_CITIZENS,
  },
  {
    sName: 'BreachShipsDestroyed',
    friendlyName: 'Ship Breaker',
    description: `Destroy ${TARGET_BREACH_SHIPS} breach ships`,
    checkType: 'breachShipsDestroyed',
    nThreshold: TARGET_BREACH_SHIPS,
  },
  {
    sName: 'AllPossessions',
    friendlyName: 'Collector',
    description: 'Collect all displayable possessions',
    checkType: 'allPossessions',
    nThreshold: 1,
  },
  {
    sName: 'RaidersConverted',
    friendlyName: 'Diplomat',
    description: `Convert ${TARGET_RAIDERS_CONVERTED} raiders`,
    checkType: 'raidersConverted',
    nThreshold: TARGET_RAIDERS_CONVERTED,
  },
  {
    sName: 'HostilesAsphyxiated',
    friendlyName: 'Airlock Justice',
    description: `Asphyxiate ${TARGET_HOSTILES_ASPHYXIATED} hostiles`,
    checkType: 'hostilesAsphyxiated',
    nThreshold: TARGET_HOSTILES_ASPHYXIATED,
  },
  {
    sName: 'HostilesKilledByTurrets',
    friendlyName: 'Automated Defense',
    description: `Kill ${TARGET_HOSTILE_TURRET_KILLS} hostiles with turrets`,
    checkType: 'hostilesKilledByTurrets',
    nThreshold: TARGET_HOSTILE_TURRET_KILLS,
  },
  {
    sName: 'BodiesRefined',
    friendlyName: 'Recycler',
    description: `Recycle ${TARGET_BODIES} corpses`,
    checkType: 'bodiesRefined',
    nThreshold: TARGET_BODIES,
  },
  {
    sName: 'FinalSiege',
    friendlyName: 'Last Stand',
    description: 'Survive the final siege',
    checkType: 'finalSiege',
    nThreshold: 1,
  },
];
