/**
 * EnvObjectData.ts — Static definitions for all placeable objects.
 * Mirrors EnvObjects/EnvObjectData.lua: complete tObjects and tMenus tables.
 */

import { ZoneType } from '../world/ZoneType';

export interface EnvObjectDef {
  spriteName: string;
  friendlyName: string;
  description: string;
  matterCost: number;
  width: number;
  height: number;
  margin: number;
  nPowerDraw: number;
  nPowerOutput: number;
  oxygenLevel: number;
  decayPerSecond: number;
  zoneName: ZoneType | null;
  additionalZones: ZoneType[];
  againstWall: boolean;
  bBlocksPathing: boolean;
  bBlocksOxygen: boolean;
  door: boolean;
  bCanDeactivate: boolean;
  nMoraleScore: number;
  explodeOnFailure: boolean;
  customClass: string | null;
  researchPrereq: string | null;
  noRoom: boolean;
  bCanBuildInSpace: boolean;
  sidebarIcon: string;
  nSabotageDuration: number;
  bInventory: boolean;
  showInObjectMenu: boolean;
}

function def(overrides: Partial<EnvObjectDef> & { spriteName: string; friendlyName: string; matterCost: number }): EnvObjectDef {
  return {
    description: '',
    width: 1,
    height: 1,
    margin: 0,
    nPowerDraw: 0,
    nPowerOutput: 0,
    oxygenLevel: 0,
    decayPerSecond: 0.01,
    zoneName: null,
    additionalZones: [],
    againstWall: false,
    bBlocksPathing: false,
    bBlocksOxygen: false,
    door: false,
    bCanDeactivate: false,
    nMoraleScore: 0,
    explodeOnFailure: false,
    customClass: null,
    researchPrereq: null,
    noRoom: false,
    bCanBuildInSpace: false,
    sidebarIcon: '',
    nSabotageDuration: 0,
    bInventory: false,
    showInObjectMenu: true,
    ...overrides,
  };
}

