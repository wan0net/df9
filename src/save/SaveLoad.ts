/**
 * SaveLoad.ts — Game persistence system.
 * Mirrors GameRules.lua save/load: serialize grid, rooms, objects, characters, research, events.
 */

import { GameRules, SAVEGAME_VERSION } from '../core/GameRules';
import { Base, type BaseStats } from '../core/Base';
import type { TileGrid } from '../world/TileGrid';
import type { RoomManager } from '../rooms/RoomManager';
import type { EventController } from '../events/EventController';
import type { MaladyInstance } from '../malady/Malady';
import type { LogEntry } from '../characters/Log';
import { SoundManager } from '../audio/SoundManager';
import type { TutorialSaveState } from '../ui/TutorialSystem';
import { ZoneType } from '../world/ZoneType';
import { ResearchZone } from '../zones/ResearchZone';
import { tObjects } from '../envobjects/EnvObjectData';
import { ITEM_TEMPLATES } from '../inventory/InventoryData';
import { PICKUP_DEFS } from '../pickups/PickupData';
import { EVENT_DEFS } from '../events/EventData';

// ── Save data interfaces ────────────────────────────────────────

const MAX_SAVE_JSON_BYTES = 8 * 1024 * 1024;
const MAX_CHARACTERS = 5_000;
const MAX_OBJECTS = 20_000;
const MAX_AUX_ITEMS = 50_000;
const MAX_STRING_LENGTH = 4_096;
const VALID_TILE_TYPES = new Set([1, 4, 5, 6, 8, 9, 10]);
const hasOwn = (record: object, key: string) =>
  Object.prototype.hasOwnProperty.call(record, key);
const isValidTileType = (tile: unknown) =>
  isInteger(tile) && (VALID_TILE_TYPES.has(tile) || (tile >= 1_024 && tile <= 1_124));

export interface CharSaveData {
  id: number;
  tileX: number;
  tileY: number;
  name: string;
  job: number;
  team: number;
  race?: number;
  hp: number;
  maxHP: number;
  status: number;
  xp: number;
  competency: Record<number, number>;
  morale: number;
  anger: number;
  nRemainingDutyTime: number;
  weapon: string | null;
  bSpacesuit: boolean;
  nSuitOxygen: number;
  maladies: MaladyInstance[];
  tLog?: LogEntry[];
  needs?: { hunger: number; energy: number; amusement: number; social: number; oxygen: number; duty?: number };
  inventory?: { sTemplate: string; sName: string; nCount: number }[];
  heldItem?: string | null;
}

export interface ObjSaveData {
  schemaVersion?: 1;
  kind?: 'object' | 'door';
  sName?: string;
  name?: string;
  tileX: number;
  tileY: number;
  bFlipX?: boolean;
  bFlipY?: boolean;
  bBuilt?: boolean;
  wallTileX?: number;
  wallTileY?: number;
  nCondition?: number;
  bActive?: boolean;
  bHasPower?: boolean;
  nTempPowerLossEnd?: number;
  sUniqueName?: string;
  sBuilderName?: string;
  sBuildTime?: string;
  operation?: number;
  bSmashedOpen?: boolean;
  secondTileX?: number;
  secondTileY?: number;
  /** Legacy version-7 fields. */
  built?: boolean;
  condition?: number;
  hasPower?: boolean;
}

export interface ResearchSaveData {
  active: string | null;
  progress: number;
  completed: string[];
  progressByKey?: Record<string, number>;
}

