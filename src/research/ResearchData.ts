/**
 * ResearchData.ts — Full tech tree.
 * Mirrors ResearchData.lua exactly. Uses RESRCH/PROPSX linecodes where Lua specifies sName/sDesc.
 */

import { line } from '../localization/Localization';

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
    get friendlyName() { return line('RESRCH019TEXT'); },
    get description() { return line('RESRCH020TEXT'); },
    nCost: 1200,
    prerequisites: [],
    unlocks: ['SpaceSuit2'],
  },

  // ── Builder upgrades ────────────────────────────────────────
  VaporizeLevel2: {
    sName: 'VaporizeLevel2',
    get friendlyName() { return line('RESRCH001TEXT'); },
    get description() { return line('RESRCH002TEXT'); },
    nCost: 1200,
    prerequisites: [],
    unlocks: [],
  },
  BuildLevel2: {
    sName: 'BuildLevel2',
    get friendlyName() { return line('RESRCH011TEXT'); },
    get description() { return line('RESRCH012TEXT'); },
    nCost: 1000,
    prerequisites: [],
    unlocks: [],
  },

  // ── Maintenance ─────────────────────────────────────────────
  MaintenanceLevel2: {
    sName: 'MaintenanceLevel2',
    get friendlyName() { return line('RESRCH009TEXT'); },
    get description() { return line('RESRCH010TEXT'); },
    nCost: 1200,
    prerequisites: ['MaintenanceLevel2Discovered'],
    unlocks: [],
    nConditionMultiplier: 1.5,
  },

  // ── Botanist ────────────────────────────────────────────────
  PlantLevel2: {
    sName: 'PlantLevel2',
    get friendlyName() { return line('RESRCH013TEXT'); },
    get description() { return line('RESRCH014TEXT'); },
    nCost: 1000,
    prerequisites: [],
    unlocks: [],
    nConditionMultiplier: 2,
  },

  // ── Combat ──────────────────────────────────────────────────
  LaserRifles: {
    sName: 'LaserRifles',
    get friendlyName() { return line('RESRCH003TEXT'); },
    get description() { return line('RESRCH004TEXT'); },
    nCost: 1100,
    prerequisites: [],
    unlocks: ['LaserRifles'],
  },
  ArmorLevel2: {
    sName: 'ArmorLevel2',
    get friendlyName() { return line('RESRCH005TEXT'); },
    get description() { return line('RESRCH006TEXT'); },
    nCost: 900,
    prerequisites: [],
    unlocks: ['ArmorLevel2'],
  },
  TeamTactics: {
    sName: 'TeamTactics',
    get friendlyName() { return line('RESRCH017TEXT'); },
    get description() { return line('RESRCH018TEXT'); },
    nCost: 2400,
    prerequisites: ['TeamTacticsDiscovered'],
    unlocks: [],
  },

  // ── O2 Recycler upgrades ───────────────────────────────────
  OxygenRecyclerLevel2: {
    sName: 'OxygenRecyclerLevel2',
    get friendlyName() { return line('PROPSX062TEXT'); },
    get description() { return line('PROPSX063TEXT'); },
    nCost: 1000,
    prerequisites: ['AirScrubber'],
    unlocks: ['OxygenRecyclerLevel2'],
  },
  OxygenRecyclerLevel3: {
    sName: 'OxygenRecyclerLevel3',
    get friendlyName() { return line('RECYCLE001TEXT'); },
    get description() { return line('RECYCLE002TEXT'); },
    nCost: 2000,
    prerequisites: ['OxygenRecyclerLevel2'],
    unlocks: ['OxygenRecyclerLevel3'],
  },
  OxygenRecyclerLevel4: {
    sName: 'OxygenRecyclerLevel4',
    get friendlyName() { return line('RECYCLE004TEXT'); },
    get description() { return line('RECYCLE005TEXT'); },
    nCost: 4000,
    prerequisites: ['OxygenRecyclerLevel3'],
    unlocks: ['OxygenRecyclerLevel4'],
  },

  // ── Generator upgrades ─────────────────────────────────────
  GeneratorLevel2: {
    sName: 'GeneratorLevel2',
    get friendlyName() { return line('PROPSX096TEXT'); },
    get description() { return line('PROPSX097TEXT'); },
    nCost: 1000,
    prerequisites: [],
    unlocks: ['GeneratorLevel2'],
  },
  GeneratorLevel3: {
    sName: 'GeneratorLevel3',
    get friendlyName() { return line('PROPSX100TEXT'); },
    get description() { return line('PROPSX101TEXT'); },
    nCost: 1500,
    prerequisites: ['GeneratorLevel2'],
    unlocks: ['GeneratorLevel3'],
  },
  GeneratorLevel4: {
    sName: 'GeneratorLevel4',
    get friendlyName() { return line('PROPSX102TEXT'); },
    get description() { return line('PROPSX103TEXT'); },
    nCost: 2000,
    prerequisites: ['GeneratorLevel3'],
    unlocks: ['GeneratorLevel4'],
  },

  // ── Air Scrubber ───────────────────────────────────────────
  AirScrubber: {
    sName: 'AirScrubber',
    get friendlyName() { return line('PROPSX078TEXT'); },
    get description() { return line('PROPSX079TEXT'); },
    nCost: 500,
    prerequisites: [],
    unlocks: ['AirScrubber'],
  },

  // ── HappyBot ──────────────────────────────────────────────
  HappyBot: {
    sName: 'HappyBot',
    get friendlyName() { return line('PROPSX104TEXT'); },
    get description() { return line('PROPSX105TEXT'); },
    nCost: 2000,
    prerequisites: ['AirScrubber'],
    unlocks: ['HappyBot'],
  },

  // ── Door upgrades ──────────────────────────────────────────
  DoorLevel2: {
    sName: 'DoorLevel2',
    get friendlyName() { return line('PROPSX064TEXT'); },
    get description() { return line('PROPSX065TEXT'); },
    nCost: 900,
    prerequisites: [],
    unlocks: ['HeavyDoor'],
  },

  // ── Food upgrades ─────────────────────────────────────────
  FridgeLevel2: {
    sName: 'FridgeLevel2',
    get friendlyName() { return line('PROPSX069TEXT'); },
    get description() { return line('PROPSX068TEXT'); },
    nCost: 900,
    prerequisites: ['FridgeLevel2Discovered'],
    unlocks: ['FridgeLevel2'],
  },

  // ── Refinery upgrades ─────────────────────────────────────
  RefineryDropoffLevel2: {
    sName: 'RefineryDropoffLevel2',
    get friendlyName() { return line('PROPSX066TEXT'); },
    get description() { return line('PROPSX067TEXT'); },
    nCost: 1200,
    prerequisites: [],
    unlocks: ['RefineryDropoffLevel2'],
  },

  // ── Turret upgrades ───────────────────────────────────────
  WallMountedTurret2: {
    sName: 'WallMountedTurret2',
    get friendlyName() { return line('PROPSX080TEXT'); },
    get description() { return line('PROPSX081TEXT'); },
    nCost: 2000,
    prerequisites: ['WallMountedTurretLevel2Discovered'],
    unlocks: ['WallMountedTurret2'],
  },

  // ── Discovery blueprints (bDiscoverOnly) ──────────────────
  // These gate other research. Discovered via datacubes/derelicts.
  FridgeLevel2Discovered: {
    sName: 'FridgeLevel2Discovered',
    get friendlyName() { return line('PROPSX069TEXT'); },
    get description() { return line('PROPSX068TEXT'); },
    nCost: 1,
    prerequisites: [],
    unlocks: [],
    bDiscoverOnly: true,
  },
  TeamTacticsDiscovered: {
    sName: 'TeamTacticsDiscovered',
    get friendlyName() { return line('RESRCH017TEXT'); },
    get description() { return line('RESRCH018TEXT'); },
    nCost: 1,
    prerequisites: [],
    unlocks: [],
    bDiscoverOnly: true,
  },
  MaintenanceLevel2Discovered: {
    sName: 'MaintenanceLevel2Discovered',
    get friendlyName() { return line('RESRCH009TEXT'); },
    get description() { return line('RESRCH010TEXT'); },
    nCost: 1,
    prerequisites: [],
    unlocks: [],
    bDiscoverOnly: true,
  },
  WallMountedTurretLevel2Discovered: {
    sName: 'WallMountedTurretLevel2Discovered',
    get friendlyName() { return line('PROPSX080TEXT'); },
    get description() { return line('PROPSX081TEXT'); },
    nCost: 1,
    prerequisites: [],
    unlocks: [],
    bDiscoverOnly: true,
  },
};
