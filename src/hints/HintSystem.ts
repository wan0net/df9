/**
 * HintSystem.ts — Contextual tutorial hints.
 * Shows tips when specific game conditions are met for the first time.
 * Mirrors Lua HintData.lua + HintChecks.lua — all 50 Lua hints present.
 */

import { Base } from '../core/Base';
import { CommandQueue } from '../core/CommandQueue';
import { GameRules } from '../core/GameRules';
import {
  BUILDER, MINER, TECHNICIAN, EMERGENCY, BARTENDER, BOTANIST,
  SCIENTIST, DOCTOR, JANITOR, TEAM_ID_PLAYER,
} from '../characters/CharacterConstants';
import { EnvObjectManager } from '../envobjects/EnvObjectManager';
import { Malady } from '../malady/Malady';
import { line } from '../localization/Localization';

// ── Interfaces for loose-coupled game state ────────────────────────────

interface HintMalady {
  sMaladyName: string;
  sType?: string;
  bSymptomatic: boolean;
  bDiagnosed: boolean;
}

interface HintRoom {
  zone?: string;
  sealed?: boolean;
  oxygen?: number;
  hasPowerFlag?: boolean;
  hasFullPower?: boolean;
  bBreach?: boolean;
  nPowerDraw?: number;
  nTeam?: number;
}

interface HintCharacter {
  getJob?: () => number;
  isAlive?: () => boolean;
  bLowOxygen?: boolean;
  heldItem?: string | null;
  tStats?: { nTeam?: number; nJob?: number };
  nStarveTime?: number;
  maladies?: HintMalady[];
  bRampaging?: boolean;
  tAssignedToBrig?: number | null;
  currentTaskName?: string | null;
  getJobAffinity?: (jobId?: number) => number;
  bSpacewalking?: boolean;
}

interface HintObject {
  sName: string;
  bBuilt?: boolean;
  nCondition?: number;
  isFunctioning?: () => boolean;
  rRoom?: HintRoom | null;
  bSeeded?: boolean;
  nPlantHealth?: number;
  bSlatedForVaporize?: boolean;
  sOwner?: string | null;
}

interface HintCommand {
  type: string;
  status: string;
}

export interface HintProviders {
  hasEnclosedRooms: () => boolean;
  hasZonedRoom: () => boolean;
  hasStartedResearch: () => boolean;
  hasBuiltObject: () => boolean;
  getPopulation: () => number;
  hasHostiles: () => boolean;
  getRooms?: () => HintRoom[];
  getCharacters?: () => HintCharacter[];
  getObjects?: () => HintObject[];
  getCommands?: () => HintCommand[];
  getMatter?: () => number;
  hasActiveFires?: () => boolean;
  hasBeaconPlaced?: () => boolean;
  getActiveResearch?: () => string | null;
  inEditMode?: () => boolean;
}

interface HintDef {
  id: string;
  /** Linecode key for hint message. */
  sLC: string;
  nPriority?: number;
  nDisplayTimeBeforeHide?: number;
  nTimeTrueBeforeDisplay?: number;
  check: (ctx: HintContext) => boolean;
}

interface HintContext {
  hasEnclosedRooms: boolean;
  hasZonedRoom: boolean;
  hasStartedResearch: boolean;
  hasBuiltObject: boolean;
  population: number;
  hasHostiles: boolean;
  rooms: HintRoom[];
  characters: HintCharacter[];
  objects: HintObject[];
  commands: HintCommand[];
  matter: number;
  hasActiveFires: boolean;
  hasBeaconPlaced: boolean;
  activeResearch: string | null;
  inEditMode: boolean;
}

// ── Tunables (Lua HintChecks.lua) ──────────────────────────────────────

const LOW_MATTER_WARNING = 500;
const ACCIDENT_TIMEOUT = 20;
const DERELICT_WARN_DELAY = 20;
const REC_PLANTS_PER_BOTANIST = 6;
const DEAD_PLANT_HEALTH = 0;

// ── Helpers ────────────────────────────────────────────────────────────

function isBuilt(o: HintObject): boolean {
  return o.bBuilt !== false;
}

function isWorking(o: HintObject): boolean {
  if (!isBuilt(o)) return false;
  return o.isFunctioning ? o.isFunctioning() : true;
}

function countObjects(ctx: HintContext, names: string[]): number {
  const wanted = new Set(names);
  return ctx.objects.filter((o) => wanted.has(o.sName) && isBuilt(o)).length;
}

