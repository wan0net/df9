/**
 * EnvObjectData.ts — Static definitions for all placeable objects.
 * Mirrors EnvObjects/EnvObjectData.lua: complete tObjects, tAliases, and tMenus tables.
 */

import { ZoneType } from '../world/ZoneType';
import { BUILDER, TECHNICIAN, BOTANIST } from '../characters/CharacterConstants';
import { line } from '../localization/Localization';

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
  // ── New properties from Lua source ─────────────────────────
  interactSprite: string | null;
  portrait: string | null;
  sPortraitPath: string | null;
  clickSound: string | null;
  placeSound: string | null;
  ambientSound: string | null;
  createJob: number;
  maintainJob: number;
  inherentActivities: string[];
  changeZone: boolean;
  nCapacity: number;
  nRange: number;
  nFoodPrice: number;
  sFunctionality: string | null;
  bCanFlipY: boolean;
  bAttackable: boolean;
  bIgnoreLighting: boolean;
  bHelpsMorale: boolean;
  bSortBack: boolean;
  sFlavorText: string | null;
  tDisplaySlots: { x: number; y: number; z: number }[];
  tAnimOffset: { x: number; y: number } | null;
  tAnimOffsetFlipped: { x: number; y: number } | null;
  spriteOffsetX: number;
  spriteOffsetXFlipped: number;
  layer: string | null;
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
    // New property defaults
    interactSprite: null,
    portrait: null,
    sPortraitPath: null,
    clickSound: null,
    placeSound: null,
    ambientSound: null,
    createJob: BUILDER,
    maintainJob: TECHNICIAN,
    inherentActivities: [],
    changeZone: true,
    nCapacity: 0,
    nRange: 0,
    nFoodPrice: 0,
    sFunctionality: null,
    bCanFlipY: false,
    bAttackable: true,
    bIgnoreLighting: false,
    bHelpsMorale: false,
    bSortBack: false,
    sFlavorText: null,
    tDisplaySlots: [],
    tAnimOffset: null,
    tAnimOffsetFlipped: null,
    spriteOffsetX: 0,
    spriteOffsetXFlipped: 0,
    layer: null,
    ...overrides,
  };
}