/** Complete object definitions matching EnvObjectData.lua tObjects */
export const tObjects: Record<string, EnvObjectDef> = {
  // ── Doors ─────────────────────────────────────────────────────
  Door: def({
    spriteName: 'door_closed', friendlyName: 'Door', matterCost: 25,
    againstWall: true, door: true, bBlocksOxygen: true,
    customClass: 'Door', noRoom: true, sidebarIcon: 'icon_door',
  }),
  HeavyDoor: def({
    spriteName: 'door_heavy_closed', friendlyName: 'Heavy Door', matterCost: 100,
    againstWall: true, door: true, bBlocksPathing: true, bBlocksOxygen: true,
    customClass: 'HeavyDoor', noRoom: true, researchPrereq: 'DoorLevel2',
    sidebarIcon: 'icon_heavydoor',
  }),
  Airlock: def({
    spriteName: 'airlock_door_closed', friendlyName: 'Airlock Door', matterCost: 75,
    width: 2, againstWall: true, door: true, bBlocksOxygen: true,
    customClass: 'Airlock', noRoom: true, sidebarIcon: 'icon_airlock_door',
  }),

  // ── Power Generation ──────────────────────────────────────────
  Generator: def({
    spriteName: 'ReactorGen', friendlyName: 'Generator', matterCost: 200,
    width: 2, height: 2, margin: 2, nPowerOutput: 1000,
    decayPerSecond: 0.03, explodeOnFailure: true, bCanDeactivate: true,
    bBlocksPathing: true, nSabotageDuration: 30,
    zoneName: ZoneType.POWER, sidebarIcon: 'icon_generator',
  }),
  GeneratorLevel2: def({
    spriteName: 'generator2', friendlyName: 'Generator Mk II', matterCost: 600,
    width: 2, height: 2, margin: 2, nPowerOutput: 2500,
    decayPerSecond: 0.04, explodeOnFailure: true, bCanDeactivate: true,
    bBlocksPathing: true, nSabotageDuration: 30,
    zoneName: ZoneType.POWER, researchPrereq: 'GeneratorLevel2',
    sidebarIcon: 'icon_generator',
  }),
  GeneratorLevel3: def({
    spriteName: 'ReactorGen3', friendlyName: 'Generator Mk III', matterCost: 2000,
    width: 3, height: 3, margin: 2, nPowerOutput: 5000,
    decayPerSecond: 0.04, explodeOnFailure: true, bCanDeactivate: true,
    bBlocksPathing: true, nSabotageDuration: 30,
    zoneName: ZoneType.POWER, researchPrereq: 'GeneratorLevel3',
    sidebarIcon: 'icon_generator',
  }),
  GeneratorLevel4: def({
    spriteName: 'ReactorGen4', friendlyName: 'Generator Mk IV', matterCost: 5000,
    width: 4, height: 4, margin: 2, nPowerOutput: 10000,
    decayPerSecond: 0.04, explodeOnFailure: true, bCanDeactivate: true,
    bBlocksPathing: true, nSabotageDuration: 30,
    zoneName: ZoneType.POWER, researchPrereq: 'GeneratorLevel4',
    sidebarIcon: 'icon_generator',
  }),

  // ── Life Support ──────────────────────────────────────────────
  OxygenRecycler: def({
    spriteName: 'O2Gen', friendlyName: 'Oxygen Recycler', matterCost: 150,
    margin: 1, oxygenLevel: 50, nPowerDraw: 25,
    decayPerSecond: 0.05, explodeOnFailure: true, bCanDeactivate: true,
    bBlocksPathing: true, zoneName: ZoneType.LIFESUPPORT,
    sidebarIcon: 'icon_oxygen_recycler',
  }),
  OxygenRecyclerLevel2: def({
    spriteName: 'oxygen_recycler_level2', friendlyName: 'O2 Recycler Mk II', matterCost: 300,
    width: 2, height: 2, margin: 1, oxygenLevel: 300, nPowerDraw: 30,
    decayPerSecond: 0.05, explodeOnFailure: true, bCanDeactivate: true,
    bBlocksPathing: true, zoneName: ZoneType.LIFESUPPORT,
    researchPrereq: 'OxygenRecyclerLevel2', sidebarIcon: 'icon_oxygen_recycler',
  }),
  OxygenRecyclerLevel3: def({
    spriteName: 'O2Gen3', friendlyName: 'O2 Recycler Mk III', matterCost: 600,
    width: 3, height: 3, margin: 1, oxygenLevel: 600, nPowerDraw: 35,
    decayPerSecond: 0.06, explodeOnFailure: true, bCanDeactivate: true,
    bBlocksPathing: true, zoneName: ZoneType.LIFESUPPORT,
    researchPrereq: 'OxygenRecyclerLevel3', sidebarIcon: 'icon_oxygen_recycler',
  }),
  OxygenRecyclerLevel4: def({
    spriteName: 'O2Gen4', friendlyName: 'O2 Recycler Mk IV', matterCost: 1200,
    width: 4, height: 4, margin: 1, oxygenLevel: 900, nPowerDraw: 35,
    decayPerSecond: 0.06, explodeOnFailure: true, bCanDeactivate: true,
    bBlocksPathing: true, zoneName: ZoneType.LIFESUPPORT,
    researchPrereq: 'OxygenRecyclerLevel4', sidebarIcon: 'icon_oxygen_recycler',
  }),
  AirScrubber: def({
    spriteName: 'AirScrubber', friendlyName: 'Air Scrubber', matterCost: 300,
    margin: 1, nPowerDraw: 30,
    decayPerSecond: 0.04, explodeOnFailure: true, bCanDeactivate: true,
    bBlocksPathing: true, zoneName: ZoneType.LIFESUPPORT,
    researchPrereq: 'AirScrubber', sidebarIcon: 'icon_airscrubber',
  }),

  // ── Plants ────────────────────────────────────────────────────
  BulbousPlant: def({
    spriteName: 'BulbousPlant', friendlyName: 'Bulbous Plant', matterCost: 150,
    oxygenLevel: 7, nMoraleScore: 3, noRoom: true, sidebarIcon: 'icon_plant',
  }),
  StrangePlant: def({
    spriteName: 'strange_plant', friendlyName: 'Strange Plant', matterCost: 250,
    oxygenLevel: 10, nMoraleScore: 5, noRoom: true, sidebarIcon: 'icon_plant',
  }),
  space_tree: def({
    spriteName: 'space_tree', friendlyName: 'Space Tree', matterCost: 250,
    width: 2, height: 2, margin: 1, oxygenLevel: 10, nMoraleScore: 10,
    bBlocksPathing: true, decayPerSecond: 0.1, zoneName: ZoneType.GARDEN,
    sidebarIcon: 'icon_plant',
  }),
  HydroPlant: def({
    spriteName: 'HydroPlant', friendlyName: 'Hydroponic Plant', matterCost: 150,
    oxygenLevel: 10, nMoraleScore: 4, bBlocksPathing: true,
    decayPerSecond: 0, zoneName: ZoneType.GARDEN,
    customClass: 'HydroPlant', sidebarIcon: 'icon_plant_tray',
  }),
  HousePoint: def({
    spriteName: 'HousePoint', friendlyName: 'House Plant', matterCost: 150,
    oxygenLevel: 5, nMoraleScore: 3, noRoom: true, sidebarIcon: 'icon_plant',
  }),

  // ── Residence ─────────────────────────────────────────────────
  Bed: def({
    spriteName: 'Bed', friendlyName: 'Bed', matterCost: 150,
    width: 2, margin: 1, bBlocksPathing: true,
    customClass: 'Bed', zoneName: ZoneType.RESIDENCE,
    additionalZones: [ZoneType.BRIG], sidebarIcon: 'icon_bed',
  }),
  Dresser: def({
    spriteName: 'Dresser', friendlyName: 'Dresser', matterCost: 125,
    noRoom: true, bInventory: true, nMoraleScore: 1,
    zoneName: ZoneType.RESIDENCE, sidebarIcon: 'icon_dresser',
  }),
  WallShelf: def({
    spriteName: 'WallShelf', friendlyName: 'Wall Shelf', matterCost: 20,
    againstWall: true, noRoom: true, bInventory: true,
    zoneName: ZoneType.RESIDENCE, sidebarIcon: 'icon_shelf',
  }),
  Rug1: def({
    spriteName: 'Rug1', friendlyName: 'Rug', matterCost: 20,
    noRoom: true, nMoraleScore: 1,
    zoneName: ZoneType.RESIDENCE, sidebarIcon: 'icon_rug',
  }),

  // ── Pub ───────────────────────────────────────────────────────
  Bar: def({
    spriteName: 'Bar', friendlyName: 'Bar', matterCost: 250,
    width: 2, margin: 1, bBlocksPathing: true, decayPerSecond: 0.005,
    customClass: 'Bar', zoneName: ZoneType.PUB, sidebarIcon: 'icon_bar',
  }),
  Fridge: def({
    spriteName: 'Fridge', friendlyName: 'Food Replicator', matterCost: 250,
    againstWall: true, bBlocksPathing: true, bInventory: true,
    nPowerDraw: 35, decayPerSecond: 0.002, bCanDeactivate: true,
    customClass: 'Fridge', zoneName: ZoneType.PUB, sidebarIcon: 'icon_fridge',
  }),
  FridgeLvl2: def({
    spriteName: 'fridge_level2', friendlyName: 'Food Replicator Mk II', matterCost: 250,
    againstWall: true, bBlocksPathing: true, bInventory: true,
    nPowerDraw: 50, bCanDeactivate: true,
    customClass: 'Fridge', zoneName: ZoneType.PUB,
    researchPrereq: 'FridgeLevel2', sidebarIcon: 'icon_fridge',
  }),
  Stove: def({
    spriteName: 'Stove', friendlyName: 'Stove', matterCost: 250,
    bBlocksPathing: true, nPowerDraw: 30, decayPerSecond: 0.005,
    bCanDeactivate: true, zoneName: ZoneType.PUB, sidebarIcon: 'icon_stove',
  }),
  StandingTable: def({
    spriteName: 'StandingTable', friendlyName: 'Standing Table', matterCost: 100,
    margin: 1, bBlocksPathing: true, bInventory: true,
    customClass: 'PubTable', zoneName: ZoneType.PUB, sidebarIcon: 'icon_standingtable',
  }),
  Jukebox: def({
    spriteName: 'Jukebox', friendlyName: 'Jukebox', matterCost: 300,
    againstWall: true, bBlocksPathing: true, decayPerSecond: 0.002,
    explodeOnFailure: true, nPowerDraw: 25, bCanDeactivate: true,
    nMoraleScore: 5, customClass: 'Jukebox', zoneName: ZoneType.PUB,
    sidebarIcon: 'icon_jukebox',
  }),
  BurgerSign: def({
    spriteName: 'BurgerSign', friendlyName: 'Burger Sign', matterCost: 225,
    againstWall: true, nMoraleScore: 2, nPowerDraw: 5,
    zoneName: ZoneType.PUB, sidebarIcon: 'icon_wall_neon_burger',
  }),
  PizzaSign: def({
    spriteName: 'PizzaSign', friendlyName: 'Pizza Sign', matterCost: 150,
    againstWall: true, nMoraleScore: 2, nPowerDraw: 5,
    zoneName: ZoneType.PUB, sidebarIcon: 'icon_wall_neon_pizza',
  }),
  FriesSign: def({
    spriteName: 'FriesSign', friendlyName: 'Fries Sign', matterCost: 75,
    againstWall: true, nMoraleScore: 2, nPowerDraw: 5,
    zoneName: ZoneType.PUB, sidebarIcon: 'icon_wall_neon_fries',
  }),

  // ── Refinery ──────────────────────────────────────────────────
  refinery: def({
    spriteName: 'Refinery', friendlyName: 'Refinery', matterCost: 200,
    width: 2, height: 2, margin: 1, nPowerDraw: 40,
    decayPerSecond: 0.005, explodeOnFailure: true, bCanDeactivate: true,
    bBlocksPathing: true, customClass: 'RefineryDropoff',
    zoneName: ZoneType.REFINERY, sidebarIcon: 'icon_refinery',
  }),
  refinery_level2: def({
    spriteName: 'Refinery', friendlyName: 'Refinery Mk II', matterCost: 400,
    width: 2, height: 2, margin: 1, nPowerDraw: 50,
    decayPerSecond: 0.005, explodeOnFailure: true, bCanDeactivate: true,
    bBlocksPathing: true, customClass: 'RefineryDropoff',
    zoneName: ZoneType.REFINERY, researchPrereq: 'RefineryDropoffLevel2',
    sidebarIcon: 'icon_refinery',
  }),

  // ── Fitness ───────────────────────────────────────────────────
  WeightBench: def({
    spriteName: 'WeightBench', friendlyName: 'Weight Bench', matterCost: 100,
    width: 2, margin: 1, bBlocksPathing: true,
    customClass: 'WeightBench', zoneName: ZoneType.FITNESS,
    additionalZones: [ZoneType.BRIG], sidebarIcon: 'icon_weightbench',
  }),

  // ── Research ──────────────────────────────────────────────────
  ResearchDesk: def({
    spriteName: 'ResearchDesk', friendlyName: 'Research Desk', matterCost: 300,
    width: 2, margin: 1, bBlocksPathing: true,
    decayPerSecond: 0.005, explodeOnFailure: true,
    nPowerDraw: 50, bCanDeactivate: true,
    customClass: 'ResearchDesk', zoneName: ZoneType.RESEARCH,
    sidebarIcon: 'icon_research_desk',
  }),

  // ── Infirmary ─────────────────────────────────────────────────
  HospitalBed: def({
    spriteName: 'HospitalBed', friendlyName: 'Hospital Bed', matterCost: 400,
    width: 2, margin: 1, bBlocksPathing: true,
    decayPerSecond: 0.005, nPowerDraw: 30, bCanDeactivate: true,
    customClass: 'HospitalBed', zoneName: ZoneType.INFIRMARY,
    sidebarIcon: 'icon_hospital_bed',
  }),

  // ── Airlock ───────────────────────────────────────────────────
  AirlockLocker: def({
    spriteName: 'AirlockLocker', friendlyName: 'Spacesuit Locker', matterCost: 25,
    againstWall: true, zoneName: ZoneType.AIRLOCK,
    customClass: 'AirlockLocker', sidebarIcon: 'icon_airlock_locker',
  }),

  // ── Utility (ALL zone) ───────────────────────────────────────
  FirePanel: def({
    spriteName: 'FirePanel', friendlyName: 'Fire Panel', matterCost: 50,
    againstWall: true, noRoom: true, sidebarIcon: 'icon_fire_panel',
  }),
  EmergencyAlarm: def({
    spriteName: 'EmergencyAlarm', friendlyName: 'Emergency Alarm', matterCost: 50,
    againstWall: true, noRoom: true,
    customClass: 'EmergencyAlarm', sidebarIcon: 'icon_alarm_panel',
  }),
  HappyBot: def({
    spriteName: 'happybot', friendlyName: 'Happy Bot', matterCost: 2000,
    margin: 1, nPowerDraw: 200, decayPerSecond: 0.1,
    explodeOnFailure: true, bCanDeactivate: true,
    nMoraleScore: 15, bBlocksPathing: true, noRoom: true,
    customClass: 'HappyBot', researchPrereq: 'HappyBot',
    sidebarIcon: 'icon_happybot',
  }),
  TVScreen1: def({
    spriteName: 'TVScreen1', friendlyName: 'TV Screen', matterCost: 75,
    againstWall: true, noRoom: true, nMoraleScore: 1,
    nPowerDraw: 10, bCanDeactivate: true, sidebarIcon: 'icon_tv_screen',
  }),
  FoodReplicator: def({
    spriteName: 'FoodReplicator', friendlyName: 'Food Replicator', matterCost: 150,
    againstWall: true, noRoom: true, nMoraleScore: 3,
    nPowerDraw: 25, bCanDeactivate: true, sidebarIcon: 'icon_replicator',
  }),

  // ── Combat ────────────────────────────────────────────────────
  WallMountedTurret: def({
    spriteName: 'Turret', friendlyName: 'Turret', matterCost: 300,
    margin: 1, againstWall: true, noRoom: true, bCanBuildInSpace: true,
    decayPerSecond: 0.01, explodeOnFailure: true,
    nPowerDraw: 150, bCanDeactivate: true,
    customClass: 'Turret', sidebarIcon: 'icon_turret_ext',
  }),
  WallMountedTurret2: def({
    spriteName: 'Turret', friendlyName: 'Turret Mk II', matterCost: 600,
    margin: 1, againstWall: true, noRoom: true, bCanBuildInSpace: true,
    explodeOnFailure: true, nPowerDraw: 200, bCanDeactivate: true,
    customClass: 'TurretLv2', researchPrereq: 'WallMountedTurret2',
    sidebarIcon: 'icon_turret_ext_lv2',
  }),

  // ── Special (not in build menus) ──────────────────────────────
  SpaceshipEngine: def({
    spriteName: 'SpaceshipEngine', friendlyName: 'Spaceship Engine', matterCost: 200,
    width: 2, height: 3, margin: 1, noRoom: true, bCanBuildInSpace: true,
    nPowerOutput: 250, nSabotageDuration: 30, showInObjectMenu: false,
  }),
  BaseSeed: def({
    spriteName: 'BaseSeed', friendlyName: 'Base Seed', matterCost: 500,
    width: 2, height: 3, noRoom: true, bCanBuildInSpace: true,
    bBlocksPathing: true, nPowerOutput: 500, nSabotageDuration: 30,
    nMoraleScore: 10, showInObjectMenu: false,
  }),
};