function countWorkingObjects(ctx: HintContext, names: string[]): number {
  const wanted = new Set(names);
  return ctx.objects.filter((o) => wanted.has(o.sName) && isWorking(o)).length;
}

function hasAnyCommand(ctx: HintContext, type: string): boolean {
  return ctx.commands.some((c) => c.type === type && c.status !== 'complete' && c.status !== 'cancelled');
}

function countJob(ctx: HintContext, jobId: number): number {
  let n = 0;
  for (const c of ctx.characters) {
    if (c.getJob && c.getJob() === jobId) n++;
  }
  return n;
}

/** Count non-incapacitated characters with a given job. */
function countWorkingJob(ctx: HintContext, jobId: number): number {
  let n = 0;
  for (const c of ctx.characters) {
    if (!c.getJob || c.getJob() !== jobId) continue;
    // Check if incapacitated (MajorInjury + symptomatic)
    if (c.bSpacewalking) { n++; continue; }
    const incapacitated = c.maladies?.some(m => m.sType === 'MajorInjury' && m.bSymptomatic) ?? false;
    if (!incapacitated) n++;
  }
  return n;
}

function hasZone(ctx: HintContext, zoneName: string): boolean {
  return ctx.rooms.some((r) => r.zone === zoneName);
}

function anyBreachedRoom(ctx: HintContext): boolean {
  return ctx.rooms.some((r) => r.sealed === false);
}

function hasOxygenGeneration(ctx: HintContext): boolean {
  return countWorkingObjects(ctx, [
    'OxygenRecycler',
    'OxygenRecyclerLevel2',
    'OxygenRecyclerLevel3',
    'OxygenRecyclerLevel4',
  ]) > 0;
}

/** Lua HintChecks.noFunctioningAirlocks */
function noFunctioningAirlocks(ctx: HintContext): boolean {
  if (!ctx.hasEnclosedRooms) return false;
  return countWorkingObjects(ctx, ['Airlock']) === 0;
}

/** Lua HintChecks.haveFoodPrepObjects */
function haveFoodPrepObjects(ctx: HintContext): boolean {
  const nBotanists = countJob(ctx, BOTANIST);
  const nBartenders = countJob(ctx, BARTENDER);
  const nStoves = countObjects(ctx, ['Stove']);
  const nFridges = countObjects(ctx, ['Fridge']);
  return nBotanists > 0 && nBartenders > 0 && nStoves > 0 && nFridges > 0;
}

/** Lua HintChecks.getNumSeededPlants */
function getNumSeededPlants(ctx: HintContext): number {
  return ctx.objects.filter(o => o.sName === 'HydroPlant' && isBuilt(o) && o.bSeeded).length;
}

/** Lua HintChecks.activeResearch — check if any research zone has active project */
function hasActiveResearchProject(ctx: HintContext): boolean {
  return ctx.activeResearch !== null;
}

/** Lua HintChecks.haveCorpse */
function haveCorpse(ctx: HintContext): boolean {
  return ctx.objects.some(o => o.sName === 'Corpse');
}

/** Lua HintChecks.haveDoctor — non-incapacitated doctor */
function haveDoctor(ctx: HintContext): boolean {
  return countWorkingJob(ctx, DOCTOR) > 0;
}

/** Lua HintChecks.haveJanitor — non-incapacitated janitor */
function haveJanitor(ctx: HintContext): boolean {
  return countWorkingJob(ctx, JANITOR) > 0;
}

/** Any player room (for power checks). */
function getPlayerRooms(ctx: HintContext): HintRoom[] {
  return ctx.rooms.filter(r => (r.nTeam ?? TEAM_ID_PLAYER) === TEAM_ID_PLAYER);
}

/** Lua HintChecks.noPower — no player rooms have any power */
function noPowerCheck(ctx: HintContext): boolean {
  const playerRooms = getPlayerRooms(ctx);
  if (playerRooms.length === 0) return false;
  return playerRooms.every(r => !r.hasPowerFlag);
}

// ── Hint definitions (ordered per Lua HintData.lua) ────────────────────

