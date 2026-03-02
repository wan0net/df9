/**
 * ResearchData.ts — Full tech tree.
 * Mirrors ResearchData.lua.
 */

export interface ResearchDef {
  sName: string;
  friendlyName: string;
  description: string;
  /** Research points required. */
  nCost: number;
  /** Prerequisites (research IDs). */
  prerequisites: string[];
  /** What this research unlocks. */
  unlocks: string[];
}

export const RESEARCH_DEFS: Record<string, ResearchDef> = {
  // ── Generator upgrades ─────────────────────────────────────
  GeneratorLevel2: {
    sName: 'GeneratorLevel2',
    friendlyName: 'Generator Mk II',
    description: 'More efficient power generation',
    nCost: 500,
    prerequisites: [],
    unlocks: ['GeneratorLevel2'],
  },
  GeneratorLevel3: {
    sName: 'GeneratorLevel3',
    friendlyName: 'Generator Mk III',
    description: 'Advanced power generation',
    nCost: 1500,
    prerequisites: ['GeneratorLevel2'],
    unlocks: ['GeneratorLevel3'],
  },
  GeneratorLevel4: {
    sName: 'GeneratorLevel4',
    friendlyName: 'Generator Mk IV',
    description: 'Maximum power generation',
    nCost: 4000,
    prerequisites: ['GeneratorLevel3'],
    unlocks: ['GeneratorLevel4'],
  },

  // ── O2 Recycler upgrades ───────────────────────────────────
  OxygenRecyclerLevel2: {
    sName: 'OxygenRecyclerLevel2',
    friendlyName: 'O2 Recycler Mk II',
    description: 'Improved oxygen recycling',
    nCost: 400,
    prerequisites: [],
    unlocks: ['OxygenRecyclerLevel2'],
  },
  OxygenRecyclerLevel3: {
    sName: 'OxygenRecyclerLevel3',
    friendlyName: 'O2 Recycler Mk III',
    description: 'Advanced oxygen recycling',
    nCost: 1000,
    prerequisites: ['OxygenRecyclerLevel2'],
    unlocks: ['OxygenRecyclerLevel3'],
  },
  OxygenRecyclerLevel4: {
    sName: 'OxygenRecyclerLevel4',
    friendlyName: 'O2 Recycler Mk IV',
    description: 'Maximum oxygen recycling',
    nCost: 3000,
    prerequisites: ['OxygenRecyclerLevel3'],
    unlocks: ['OxygenRecyclerLevel4'],
  },

  // ── Door upgrades ──────────────────────────────────────────
  DoorLevel2: {
    sName: 'DoorLevel2',
    friendlyName: 'Heavy Door',
    description: 'Reinforced blast door',
    nCost: 300,
    prerequisites: [],
    unlocks: ['HeavyDoor'],
  },

  // ── Turret upgrades ────────────────────────────────────────
  TurretLevel2: {
    sName: 'TurretLevel2',
    friendlyName: 'Turret Mk II',
    description: 'Upgraded turret systems',
    nCost: 800,
    prerequisites: [],
    unlocks: ['WallMountedTurret2'],
  },

  // ── Food upgrades ──────────────────────────────────────────
  FridgeLevel2: {
    sName: 'FridgeLevel2',
    friendlyName: 'Food Replicator Mk II',
    description: 'Better food variety',
    nCost: 600,
    prerequisites: [],
    unlocks: ['FridgeLvl2'],
  },

  // ── Refinery upgrades ──────────────────────────────────────
  RefineryLevel2: {
    sName: 'RefineryLevel2',
    friendlyName: 'Refinery Mk II',
    description: 'Improved matter extraction',
    nCost: 1000,
    prerequisites: [],
    unlocks: ['refinery_level2'],
  },

  // ── Maintenance ────────────────────────────────────────────
  MaintenanceLevel2: {
    sName: 'MaintenanceLevel2',
    friendlyName: 'Improved Maintenance',
    description: 'Technicians repair more per visit',
    nCost: 400,
    prerequisites: [],
    unlocks: [],
  },
};
