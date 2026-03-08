/**
 * Base.ts — Colony-wide state tracking.
 * Mirrors Base.lua: faction registry, events, alliance, memory, bed assignments, alert log.
 */

import { GameRules, type TickableSystem } from './GameRules';
import {
  TEAM_ID_PLAYER, TEAM_ID_DEBUG_ENEMYGROUP, TEAM_ID_DEBUG_MONSTER,
  TEAM_ID_DEBUG_FRIENDLY, TEAM_ID_FIRST_USABLE, FACTION_BEHAVIOR,
} from '../characters/CharacterConstants';

// ── Event Types (Lua Base.EVENTS, lines 12-32) ──────────────────────────

export const BASE_EVENT = {
  CitizenAttacked: 'CitizenAttacked',
  Breach: 'breach',
  CitizenSuffocating: 'CitizenSuffocating',
  Default: 'Default',
  CitizenDied: 'death',
  CitizenSkillUp: 'CitizenSkillUp',
  CitizenJoined: 'immigration',
  EventAlert: 'event',
  EventFailure: 'EventFailure',
  Fire: 'fire',
  MaladyEncountered: 'MaladyEncountered',
  HostileInBase: 'hostile',
  ResearchCompleted: 'research',
  MaladyResearchCompleted: 'MaladyResearchCompleted',
  DerelictFloataway: 'derelict',
  CitizensBrawling: 'CitizensBrawling',
  CitizenTantrum: 'CitizenTantrum',
  CitizenRampage: 'rampage',
  GoalCompleted: 'goal',
  BrigEscaped: 'BrigEscaped',
} as const;

export type BaseEventType = typeof BASE_EVENT[keyof typeof BASE_EVENT];

/** Per-event metadata (Lua Base.EVENT_DATA, lines 33-100) */
export interface EventDataEntry {
  nPriority: number;
  nLogVisibleTime: number;
}

export const EVENT_DATA: Record<string, EventDataEntry> = {
  [BASE_EVENT.CitizenAttacked]:       { nPriority: 1, nLogVisibleTime: 30 },
  [BASE_EVENT.Breach]:                { nPriority: 1, nLogVisibleTime: 30 },
  [BASE_EVENT.CitizenSuffocating]:    { nPriority: 1, nLogVisibleTime: 30 },
  [BASE_EVENT.Default]:               { nPriority: 0, nLogVisibleTime: 30 },
  [BASE_EVENT.CitizenDied]:           { nPriority: 1, nLogVisibleTime: 30 },
  [BASE_EVENT.CitizenSkillUp]:        { nPriority: 0, nLogVisibleTime: 30 },
  [BASE_EVENT.CitizenJoined]:         { nPriority: 0, nLogVisibleTime: 30 },
  [BASE_EVENT.EventAlert]:            { nPriority: 0, nLogVisibleTime: 30 },
  [BASE_EVENT.EventFailure]:          { nPriority: 0, nLogVisibleTime: 30 },
  [BASE_EVENT.Fire]:                  { nPriority: 1, nLogVisibleTime: 30 },
  [BASE_EVENT.MaladyEncountered]:     { nPriority: 1, nLogVisibleTime: 30 },
  [BASE_EVENT.HostileInBase]:         { nPriority: 1, nLogVisibleTime: 30 },
  [BASE_EVENT.ResearchCompleted]:     { nPriority: 0, nLogVisibleTime: 30 },
  [BASE_EVENT.MaladyResearchCompleted]: { nPriority: 0, nLogVisibleTime: 30 },
  [BASE_EVENT.DerelictFloataway]:     { nPriority: 0, nLogVisibleTime: 30 },
  [BASE_EVENT.CitizensBrawling]:      { nPriority: 0, nLogVisibleTime: 30 },
  [BASE_EVENT.CitizenTantrum]:        { nPriority: 0, nLogVisibleTime: 30 },
  [BASE_EVENT.CitizenRampage]:        { nPriority: 1, nLogVisibleTime: 30 },
  [BASE_EVENT.GoalCompleted]:         { nPriority: 0, nLogVisibleTime: 30 },
  [BASE_EVENT.BrigEscaped]:           { nPriority: 1, nLogVisibleTime: 30 },
};

/** Death cause → alert message (Lua Base.tDeathAlerts) */
export const DEATH_ALERTS: Record<number, string> = {
  1: '{name} has died.',                        // UNSPECIFIED
  2: '{name} was killed (debug).',              // DEBUG
  3: '{name} suffocated.',                      // SUFFOCATION
  4: '{name} burned to death.',                 // FIRE
  5: '{name} died of disease.',                 // DISEASE
  6: '{name} was shot and killed.',             // COMBAT_RANGED
  7: '{name} was sucked into space.',           // SUCKED_INTO_SPACE
  8: '{name} was killed by a parasite.',        // PARASITE
  9: '{name} starved to death.',                // STARVATION
  10: '{name} was beaten to death.',            // COMBAT_MELEE
  11: '{name} was killed by a Thing.',          // THING
};