const HINTS: HintDef[] = [
  // Lua: noMoraleObjects — HINTSX059TEXT
  {
    id: 'noMoraleObjects',
    sLC: 'HINTSX059TEXT',
    check: (ctx) => {
      const monitors = countObjects(ctx, ['TVScreen1']);
      const plants = countObjects(ctx, ['HousePlant', 'BulbousPlant', 'StrangePlant']);
      return monitors < 2 || plants < 2;
    },
  },
  // Lua: YouCanForceOpenADoor — HINTSX027TEXT
  {
    id: 'YouCanForceOpenADoor',
    sLC: 'HINTSX027TEXT',
    check: (ctx) => {
      if (!noFunctioningAirlocks(ctx)) return false;
      // Must have airlock doors but NOT the "bad door" case
      const hasAirlockDoor = countObjects(ctx, ['Airlock']) > 0;
      if (!hasAirlockDoor) return false;
      // Exclude DontPutNormalDoorsOnAnAirlock case
      if (hasZone(ctx, 'AIRLOCK') && countObjects(ctx, ['Door', 'HeavyDoor']) > 0) return false;
      return true;
    },
  },
  // Lua: DontPutNormalDoorsOnAnAirlock — HINTSX037TEXT
  {
    id: 'DontPutNormalDoorsOnAnAirlock',
    sLC: 'HINTSX037TEXT',
    check: (ctx) => {
      if (!noFunctioningAirlocks(ctx)) return false;
      if (!hasZone(ctx, 'AIRLOCK')) return false;
      return countObjects(ctx, ['Door', 'HeavyDoor']) > 0 && countWorkingObjects(ctx, ['Airlock']) === 0;
    },
  },
  // Lua: NotEnoughTechnicians — HINTSX001TEXT, pri=2
  {
    id: 'NotEnoughTechnicians',
    sLC: 'HINTSX001TEXT',
    nPriority: 2,
    check: (ctx) => {
      const techs = countJob(ctx, TECHNICIAN);
      const damaged = ctx.objects.filter((o) => isBuilt(o) && typeof o.nCondition === 'number' && o.nCondition < 80).length;
      return damaged > Math.max(1, Math.floor(techs / 6));
    },
  },
  // Lua: LowMatter — HINTSX002TEXT, display=30
  {
    id: 'LowMatter',
    sLC: 'HINTSX002TEXT',
    nDisplayTimeBeforeHide: 30,
    check: (ctx) => ctx.matter < LOW_MATTER_WARNING,
  },
  // Lua: ConstructionNoBuilders — HINTSX003TEXT, pri=2
  {
    id: 'ConstructionNoBuilders',
    sLC: 'HINTSX003TEXT',
    nPriority: 2,
    check: (ctx) => countJob(ctx, BUILDER) === 0 && (hasAnyCommand(ctx, 'build_tile') || hasAnyCommand(ctx, 'build_object')),
  },
  // Lua: NoMiners — HINTSX007TEXT, display=60, pri=2
  {
    id: 'NoMiners',
    sLC: 'HINTSX007TEXT',
    nDisplayTimeBeforeHide: 60,
    nPriority: 2,
    check: (ctx) => countJob(ctx, MINER) === 0 && hasAnyCommand(ctx, 'mine'),
  },
  // Lua: NoRefineries — HINTSX008TEXT
  {
    id: 'NoRefineries',
    sLC: 'HINTSX008TEXT',
    check: (ctx) => {
      if (countJob(ctx, MINER) === 0) return false;
      const hasRockCarrier = ctx.characters.some((c) => c.heldItem === 'Rock');
      if (!hasRockCarrier) return false;
      return countObjects(ctx, ['RefineryDropoff', 'RefineryDropoffLevel2']) === 0;
    },
  },
  // Lua: LowOxygen — HINTSX010TEXT, pri=2
  {
    id: 'LowOxygen',
    sLC: 'HINTSX010TEXT',
    nPriority: 2,
    check: (ctx) => {
      if (ctx.rooms.length === 0) return false;
      if (ctx.characters.length === 0) return false;
      const low = ctx.characters.filter((c) => c.bLowOxygen).length;
      if (ctx.characters.length === 1) return low > 0;
      return low >= Math.floor(ctx.characters.length / 2);
    },
  },
  // Lua: NotEnoughBeds — HINTSX012TEXT
  {
    id: 'NotEnoughBeds',
    sLC: 'HINTSX012TEXT',
    check: (ctx) => ctx.population > 0 && countObjects(ctx, ['Bed']) < ctx.population,
  },
  // Lua: EveryoneDead — HINTSX009TEXT, pri=3
  {
    id: 'EveryoneDead',
    sLC: 'HINTSX009TEXT',
    nPriority: 3,
    check: (ctx) => ctx.population === 0,
  },
  // Lua: NoFunctioningAirlocks — HINTSX015TEXT
  {
    id: 'NoFunctioningAirlocks',
    sLC: 'HINTSX015TEXT',
    check: (ctx) => noFunctioningAirlocks(ctx),
  },
  // Lua: RoomsButNoOxygen — HINTSX017TEXT
  {
    id: 'RoomsButNoOxygen',
    sLC: 'HINTSX017TEXT',
    check: (ctx) => ctx.hasEnclosedRooms && !hasOxygenGeneration(ctx),
  },
  // Lua: NoBuilding — HINTSX016TEXT
  {
    id: 'NoBuilding',
    sLC: 'HINTSX016TEXT',
    check: (ctx) => ctx.rooms.length === 0 && !hasAnyCommand(ctx, 'build_tile'),
  },
  // Lua: PubAtCapacity — HINTSX019TEXT
  {
    id: 'PubAtCapacity',
    sLC: 'HINTSX019TEXT',
    check: (ctx) => {
      if (!hasZone(ctx, 'PUB')) return false;
      const bars = countWorkingObjects(ctx, ['Bar']);
      return ctx.population > Math.max(4, bars * 6);
    },
  },
  // Lua: PubButNoBar — HINTSX020TEXT
  {
    id: 'PubButNoBar',
    sLC: 'HINTSX020TEXT',
    check: (ctx) => hasZone(ctx, 'PUB') && countObjects(ctx, ['Bar']) === 0,
  },
  // Lua: EditMode — HINTSX018TEXT
  {
    id: 'EditMode',
    sLC: 'HINTSX018TEXT',
    check: (ctx) => ctx.inEditMode,
  },
  // Lua: FailedDutyAccident — HINTSX021TEXT
  {
    id: 'FailedDutyAccident',
    sLC: 'HINTSX021TEXT',
    check: () => {
      if (GameRules.nLastDutyAccident === 0) return false;
      return GameRules.nLastDutyAccident + ACCIDENT_TIMEOUT > GameRules.elapsedTime;
    },
  },
  // Lua: DerelictNoBeacon — HINTSX022TEXT
  {
    id: 'DerelictNoBeacon',
    sLC: 'HINTSX022TEXT',
    check: (ctx) => {
      if (GameRules.nLastNewShip === 0) return false;
      return !ctx.hasBeaconPlaced && GameRules.nLastNewShip + DERELICT_WARN_DELAY > GameRules.elapsedTime;
    },
  },
  // Lua: FireNoExtinguisher — HINTSX023TEXT
  {
    id: 'FireNoExtinguisher',
    sLC: 'HINTSX023TEXT',
    check: (ctx) => {
      if (!ctx.hasActiveFires) return false;
      // Check if any character is extinguishing fire bare-handed (no FirePanel in room)
      const bareHandedFireFighters = ctx.characters.filter(
        c => c.currentTaskName === 'ExtinguishFireBareHanded',
      );
      if (bareHandedFireFighters.length === 0) return false;
      // At least one fire room lacks a FirePanel
      const firePanelRooms = new Set<HintRoom>();
      for (const o of ctx.objects) {
        if (o.sName === 'FirePanel' && isBuilt(o) && o.rRoom) {
          firePanelRooms.add(o.rRoom);
        }
      }
      // If there are active fires and someone is fighting bare-handed, hint is valid
      return true;
    },
  },
  // Lua: BeaconNoSecurity — HINTSX024TEXT
  {
    id: 'BeaconNoSecurity',
    sLC: 'HINTSX024TEXT',
    check: (ctx) => ctx.hasBeaconPlaced && countJob(ctx, EMERGENCY) === 0,
  },
  // Lua: RoomButNeverZoned — HINTSX026TEXT
  {
    id: 'RoomButNeverZoned',
    sLC: 'HINTSX026TEXT',
    check: (ctx) => ctx.hasEnclosedRooms && !ctx.hasZonedRoom,
  },
  // Lua: StarvingNoFood — HINTSX030TEXT, pri=2
  {
    id: 'StarvingNoFood',
    sLC: 'HINTSX030TEXT',
    nPriority: 2,
    check: (ctx) => {
      // No replicators
      const nReplicators = countObjects(ctx, ['FoodReplicator']);
      if (nReplicators > 0) return false;
      // No seeded hydro plants
      const nHydroPlants = countObjects(ctx, ['HydroPlant']);
      if (nHydroPlants > 0 && getNumSeededPlants(ctx) > 0) return false;
      // At least one starving citizen
      return ctx.characters.some(c => (c.nStarveTime ?? 0) > 0);
    },
  },
  // Lua: GardenNoBotanist — HINTSX031TEXT
  {
    id: 'GardenNoBotanist',
    sLC: 'HINTSX031TEXT',
    check: (ctx) => {
      const nHydroPlants = countObjects(ctx, ['HydroPlant']);
      if (nHydroPlants === 0) return false;
      return countJob(ctx, BOTANIST) === 0;
    },
  },
  // Lua: NotEnoughBotanists — HINTSX034TEXT
  {
    id: 'NotEnoughBotanists',
    sLC: 'HINTSX034TEXT',
    check: (ctx) => {
      const nHydroPlants = countObjects(ctx, ['HydroPlant']);
      if (nHydroPlants === 0) return false;
      const nBotanists = countJob(ctx, BOTANIST);
      // Check for dead/dying plants
      const deadPlants = ctx.objects.filter(
        o => o.sName === 'HydroPlant' && isBuilt(o) && o.bSeeded &&
          typeof o.nPlantHealth === 'number' && o.nPlantHealth <= DEAD_PLANT_HEALTH,
      );
      if (deadPlants.length === 0) return false;
      return nBotanists === 0 || (nBotanists / nHydroPlants) < (1 / REC_PLANTS_PER_BOTANIST);
    },
  },
  // Lua: CropsNoFoodPrep — HINTSX032TEXT
  {
    id: 'CropsNoFoodPrep',
    sLC: 'HINTSX032TEXT',
    check: (ctx) => {
      const nHydroPlants = countObjects(ctx, ['HydroPlant']);
      if (nHydroPlants === 0) return false;
      // Any ripe plants? (simplified: seeded plants exist)
      if (getNumSeededPlants(ctx) === 0) return false;
      return !haveFoodPrepObjects(ctx);
    },
  },
  // Lua: MealNoTables — HINTSX033TEXT
  {
    id: 'MealNoTables',
    sLC: 'HINTSX033TEXT',
    check: (ctx) => {
      const nTables = countObjects(ctx, ['StandingTable']);
      return nTables === 0 && haveFoodPrepObjects(ctx);
    },
  },
  // Lua: FoodNotPathable — HINTSX035TEXT
  {
    id: 'FoodNotPathable',
    sLC: 'HINTSX035TEXT',
    check: (ctx) => {
      // Starving citizen, food exists but not pathable
      const starvers = ctx.characters.filter(c => c.currentTaskName === 'Starve');
      if (starvers.length === 0) return false;
      // Not the "no food" or "no matter" cases
      const nReplicators = countObjects(ctx, ['FoodReplicator']);
      if (nReplicators === 0 && getNumSeededPlants(ctx) === 0) return false;
      if (ctx.matter < LOW_MATTER_WARNING && nReplicators > 0) return false;
      return true;
    },
  },
  // Lua: StarvingNoMatter — HINTSX036TEXT
  {
    id: 'StarvingNoMatter',
    sLC: 'HINTSX036TEXT',
    check: (ctx) => {
      // Starving people, replicators exist, but no matter
      const starvers = ctx.characters.filter(c => (c.nStarveTime ?? 0) > 0);
      if (starvers.length === 0) return false;
      const nReplicators = countObjects(ctx, ['FoodReplicator']);
      if (nReplicators === 0) return false;
      // Low/no matter means replicator can't buy food
      return ctx.matter < 50;
    },
  },
  // Lua: ResearchReadyNoResearch — HINTSX038TEXT, pri=0
  {
    id: 'ResearchReadyNoResearch',
    sLC: 'HINTSX038TEXT',
    nPriority: 0,
    check: (ctx) => {
      const nScientists = countJob(ctx, SCIENTIST);
      if (nScientists === 0) return false;
      const nDesks = countObjects(ctx, ['ResearchDesk']);
      if (nDesks === 0) return false;
      return !hasActiveResearchProject(ctx);
    },
  },
  // Lua: ResearchNoDesks — HINTSX039TEXT
  {
    id: 'ResearchNoDesks',
    sLC: 'HINTSX039TEXT',
    check: (ctx) => {
      const nScientists = countJob(ctx, SCIENTIST);
      if (nScientists === 0) return false;
      const nDesks = countObjects(ctx, ['ResearchDesk']);
      return hasActiveResearchProject(ctx) && nDesks === 0;
    },
  },
  // Lua: ResearchNoScientists — HINTSX040TEXT
  {
    id: 'ResearchNoScientists',
    sLC: 'HINTSX040TEXT',
    check: (ctx) => {
      const nScientists = countJob(ctx, SCIENTIST);
      return hasActiveResearchProject(ctx) && nScientists === 0;
    },
  },
  // Lua: UnclaimedResearchDatacubes — HINTSX041TEXT
  {
    id: 'UnclaimedResearchDatacubes',
    sLC: 'HINTSX041TEXT',
    check: (ctx) => {
      // Datacubes that haven't been slated for teardown
      return ctx.objects.some(
        o => o.sName === 'ResearchDatacube' && !o.bSlatedForVaporize,
      );
    },
  },
  // Lua: ClaimedResearchDatacubesNoScientists — HINTSX043TEXT
  {
    id: 'ClaimedResearchDatacubesNoScientists',
    sLC: 'HINTSX043TEXT',
    check: (ctx) => {
      const nScientists = countJob(ctx, SCIENTIST);
      if (nScientists > 0) return false;
      return ctx.objects.some(o => o.sName === 'ResearchDatacube' && !o.bSlatedForVaporize);
    },
  },
  // Lua: ClaimedResearchDatacubesNoDesks — HINTSX042TEXT
  {
    id: 'ClaimedResearchDatacubesNoDesks',
    sLC: 'HINTSX042TEXT',
    check: (ctx) => {
      const nDesks = countObjects(ctx, ['ResearchDesk']);
      if (nDesks > 0) return false;
      return ctx.objects.some(o => o.sName === 'ResearchDatacube' && !o.bSlatedForVaporize);
    },
  },
  // Lua: CorpseNoRefinery — HINTSX044TEXT
  {
    id: 'CorpseNoRefinery',
    sLC: 'HINTSX044TEXT',
    check: (ctx) => {
      if (!haveCorpse(ctx)) return false;
      const nRefineries = countObjects(ctx, ['RefineryDropoff', 'RefineryDropoffLevel2']);
      return nRefineries === 0;
    },
  },
  // Lua: CorpseNoJanitor — HINTSX046TEXT
  {
    id: 'CorpseNoJanitor',
    sLC: 'HINTSX046TEXT',
    check: (ctx) => {
      if (haveJanitor(ctx)) return false;
      return haveCorpse(ctx);
    },
  },
  // Lua: PatientNoDoctor — HINTSX045TEXT
  {
    id: 'PatientNoDoctor',
    sLC: 'HINTSX045TEXT',
    check: (ctx) => {
      if (haveDoctor(ctx)) return false;
      return ctx.characters.some(c => c.currentTaskName === 'CheckInToHospital');
    },
  },
  // Lua: IllnessNoCureResearched — HINTSX048TEXT
  {
    id: 'IllnessNoCureResearched',
    sLC: 'HINTSX048TEXT',
    check: (ctx) => {
      for (const c of ctx.characters) {
        if (!c.maladies) continue;
        for (const m of c.maladies) {
          if (m.bDiagnosed && !Malady.hasDiscoveredCure(m.sMaladyName)) {
            return true;
          }
        }
      }
      return false;
    },
  },
  // Lua: IllnessNoDoctor — HINTSX047TEXT
  {
    id: 'IllnessNoDoctor',
    sLC: 'HINTSX047TEXT',
    check: (ctx) => {
      if (haveDoctor(ctx)) return false;
      for (const c of ctx.characters) {
        if (!c.maladies) continue;
        for (const m of c.maladies) {
          if (m.bSymptomatic) return true;
        }
      }
      return false;
    },
  },
  // Lua: CitizenIncapacitatedNoDoctor — HINTSX049TEXT
  {
    id: 'CitizenIncapacitatedNoDoctor',
    sLC: 'HINTSX049TEXT',
    check: (ctx) => {
      if (haveDoctor(ctx)) return false;
      for (const c of ctx.characters) {
        if (!c.maladies) continue;
        const incap = c.maladies.some(m => m.sType === 'MajorInjury' && m.bSymptomatic);
        if (incap) return true;
      }
      return false;
    },
  },
  // Lua: NoPower — HINTSX050TEXT
  {
    id: 'NoPower',
    sLC: 'HINTSX050TEXT',
    check: (ctx) => noPowerCheck(ctx),
  },
  // Lua: UnmetPowerNeeds — HINTSX051TEXT
  {
    id: 'UnmetPowerNeeds',
    sLC: 'HINTSX051TEXT',
    check: (ctx) => {
      if (noPowerCheck(ctx)) return false;
      const playerRooms = getPlayerRooms(ctx);
      return playerRooms.some(r => !r.hasFullPower && !r.bBreach);
    },
  },
  // Lua: AirlockNoLocker — HINTSX052TEXT
  {
    id: 'AirlockNoLocker',
    sLC: 'HINTSX052TEXT',
    check: (ctx) => {
      const airlockRooms = ctx.rooms.filter(r => r.zone === 'AIRLOCK');
      if (airlockRooms.length === 0) return false;
      // Check if any airlock room lacks a suit locker
      const roomsWithLocker = new Set<HintRoom>();
      for (const o of ctx.objects) {
        if (o.sName === 'AirlockLocker' && isBuilt(o) && !o.bSlatedForVaporize && o.rRoom) {
          roomsWithLocker.add(o.rRoom);
        }
      }
      return airlockRooms.some(r => !roomsWithLocker.has(r));
    },
  },
  // Lua: CitizenLowDutyAffinity — HINTSX053TEXT, display=30, pri=0
  {
    id: 'CitizenLowDutyAffinity',
    sLC: 'HINTSX053TEXT',
    nDisplayTimeBeforeHide: 30,
    nPriority: 0,
    check: (ctx) => {
      for (const c of ctx.characters) {
        if (c.getJobAffinity) {
          const affinity = c.getJobAffinity();
          if (affinity <= -8) return true;
        }
      }
      return false;
    },
  },
  // Lua: UnassignedResidences — HINTSX054TEXT, timeTrueBeforeDisplay=10, display=30
  {
    id: 'UnassignedResidences',
    sLC: 'HINTSX054TEXT',
    nTimeTrueBeforeDisplay: 10,
    nDisplayTimeBeforeHide: 30,
    check: (ctx) => {
      const beds = ctx.objects.filter(o => o.sName === 'Bed' && isBuilt(o));
      if (beds.length === 0) return false;
      if (beds.length < ctx.population) return false;
      const nUsed = beds.filter(o => o.sOwner != null).length;
      return nUsed < ctx.population;
    },
  },
  // Lua: NoShelving — HINTSX055TEXT, pri=0
  {
    id: 'NoShelving',
    sLC: 'HINTSX055TEXT',
    nPriority: 0,
    check: (ctx) => {
      // Simplified: if population decent-sized and no shelving objects
      if (ctx.population < 4) return false;
      const shelves = countObjects(ctx, ['Shelf', 'BookShelf', 'ShelvingUnit', 'Shelf_Level2']);
      return shelves === 0;
    },
  },
  // Lua: PowerHoliday — HINTSX056TEXT
  {
    id: 'PowerHoliday',
    sLC: 'HINTSX056TEXT',
    check: (ctx) => {
      // Power holiday = power outage event. Check if power is low and
      // there's a general power deficit (proxy for holiday).
      if (noPowerCheck(ctx)) return false;
      const playerRooms = getPlayerRooms(ctx);
      const unpowered = playerRooms.filter(r => !r.hasFullPower && !r.bBreach);
      // Only fire if a significant fraction of rooms are underpowered
      return unpowered.length > playerRooms.length / 2 && playerRooms.length > 2;
    },
  },
  // Lua: IncapacitatedTroublemaker — HINTSX057TEXT
  {
    id: 'IncapacitatedTroublemaker',
    sLC: 'HINTSX057TEXT',
    check: (ctx) => {
      for (const c of ctx.characters) {
        if (!c.bRampaging) continue;
        const incap = c.maladies?.some(m => m.sType === 'MajorInjury' && m.bSymptomatic) ?? false;
        if (incap && !c.tAssignedToBrig) return true;
      }
      return false;
    },
  },
  // Lua: MinersNoMining — HINTSX058TEXT, display=60, pri=0
  {
    id: 'MinersNoMining',
    sLC: 'HINTSX058TEXT',
    nDisplayTimeBeforeHide: 60,
    nPriority: 0,
    check: (ctx) => {
      if (countJob(ctx, MINER) === 0) return false;
      // Need refineries (Lua checks shelving functionality, we check refineries)
      const nRefineries = countObjects(ctx, ['RefineryDropoff', 'RefineryDropoffLevel2']);
      if (nRefineries === 0) return false;
      return !hasAnyCommand(ctx, 'mine');
    },
  },
];