/** Complete object definitions matching EnvObjectData.lua tObjects */
export const tObjects: Record<string, EnvObjectDef> = {
  // ── Special (hidden) ─────────────────────────────────────────
  Spawner: def({
    spriteName: 'spawner', friendlyName: 'Spawner', matterCost: 0,
    customClass: 'Spawner', showInObjectMenu: false,
    noRoom: true, bCanBuildInSpace: true,
  }),
  DockPoint: def({
    spriteName: 'dockpoint', friendlyName: 'Dock Point', matterCost: 0,
    showInObjectMenu: false, noRoom: true, bCanBuildInSpace: true,
  }),

  // ── Doors ─────────────────────────────────────────────────────
  Door: def({
    spriteName: 'door_closed', friendlyName: line('PROPSX019TEXT'), matterCost: 25,
    door: true, bBlocksOxygen: true,
    customClass: 'Door', noRoom: true, sidebarIcon: 'icon_door',
    layer: 'worldWall', clickSound: 'spacedoor', placeSound: 'placedoor',
    portrait: 'Env_Door', sFlavorText: 'OBFLAV018TEXT',
  }),
  HeavyDoor: def({
    spriteName: 'door_heavy_closed', friendlyName: line('PROPSX064TEXT'), matterCost: 100,
    door: true, bBlocksOxygen: true,
    customClass: 'HeavyDoor', noRoom: true, researchPrereq: 'DoorLevel2',
    sidebarIcon: 'icon_heavydoor', layer: 'worldWall',
    clickSound: 'spacedoor', placeSound: 'placedoor',
    portrait: 'Env_HeavyDoor', sFunctionality: 'Door',
    sFlavorText: 'OBFLAV025TEXT',
  }),
  Airlock: def({
    spriteName: 'airlock_door_closed', friendlyName: line('PROPSX021TEXT'), matterCost: 75,
    width: 2, door: true, bBlocksOxygen: true,
    customClass: 'Airlock', noRoom: true, sidebarIcon: 'icon_airlock_door',
    layer: 'worldWall', clickSound: '', placeSound: 'placeairlock',
    portrait: 'Env_Airlock_Door', sFlavorText: 'OBFLAV016TEXT',
  }),

  // ── Power Generation ──────────────────────────────────────────
  Generator: def({
    spriteName: 'generator', friendlyName: line('ZONEUI015TEXT'), matterCost: 200,
    width: 2, height: 2, margin: 2, nPowerOutput: 1000,
    decayPerSecond: 0.03, explodeOnFailure: true, bCanDeactivate: true,
    bBlocksPathing: true, nSabotageDuration: 30,
    zoneName: ZoneType.POWER, sidebarIcon: 'icon_generator',
    clickSound: 'fusionreactor', ambientSound: 'reactorloop',
    portrait: 'Env_Power_Generator', placeSound: 'placereactor',
    sFlavorText: 'OBFLAV019TEXT',
  }),
  GeneratorLevel2: def({
    spriteName: 'generator2', friendlyName: line('PROPSX096TEXT'), matterCost: 600,
    width: 2, height: 2, margin: 2, nPowerOutput: 2500,
    decayPerSecond: 0.04, explodeOnFailure: true, bCanDeactivate: true,
    bBlocksPathing: true, nSabotageDuration: 30,
    zoneName: ZoneType.POWER, researchPrereq: 'GeneratorLevel2',
    sidebarIcon: 'icon_generator',
    clickSound: 'fusionreactor', ambientSound: 'reactorloop',
    portrait: 'Env_Power_Generator', placeSound: 'placereactor',
    sFlavorText: 'OBFLAV022TEXT',
  }),
  GeneratorLevel3: def({
    spriteName: 'ReactorGen3', friendlyName: line('PROPSX100TEXT'), matterCost: 2000,
    width: 3, height: 3, margin: 2, nPowerOutput: 5000,
    decayPerSecond: 0.04, explodeOnFailure: true, bCanDeactivate: true,
    bBlocksPathing: true, nSabotageDuration: 30,
    zoneName: ZoneType.POWER, researchPrereq: 'GeneratorLevel3',
    sidebarIcon: 'icon_generator',
    clickSound: 'fusionreactor', ambientSound: 'reactorloop',
    portrait: 'Env_Power_Generator', placeSound: 'placereactor',
    sFlavorText: 'OBFLAV037TEXT',
  }),
  GeneratorLevel4: def({
    spriteName: 'ReactorGen4', friendlyName: line('PROPSX102TEXT'), matterCost: 5000,
    width: 4, height: 4, margin: 2, nPowerOutput: 10000,
    decayPerSecond: 0.04, explodeOnFailure: true, bCanDeactivate: true,
    bBlocksPathing: true, nSabotageDuration: 30,
    zoneName: ZoneType.POWER, researchPrereq: 'GeneratorLevel4',
    sidebarIcon: 'icon_generator',
    clickSound: 'fusionreactor', ambientSound: 'reactorloop',
    portrait: 'Env_Power_Generator', placeSound: 'placereactor',
    sFlavorText: 'OBFLAV038TEXT',
  }),

  // ── Life Support ──────────────────────────────────────────────
  OxygenRecycler: def({
    spriteName: 'O2Gen', friendlyName: line('ZONEUI016TEXT'), matterCost: 150,
    margin: 1, oxygenLevel: 50, nPowerDraw: 25,
    decayPerSecond: 0.05, explodeOnFailure: true, bCanDeactivate: true,
    bBlocksPathing: true, zoneName: ZoneType.LIFESUPPORT,
    sidebarIcon: 'icon_oxygen_recycler',
    clickSound: 'oxygenrecycler', ambientSound: 'oxygenrecyclerloop',
    portrait: 'Env_LifeSupport_OxygenRecycler', placeSound: 'placerecycler',
    sFlavorText: 'OBFLAV001TEXT',
  }),
  OxygenRecyclerLevel2: def({
    spriteName: 'oxygen_recycler_level2', friendlyName: line('PROPSX062TEXT'), matterCost: 300,
    width: 2, height: 2, margin: 1, oxygenLevel: 300, nPowerDraw: 30,
    decayPerSecond: 0.05, explodeOnFailure: true, bCanDeactivate: true,
    bBlocksPathing: true, zoneName: ZoneType.LIFESUPPORT,
    researchPrereq: 'OxygenRecyclerLevel2', sidebarIcon: 'icon_oxygen_recycler',
    clickSound: 'oxygenrecycler', ambientSound: 'oxygenrecyclerloop',
    portrait: 'Env_LifeSupport_OxygenRecycler2', placeSound: 'placerecycler',
    sFunctionality: 'OxygenRecycler', sFlavorText: 'OBFLAV002TEXT',
  }),
  OxygenRecyclerLevel3: def({
    spriteName: 'O2Gen3', friendlyName: line('RECYCLE001TEXT'), matterCost: 600,
    width: 3, height: 3, margin: 1, oxygenLevel: 600, nPowerDraw: 35,
    decayPerSecond: 0.06, explodeOnFailure: true, bCanDeactivate: true,
    bBlocksPathing: true, zoneName: ZoneType.LIFESUPPORT,
    researchPrereq: 'OxygenRecyclerLevel3', sidebarIcon: 'icon_oxygen_recycler',
    clickSound: 'oxygenrecycler', ambientSound: 'oxygenrecyclerloop',
    portrait: 'Env_LifeSupport_OxygenRecycler2', placeSound: 'placerecycler',
    sFunctionality: 'OxygenRecycler', sFlavorText: 'RECYCLE003TEXT',
  }),
  OxygenRecyclerLevel4: def({
    spriteName: 'O2Gen4', friendlyName: line('RECYCLE004TEXT'), matterCost: 1200,
    width: 4, height: 4, margin: 1, oxygenLevel: 900, nPowerDraw: 35,
    decayPerSecond: 0.06, explodeOnFailure: true, bCanDeactivate: true,
    bBlocksPathing: true, zoneName: ZoneType.LIFESUPPORT,
    researchPrereq: 'OxygenRecyclerLevel4', sidebarIcon: 'icon_oxygen_recycler',
    clickSound: 'oxygenrecycler', ambientSound: 'oxygenrecyclerloop',
    portrait: 'Env_LifeSupport_OxygenRecycler2', placeSound: 'placerecycler',
    sFunctionality: 'OxygenRecycler', sFlavorText: 'RECYCLE006TEXT',
  }),
  AirScrubber: def({
    spriteName: 'AirScrubber', friendlyName: line('PROPSX078TEXT'), matterCost: 300,
    margin: 1, nPowerDraw: 30,
    decayPerSecond: 0.04, explodeOnFailure: true, bCanDeactivate: true,
    bBlocksPathing: true, zoneName: ZoneType.LIFESUPPORT,
    researchPrereq: 'AirScrubber', sidebarIcon: 'icon_airscrubber',
    customClass: 'AirScrubber', nRange: 12,
    portrait: 'Env_AirScrubber', placeSound: 'placeoxygenfilter',
    sFlavorText: 'OBFLAV003TEXT',
  }),

  // ── Plants ────────────────────────────────────────────────────
  BulbousPlant: def({
    spriteName: 'BulbousPlant', friendlyName: line('PROPSX106TEXT'), matterCost: 150,
    oxygenLevel: 7, nMoraleScore: 3, noRoom: true, sidebarIcon: 'icon_plant',
    changeZone: false, spriteOffsetX: 40, spriteOffsetXFlipped: -60,
    portrait: 'bulbous_plant_icon', placeSound: 'placeplant',
    sPortraitPath: 'Environments/BulbousPlant',
    sFlavorText: 'OBFLAV040TEXT',
  }),
  StrangePlant: def({
    spriteName: 'strange_plant', friendlyName: line('PROPSX110TEXT'), matterCost: 250,
    oxygenLevel: 10, nMoraleScore: 5, noRoom: true, sidebarIcon: 'icon_plant',
    changeZone: false,
    sPortraitPath: 'Environments/strange_plant',
    placeSound: 'placeplant', sFlavorText: 'OBFLAV042TEXT',
  }),
  space_tree: def({
    spriteName: 'space_tree', friendlyName: line('PROPSX108TEXT'), matterCost: 250,
    width: 2, height: 2, margin: 1, oxygenLevel: 10, nMoraleScore: 10,
    bBlocksPathing: true, decayPerSecond: 0.1, zoneName: ZoneType.GARDEN,
    sidebarIcon: 'icon_plant', changeZone: false,
    maintainJob: BOTANIST, spriteOffsetX: -10, spriteOffsetXFlipped: 250,
    sPortraitPath: 'Environments/space_tree',
    portrait: 'SpaceTree_portrait', placeSound: 'placeplant',
    sFlavorText: 'OBFLAV041TEXT',
  }),
  HydroPlant: def({
    spriteName: 'HydroPlant', friendlyName: line('PROPSX025TEXT'), matterCost: 150,
    oxygenLevel: 10, nMoraleScore: 4, bBlocksPathing: true,
    decayPerSecond: 0, zoneName: ZoneType.GARDEN,
    customClass: 'HydroPlant', sidebarIcon: 'icon_plant_tray',
    maintainJob: BOTANIST,
    portrait: 'Env_Plant_Tray', placeSound: 'placehydroplant',
    sFlavorText: 'OBFLAV034TEXT',
  }),
  HousePlant: def({
    spriteName: 'HousePoint', friendlyName: line('ZONEUI059TEXT'), matterCost: 150,
    oxygenLevel: 5, nMoraleScore: 3, noRoom: true, sidebarIcon: 'icon_plant',
    changeZone: false,
    portrait: 'Env_Plant_01', placeSound: 'placeplant',
    sFlavorText: 'OBFLAV015TEXT',
  }),

  // ── Residence ─────────────────────────────────────────────────
  Bed: def({
    spriteName: 'Bed', friendlyName: line('ZONEUI044TEXT'), matterCost: 150,
    width: 2, margin: 1, bBlocksPathing: true,
    customClass: 'Bed', zoneName: ZoneType.RESIDENCE,
    additionalZones: [ZoneType.BRIG], sidebarIcon: 'icon_bed',
    clickSound: 'spacebed', portrait: 'Env_Bed', placeSound: 'placebed',
    tAnimOffset: { x: 55, y: 60 }, tAnimOffsetFlipped: { x: 55, y: 25 },
    sFlavorText: 'OBFLAV026TEXT',
  }),
  Dresser: def({
    spriteName: 'Dresser', friendlyName: line('ZONEUI061TEXT'), matterCost: 125,
    noRoom: true, bInventory: true, nMoraleScore: 1,
    zoneName: ZoneType.RESIDENCE, sidebarIcon: 'icon_dresser',
    spriteOffsetX: 10, sFunctionality: 'Shelving',
    portrait: 'Env_Residence_Dresser', placeSound: 'placedresser',
    sFlavorText: 'OBFLAV023TEXT',
    tDisplaySlots: [
      { x: -155, y: -12, z: 10 },
      { x: -125, y: 3, z: 5 },
    ],
  }),
  WallShelf: def({
    spriteName: 'WallShelf', friendlyName: line('PROPSX092TEXT'), matterCost: 20,
    againstWall: true, noRoom: true, bInventory: true,
    zoneName: ZoneType.RESIDENCE, sidebarIcon: 'icon_shelf',
    decayPerSecond: 0, spriteOffsetX: -15, spriteOffsetXFlipped: 15,
    clickSound: 'spacesuitlocker', sFunctionality: 'Shelving',
    portrait: 'Env_Shelf', placeSound: 'placedresser',
    sFlavorText: 'OBFLAV036TEXT',
    tDisplaySlots: [
      { x: -183, y: -14, z: 6 },
      { x: -153, y: 1, z: 3 },
      { x: -183, y: 44, z: 12 },
      { x: -153, y: 59, z: 9 },
    ],
  }),
  Rug1: def({
    spriteName: 'Rug1', friendlyName: line('ZONEUI063TEXT'), matterCost: 20,
    noRoom: true, nMoraleScore: 1,
    zoneName: ZoneType.RESIDENCE, sidebarIcon: 'icon_rug',
    bHelpsMorale: true, bSortBack: true,
    portrait: 'Env_Rug', placeSound: 'placerug',
    sFlavorText: 'OBFLAV008TEXT',
  }),

  // ── Pub ───────────────────────────────────────────────────────
  Bar: def({
    spriteName: 'Bar', friendlyName: line('ZONEUI065TEXT'), matterCost: 250,
    width: 2, margin: 1, bBlocksPathing: true, decayPerSecond: 0.005,
    customClass: 'Bar', zoneName: ZoneType.PUB, sidebarIcon: 'icon_bar',
    portrait: 'Env_Bar', placeSound: 'placebar',
    sFlavorText: 'OBFLAV030TEXT',
  }),
  Fridge: def({
    spriteName: 'Fridge', friendlyName: line('PROPSX033TEXT'), matterCost: 250,
    againstWall: true, bBlocksPathing: true, bInventory: true,
    nPowerDraw: 35, decayPerSecond: 0.002, bCanDeactivate: true,
    customClass: 'Fridge', zoneName: ZoneType.PUB, sidebarIcon: 'icon_fridge',
    interactSprite: 'fridge_open', nCapacity: 7,
    portrait: 'Env_Pub_Fridge', placeSound: 'placefridge',
    sFlavorText: 'OBFLAV013TEXT',
  }),
  FridgeLvl2: def({
    spriteName: 'fridge_level2', friendlyName: line('PROPSX069TEXT'), matterCost: 250,
    againstWall: true, bBlocksPathing: true, bInventory: true,
    nPowerDraw: 50, decayPerSecond: 0.002, bCanDeactivate: true,
    customClass: 'Fridge', zoneName: ZoneType.PUB,
    researchPrereq: 'FridgeLevel2', sidebarIcon: 'icon_fridge',
    interactSprite: 'fridge_level2_open', nCapacity: 50,
    sFunctionality: 'Fridge',
    portrait: 'Env_Pub_Fridge', placeSound: 'placefridge',
    sFlavorText: 'OBFLAV014TEXT',
  }),
  Stove: def({
    spriteName: 'Stove', friendlyName: line('PROPSX030TEXT'), matterCost: 250,
    bBlocksPathing: true, nPowerDraw: 30, decayPerSecond: 0.005,
    bCanDeactivate: true, zoneName: ZoneType.PUB, sidebarIcon: 'icon_stove',
    portrait: 'Env_Pub_Stove', placeSound: 'placestove',
    sFlavorText: 'OBFLAV035TEXT',
  }),
  StandingTable: def({
    spriteName: 'StandingTable', friendlyName: line('PROPSX031TEXT'), matterCost: 100,
    margin: 1, bBlocksPathing: true, bInventory: true, decayPerSecond: 0,
    customClass: 'PubTable', zoneName: ZoneType.PUB, sidebarIcon: 'icon_standingtable',
    portrait: 'Env_Pub_StandingTable', placeSound: 'placetable',
    sFlavorText: 'OBFLAV005TEXT',
  }),
  Jukebox: def({
    spriteName: 'Jukebox', friendlyName: line('JUKEX001TEXT'), matterCost: 300,
    againstWall: true, bBlocksPathing: true, decayPerSecond: 0.002,
    explodeOnFailure: true, nPowerDraw: 25, bCanDeactivate: true,
    nMoraleScore: 5, customClass: 'Jukebox', zoneName: ZoneType.PUB,
    sidebarIcon: 'icon_airscrubber',
    inherentActivities: ['ListenToJukebox'],
    portrait: 'Juke_Portrait', sPortraitPath: 'Environments/Jukebox',
    placeSound: 'placeoxygenfilter', sFlavorText: 'JUKEX003TEXT',
  }),
  BurgerSign: def({
    spriteName: 'BurgerSign', friendlyName: line('PROPSX007TEXT'), matterCost: 225,
    againstWall: true, nMoraleScore: 2, nPowerDraw: 5,
    zoneName: ZoneType.PUB, sidebarIcon: 'icon_wall_neon_burger',
    bIgnoreLighting: true,
    portrait: 'Env_Bar_NeonBurger', placeSound: 'placeneon',
    sFlavorText: 'OBFLAV010TEXT',
  }),
  PizzaSign: def({
    spriteName: 'PizzaSign', friendlyName: line('PROPSX011TEXT'), matterCost: 150,
    againstWall: true, nMoraleScore: 2, nPowerDraw: 5,
    zoneName: ZoneType.PUB, sidebarIcon: 'icon_wall_neon_pizza',
    bIgnoreLighting: true,
    portrait: 'Env_Bar_NeonPizza', placeSound: 'placeneon',
    sFlavorText: 'OBFLAV011TEXT',
  }),
  FriesSign: def({
    spriteName: 'FriesSign', friendlyName: line('PROPSX009TEXT'), matterCost: 75,
    againstWall: true, nMoraleScore: 2, nPowerDraw: 5,
    zoneName: ZoneType.PUB, sidebarIcon: 'icon_wall_neon_fries',
    bIgnoreLighting: true,
    portrait: 'Env_Bar_NeonFries', placeSound: 'placeneon',
    sFlavorText: 'OBFLAV012TEXT',
  }),

  // ── Refinery ──────────────────────────────────────────────────
  refinery: def({
    spriteName: 'Refinery', friendlyName: line('ZONEUI045TEXT'), matterCost: 200,
    width: 2, height: 2, margin: 1, nPowerDraw: 40,
    decayPerSecond: 0.005, explodeOnFailure: true, bCanDeactivate: true,
    bBlocksPathing: true, customClass: 'RefineryDropoff',
    zoneName: ZoneType.REFINERY, sidebarIcon: 'icon_refinery',
    clickSound: 'spacebed', ambientSound: 'refineryloop',
    portrait: 'Env_Refinery', placeSound: 'placerefinery',
    sFlavorText: 'OBFLAV032TEXT',
  }),
  refinery_level2: def({
    spriteName: 'Refinery', friendlyName: line('PROPSX066TEXT'), matterCost: 400,
    width: 2, height: 2, margin: 1, nPowerDraw: 50,
    decayPerSecond: 0.005, explodeOnFailure: true, bCanDeactivate: true,
    bBlocksPathing: true, customClass: 'RefineryDropoff',
    zoneName: ZoneType.REFINERY, researchPrereq: 'RefineryDropoffLevel2',
    sidebarIcon: 'icon_refinery',
    clickSound: 'spacebed', ambientSound: 'refineryloop',
    portrait: 'Env_Refinery', placeSound: 'placerefinery',
    sFunctionality: 'RefineryDropoff', sFlavorText: 'OBFLAV033TEXT',
  }),

  // ── Fitness ───────────────────────────────────────────────────
  WeightBench: def({
    spriteName: 'WeightBench', friendlyName: line('PROPSX046TEXT'), matterCost: 100,
    width: 2, margin: 1, bBlocksPathing: true,
    customClass: 'WeightBench', zoneName: ZoneType.FITNESS,
    additionalZones: [ZoneType.BRIG], sidebarIcon: 'icon_weightbench',
    interactSprite: 'weightbench_inuse',
    inherentActivities: ['LiftAtWeightBench'],
    clickSound: 'fusionreactor', portrait: 'Env_WeightBench',
    tAnimOffset: { x: 25, y: 45 }, tAnimOffsetFlipped: { x: 45, y: 25 },
    sFlavorText: 'OBFLAV009TEXT',
  }),

  // ── Research ──────────────────────────────────────────────────
  ResearchDesk: def({
    spriteName: 'ResearchDesk', friendlyName: line('PROPSX060TEXT'), matterCost: 300,
    width: 2, margin: 1, bBlocksPathing: true,
    decayPerSecond: 0.005, explodeOnFailure: true,
    nPowerDraw: 50, bCanDeactivate: true,
    customClass: 'ResearchDesk', zoneName: ZoneType.RESEARCH,
    sidebarIcon: 'icon_research_desk',
    clickSound: 'spacebed', portrait: 'Env_Research_Desk',
    placeSound: 'placebed', sFlavorText: 'OBFLAV006TEXT',
  }),

  // ── Infirmary ─────────────────────────────────────────────────
  HospitalBed: def({
    spriteName: 'HospitalBed', friendlyName: line('PROPSX076TEXT'), matterCost: 400,
    width: 2, margin: 1, bBlocksPathing: true,
    decayPerSecond: 0.005, nPowerDraw: 30, bCanDeactivate: true,
    customClass: 'HospitalBed', zoneName: ZoneType.INFIRMARY,
    sidebarIcon: 'icon_hospital_bed',
    interactSprite: 'hospital_bed_occupied',
    clickSound: 'spacebed', portrait: 'Env_HospitalBed',
    placeSound: 'placebed',
    tAnimOffset: { x: 55, y: 60 }, tAnimOffsetFlipped: { x: 55, y: 25 },
    sFlavorText: 'OBFLAV031TEXT',
  }),

  // ── Airlock ───────────────────────────────────────────────────
  AirlockLocker: def({
    spriteName: 'AirlockLocker', friendlyName: line('ZONEUI040TEXT'), matterCost: 25, // Lua EnvObjectData.lua matterCost=25
    againstWall: true, zoneName: ZoneType.AIRLOCK,
    customClass: 'AirlockLocker', sidebarIcon: 'icon_airlock_locker',
    explodeOnFailure: true, bAttackable: false,
    clickSound: 'spacesuitlocker', portrait: 'Env_Airlock_Locker',
    placeSound: 'placespacesuitlocker', sFlavorText: 'OBFLAV021TEXT',
  }),

  // ── Utility (ALL zone) ───────────────────────────────────────
  FirePanel: def({
    spriteName: 'FirePanel', friendlyName: line('PROPSX001TEXT'), matterCost: 50,
    againstWall: true, noRoom: true, sidebarIcon: 'icon_fire_panel',
    clickSound: 'spacesuitlocker',
    portrait: 'Env_Firepanel', placeSound: 'placefirepanel',
    sFlavorText: 'OBFLAV029TEXT',
  }),
  EmergencyAlarm: def({
    spriteName: 'EmergencyAlarm', friendlyName: line('PROPSX040TEXT'), matterCost: 50,
    againstWall: true, noRoom: true,
    customClass: 'EmergencyAlarm', sidebarIcon: 'icon_alarm_panel',
    clickSound: 'spacesuitlocker',
    portrait: 'Env_AlarmPanel', placeSound: 'placefirepanel',
    sFlavorText: 'OBFLAV020TEXT',
  }),
  HappyBot: def({
    spriteName: 'happybot', friendlyName: line('PROPSX104TEXT'), matterCost: 2000,
    margin: 1, nPowerDraw: 200, decayPerSecond: 0.1,
    explodeOnFailure: true, bCanDeactivate: true,
    nMoraleScore: 15, bBlocksPathing: true, noRoom: true,
    customClass: 'HappyBot', researchPrereq: 'HappyBot',
    sidebarIcon: 'icon_airscrubber',
    nRange: 3, spriteOffsetX: 5,
    portrait: 'HappyBot_portrait', sPortraitPath: 'Environments/HappyBot',
    placeSound: 'placeoxygenfilter', sFlavorText: 'OBFLAV039TEXT',
  }),
  TVScreen1: def({
    spriteName: 'TVScreen1', friendlyName: line('PROPSX003TEXT'), matterCost: 75,
    againstWall: true, noRoom: true, nMoraleScore: 1,
    nPowerDraw: 10, bCanDeactivate: true, sidebarIcon: 'icon_tv_screen',
    portrait: 'Env_TVScreen', placeSound: 'placemonitor',
    sFlavorText: 'OBFLAV028TEXT',
  }),
  FoodReplicator: def({
    spriteName: 'FoodReplicator', friendlyName: line('PROPSX027TEXT'), matterCost: 150,
    againstWall: true, noRoom: true, nMoraleScore: 3,
    nPowerDraw: 25, bCanDeactivate: true, sidebarIcon: 'icon_replicator',
    customClass: 'FoodReplicator', nFoodPrice: 50,
    clickSound: 'spacesuitlocker',
    portrait: 'Env_Replicator', placeSound: 'placefoodreplicator',
    sFlavorText: 'OBFLAV004TEXT',
  }),

  // ── Combat ────────────────────────────────────────────────────
  WallMountedTurret: def({
    spriteName: 'Turret', friendlyName: line('PROPSX084TEXT'), matterCost: 300,
    margin: 1, againstWall: true, noRoom: true, bCanBuildInSpace: true,
    decayPerSecond: 0.01, explodeOnFailure: true,
    nPowerDraw: 150, bCanDeactivate: true,
    customClass: 'Turret', sidebarIcon: 'icon_turret_ext',
    bCanFlipY: true, sFunctionality: 'Turret',
    spriteOffsetX: -110, spriteOffsetXFlipped: -20,
    clickSound: 'spacebed', portrait: 'Env_TurretExt',
    placeSound: 'placebed', sFlavorText: 'OBFLAV017TEXT',
  }),
  WallMountedTurret2: def({
    spriteName: 'Turret', friendlyName: line('PROPSX080TEXT'), matterCost: 600,
    margin: 1, againstWall: true, noRoom: true, bCanBuildInSpace: true,
    explodeOnFailure: true, nPowerDraw: 200, bCanDeactivate: true,
    customClass: 'TurretLv2', researchPrereq: 'WallMountedTurret2',
    sidebarIcon: 'icon_turret_ext_lv2',
    bCanFlipY: true, sFunctionality: 'Turret',
    spriteOffsetX: -110, spriteOffsetXFlipped: -20,
    clickSound: 'spacebed', portrait: 'Env_TurretExtLv2',
    placeSound: 'placebed', sFlavorText: 'OBFLAV024TEXT',
  }),

  // ── Special (not in build menus) ──────────────────────────────
  SpaceshipEngine: def({
    spriteName: 'SpaceshipEngine', friendlyName: line('PROPSX094TEXT'), matterCost: 200,
    width: 2, height: 3, margin: 1, noRoom: true, bCanBuildInSpace: true,
    bBlocksPathing: true, nPowerOutput: 250, nSabotageDuration: 30,
    showInObjectMenu: false,
    clickSound: 'fusionreactor', portrait: 'Env_SeedPod',
  }),
  BaseSeed: def({
    spriteName: 'BaseSeed', friendlyName: line('PROPSX005TEXT'), matterCost: 500,
    width: 2, height: 3, noRoom: true, bCanBuildInSpace: true,
    bBlocksPathing: true, nPowerOutput: 500, nSabotageDuration: 30,
    nMoraleScore: 10, showInObjectMenu: false,
    clickSound: 'fusionreactor', portrait: 'Env_SeedPod',
    sFlavorText: 'OBFLAV027TEXT',
  }),
};