// ── Current Event Tracking ───────────────────────────────────────────

interface CurrentEvent {
  sType: string;
  nStartTime: number;
  nEndTime: number;
  nPriority: number;
  sReporterID?: string;
}

// ── Memory Entry ─────────────────────────────────────────────────────

interface MemoryEntry {
  value: unknown;
  nTime: number;
  nDuration: number;
}

// ── Alerts & Stats ───────────────────────────────────────────────────

export interface BaseAlert {
  type: string;
  message: string;
  time: number;
  /** Lua: nEndTime — auto-dismiss when elapsedTime > nEndTime. */
  nEndTime: number;
  /** Lua: nPriority — 0=normal, 1=high. */
  nPriority: number;
}

export interface BaseStats {
  nMealsServed: number;
  nCuresResearched: number;
  nCorpsesRecycled: number;
  nBreachShipsDestroyed: number;
  nHostilesKilled: number;
  nHostilesAsphyxiated: number;
  nHostilesKilledByTurret: number;
  nHostilesKilledByParasite: number;
  nRaidersConverted: number;
  nRocksRecycled: number;
}

function createEmptyStats(): BaseStats {
  return {
    nMealsServed: 0,
    nCuresResearched: 0,
    nCorpsesRecycled: 0,
    nBreachShipsDestroyed: 0,
    nHostilesKilled: 0,
    nHostilesAsphyxiated: 0,
    nHostilesKilledByTurret: 0,
    nHostilesKilledByParasite: 0,
    nRaidersConverted: 0,
    nRocksRecycled: 0,
  };
}

// ── Callback type for hostile-in-base checks ─────────────────────────

export interface CharacterInfo {
  id: number;
  tileX: number;
  tileY: number;
  nTeam: number;
  isAlive: boolean;
  bIncapacitated: boolean;
  bCuffed: boolean;
}

export type GetCharactersInRoomsFn = () => { roomId: number; characters: CharacterInfo[] }[];

// ── BaseClass ────────────────────────────────────────────────────────

class BaseClass implements TickableSystem {
  // ── Bed Assignments ──
  tBedToChar: Map<number, number> = new Map();
  tCharToBed: Map<number, number> = new Map();

  // ── Alert/event log ──
  alerts: BaseAlert[] = [];
  tStats: BaseStats = createEmptyStats();
  private maxAlerts = 50;

  // ── Faction Registry (Lua Base.tS.tTeamIDToFactionBehavior) ──
  private tTeamIDToFactionBehavior: Map<number, number> = new Map();
  private nNextTeamID = TEAM_ID_FIRST_USABLE + 1;

  // ── Current Events (transient, not saved) ──
  private tCurrentEvents: CurrentEvent[] = [];

  // ── Memory (Lua Base.tS.tMemory) ──
  private tMemory: Map<string, MemoryEntry> = new Map();

  // ── External callback for hostile-in-base checks ──
  private getCharactersInRooms: GetCharactersInRoomsFn | null = null;

  // ── Init ──

  init() {
    this.tBedToChar.clear();
    this.tCharToBed.clear();
    this.alerts = [];
    this.tStats = createEmptyStats();

    // Seed default faction behaviors (Lua Base.init, lines 114-136)
    this.tTeamIDToFactionBehavior.clear();
    this.tTeamIDToFactionBehavior.set(TEAM_ID_PLAYER, FACTION_BEHAVIOR.Citizen);
    this.tTeamIDToFactionBehavior.set(TEAM_ID_DEBUG_ENEMYGROUP, FACTION_BEHAVIOR.EnemyGroup);
    this.tTeamIDToFactionBehavior.set(TEAM_ID_DEBUG_FRIENDLY, FACTION_BEHAVIOR.Friendly);
    this.tTeamIDToFactionBehavior.set(TEAM_ID_DEBUG_MONSTER, FACTION_BEHAVIOR.Monster);
    this.nNextTeamID = TEAM_ID_FIRST_USABLE + 1;

    this.tCurrentEvents = [];
    this.tMemory.clear();

    // Register at slot 13 (Base.onTick in Lua tick order)
    GameRules.registerSystem(13, this);
  }

  // ── Faction Registry (Lua Base.lua lines 359-380) ──

  /** Get faction behavior for a team (defaults to EnemyGroup if unknown). */
  getTeamFactionBehavior(nTeam: number): number {
    return this.tTeamIDToFactionBehavior.get(nTeam) ?? FACTION_BEHAVIOR.EnemyGroup;
  }