// ── HintSystem class ───────────────────────────────────────────────────

export class HintSystem {
  private shownHints: Set<string> = new Set(); // kept for save/load compat
  private providers: HintProviders;
  private trueSince: Map<string, number> = new Map();
  private lastShownTime: Map<string, number> = new Map();
  private suppressUntil = 0;
  /** Min seconds between re-showing the same hint */
  private static readonly HINT_COOLDOWN = 120;
  private tickAccum = 0;
  private static readonly CHECK_INTERVAL = 5;

  constructor(providers: HintProviders) {
    this.providers = providers;
  }

  private createContext(): HintContext {
    const providedObjects = this.providers.getObjects?.();
    const objects = providedObjects ?? EnvObjectManager.getObjects();
    const providedCommands = this.providers.getCommands?.();
    const commands = providedCommands ?? CommandQueue.getAllActive().map((c) => ({ type: c.type, status: c.status }));
    const roomsFromProvider = this.providers.getRooms?.() ?? [];
    const roomRefs = new Set<HintRoom>();
    for (const room of roomsFromProvider) roomRefs.add(room);
    for (const o of objects) {
      if (o.rRoom) roomRefs.add(o.rRoom);
    }
    return {
      hasEnclosedRooms: this.providers.hasEnclosedRooms(),
      hasZonedRoom: this.providers.hasZonedRoom(),
      hasStartedResearch: this.providers.hasStartedResearch(),
      hasBuiltObject: this.providers.hasBuiltObject(),
      population: this.providers.getPopulation(),
      hasHostiles: this.providers.hasHostiles(),
      rooms: Array.from(roomRefs),
      characters: this.providers.getCharacters?.() ?? [],
      objects,
      commands,
      matter: this.providers.getMatter?.() ?? GameRules.nMatter,
      hasActiveFires: this.providers.hasActiveFires?.() ?? false,
      hasBeaconPlaced: this.providers.hasBeaconPlaced?.() ?? false,
      activeResearch: this.providers.getActiveResearch?.() ?? null,
      inEditMode: this.providers.inEditMode?.() ?? false,
    };
  }

