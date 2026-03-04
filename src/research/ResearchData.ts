/**
 * ResearchData.ts — Full tech tree.
 * Mirrors ResearchData.lua exactly.
 */

export interface ResearchDef {
  sName: string;
  friendlyName: string;
  description: string;
  /** Research points required (nResearchUnits in Lua). */
  nCost: number;
  /** Prerequisites (research IDs that must be completed first). */
  prerequisites: string[];
  /** What this research unlocks (env object keys, etc.). */
  unlocks: string[];
  /** If true, this is a "discovery" blueprint — gates other research but does not
   *  itself unlock buildable items. Discovered via datacubes/derelicts. */
  bDiscoverOnly?: boolean;
  /** Condition multiplier for maintenance/plant upgrades. */
  nConditionMultiplier?: number;
}

export const RESEARCH_DEFS: Record<string, ResearchDef> = {
  // ── Spacesuit ───────────────────────────────────────────────
  SpaceSuit2: {
    sName: 'SpaceSuit2',
    friendlyName: 'Spacesuit Mk II',
    description: 'Improved spacesuit with better oxygen reserves.',
    nCost: 1200,
    prerequisites: [],
    unlocks: ['SpaceSuit2'],
  },

  // ── Builder upgrades ────────────────────────────────────────
  VaporizeLevel2: {
    sName: 'VaporizeLevel2',
    friendlyName: 'Vaporize Mk II',
    description: 'Faster vaporization of unwanted structures.',
    nCost: 1200,
    prerequisites: [],
    unlocks: [],
  },
  BuildLevel2: {
    sName: 'BuildLevel2',
    friendlyName: 'Build Mk II',
    description: 'Builders construct faster.',
    nCost: 1000,
    prerequisites: [],
    unlocks: [],
  },

  // ── Maintenance ─────────────────────────────────────────────
  MaintenanceLevel2: {
    sName: 'MaintenanceLevel2',
    friendlyName: 'Improved Maintenance',
    description: 'Technicians repair more per visit.',
    nCost: 1200,
    prerequisites: ['MaintenanceLevel2Discovered'],
    unlocks: [],
    nConditionMultiplier: 1.5,
  },

  // ── Botanist ────────────────────────────────────────────────
  PlantLevel2: {
    sName: 'PlantLevel2',
    friendlyName: 'Botany Mk II',
    description: 'Plants grow stronger and live longer.',
    nCost: 1000,
    prerequisites: [],
    unlocks: [],
    nConditionMultiplier: 2,
  },

  // ── Combat ──────────────────────────────────────────────────
  LaserRifles: {
    sName: 'LaserRifles',
    friendlyName: 'Laser Rifles',
    description: 'Equip security with ranged laser weapons.',
    nCost: 1100,
    prerequisites: [],
    unlocks: ['LaserRifles'],
  },
  ArmorLevel2: {
    sName: 'ArmorLevel2',
    friendlyName: 'Armor Mk II',
    description: 'Better armor for security personnel.',
    nCost: 900,
    prerequisites: [],
    unlocks: ['ArmorLevel2'],
  },
  TeamTactics: {
    sName: 'TeamTactics',
    friendlyName: 'Team Tactics',
    description: 'Security squads fight more effectively together.',
    nCost: 2400,
    prerequisites: ['TeamTacticsDiscovered'],
    unlocks: [],
  },

  // ── O2 Recycler upgrades ───────────────────────────────────
  OxygenRecyclerLevel2: {
    sName: 'OxygenRecyclerLevel2',
    friendlyName: 'O2 Recycler Mk II',
    description: 'Improved oxygen recycling.',
    nCost: 1000,
    prerequisites: ['AirScrubber'],
    unlocks: ['OxygenRecyclerLevel2'],
  },
  OxygenRecyclerLevel3: {
    sName: 'OxygenRecyclerLevel3',
    friendlyName: 'O2 Recycler Mk III',
    description: 'Advanced oxygen recycling.',
    nCost: 2000,
    prerequisites: ['OxygenRecyclerLevel2'],
    unlocks: ['OxygenRecyclerLevel3'],
  },
  OxygenRecyclerLevel4: {
    sName: 'OxygenRecyclerLevel4',
    friendlyName: 'O2 Recycler Mk IV',
    description: 'Maximum oxygen recycling.',
    nCost: 4000,
    prerequisites: ['OxygenRecyclerLevel3'],
    unlocks: ['OxygenRecyclerLevel4'],
  },

  // ── Generator upgrades ─────────────────────────────────────
  GeneratorLevel2: {
    sName: 'GeneratorLevel2',
    friendlyName: 'Generator Mk II',
    description: 'More efficient power generation.',
    nCost: 1000,
    prerequisites: [],
    unlocks: ['GeneratorLevel2'],
  },
  GeneratorLevel3: {
    sName: 'GeneratorLevel3',
    friendlyName: 'Generator Mk III',
    description: 'Advanced power generation.',
    nCost: 1500,
    prerequisites: ['GeneratorLevel2'],
    unlocks: ['GeneratorLevel3'],
  },
  GeneratorLevel4: {
    sName: 'GeneratorLevel4',
    friendlyName: 'Generator Mk IV',
    description: 'Maximum power generation.',
    nCost: 2000,
    prerequisites: ['GeneratorLevel3'],
    unlocks: ['GeneratorLevel4'],
  },

  // ── Air Scrubber ───────────────────────────────────────────
  AirScrubber: {
    sName: 'AirScrubber',
    friendlyName: 'Air Scrubber',
    description: 'Compact air filtration unit.',
    nCost: 500,
    prerequisites: [],
    unlocks: ['AirScrubber'],
  },

  // ── HappyBot ──────────────────────────────────────────────
  HappyBot: {
    sName: 'HappyBot',
    friendlyName: 'HappyBot',
    description: 'Morale-boosting robot assistant.',
    nCost: 2000,
    prerequisites: ['AirScrubber'],
    unlocks: ['HappyBot'],
  },

  // ── Door upgrades ──────────────────────────────────────────
  DoorLevel2: {
    sName: 'DoorLevel2',
    friendlyName: 'Heavy Door',
    description: 'Reinforced blast door.',
    nCost: 900,
    prerequisites: [],
    unlocks: ['HeavyDoor'],
  },

  // ── Food upgrades ─────────────────────────────────────────
  FridgeLevel2: {
    sName: 'FridgeLevel2',
    friendlyName: 'Food Replicator Mk II',
    description: 'Better food variety and capacity.',
    nCost: 900,
    prerequisites: ['FridgeLevel2Discovered'],
    unlocks: ['FridgeLevel2'],
  },

  // ── Refinery upgrades ─────────────────────────────────────
  RefineryDropoffLevel2: {
    sName: 'RefineryDropoffLevel2',
    friendlyName: 'Refinery Mk II',
    description: 'Improved matter extraction.',
    nCost: 1200,
    prerequisites: [],
    unlocks: ['RefineryDropoffLevel2'],
  },

  // ── Turret upgrades ───────────────────────────────────────
  WallMountedTurret2: {
    sName: 'WallMountedTurret2',
    friendlyName: 'Turret Mk II',
    description: 'Upgraded turret systems.',
    nCost: 2000,
    prerequisites: ['WallMountedTurretLevel2Discovered'],
    unlocks: ['WallMountedTurret2'],
  },

  // ── Discovery blueprints (bDiscoverOnly) ──────────────────
  // These gate other research. Discovered via datacubes/derelicts.
  FridgeLevel2Discovered: {
    sName: 'FridgeLevel2Discovered',
    friendlyName: 'Replicator Mk II Blueprint',
    description: 'A schematic for an improved food replicator.',
    nCost: 1,
    prerequisites: [],
    unlocks: [],
    bDiscoverOnly: true,
  },
  TeamTacticsDiscovered: {
    sName: 'TeamTacticsDiscovered',
    friendlyName: 'Team Tactics Blueprint',
    description: 'Tactical training documentation.',
    nCost: 1,
    prerequisites: [],
    unlocks: [],
    bDiscoverOnly: true,
  },
  MaintenanceLevel2Discovered: {
    sName: 'MaintenanceLevel2Discovered',
    friendlyName: 'Maintenance Mk II Blueprint',
    description: 'Advanced repair techniques documentation.',
    nCost: 1,
    prerequisites: [],
    unlocks: [],
    bDiscoverOnly: true,
  },
  WallMountedTurretLevel2Discovered: {
    sName: 'WallMountedTurretLevel2Discovered',
    friendlyName: 'Turret Mk II Blueprint',
    description: 'Upgraded turret schematics.',
    nCost: 1,
    prerequisites: [],
    unlocks: [],
    bDiscoverOnly: true,
  },
};