  /** Set faction behavior for a team. */
  setTeamFactionBehavior(nTeam: number, nBehavior: number) {
    this.tTeamIDToFactionBehavior.set(nTeam, nBehavior);
  }

  /** Allocate a new team ID with given faction behavior (Lua Base.createNewTeamID). */
  createNewTeamID(nFactionBehavior: number): number {
    // Citizens always map to TEAM_ID_PLAYER
    if (nFactionBehavior === FACTION_BEHAVIOR.Citizen) {
      return TEAM_ID_PLAYER;
    }

    // Find next unused team ID
    while (this.tTeamIDToFactionBehavior.has(this.nNextTeamID)) {
      this.nNextTeamID++;
    }

    const nTeam = this.nNextTeamID;
    this.nNextTeamID++;
    this.tTeamIDToFactionBehavior.set(nTeam, nFactionBehavior);
    return nTeam;
  }

  // ── Alliance Functions (Lua Base.lua lines 422-449) ──

  /** Check if a team is friendly to the player (Citizen or Friendly behavior). */
  isFriendlyToPlayer(nTeam: number): boolean {
    const behavior = this.getTeamFactionBehavior(nTeam);
    return behavior === FACTION_BEHAVIOR.Citizen || behavior === FACTION_BEHAVIOR.Friendly;
  }

  /** Check if two teams are friendly to each other (Lua Base.isFriendly). */
  isFriendly(nTeamA: number, nTeamB: number): boolean {
    if (nTeamA === nTeamB) return true;

    const behaviorA = this.getTeamFactionBehavior(nTeamA);
    const behaviorB = this.getTeamFactionBehavior(nTeamB);

    // Citizen/Friendly befriend each other
    if (behaviorA === FACTION_BEHAVIOR.Citizen || behaviorA === FACTION_BEHAVIOR.Friendly) {
      return behaviorB === FACTION_BEHAVIOR.Citizen || behaviorB === FACTION_BEHAVIOR.Friendly;
    }

    // Monster loves other monsters
    if (behaviorA === FACTION_BEHAVIOR.Monster) {
      return behaviorB === FACTION_BEHAVIOR.Monster;
    }

    // EnemyGroup/KillBot/Trader: only friendly to same team
    return nTeamA === nTeamB;
  }

  // ── Memory System (Lua Base.lua lines 332-357) ──

  /** Store a value with expiration (default 10 seconds). */
  storeMemory(key: string, value: unknown, nDuration = 10) {
    this.tMemory.set(key, {
      value,
      nTime: GameRules.simTime,
      nDuration,
    });
  }

  /** Retrieve a stored value if not expired. Returns null if expired or missing. */
  retrieveMemory(key: string): unknown | null {
    const entry = this.tMemory.get(key);
    if (!entry) return null;
    if (GameRules.simTime - entry.nTime > entry.nDuration) {
      this.tMemory.delete(key);
      return null;
    }
    return entry.value;
  }

  // ── Event Occurrence (Lua Base.lua lines 210-248) ──

  /** Fire a base event with deduplication and alert logging. */
  eventOccurred(eventType: string, params?: {
    sReporterID?: string;
    sMessage?: string;
    nPriority?: number;
    nLogVisibleTime?: number;
  }) {
    const reporterID = params?.sReporterID;

    // Dedup: check for existing event of same type + reporter
    const existing = this.tCurrentEvents.find(
      e => e.sType === eventType && e.sReporterID === reporterID
    );
    if (existing) {
      // Extend duration
      const data = EVENT_DATA[eventType] ?? EVENT_DATA[BASE_EVENT.Default];
      const duration = params?.nLogVisibleTime ?? data.nLogVisibleTime;
      existing.nEndTime = GameRules.simTime + duration;
      return;
    }

    // Get metadata
    const data = EVENT_DATA[eventType] ?? EVENT_DATA[BASE_EVENT.Default];
    const priority = params?.nPriority ?? data.nPriority;
    const duration = params?.nLogVisibleTime ?? data.nLogVisibleTime;

    // Create current event entry
    this.tCurrentEvents.push({
      sType: eventType,
      nStartTime: GameRules.simTime,
      nEndTime: GameRules.simTime + duration,
      nPriority: priority,
      sReporterID: reporterID,
    });

    // Log alert
    const message = params?.sMessage ?? eventType;
    this.addAlert(eventType, message);
  }

  /** Get all current (non-expired) events. */
  getCurrentEvents(): ReadonlyArray<CurrentEvent> {
    return this.tCurrentEvents;
  }

  // ── Hostile In Base (Lua Base.lua lines 451-466) ──

  /** Set the callback for getting characters in rooms. */
  setCharactersInRoomsCallback(fn: GetCharactersInRoomsFn) {
    this.getCharactersInRooms = fn;
  }