  update(dt: number) {
    this.tickAccum += dt;
    if (this.tickAccum < HintSystem.CHECK_INTERVAL) return;
    this.tickAccum -= HintSystem.CHECK_INTERVAL;
    if (GameRules.elapsedTime < this.suppressUntil) return;

    const ctx = this.createContext();
    let selected: HintDef | null = null;
    let bestPriority = -1;
    const now = GameRules.elapsedTime;

    for (const hint of HINTS) {
      // Lua: hints can re-trigger after cooldown (not permanently consumed)
      const lastShown = this.lastShownTime.get(hint.id);
      if (lastShown !== undefined && (now - lastShown) < HintSystem.HINT_COOLDOWN) continue;

      if (!hint.check(ctx)) {
        this.trueSince.delete(hint.id);
        continue;
      }

      if (!this.trueSince.has(hint.id)) {
        this.trueSince.set(hint.id, now);
      }
      const timeTrue = now - (this.trueSince.get(hint.id) ?? now);
      if (timeTrue < (hint.nTimeTrueBeforeDisplay ?? 0)) {
        continue;
      }

      const priority = hint.nPriority ?? 2;
      if (priority > bestPriority) {
        selected = hint;
        bestPriority = priority;
      }
    }

    if (!selected) return;
    // Lua Hint.lua: hints are NOT permanently consumed — they re-trigger when
    // conditions return after nDisplayTimeBeforeHide expires. We use suppressUntil
    // to prevent spam but don't permanently add to shownHints.
    this.trueSince.delete(selected.id);
    Base.addAlert('hint', line(selected.sLC));
    this.suppressUntil = now + (selected.nDisplayTimeBeforeHide ?? 30);
    // Track last-shown time per hint to avoid showing same hint too frequently
    this.lastShownTime.set(selected.id, now);
  }

  getShownHints(): string[] {
    return Array.from(this.shownHints);
  }

  getSaveData() {
    return Array.from(this.shownHints);
  }

  loadSaveData(data: string[]) {
    this.shownHints = new Set(data);
    this.trueSince.clear();
  }
}