/** Zone build menus matching EnvObjectData.lua tMenus */
export const tMenus: Record<string, string[]> = {
  ALL: ['Door', 'Airlock', 'HeavyDoor', 'FirePanel', 'EmergencyAlarm', 'HappyBot', 'BulbousPlant', 'StrangePlant'],
  POWER: ['Generator', 'GeneratorLevel2', 'GeneratorLevel3', 'GeneratorLevel4'],
  LIFESUPPORT: ['AirScrubber', 'OxygenRecycler', 'OxygenRecyclerLevel2', 'OxygenRecyclerLevel3', 'OxygenRecyclerLevel4'],
  RESIDENCE: ['Bed', 'Dresser', 'WallShelf', 'Rug1'],
  GARDEN: ['space_tree', 'HydroPlant'],
  PUB: ['Bar', 'Fridge', 'FridgeLvl2', 'Stove', 'StandingTable', 'BurgerSign', 'PizzaSign', 'FriesSign', 'Jukebox'],
  AIRLOCK: ['AirlockLocker'],
  REFINERY: ['refinery', 'refinery_level2'],
  FITNESS: ['WeightBench'],
  INFIRMARY: ['HospitalBed'],
  RESEARCH: ['ResearchDesk'],
  BRIG: [],
};

/** Get objects available for a given zone type */
export function getMenuForZone(zone: ZoneType): string[] {
  const zoneItems = tMenus[zone] ?? [];
  const allItems = tMenus.ALL ?? [];
  return [...allItems, ...zoneItems];
}