  /** Check if any hostile character is inside a player-owned room. */
  isHostileInBase(bIncludeIncapacitated = false): boolean {
    if (!this.getCharactersInRooms) return false;

    const roomsWithChars = this.getCharactersInRooms();
    for (const { characters } of roomsWithChars) {
      for (const c of characters) {
        if (!c.isAlive) continue;
        if (!bIncludeIncapacitated && c.bIncapacitated) continue;
        if (c.bCuffed) continue;
        if (!this.isFriendlyToPlayer(c.nTeam)) return true;
      }
    }
    return false;
  }

  // ── Bed Assignments ──

  assignBed(bedId: number, charId: number) {
    const oldBed = this.tCharToBed.get(charId);
    if (oldBed !== undefined) {
      this.tBedToChar.delete(oldBed);
    }
    const oldChar = this.tBedToChar.get(bedId);
    if (oldChar !== undefined) {
      this.tCharToBed.delete(oldChar);
    }
    this.tBedToChar.set(bedId, charId);
    this.tCharToBed.set(charId, bedId);
  }

  unassignBed(bedId: number) {
    const charId = this.tBedToChar.get(bedId);
    if (charId !== undefined) {
      this.tCharToBed.delete(charId);
    }
    this.tBedToChar.delete(bedId);
  }

  getBedForChar(charId: number): number | undefined {
    return this.tCharToBed.get(charId);
  }

  getCharForBed(bedId: number): number | undefined {
    return this.tBedToChar.get(bedId);
  }

  // ── Alert Log ──

  addAlert(type: string, message: string) {
    const data = EVENT_DATA[type] ?? EVENT_DATA[BASE_EVENT.Default];
    const duration = data.nLogVisibleTime;
    const priority = data.nPriority;
    const endTime = GameRules.elapsedTime + duration;

    // Lua _getRelatedEvent: deduplicate — extend existing alert if same type
    const existing = this.alerts.find(a => a.type === type);
    if (existing) {
      existing.message = message;
      existing.nEndTime = Math.max(existing.nEndTime, endTime);
      existing.time = GameRules.simTime;
      return;
    }

    this.alerts.unshift({
      type,
      message,
      time: GameRules.simTime,
      nEndTime: endTime,
      nPriority: priority,
    });
    if (this.alerts.length > this.maxAlerts) {
      this.alerts.pop();
    }
  }

  /** Cull expired alerts (Lua Base.onTick auto-dismiss by nEndTime). */
  cullExpiredAlerts() {
    this.alerts = this.alerts.filter(a => a.nEndTime > GameRules.elapsedTime);
  }

  getRecentAlerts(count = 5): BaseAlert[] {
    return this.alerts.slice(0, count);
  }

  // ── Stats ──

  incrementStat(key: keyof BaseStats, amount = 1) {
    this.tStats[key] += amount;
  }

  getStats(): Readonly<BaseStats> {
    return this.tStats;
  }

  loadStats(saved: Partial<BaseStats>) {
    this.tStats = { ...createEmptyStats(), ...saved };
  }

  // ── Save/Load Extensions ──

  /** Get faction registry data for save. */
  getFactionSaveData(): { teamFactions: [number, number][]; nNextTeamID: number } {
    return {
      teamFactions: Array.from(this.tTeamIDToFactionBehavior.entries()),
      nNextTeamID: this.nNextTeamID,
    };
  }

  /** Load faction registry from save data. */
  loadFactionData(data: { teamFactions: [number, number][]; nNextTeamID: number }) {
    this.tTeamIDToFactionBehavior.clear();
    for (const [teamId, behavior] of data.teamFactions) {
      this.tTeamIDToFactionBehavior.set(teamId, behavior);
    }
    this.nNextTeamID = data.nNextTeamID;
  }

  // ── Tick ──

  onTick(dt: number) {
    if (dt <= 0) return;

    // Check for hostiles in base every 60s via memory cooldown (Lua Base.onTick)
    if (this.retrieveMemory(BASE_EVENT.HostileInBase) === null) {
      const hostile = this.isHostileInBase();
      if (hostile) {
        this.storeMemory(BASE_EVENT.HostileInBase, true, 60);
        this.eventOccurred(BASE_EVENT.HostileInBase, {
          sMessage: 'Hostile detected in base!',
        });
      }
    }

    // Prune expired events
    const now = GameRules.simTime;
    for (let i = this.tCurrentEvents.length - 1; i >= 0; i--) {
      if (this.tCurrentEvents[i].nEndTime < now) {
        this.tCurrentEvents.splice(i, 1);
      }
    }
  }
}

/** Global singleton */
export const Base = new BaseClass();