// ── Wire description linecodes (Lua EnvObjectData.lua description field) ────
const DESC_LCS: Record<string, string> = {
  Door: 'PROPSX020TEXT', HeavyDoor: 'PROPSX065TEXT', Airlock: 'PROPSX022TEXT',
  Generator: 'ZONEUI051TEXT', GeneratorLevel2: 'PROPSX097TEXT',
  GeneratorLevel3: 'PROPSX101TEXT', GeneratorLevel4: 'PROPSX103TEXT',
  OxygenRecycler: 'ZONEUI052TEXT', OxygenRecyclerLevel2: 'PROPSX063TEXT',
  OxygenRecyclerLevel3: 'RECYCLE002TEXT', OxygenRecyclerLevel4: 'RECYCLE005TEXT',
  AirScrubber: 'PROPSX079TEXT',
  BulbousPlant: 'PROPSX107TEXT', StrangePlant: 'PROPSX111TEXT',
  space_tree: 'PROPSX109TEXT', HydroPlant: 'PROPSX026TEXT', HousePlant: 'ZONEUI060TEXT',
  Bed: 'ZONEUI054TEXT', Dresser: 'ZONEUI062TEXT', WallShelf: 'PROPSX093TEXT',
  Rug1: 'ZONEUI064TEXT',
  Bar: 'ZONEUI066TEXT', Fridge: 'PROPSX034TEXT', FridgeLvl2: 'PROPSX068TEXT',
  Stove: 'PROPSX029TEXT', StandingTable: 'PROPSX032TEXT', Jukebox: 'JUKEX002TEXT',
  BurgerSign: 'PROPSX008TEXT', PizzaSign: 'PROPSX012TEXT', FriesSign: 'PROPSX010TEXT',
  refinery: 'ZONEUI055TEXT', refinery_level2: 'PROPSX067TEXT',
  WeightBench: 'PROPSX047TEXT', ResearchDesk: 'PROPSX061TEXT',
  HospitalBed: 'PROPSX077TEXT', AirlockLocker: 'ZONEUI053TEXT',
  FirePanel: 'PROPSX002TEXT', EmergencyAlarm: 'PROPSX041TEXT',
  HappyBot: 'PROPSX105TEXT', TVScreen1: 'PROPSX004TEXT',
  FoodReplicator: 'PROPSX028TEXT',
  WallMountedTurret: 'PROPSX074TEXT', WallMountedTurret2: 'PROPSX081TEXT',
  SpaceshipEngine: 'PROPSX095TEXT', BaseSeed: 'PROPSX006TEXT',
};
for (const [key, lc] of Object.entries(DESC_LCS)) {
  if (tObjects[key]) tObjects[key].description = line(lc);
}

