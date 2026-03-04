/**
 * GoalData.ts — Goal/achievement definitions.
 * Mirrors GoalData.lua: 16 goals matching original Spacebase DF-9 exactly.
 */

export interface GoalDef {
  sName: string;
  friendlyName: string;
  description: string;
  /** Check type key — matched in GoalSystem.checkGoal(). */
  checkType: string;
  /** Target threshold (used by most check types). */
  nThreshold: number;
}

export const GOAL_DEFS: GoalDef[] = [
  // ── Population / Resources ──────────────────────────────────────────
  {
    sName: 'Citizens',
    friendlyName: 'Population Boom',
    description: 'Have 50 citizens living in your base',
    checkType: 'population',
    nThreshold: 50,
  },
  {
    sName: 'Matter',
    friendlyName: 'Loaded',
    description: 'Accumulate 50,000 matter',
    checkType: 'matter',
    nThreshold: 50000,
  },
  // ── Building ────────────────────────────────────────────────────────
  {
    sName: 'BuiltEverything',
    friendlyName: 'One of Everything',
    description: 'Build at least one of every object type',
    checkType: 'builtEverything',
    nThreshold: 0, // dynamic — all showInObjectMenu types
  },
  // ── Combat ──────────────────────────────────────────────────────────
  {
    sName: 'HostilesKilled',
    friendlyName: 'Exterminator',
    description: 'Kill 50 hostile raiders',
    checkType: 'stat:nHostilesKilled',
    nThreshold: 50,
  },
  // ── Territory ───────────────────────────────────────────────────────
  {
    sName: 'BaseTiles',
    friendlyName: 'Growing Fast',
    description: 'Have 3,000 base tiles',
    checkType: 'baseTiles',
    nThreshold: 3000,
  },
  // ── Food ────────────────────────────────────────────────────────────
  {
    sName: 'MealsServed',
    friendlyName: 'Five-Star Chef',
    description: 'Serve 1,000 meals',
    checkType: 'stat:nMealsServed',
    nThreshold: 1000,
  },
  // ── Research ────────────────────────────────────────────────────────
  {
    sName: 'CuresResearched',
    friendlyName: 'Doctor Doctor',
    description: 'Research 10 disease cures',
    checkType: 'stat:nCuresResearched',
    nThreshold: 10,
  },
  {
    sName: 'AllTechs',
    friendlyName: 'Master of Science',
    description: 'Research all technologies',
    checkType: 'allTechs',
    nThreshold: 0, // dynamic — all non-bDiscoverOnly techs
  },
  // ── Morale ──────────────────────────────────────────────────────────
  {
    sName: 'HappyCitizens',
    friendlyName: 'Happy Station',
    description: 'Have 30 citizens with morale above 90',
    checkType: 'happyCitizens',
    nThreshold: 30,
  },
  // ── Events ──────────────────────────────────────────────────────────
  {
    sName: 'BreachShipsDestroyed',
    friendlyName: 'Repel Boarders',
    description: 'Destroy 5 breach ships',
    checkType: 'stat:nBreachShipsDestroyed',
    nThreshold: 5,
  },
  // ── Inventory ───────────────────────────────────────────────────────
  {
    sName: 'AllPossessions',
    friendlyName: 'Hoarder',
    description: 'Collect all displayable item types',
    checkType: 'allPossessions',
    nThreshold: 0, // dynamic — all bStuff+bDisplayable items
  },
  // ── Factions ────────────────────────────────────────────────────────
  {
    sName: 'RaidersConverted',
    friendlyName: 'Turn the Other Cheek',
    description: 'Convert 10 raiders to your cause',
    checkType: 'stat:nRaidersConverted',
    nThreshold: 10,
  },
  // ── Combat (continued) ──────────────────────────────────────────────
  {
    sName: 'HostilesAsphyxiated',
    friendlyName: 'Space is a Harsh Mistress',
    description: 'Asphyxiate 10 hostiles',
    checkType: 'stat:nHostilesAsphyxiated',
    nThreshold: 10,
  },
  {
    sName: 'HostilesKilledByTurrets',
    friendlyName: 'Automated Defense',
    description: 'Kill 20 hostiles with turrets',
    checkType: 'stat:nHostilesKilledByTurret',
    nThreshold: 20,
  },
  // ── Recycling ───────────────────────────────────────────────────────
  {
    sName: 'BodiesRefined',
    friendlyName: 'Recycler',
    description: 'Recycle 100 corpses into matter',
    checkType: 'stat:nCorpsesRecycled',
    nThreshold: 100,
  },
  // ── Final Goal ──────────────────────────────────────────────────────
  {
    sName: 'FinalSiege',
    friendlyName: 'Victory!',
    description: 'Survive the final siege: endure the compound event and eliminate all hostiles',
    checkType: 'finalSiege',
    nThreshold: 0,
  },
];
