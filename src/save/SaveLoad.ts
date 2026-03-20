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

// ── Save data interfaces ────────────────────────────────────────

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
  needs?: { hunger: number; energy: number; amusement: number; social: number; oxygen: number };
  inventory?: { sTemplate: string; sName: string; nCount: number }[];
  heldItem?: string | null;
}

export interface ObjSaveData {
  name: string;
  tileX: number;
  tileY: number;
  built: boolean;
  condition: number;
  hasPower: boolean;
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
  research: { active: string | null; progress: number; completed: string[] };
  roomZones: { roomId: number; zone: string; oxygen?: number }[];
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
  tutorialStage?: number;
  bMuted?: boolean;
  masterVolume?: number;
}

export class SaveLoadSystem {
  private grid: TileGrid;
  private roomManager: RoomManager;

  /** External data providers set from main.ts */
  getCharacterData: (() => CharSaveData[]) | null = null;
  getObjectData: (() => ObjSaveData[]) | null = null;
  getResearchData: (() => { active: string | null; progress: number; completed: string[] }) | null = null;
  getEventData: (() => ReturnType<EventController['getSaveData']>) | null = null;
  getTopicsData: (() => { tTopics: Record<string, { name: string; category: string }>; counter: number }) | null = null;
  getFireData: (() => { tTiles: Record<string, number>; tFlames: Record<string, number> }) | null = null;
  getCommandData: (() => { type: string; tileX: number; tileY: number; objectName?: string }[]) | null = null;
  getPickupData: (() => { sName: string; tileX: number; tileY: number }[]) | null = null;
  getCameraData: (() => { cameraX: number; cameraY: number; cameraZoom: number }) | null = null;
  getTutorialStage: (() => number) | null = null;
  getAudioData: (() => { bMuted: boolean; masterVolume: number }) | null = null;

  loadCharacterData: ((data: CharSaveData[]) => void) | null = null;
  loadObjectData: ((data: ObjSaveData[]) => void) | null = null;
  loadResearchData: ((data: { active: string | null; progress: number; completed: string[] }) => void) | null = null;
  loadEventData: ((data: ReturnType<EventController['getSaveData']>) => void) | null = null;
  loadTopicsData: ((data: { tTopics: Record<string, { name: string; category: string }>; counter: number }) => void) | null = null;
  loadFireData: ((data: { tTiles: Record<string, number>; tFlames: Record<string, number> }) => void) | null = null;
  loadCommandData: ((data: { type: string; tileX: number; tileY: number; objectName?: string }[]) => void) | null = null;
  loadPickupData: ((data: { sName: string; tileX: number; tileY: number }[]) => void) | null = null;
  loadCameraData: ((data: { cameraX: number; cameraY: number; cameraZoom: number }) => void) | null = null;
  loadTutorialStage: ((stage: number) => void) | null = null;
  loadAudioData: ((data: { bMuted: boolean; masterVolume: number }) => void) | null = null;

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
    }));

    const cameraData = this.getCameraData?.();
    const tutorialStage = this.getTutorialStage?.() ?? this.getTutorialStageFromDebugBridge();
    const audioData = this.getAudioData?.() ?? {
      bMuted: SoundManager.isMuted(),
      masterVolume: SoundManager.getMasterVolume(),
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
      tutorialStage,
      bMuted: audioData.bMuted,
      masterVolume: audioData.masterVolume,
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
      const data = JSON.parse(json) as SaveData;
      return this.load(data);
    } catch (e) {
      console.error('Load failed:', e);
      return false;
    }
  }

  /** Restore game state from save data. */
  load(data: SaveData): boolean {
    if (!data || data.version !== SAVEGAME_VERSION) {
      console.warn('Incompatible save version');
      return false;
    }

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

    // Restore per-room oxygen from saved roomZones (backwards compat for saves without o2Grid)
    if (data.roomZones && !data.o2Grid) {
      const rooms = this.roomManager.getRooms();
      for (const rz of data.roomZones) {
        const room = rooms.find(r => r.id === rz.roomId);
        if (room && rz.oxygen !== undefined) {
          room.oxygen = rz.oxygen;
          // Also initialize per-tile O2 from room-level value
          const tileVal = Math.round((rz.oxygen / 255) * 65535);
          for (const t of room.tiles) {
            this.grid.setO2(t.x, t.y, tileVal);
          }
        }
      }
    } else if (data.roomZones) {
      // With o2Grid, still restore room zones but derive oxygen from tiles
      const rooms = this.roomManager.getRooms();
      for (const room of rooms) {
        if (room.tiles.length === 0) continue;
        let sum = 0;
        for (const t of room.tiles) sum += this.grid.getO2(t.x, t.y);
        room.oxygen = Math.round((sum / room.tiles.length / 65535) * 255);
        room.invalidateOxygenScore();
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

    if (data.tutorialStage !== undefined) {
      this.loadTutorialStage?.(data.tutorialStage);
    }

    const bMuted = data.bMuted ?? SoundManager.isMuted();
    const masterVolume = data.masterVolume ?? SoundManager.getMasterVolume();
    if (this.loadAudioData) {
      this.loadAudioData({ bMuted, masterVolume });
    } else {
      SoundManager.setMasterVolume(masterVolume);
      if (SoundManager.isMuted() !== bMuted) {
        SoundManager.toggleMute();
      }
    }

    return true;
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
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const data = JSON.parse(reader.result as string) as SaveData;
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