// ── Alias system (matches EnvObjectData.lua tAliases) ───────────
export const tAliases: Record<string, string> = {
  Fridge_level2: 'FridgeLvl2',
  FridgeLevel2: 'FridgeLvl2',
  tvScreen1: 'TVScreen1',
  burgerSign: 'BurgerSign',
  pizzaSign: 'PizzaSign',
  friesSign: 'FriesSign',
  HousePoint: 'HousePlant',
};

/** Resolve an object name through the alias table. */
export function resolveAlias(sName: string): string {
  return tAliases[sName] ?? sName;
}

/** Get object data by name, resolving aliases. Returns null if not found. */
export function getObjectData(sName: string): EnvObjectDef | null {
  const resolved = resolveAlias(sName);
  return tObjects[resolved] ?? null;
}

/** Get all object keys that share a given sFunctionality value. */
export function getObjectsByFunctionality(sFunctionality: string): string[] {
  const results: string[] = [];
  for (const [key, data] of Object.entries(tObjects)) {
    // An object matches if its sFunctionality equals the query, OR
    // if its own key matches (the base object of the group).
    if (data.sFunctionality === sFunctionality || key === sFunctionality) {
      results.push(key);
    }
  }
  return results;
}

/** Zone build menus matching EnvObjectData.lua tMenus */
export const tMenus: Record<string, string[]> = {
  ALL: ['Door', 'Airlock', 'HeavyDoor', 'FirePanel', 'EmergencyAlarm', 'HappyBot', 'BulbousPlant', 'StrangePlant'],
  POWER: ['Generator', 'GeneratorLevel2', 'GeneratorLevel3', 'GeneratorLevel4'],
  LIFESUPPORT: ['AirScrubber', 'OxygenRecycler', 'OxygenRecyclerLevel2', 'OxygenRecyclerLevel3', 'OxygenRecyclerLevel4'],
  RESIDENCE: [],
  GARDEN: ['space_tree'],
  PUB: ['Bar', 'Fridge', 'FridgeLvl2', 'Stove', 'StandingTable', 'BurgerSign', 'PizzaSign', 'FriesSign'],
  AIRLOCK: [],
  REFINERY: ['refinery', 'refinery_level2'],
  FITNESS: [],
  INFIRMARY: [],
  RESEARCH: [],
  BRIG: [],
};

/** Get objects available for a given zone type */
export function getMenuForZone(zone: ZoneType): string[] {
  const zoneItems = tMenus[zone] ?? [];
  const allItems = tMenus.ALL ?? [];
  return [...allItems, ...zoneItems];
}
