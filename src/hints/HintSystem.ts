/**
 * HintSystem.ts — Contextual tutorial hints.
 * Shows tips when specific game conditions are met for the first time.
 */

import { Base } from '../core/Base';
import { CommandQueue } from '../core/CommandQueue';
import { GameRules } from '../core/GameRules';
import { BUILDER, MINER, TECHNICIAN } from '../characters/CharacterConstants';
import { EnvObjectManager } from '../envobjects/EnvObjectManager';
import { line } from '../localization/Localization';

interface HintRoom {
  zone?: string;
  sealed?: boolean;
  oxygen?: number;
}

interface HintCharacter {
  getJob?: () => number;
  isAlive?: () => boolean;
  bLowOxygen?: boolean;
  heldItem?: string | null;
  tStats?: { nTeam?: number };
}

interface HintObject {
  sName: string;
  bBuilt?: boolean;
  nCondition?: number;
  isFunctioning?: () => boolean;
  rRoom?: HintRoom | null;
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
}

const LOW_MATTER_WARNING = 500;

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

const HINTS: HintDef[] = [
  {
    id: 'build_room',
    sLC: 'HINTSX016TEXT',
    nPriority: 2,
    check: (ctx) => !ctx.hasEnclosedRooms,
  },
  {
    id: 'zone_room',
    sLC: 'HINTSX026TEXT',
    nPriority: 2,
    check: (ctx) => ctx.hasEnclosedRooms && !ctx.hasZonedRoom,
  },
  {
    id: 'place_objects',
    sLC: 'HINTSX050TEXT',
    nPriority: 2,
    check: (ctx) => ctx.hasZonedRoom && !ctx.hasBuiltObject,
  },
  {
    id: 'research',
    sLC: 'HINTSX038TEXT',
    nPriority: 2,
    check: (ctx) => ctx.hasBuiltObject && !ctx.hasStartedResearch,
  },
  {
    id: 'combat',
    sLC: 'ALERTS017TEXT',
    nPriority: 3,
    check: (ctx) => ctx.hasHostiles,
  },

  {
    id: 'noMoraleObjects',
    sLC: 'HINTSX059TEXT',
    nPriority: 2,
    check: (ctx) => {
      const monitors = countObjects(ctx, ['TVScreen1']);
      const plants = countObjects(ctx, ['HousePlant', 'BulbousPlant', 'StrangePlant']);
      return monitors < 2 || plants < 2;
    },
  },
  {
    id: 'YouCanForceOpenADoor',
    sLC: 'HINTSX027TEXT',
    nPriority: 2,
    check: (ctx) => {
      const hasAirlockDoor = countObjects(ctx, ['Airlock']) > 0;
      return hasAirlockDoor && countWorkingObjects(ctx, ['Airlock']) === 0 && !HINTS.find(h => h.id === 'DontPutNormalDoorsOnAnAirlock')!.check(ctx);
    },
  },
  {
    id: 'DontPutNormalDoorsOnAnAirlock',
    sLC: 'HINTSX037TEXT',
    nPriority: 2,
    check: (ctx) => {
      if (!hasZone(ctx, 'AIRLOCK')) return false;
      return countObjects(ctx, ['Door', 'HeavyDoor']) > 0 && countWorkingObjects(ctx, ['Airlock']) === 0;
    },
  },
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
  {
    id: 'LowMatter',
    sLC: 'HINTSX002TEXT',
    nPriority: 2,
    nDisplayTimeBeforeHide: 30,
    check: (ctx) => ctx.matter < LOW_MATTER_WARNING,
  },
  {
    id: 'ConstructionNoBuilders',
    sLC: 'HINTSX003TEXT',
    nPriority: 2,
    check: (ctx) => countJob(ctx, BUILDER) === 0 && (hasAnyCommand(ctx, 'build_tile') || hasAnyCommand(ctx, 'build_object')),
  },
  {
    id: 'NoMiners',
    sLC: 'HINTSX007TEXT',
    nPriority: 2,
    nDisplayTimeBeforeHide: 60,
    check: (ctx) => countJob(ctx, MINER) === 0 && hasAnyCommand(ctx, 'mine'),
  },
  {
    id: 'NoRefineries',
    sLC: 'HINTSX008TEXT',
    nPriority: 2,
    check: (ctx) => {
      if (countJob(ctx, MINER) === 0) return false;
      const hasRockCarrier = ctx.characters.some((c) => c.heldItem === 'Rock');
      if (!hasRockCarrier) return false;
      return countObjects(ctx, ['RefineryDropoff', 'RefineryDropoffLevel2']) === 0;
    },
  },
  {
    id: 'LowOxygen',
    sLC: 'HINTSX010TEXT',
    nPriority: 2,
    check: (ctx) => {
      const roomLow = ctx.rooms.some((r) => typeof r.oxygen === 'number' && r.oxygen < 35);
      if (roomLow) return true;
      if (ctx.characters.length === 0) return false;
      const low = ctx.characters.filter((c) => c.bLowOxygen).length;
      return low >= Math.max(1, Math.floor(ctx.characters.length / 2));
    },
  },
  {
    id: 'NotEnoughBeds',
    sLC: 'HINTSX012TEXT',
    nPriority: 2,
    check: (ctx) => ctx.population > 0 && countObjects(ctx, ['Bed']) < ctx.population,
  },
  {
    id: 'EveryoneDead',
    sLC: 'HINTSX009TEXT',
    nPriority: 3,
    check: (ctx) => ctx.population === 0,
  },
  {
    id: 'NoFunctioningAirlocks',
    sLC: 'HINTSX015TEXT',
    nPriority: 2,
    check: (ctx) => ctx.hasEnclosedRooms && countWorkingObjects(ctx, ['Airlock']) === 0,
  },
  {
    id: 'RoomsButNoOxygen',
    sLC: 'HINTSX017TEXT',
    nPriority: 2,
    check: (ctx) => ctx.hasEnclosedRooms && !hasOxygenGeneration(ctx),
  },
  {
    id: 'NoBuilding',
    sLC: 'HINTSX016TEXT',
    nPriority: 2,
    check: (ctx) => !ctx.hasEnclosedRooms && !hasAnyCommand(ctx, 'build_tile'),
  },
  {
    id: 'PubAtCapacity',
    sLC: 'HINTSX019TEXT',
    nPriority: 2,
    check: (ctx) => {
      if (!hasZone(ctx, 'PUB')) return false;
      const bars = countWorkingObjects(ctx, ['Bar']);
      return ctx.population > Math.max(4, bars * 6);
    },
  },
  {
    id: 'PubButNoBar',
    sLC: 'HINTSX020TEXT',
    nPriority: 2,
    check: (ctx) => hasZone(ctx, 'PUB') && countObjects(ctx, ['Bar']) === 0,
  },

  {
    id: 'NoResearchLab',
    sLC: 'HINTSX039TEXT',
    nPriority: 2,
    check: (ctx) => ctx.population >= 3 && !hasZone(ctx, 'RESEARCH'),
  },
  {
    id: 'NoHospital',
    sLC: 'HINTSX045TEXT',
    nPriority: 2,
    check: (ctx) => ctx.population >= 4 && !hasZone(ctx, 'INFIRMARY'),
  },
  {
    id: 'NoFitnessZone',
    sLC: 'HINTSX019TEXT',
    nPriority: 2,
    check: (ctx) => ctx.population >= 5 && !hasZone(ctx, 'FITNESS'),
  },
  {
    id: 'NoJukebox',
    sLC: 'HINTSX020TEXT',
    nPriority: 2,
    check: (ctx) => hasZone(ctx, 'PUB') && countObjects(ctx, ['Jukebox']) === 0,
  },
  {
    id: 'NoBar',
    sLC: 'HINTSX020TEXT',
    nPriority: 2,
    check: (ctx) => hasZone(ctx, 'PUB') && countObjects(ctx, ['Bar']) === 0,
  },
  {
    id: 'NoFoodReplicator',
    sLC: 'HINTSX030TEXT',
    nPriority: 2,
    check: (ctx) => ctx.population > 0 && countObjects(ctx, ['FoodReplicator']) === 0,
  },
  {
    id: 'NoAirlocks',
    sLC: 'HINTSX015TEXT',
    nPriority: 2,
    check: (ctx) => ctx.hasEnclosedRooms && countObjects(ctx, ['Airlock']) === 0,
  },
  {
    id: 'NoBreachRepair',
    sLC: 'HINTSX005TEXT',
    nPriority: 2,
    check: (ctx) => anyBreachedRoom(ctx),
  },
  {
    id: 'NoOxygenGeneration',
    sLC: 'HINTSX017TEXT',
    nPriority: 2,
    check: (ctx) => hasZone(ctx, 'LIFESUPPORT') && !hasOxygenGeneration(ctx),
  },
  {
    id: 'NoMiningOperation',
    sLC: 'HINTSX058TEXT',
    nPriority: 2,
    check: (ctx) => countJob(ctx, MINER) > 0 && !hasAnyCommand(ctx, 'mine'),
  },
  {
    id: 'NoRefineryOperation',
    sLC: 'HINTSX008TEXT',
    nPriority: 2,
    check: (ctx) => hasZone(ctx, 'REFINERY') && countWorkingObjects(ctx, ['RefineryDropoff', 'RefineryDropoffLevel2']) === 0,
  },
];

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