export interface SaveData {
  version: number;
  nMatter: number;
  simTime: number;
  elapsedTime: number;
  SPACEDATE_BASE: number;
  playerTimeScale: number;
  gridWidth: number;
  gridHeight: number;
  gridData: number[];
  characters: CharSaveData[];
  objects: ObjSaveData[];
  research: ResearchSaveData;
  roomZones: { roomId: number; zone: string; oxygen?: number; researchProject?: string | null }[];
  events?: ReturnType<EventController['getSaveData']>;
  topics?: { tTopics: Record<string, { name: string; category: string }>; counter: number };
  tStats?: BaseStats;
  factionData?: { teamFactions: [number, number][]; nNextTeamID: number };
  fires?: { tTiles: Record<string, number>; tFlames: Record<string, number> };
  commands?: { type: string; tileX: number; tileY: number; objectName?: string }[];
  pickups?: { sName: string; tileX: number; tileY: number }[];
  powerHolidayEndTime?: number | null;
  /** Per-tile O2 grid (RLE compressed). */
  o2Grid?: number[];
  /** Sandbox mode (Lua NewBase.lua: disables hostile events until 100+ pop). */
  bSandboxMode?: boolean;
  /** Cutaway mode (Lua GameRules.cutawayMode). */
  cutawayMode?: boolean;
  /** Disaster mode (Lua GameRules.bDisasterMode). */
  bDisasterMode?: boolean;
  /** Hint state flags for tutorial progression. */
  bHasHadEnclosedRooms?: boolean;
  bHasZoned?: boolean;
  bHasStartedResearch?: boolean;
  cameraX?: number;
  cameraY?: number;
  /** S-6: Missing save fields matching Lua */
  nLastDutyAccident?: number;
  nLastNewShip?: number;
  cameraZoom?: number;
  bTutorialMode?: boolean;
  tutorialStage?: number;
  tutorialState?: TutorialSaveState;
  tutorialFlags?: Record<string, boolean>;
  bMuted?: boolean;
  masterVolume?: number;
  /** S-7: Per-category volume levels */
  sfxVolume?: number;
  musicVolume?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteNumber(value: unknown, min = -Number.MAX_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function isInteger(value: unknown, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER): value is number {
  return Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
}

function isString(value: unknown, maxLength = MAX_STRING_LENGTH): value is string {
  return typeof value === 'string' && value.length <= maxLength;
}

function isOptionalBoolean(value: unknown): boolean {
  return value === undefined || typeof value === 'boolean';
}

function isOptionalFinite(value: unknown, min?: number, max?: number): boolean {
  return value === undefined || isFiniteNumber(value, min, max);
}

function isBoundedArray(value: unknown, maxLength: number): value is unknown[] {
  return Array.isArray(value) && value.length <= maxLength;
}

function validateCharacter(value: unknown, width: number, height: number): value is CharSaveData {
  if (!isRecord(value)) return false;
  if (!isInteger(value.id, 0) || !isInteger(value.tileX, 0, width - 1) || !isInteger(value.tileY, 0, height - 1)) return false;
  if (!isString(value.name, 256) || !isInteger(value.job, 0, 100) || !isInteger(value.team, -100_000, 100_000)) return false;
  if (value.race !== undefined && !isInteger(value.race, 0, 100)) return false;
  if (!isFiniteNumber(value.hp, 0, 1_000_000) || !isFiniteNumber(value.maxHP, 1, 1_000_000) || value.hp > value.maxHP) return false;
  if (!isInteger(value.status, 0, 100) || !isFiniteNumber(value.xp, 0, 1_000_000_000)) return false;
  if (!isRecord(value.competency) || Object.keys(value.competency).length > 128 ||
      !Object.values(value.competency).every(v => isFiniteNumber(v, -1_000, 1_000))) return false;
  if (!isFiniteNumber(value.morale, -1_000, 1_000) || !isFiniteNumber(value.anger, -1_000, 1_000) ||
      !isFiniteNumber(value.nRemainingDutyTime, -1_000_000, 1_000_000)) return false;
  if (!(value.weapon === null || isString(value.weapon, 256)) || typeof value.bSpacesuit !== 'boolean' ||
      !isFiniteNumber(value.nSuitOxygen, 0, 1_000_000)) return false;
  if (!isBoundedArray(value.maladies, 128) || !value.maladies.every(isRecord)) return false;
  if (value.needs !== undefined) {
    if (!isRecord(value.needs)) return false;
    for (const key of ['hunger', 'energy', 'amusement', 'social', 'oxygen'] as const) {
      if (!isFiniteNumber(value.needs[key], -1_000, 1_000)) return false;
    }
    if (!isOptionalFinite(value.needs.duty, -1_000, 1_000)) return false;
  }
  if (value.inventory !== undefined) {
    if (!isBoundedArray(value.inventory, 1_000) || !value.inventory.every(item =>
      isRecord(item) && isString(item.sTemplate, 256) && hasOwn(ITEM_TEMPLATES, item.sTemplate) &&
      isString(item.sName, 1_024) &&
      isInteger(item.nCount, 1, 1_000_000))) return false;
  }
  if (value.tLog !== undefined && (!isBoundedArray(value.tLog, 1_000) || !value.tLog.every(isRecord))) return false;
  return value.heldItem === undefined || value.heldItem === null ||
    (isString(value.heldItem, 256) && hasOwn(PICKUP_DEFS, value.heldItem));
}

function validateObject(value: unknown, width: number, height: number): value is ObjSaveData {
  if (!isRecord(value) || !isInteger(value.tileX, 0, width - 1) || !isInteger(value.tileY, 0, height - 1)) return false;
  const name = value.sName ?? value.name;
  if (!isString(name, 256) || !hasOwn(tObjects, name)) return false;
  if (value.schemaVersion !== undefined && value.schemaVersion !== 1) return false;
  if (value.kind !== undefined && value.kind !== 'object' && value.kind !== 'door') return false;
  for (const key of ['bFlipX', 'bFlipY', 'bBuilt', 'bActive', 'bHasPower', 'bSmashedOpen', 'built'] as const) {
    if (!isOptionalBoolean(value[key])) return false;
  }
  for (const key of ['sUniqueName', 'sBuilderName', 'sBuildTime'] as const) {
    if (value[key] !== undefined && !isString(value[key], 1_024)) return false;
  }
  if (!isOptionalFinite(value.nCondition, 0, 100) || !isOptionalFinite(value.condition, 0, 100) ||
      !isOptionalFinite(value.nTempPowerLossEnd, -1, 1_000_000_000)) return false;
  if (value.hasPower !== undefined && typeof value.hasPower !== 'boolean') return false;
  if (value.operation !== undefined && !isInteger(value.operation, 1, 3)) return false;
  return (value.secondTileX === undefined || isInteger(value.secondTileX, -1, width - 1)) &&
    (value.secondTileY === undefined || isInteger(value.secondTileY, -1, height - 1)) &&
    (value.wallTileX === undefined || isInteger(value.wallTileX, -1, width - 1)) &&
    (value.wallTileY === undefined || isInteger(value.wallTileY, -1, height - 1));
}

function validateCoordinateKey(key: string, width: number, height: number): boolean {
  const match = /^(-?\d+),(-?\d+)$/.exec(key);
  return !!match &&
    isInteger(Number(match[1]), 0, width - 1) &&
    isInteger(Number(match[2]), 0, height - 1);
}

function validateFiniteRecord(
  value: unknown,
  maxEntries: number,
  min: number,
  max: number,
  keyValidator: (key: string) => boolean = key => isString(key, 256),
): value is Record<string, number> {
  return isRecord(value) &&
    Object.keys(value).length <= maxEntries &&
    Object.entries(value).every(([key, entry]) =>
      keyValidator(key) && isFiniteNumber(entry, min, max));
}

function validateEventEntry(value: unknown): boolean {
  return isRecord(value) &&
    isString(value.defName, 256) && hasOwn(EVENT_DEFS, value.defName) &&
    isFiniteNumber(value.scheduledTime, 0, 1_000_000_000) &&
    isFiniteNumber(value.alertTime, -1_000_000_000, 1_000_000_000) &&
    typeof value.alerted === 'boolean' &&
    isInteger(value.nFailures, 0, 1_000_000) &&
    typeof value.bFailed === 'boolean';
}

function validateEvents(value: unknown): boolean {
  if (!isRecord(value) ||
      typeof value.forecastGenerated !== 'boolean' ||
      typeof value.compoundEventFired !== 'boolean' ||
      !isOptionalBoolean(value.bRanMegaEvent) ||
      !isOptionalFinite(value.nMegaEventStartTime, 0, 1_000_000_000) ||
      !validateFiniteRecord(value.galaxyValues, 128, -1_000_000, 1_000_000) ||
      !isBoundedArray(value.forecast, 1_000) ||
      !value.forecast.every(validateEventEntry)) return false;
  if (value.prevEvents !== undefined &&
      (!isBoundedArray(value.prevEvents, 1_000) ||
       !value.prevEvents.every(event =>
         isRecord(event) &&
         isString(event.sEventType, 256) &&
         isFiniteNumber(event.nCompletionTime, 0, 1_000_000_000)))) return false;
  if (value.currentEvent === undefined || value.currentEvent === null) return true;
  if (!isRecord(value.currentEvent) ||
      !isString(value.currentEvent.defName, 256) ||
      !hasOwn(EVENT_DEFS, value.currentEvent.defName) ||
      !isInteger(value.currentEvent.status, 0, 2) ||
      !isFiniteNumber(value.currentEvent.startTime, 0, 1_000_000_000) ||
      !isFiniteNumber(value.currentEvent.elapsedTime, 0, 1_000_000_000)) return false;
  const entry = value.currentEvent.entry;
  return entry === undefined || entry === null || validateEventEntry({
    ...entry as object,
    defName: value.currentEvent.defName,
  });
}

function validateTopics(value: unknown): boolean {
  if (!isRecord(value) || !isInteger(value.counter, 0, 1_000_000_000) ||
      !isRecord(value.tTopics) || Object.keys(value.tTopics).length > MAX_AUX_ITEMS) return false;
  return Object.entries(value.tTopics).every(([key, topic]) =>
    isString(key, 256) &&
    isRecord(topic) &&
    isString(topic.name, 1_024) &&
    isString(topic.category, 256));
}

function validateFires(value: unknown, width: number, height: number): boolean {
  if (!isRecord(value)) return false;
  const validKey = (key: string) => validateCoordinateKey(key, width, height);
  return validateFiniteRecord(value.tTiles, MAX_AUX_ITEMS, 0, 1_000_000, validKey) &&
    validateFiniteRecord(value.tFlames, MAX_AUX_ITEMS, 0, 1_000_000, validKey);
}

function validateTutorialState(value: unknown): boolean {
  return isRecord(value) &&
    typeof value.active === 'boolean' &&
    isInteger(value.currentStage, 0, 20) &&
    isFiniteNumber(value.stageTimer, 0, 1_000_000) &&
    isBoundedArray(value.completedConditions, 100) &&
    value.completedConditions.every(condition => isString(condition, 256));
}

export function validateSaveData(value: unknown, width: number, height: number): value is SaveData {
  if (!isRecord(value) || value.version !== SAVEGAME_VERSION) return false;
  if (!isInteger(value.gridWidth, 1, 512) || !isInteger(value.gridHeight, 1, 512) ||
      value.gridWidth !== width || value.gridHeight !== height) return false;
  const cells = width * height;
  if (!isBoundedArray(value.gridData, cells) || value.gridData.length !== cells ||
      !value.gridData.every(isValidTileType)) return false;
  if (!isFiniteNumber(value.nMatter, 0, 1_000_000_000) || !isFiniteNumber(value.simTime, 0, 1_000_000_000) ||
      !isFiniteNumber(value.elapsedTime, 0, 1_000_000_000) || !isFiniteNumber(value.SPACEDATE_BASE, -1_000_000_000, 1_000_000_000) ||
      ![0, 0.25, 0.5, 1, 2, 4].includes(value.playerTimeScale as number)) return false;
  if (!isBoundedArray(value.characters, MAX_CHARACTERS) ||
      !value.characters.every(char => validateCharacter(char, width, height))) return false;
  if (!isBoundedArray(value.objects, MAX_OBJECTS) ||
      !value.objects.every(obj => validateObject(obj, width, height))) return false;
  if (!isRecord(value.research) || !(value.research.active === null || isString(value.research.active, 256)) ||
      !isFiniteNumber(value.research.progress, 0, 1_000_000) ||
      !isBoundedArray(value.research.completed, 10_000) ||
      !value.research.completed.every(item => isString(item, 256))) return false;
  if (value.research.progressByKey !== undefined &&
      (!isRecord(value.research.progressByKey) ||
       Object.keys(value.research.progressByKey).length > 10_000 ||
       !Object.entries(value.research.progressByKey).every(([key, progress]) =>
         isString(key, 256) && isFiniteNumber(progress, 0, 1_000_000)))) return false;
  if (!isBoundedArray(value.roomZones, MAX_AUX_ITEMS) || !value.roomZones.every(zone =>
    isRecord(zone) && isInteger(zone.roomId, 0) &&
    typeof zone.zone === 'string' && Object.values(ZoneType).includes(zone.zone as ZoneType) &&
    isOptionalFinite(zone.oxygen, 0, 255) &&
    (zone.researchProject === undefined || zone.researchProject === null || isString(zone.researchProject, 256)))) return false;
  if (value.commands !== undefined &&
      (!isBoundedArray(value.commands, MAX_AUX_ITEMS) ||
       !value.commands.every(command =>
         isRecord(command) &&
         ['mine', 'build_object', 'build_tile', 'demolish'].includes(command.type as string) &&
         isInteger(command.tileX, 0, width - 1) &&
         isInteger(command.tileY, 0, height - 1) &&
         (command.objectName === undefined ||
          (isString(command.objectName, 256) && hasOwn(tObjects, command.objectName)))))) return false;
  if (value.pickups !== undefined &&
      (!isBoundedArray(value.pickups, MAX_AUX_ITEMS) ||
       !value.pickups.every(pickup =>
         isRecord(pickup) &&
         isString(pickup.sName, 256) && hasOwn(PICKUP_DEFS, pickup.sName) &&
         isInteger(pickup.tileX, 0, width - 1) &&
         isInteger(pickup.tileY, 0, height - 1)))) return false;
  if (value.events !== undefined && !validateEvents(value.events)) return false;
  if (value.topics !== undefined && !validateTopics(value.topics)) return false;
  if (value.fires !== undefined && !validateFires(value.fires, width, height)) return false;
  if (value.factionData !== undefined) {
    if (!isRecord(value.factionData) ||
        !isBoundedArray(value.factionData.teamFactions, MAX_AUX_ITEMS) ||
        !value.factionData.teamFactions.every(pair =>
          Array.isArray(pair) && pair.length === 2 &&
          isInteger(pair[0], -100_000, 100_000) &&
          isInteger(pair[1], 0, 100)) ||
        !isInteger(value.factionData.nNextTeamID, 0, 1_000_000)) return false;
  }
  if (value.tStats !== undefined &&
      (!isRecord(value.tStats) ||
       Object.keys(value.tStats).length > 128 ||
       !Object.values(value.tStats).every(stat => isFiniteNumber(stat, 0, 1_000_000_000)))) return false;
  if (value.tutorialState !== undefined && !validateTutorialState(value.tutorialState)) return false;
  if (value.tutorialFlags !== undefined &&
      (!isRecord(value.tutorialFlags) ||
       Object.keys(value.tutorialFlags).length > 100 ||
       !Object.entries(value.tutorialFlags).every(([key, flag]) =>
         isString(key, 256) && typeof flag === 'boolean'))) return false;
  if (value.o2Grid !== undefined) {
    if (!isBoundedArray(value.o2Grid, cells * 2) || value.o2Grid.length % 2 !== 0) return false;
    let decoded = 0;
    for (let i = 0; i < value.o2Grid.length; i += 2) {
      const count = value.o2Grid[i];
      const oxygen = value.o2Grid[i + 1];
      if (!isInteger(count, 1, 65_535) || !isInteger(oxygen, 0, 65_535)) return false;
      decoded += count;
    }
    if (decoded !== cells) return false;
  }
  for (const key of ['bSandboxMode', 'cutawayMode', 'bDisasterMode', 'bTutorialMode',
    'bHasHadEnclosedRooms', 'bHasZoned', 'bHasStartedResearch', 'bMuted'] as const) {
    if (!isOptionalBoolean(value[key])) return false;
  }
  for (const key of ['cameraX', 'cameraY', 'cameraZoom', 'nLastDutyAccident', 'nLastNewShip',
    'masterVolume', 'sfxVolume', 'musicVolume'] as const) {
    if (!isOptionalFinite(value[key], -1_000_000_000, 1_000_000_000)) return false;
  }
  if (value.tutorialStage !== undefined && !isInteger(value.tutorialStage, 0, 20)) return false;
  if (value.powerHolidayEndTime !== undefined && value.powerHolidayEndTime !== null &&
      !isFiniteNumber(value.powerHolidayEndTime, 0, 1_000_000_000)) return false;
  try {
    return JSON.stringify(value).length <= MAX_SAVE_JSON_BYTES;
  } catch {
    return false;
  }
}

export class SaveLoadSystem {
  private grid: TileGrid;
  private roomManager: RoomManager;

  /** External data providers set from main.ts */
  getCharacterData: (() => CharSaveData[]) | null = null;
  getObjectData: (() => ObjSaveData[]) | null = null;
  getResearchData: (() => ResearchSaveData) | null = null;
  getEventData: (() => ReturnType<EventController['getSaveData']>) | null = null;
  getTopicsData: (() => { tTopics: Record<string, { name: string; category: string }>; counter: number }) | null = null;
  getFireData: (() => { tTiles: Record<string, number>; tFlames: Record<string, number> }) | null = null;
  getCommandData: (() => { type: string; tileX: number; tileY: number; objectName?: string }[]) | null = null;
  getPickupData: (() => { sName: string; tileX: number; tileY: number }[]) | null = null;
  getCameraData: (() => { cameraX: number; cameraY: number; cameraZoom: number }) | null = null;
  getTutorialStage: (() => number) | null = null;
  getTutorialState: (() => TutorialSaveState) | null = null;
  getTutorialFlags: (() => Record<string, boolean>) | null = null;
  getAudioData: (() => { bMuted: boolean; masterVolume: number; sfxVolume: number; musicVolume: number }) | null = null;

  loadCharacterData: ((data: CharSaveData[]) => void) | null = null;
  loadObjectData: ((data: ObjSaveData[]) => void) | null = null;
  loadResearchData: ((data: ResearchSaveData) => void) | null = null;
  loadEventData: ((data: ReturnType<EventController['getSaveData']>) => void) | null = null;
  loadTopicsData: ((data: { tTopics: Record<string, { name: string; category: string }>; counter: number }) => void) | null = null;
  loadFireData: ((data: { tTiles: Record<string, number>; tFlames: Record<string, number> }) => void) | null = null;
  loadCommandData: ((data: { type: string; tileX: number; tileY: number; objectName?: string }[]) => void) | null = null;
  loadPickupData: ((data: { sName: string; tileX: number; tileY: number }[]) => void) | null = null;
  loadCameraData: ((data: { cameraX: number; cameraY: number; cameraZoom: number }) => void) | null = null;
  loadTutorialStage: ((stage: number) => void) | null = null;
  loadTutorialState: ((state: TutorialSaveState) => void) | null = null;
  loadTutorialFlags: ((flags: Record<string, boolean>) => void) | null = null;
  loadAudioData: ((data: { bMuted: boolean; masterVolume: number; sfxVolume: number; musicVolume: number }) => void) | null = null;

  constructor(grid: TileGrid, roomManager: RoomManager) {
    this.grid = grid;
    this.roomManager = roomManager;
  }

  /** Serialize the full game state to a save object. */
  save(): SaveData {
    // Serialize grid
    const gridData: number[] = [];
    for (let y = 0; y < this.grid.height; y++) {
      for (let x = 0; x < this.grid.width; x++) {
        gridData.push(this.grid.get(x, y));
      }
    }

    // Room zones
    const roomZones = this.roomManager.getRooms().map(r => ({
      roomId: r.id,
      zone: r.zone as string,
      oxygen: r.oxygen,
      researchProject: r.zoneObj instanceof ResearchZone ? r.zoneObj.getActiveResearch() : undefined,
    }));

    const cameraData = this.getCameraData?.();
    const tutorialStage = this.getTutorialStage?.() ?? this.getTutorialStageFromDebugBridge();
    const audioData = this.getAudioData?.() ?? {
      bMuted: SoundManager.isMuted(),
      masterVolume: SoundManager.getMasterVolume(),
      sfxVolume: SoundManager.getSfxVolume(),
      musicVolume: SoundManager.getMusicVolume(),
    };

    return {
      version: SAVEGAME_VERSION,
      nMatter: GameRules.nMatter,
      simTime: GameRules.simTime,
      elapsedTime: GameRules.elapsedTime,
      SPACEDATE_BASE: GameRules.SPACEDATE_BASE,
      playerTimeScale: GameRules.playerTimeScale,
      gridWidth: this.grid.width,
      gridHeight: this.grid.height,
      gridData,
      characters: this.getCharacterData?.() ?? [],
      objects: this.getObjectData?.() ?? [],
      research: this.getResearchData?.() ?? { active: null, progress: 0, completed: [] },
      roomZones,
      events: this.getEventData?.(),
      topics: this.getTopicsData?.(),
      tStats: { ...Base.tStats },
      factionData: Base.getFactionSaveData(),
      fires: this.getFireData?.(),
      commands: this.getCommandData?.(),
      pickups: this.getPickupData?.(),
      powerHolidayEndTime: GameRules.powerHolidayEndTime,
      o2Grid: this.grid.getO2Data(),
      bSandboxMode: GameRules.bSandboxMode,
      cutawayMode: GameRules.cutawayMode,
      bDisasterMode: GameRules.bDisasterMode,
      bHasHadEnclosedRooms: GameRules.bHasHadEnclosedRooms,
      bHasZoned: GameRules.bHasZoned,
      bHasStartedResearch: GameRules.bHasStartedResearch,
      nLastDutyAccident: GameRules.nLastDutyAccident,
      nLastNewShip: GameRules.nLastNewShip,
      cameraX: cameraData?.cameraX,
      cameraY: cameraData?.cameraY,
      cameraZoom: cameraData?.cameraZoom,
      bTutorialMode: GameRules.bTutorialMode,
      tutorialStage,
      tutorialState: this.getTutorialState?.(),
      tutorialFlags: this.getTutorialFlags?.(),
      bMuted: audioData.bMuted,
      masterVolume: audioData.masterVolume,
      sfxVolume: audioData.sfxVolume,
      musicVolume: audioData.musicVolume,
    };
  }

  /** Save to localStorage. */
  saveToStorage(slotName = 'SpacebaseDF9AutoSave') {
    const data = this.save();
    try {
      localStorage.setItem(slotName, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('Save failed:', e);
      return false;
    }
  }

  /** Load from localStorage. Returns true if successful. */
  loadFromStorage(slotName = 'SpacebaseDF9AutoSave'): boolean {
    try {
      const json = localStorage.getItem(slotName);
      if (!json) return false;
      if (json.length > MAX_SAVE_JSON_BYTES) return false;
      const data: unknown = JSON.parse(json);
      return this.load(data);
    } catch (e) {
      console.error('Load failed:', e);
      return false;
    }
  }

  /** Restore game state from save data. */
  load(data: unknown): boolean {
    if (!validateSaveData(data, this.grid.width, this.grid.height)) {
      console.warn('Incompatible save version');
      return false;
    }
    let priorState: SaveData;
    try {
      priorState = this.save();
    } catch (error) {
      console.error('Could not snapshot state before load:', error);
      return false;
    }
    try {
      this.applyValidatedSave(data);
      return true;
    } catch (error) {
      console.error('Load failed; restoring prior state:', error);
      try {
        this.applyValidatedSave(priorState);
      } catch (rollbackError) {
        console.error('Load rollback failed:', rollbackError);
      }
      return false;
    }
  }

  private applyValidatedSave(data: SaveData): void {
    // Restore GameRules state
    GameRules.nMatter = data.nMatter;
    GameRules.simTime = data.simTime;
    GameRules.elapsedTime = data.elapsedTime;
    GameRules.SPACEDATE_BASE = data.SPACEDATE_BASE;
    GameRules.setTimeScale(data.playerTimeScale);

    // Restore power holiday state
    if (data.powerHolidayEndTime !== undefined) {
      GameRules.powerHolidayEndTime = data.powerHolidayEndTime ?? null;
      GameRules.bPowerHoliday = GameRules.powerHolidayEndTime !== null;
    } else {
      // Old save without power holiday data — grant grace period (Lua compat)
      GameRules.powerHolidayEndTime = GameRules.elapsedTime + 600;
      GameRules.bPowerHoliday = true;
    }

    // Restore sandbox mode
    GameRules.bSandboxMode = data.bSandboxMode ?? false;
    GameRules.cutawayMode = data.cutawayMode ?? false;
    GameRules.bDisasterMode = data.bDisasterMode ?? false;
    GameRules.bTutorialMode = data.bTutorialMode ?? false;
    GameRules.bHasHadEnclosedRooms = data.bHasHadEnclosedRooms ?? false;
    GameRules.bHasZoned = data.bHasZoned ?? false;
    GameRules.bHasStartedResearch = data.bHasStartedResearch ?? false;
    GameRules.nLastDutyAccident = data.nLastDutyAccident ?? 0;
    GameRules.nLastNewShip = data.nLastNewShip ?? 0;

    // Restore grid
    if (data.gridData && data.gridData.length === data.gridWidth * data.gridHeight) {
      for (let y = 0; y < data.gridHeight; y++) {
        for (let x = 0; x < data.gridWidth; x++) {
          this.grid.set(x, y, data.gridData[y * data.gridWidth + x]);
        }
      }
    }

    // Re-detect rooms from the restored grid
    this.roomManager.markDirty([]);
    this.roomManager.update();

    // Restore per-tile O2 grid if available
    if (data.o2Grid) {
      this.grid.loadO2Data(data.o2Grid);
    }

    // Lua ResearchZone:getSaveTable/initFromSaveTable: restore zone identity
    // before applying zone-specific durable state.
    const restoredRooms = this.roomManager.getRooms();
    for (const rz of data.roomZones) {
      const room = restoredRooms.find(r => r.id === rz.roomId);
      if (!room) continue;
      room.zone = rz.zone as ZoneType;
      this.roomManager.persistZone(room);
      if (room.zoneObj instanceof ResearchZone && rz.researchProject !== undefined) {
        room.zoneObj.setActiveResearch(rz.researchProject);
      }
    }

    // Restore per-room oxygen from saved roomZones (backwards compat for saves without o2Grid)
    if (data.roomZones && !data.o2Grid) {
      const rooms = this.roomManager.getRooms();
      for (const rz of data.roomZones) {
        const room = rooms.find(r => r.id === rz.roomId);
        if (room && rz.oxygen !== undefined) {
          // Also initialize per-tile O2 from room-level value
          const tileVal = Math.round((rz.oxygen / 255) * 65535);
          for (const t of room.tiles) {
            this.grid.setO2(t.x, t.y, tileVal);
          }
          room.setOxygenStats(rz.oxygen, tileVal, tileVal * room.tiles.length);
        }
      }
    } else if (data.roomZones) {
      // With o2Grid, still restore room zones but derive oxygen from tiles
      const rooms = this.roomManager.getRooms();
      for (const room of rooms) {
        if (room.tiles.length === 0) continue;
        let sum = 0;
        for (const t of room.tiles) sum += this.grid.getO2(t.x, t.y);
        const oxygenScore = sum / room.tiles.length;
        room.setOxygenStats(Math.round(oxygenScore * (255 / 65535)), oxygenScore, sum);
      }
    }

    // Restore stats
    if (data.tStats) Base.loadStats(data.tStats);

    // Restore faction registry
    if (data.factionData) Base.loadFactionData(data.factionData);

    // Restore subsystem data
    if (data.characters) this.loadCharacterData?.(data.characters);
    if (data.objects) this.loadObjectData?.(data.objects);
    if (data.research) this.loadResearchData?.(data.research);
    if (data.events) this.loadEventData?.(data.events);
    if (data.topics) this.loadTopicsData?.(data.topics);
    if (data.fires) this.loadFireData?.(data.fires);
    if (data.commands) this.loadCommandData?.(data.commands);
    if (data.pickups) this.loadPickupData?.(data.pickups);

    if (
      data.cameraX !== undefined &&
      data.cameraY !== undefined &&
      data.cameraZoom !== undefined
    ) {
      this.loadCameraData?.({ cameraX: data.cameraX, cameraY: data.cameraY, cameraZoom: data.cameraZoom });
    }

    if (data.tutorialFlags) {
      this.loadTutorialFlags?.(data.tutorialFlags);
    }

    if (data.tutorialState) {
      this.loadTutorialState?.(data.tutorialState);
    } else if (data.tutorialStage !== undefined) {
      this.loadTutorialStage?.(data.tutorialStage);
    } else if (GameRules.bTutorialMode) {
      this.loadTutorialState?.({
        active: true,
        currentStage: 0,
        stageTimer: 0,
        completedConditions: [],
      });
    }

    const bMuted = data.bMuted ?? SoundManager.isMuted();
    const masterVolume = data.masterVolume ?? SoundManager.getMasterVolume();
    const sfxVolume = data.sfxVolume ?? SoundManager.getSfxVolume();
    const musicVolume = data.musicVolume ?? SoundManager.getMusicVolume();
    if (this.loadAudioData) {
      this.loadAudioData({ bMuted, masterVolume, sfxVolume, musicVolume });
    } else {
      SoundManager.setMasterVolume(masterVolume);
      SoundManager.setSfxVolume(sfxVolume);
      SoundManager.setMusicVolume(musicVolume);
      if (SoundManager.isMuted() !== bMuted) {
        SoundManager.toggleMute();
      }
    }

  }

  private getTutorialStageFromDebugBridge(): number | undefined {
    const bridge = (globalThis as { __df9?: { getTutorialStage?: () => number } }).__df9;
    return bridge?.getTutorialStage?.();
  }

  /** Check if a save exists. */
  hasSave(slotName = 'SpacebaseDF9AutoSave'): boolean {
    return localStorage.getItem(slotName) !== null;
  }

  /** Delete a save. */
  deleteSave(slotName = 'SpacebaseDF9AutoSave') {
    localStorage.removeItem(slotName);
  }

  /** Export save data as a downloadable .json file. */
  exportToFile(filename = 'spacebase-df9-save.json') {
    const data = this.save();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /** Import save data from a .json file via file picker. Returns a promise. */
  importFromFile(): Promise<boolean> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.style.display = 'none';
      input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (!file) { resolve(false); return; }
        if (file.size > MAX_SAVE_JSON_BYTES) { resolve(false); return; }
        const reader = new FileReader();
        reader.onload = () => {
          try {
            if (typeof reader.result !== 'string' || reader.result.length > MAX_SAVE_JSON_BYTES) {
              resolve(false);
              return;
            }
            const data: unknown = JSON.parse(reader.result);
            const ok = this.load(data);
            resolve(ok);
          } catch (e) {
            console.error('Import failed:', e);
            resolve(false);
          }
        };
        reader.onerror = () => resolve(false);
        reader.readAsText(file);
      });
      document.body.appendChild(input);
      input.click();
      document.body.removeChild(input);
    });
  }
}
