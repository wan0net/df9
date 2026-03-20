import { ZoneType } from '../world/ZoneType';
import { TileType } from '../world/TileTypes';
import type { ObjectTag } from '../core/ObjectList';
import type { Zone } from '../zones/Zone';
import { TEAM_ID_PLAYER, TEAM_ID_PLAYER_ABANDONED, OXYGEN_LOW, OXYGEN_SUFFOCATING } from '../characters/CharacterConstants';
import { GameRules } from '../core/GameRules';
import { SoundManager } from '../audio/SoundManager';
import { SpatialAudio } from '../audio/SpatialAudio';
import type { TileGrid } from '../world/TileGrid';

type FloatAwayObject = { remove: () => void };
type FloatAwayCharacter = { kill: (cause: number) => void };

interface FloatAwayContext {
  grid: TileGrid;
  getObjectsAtTile?: (tx: number, ty: number) => FloatAwayObject[];
  getCharactersAtTile?: (tx: number, ty: number) => FloatAwayCharacter[];
  removeRoom?: (room: Room) => void;
  deathCause?: number;
}

// ── Room constants — mirrors Room.lua:46-59 ─────────────────────────────────
export const LIGHTING_SCHEME_OFF      = 0;
export const LIGHTING_SCHEME_NORMAL   = 1;
export const LIGHTING_SCHEME_FIRE     = 2;
export const LIGHTING_SCHEME_VACUUM   = 3;
export const LIGHTING_SCHEME_DIM      = 4;
export const LIGHTING_SCHEME_LOWPOWER = 5;

/** Seconds a room must be dangerous before an alert fires (Room.lua:53) */
export const DANGEROUS_DURATION        = 120;
/** Seconds after threat clears before room stops being "alert" (Room.lua:54) */
export const LOSE_VISIBILITY_TIME      = 45;
/** Seconds until unexplored room loses revealed status (Room.lua:55) */
export const LOSE_REVEALED_TIME        = 270;
/** Seconds until loose items float away in vacuum room (Room.lua:56) */
export const FLOAT_AWAY_TIME           = 720;
/** Ticks between re-checking room connectivity (Room.lua:57) */
export const CONTIGUITY_TEST_INTERVAL  = 2;
/** Power drawn by room per tile (Room.lua:58) */
export const POWER_DRAW_PER_TILE       = 1;

// ── Visibility states — mirrors World.VISIBILITY_* ──────────────────────────
export const VISIBILITY_HIDDEN = 0;
export const VISIBILITY_DIM    = 1;
export const VISIBILITY_FULL   = 2;

export class Room {
  id: number;
  tiles: { x: number; y: number }[] = [];
  oxygen = 0;
  zone: ZoneType = ZoneType.PLAIN;

  /** ObjectList tag for this room (set when registered with ObjectList). */
  tag: ObjectTag | null = null;

  /** Zone subclass instance managing zone-specific state. */
  zoneObj: Zone | null = null;

  /** Rooms contiguous through doors (populated in Phase 6). */
  tContiguousRooms: Room[] = [];
  /** Rooms adjacent through shared wall tiles (for power distribution). */
  tWallAdjacentRooms: Room[] = [];
  /** Rooms adjacent through doors (populated in room detection). */
  tAdjoining: Room[] = [];
  /** Rooms reachable via open doors (populated in room detection). */
  tAccessibleByDoor: Room[] = [];

  /** Power fields (populated in Phase 6). */
  nPowerOutput = 0;
  nPowerDraw = 0;
  nPowerSupply = 0;

  /** Does this room have ANY power? (Lua Room:hasPower — true if nPowerSupplied > 0 OR canProvidePower) */
  get hasPowerFlag(): boolean { return this.nPowerSupply > 0 || this.nPowerOutput > 0; }

  /** Does this room have FULL power? (Lua Room:hasFullPower) */
  get hasFullPower(): boolean { return this.nPowerSupply >= this.nPowerDraw || this.nPowerOutput > 0; }

  /** Room morale score: sum of object morale scores / room size. */
  nMoraleScore = 0;

  // ── Lighting scheme — mirrors Room.nLightingScheme ────────────────────────
  /** Current lighting scheme (LIGHTING_SCHEME_* constants). */
  nLightingScheme = LIGHTING_SCHEME_NORMAL;
  /** Oscillation timer for emergency flash (0-1, driven by Lighting.onTick). */
  nLightFadeTimer = 0;
  /** Oscillation speed in cycles/second (Room.lua: nLightFadesPerSecond = 0.5). */
  nLightFadesPerSecond = 0.5;

  // ── Danger / visibility timers — mirrors Room.lua ─────────────────────────
  /** Seconds this room has been in a dangerous state (hostile/fire/vacuum). */
  nDangerTimer = 0;
  /** Seconds since last threat (for LOSE_VISIBILITY_TIME countdown). */
  nVisibilityTimer = 0;

  // ── State tracking — mirrors Room.lua Room.new() ──────────────────────────
  /** Character IDs currently in this room. */
  tCharacters = new Set<number>();
  /** Derived character count (updated in tickFast). */
  nCharacters = 0;
  /** Environment object IDs in this room. */
  tProps = new Set<number>();
  /** Door tile keys ("x,y") in this room's boundaries. */
  tDoors = new Set<string>();
  /** Wall tile entries: keyed by "x,y", stores wall direction info. */
  tWalls = new Map<string, { x: number; y: number }>();
  /** Fire tile addresses currently burning in this room. */
  tFires = new Set<string>();
  /** Number of tiles on fire. */
  nFireTiles = 0;
  /** Room is breached (exposed to space). Inverse of old `sealed`. */
  bBreach = false;
  /** Pending breach flag (set by BFS, resolved in tick). */
  bPendingBreach = false;
  tPendingBreaches = new Map<string, number>();
  /** User-initiated oxygen lockdown. */
  bUserBlockOxygen = false;
  /** Team that owns this room (default: TEAM_ID_PLAYER). */
  nTeam = TEAM_ID_PLAYER;
  /** Original team before claim/unclaim (for reverting on unclaim). Lua Room.nOriginalTeam. */
  nOriginalTeam: number | null = null;
  /** GameRules.elapsedTime when float-away timer started (VISIBILITY_HIDDEN rooms). */
  nFloatAwayTimerStart: number | null = null;
  /** Next time to test float-away conditions (debounce every 30s). */
  nNextFloatAwayTest: number | null = null;
  /** Room is currently on fire. */
  bBurning = false;
  /** Emergency alarm is active for this room. */
  bEmergencyAlarmEnabled = false;
  /** Whether this room contains a FirePanel (enables suppression tasks). */
  bHasFirePanel = false;
  /** Room upgrade level (1-3). */
  nLevel = 1;
  /** Unique zone name (e.g. "Botany Lab Alpha"). */
  uniqueZoneName = '';

  // ── Visibility tracking — mirrors Room.lua ────────────────────────────────
  /** Last time a player character was in this room (GameRules.elapsedTime). */
  nLastSeen = 0;
  /** Current visibility state (VISIBILITY_HIDDEN/DIM/FULL). */
  nLastVisibility = VISIBILITY_FULL;
  /** Force simulation even when not visible. */
  bForceSim = false;
  /** Failed pathfind attempts to this room (performance gate). */
  tFailedPathfinds = new Map<number, number>();

  // ── Oxygen cache ──────────────────────────────────────────────────────────
  /** Cached oxygen score (Lua per-tile average mapped to 0-65535 scale). */
  private nOxygenScore = 0;
  /** Whether oxygen score needs recalculation. */
  bOxygenScoreOutOfDate = true;

  /** Backwards-compatible sealed getter (inverse of bBreach). */
  get sealed(): boolean { return !this.bBreach; }
  set sealed(v: boolean) { this.bBreach = !v; }

  constructor(id: number) {
    this.id = id;
  }

  setPendingBreach(
    tx: number,
    ty: number,
    bBreach: boolean,
    elapsedTime: number,
    getRoomsOfTeam: (nTeam: number) => Room[]
  ): void {
    const tileKey = `${tx},${ty}`;
    if (bBreach) {
      this.tPendingBreaches.set(tileKey, elapsedTime);
    } else {
      this.tPendingBreaches.delete(tileKey);
    }

    const hasPendingBreaches = this.tPendingBreaches.size > 0;
    if (!this.bPendingBreach && hasPendingBreaches) {
      this.bPendingBreach = true;
      this.bForceSim = true;
      for (const room of getRoomsOfTeam(this.nTeam)) {
        room.bForceSim = true;
      }
    } else if (!hasPendingBreaches) {
      this.bPendingBreach = false;
    }
  }

  addTile(x: number, y: number) {
    this.tiles.push({ x, y });
  }

  get size(): number {
    return this.tiles.length;
  }

  // ── Utility methods — mirrors Room.lua ─────────────────────────────────────

  /** Whether the room is breached (Lua Room:isBreached). */
  isBreached(): boolean {
    return this.bBreach;
  }

  /** Get oxygen score for this room. Uses `oxygen` field (0-255) mapped to Lua scale.
   *  Lua stores per-tile 0-65535; we use room-level 0-255. Scale for comparison with
   *  character constants (which use Lua scale). */
  getOxygenScore(): number {
    if (this.bOxygenScoreOutOfDate) {
      this.bOxygenScoreOutOfDate = false;
      // Map our 0-255 oxygen to Lua's 0-65535 scale for threshold comparison
      this.nOxygenScore = (this.oxygen / 255) * 65535;
    }
    return this.nOxygenScore;
  }

  /** Mark oxygen as needing recalculation. */
  invalidateOxygenScore(): void {
    this.bOxygenScoreOutOfDate = true;
  }

  /** Whether fire suppression is available in this room (Lua Room:utilityGateTool).
   *  Returns true if room has FirePanel or character is Emergency job. */
  canSuppressFire(charJob: number): boolean {
    if (!this.bBurning) return false;
    // Lua: EMERGENCY job = 5, or room has FirePanel
    return this.bHasFirePanel || charJob === 5;
  }

  /** Whether this room is dangerous for a character (Lua Room:isDangerous).
   *  @param charTeam - character's team (default PLAYER)
   *  @param hasSpacesuit - whether character is wearing a spacesuit */
  isDangerous(charTeam = TEAM_ID_PLAYER, hasSpacesuit = false): boolean {
    if (this.bEmergencyAlarmEnabled) return true;
    if ((this.bBreach || this.bPendingBreach) && !hasSpacesuit) return true;
    if (this.nTeam !== charTeam) return true;
    if (this.zoneObj && (this.zoneObj as any).bDangerous) return true;
    const bLowO2 = this.getOxygenScore() < OXYGEN_LOW;
    return bLowO2 && !hasSpacesuit;
  }

  /** Whether this room contains hostile characters (Lua Room:hasHostiles). */
  hasHostiles(): boolean {
    // Checked by CharacterManager during gatherOptions
    return this.bHasHostiles;
  }
  /** Set by CharacterManager when scanning characters in rooms. */
  bHasHostiles = false;

  /** Room safety score for AI (Lua Room:getRoomScore). Lower = worse.
   *  @param charTeam - character's team
   *  @param hasSpacesuit - spacesuit status */
  getRoomScore(charTeam = TEAM_ID_PLAYER, hasSpacesuit = false): number {
    let score = 0;

    if (this.nFireTiles > 0) {
      score -= 1;
      if (this.nFireTiles > this.tiles.length * 0.5) score -= 1;
    }

    const o2 = this.getOxygenScore();
    if (o2 < OXYGEN_SUFFOCATING) {
      score -= 2;
    } else if (o2 < OXYGEN_LOW) {
      score -= 1;
    }

    if (this.bBreach) score -= 2;
    if (this.isDangerous(charTeam, hasSpacesuit)) score -= 1;

    return score;
  }

  /** Update fire/hazard state by scanning tiles (Lua Room:updateHazardStatus).
   *  Call with a set of currently burning tile keys. */
  updateHazardStatus(fireTileKeys?: Set<string>): void {
    this.bBurning = false;
    this.nFireTiles = 0;
    this.tFires.clear();

    if (fireTileKeys) {
      for (const tile of this.tiles) {
        const key = `${tile.x},${tile.y}`;
        if (fireTileKeys.has(key)) {
          this.bBurning = true;
          this.nFireTiles++;
          this.tFires.add(key);
        }
      }
    }

    this.updateEmergency();
  }

  /** Update emergency lighting state (Lua Room:updateEmergency). */
  updateEmergency(): void {
    if (this.nLastVisibility === VISIBILITY_DIM) {
      this.setLightingScheme(LIGHTING_SCHEME_DIM);
    } else if (this.nPowerDraw > 0 && this.nPowerSupply === 0) {
      this.setLightingScheme(LIGHTING_SCHEME_VACUUM);
    } else if (this.bBurning || this.bEmergencyAlarmEnabled || this.bPendingBreach ||
               this.bBreach || this.getOxygenScore() < OXYGEN_SUFFOCATING) {
      this.setLightingScheme(LIGHTING_SCHEME_FIRE);
      // Emergency rooms pulse (Lua: nLightFadesPerSecond > 0)
      if (this.nLightFadesPerSecond <= 0) this.nLightFadesPerSecond = 0.5;
    } else if (this.nPowerSupply < this.nPowerDraw) {
      // Generator exists but insufficient power → lowpower lighting
      this.setLightingScheme(LIGHTING_SCHEME_LOWPOWER);
    } else {
      this.setLightingScheme(LIGHTING_SCHEME_NORMAL);
    }
  }

  /** Set lighting scheme (Lua Room:setLightingScheme). */
  setLightingScheme(nNewScheme: number): void {
    if (this.nLightingScheme !== nNewScheme) {
      const oldScheme = this.nLightingScheme;
      this.nLightingScheme = nNewScheme;
      this.nLightFadeTimer = 0;
      this.nLightFadesPerSecond = 0.5;

      // Room alarm sounds on emergency scheme transitions
      if (nNewScheme === LIGHTING_SCHEME_FIRE && oldScheme !== LIGHTING_SCHEME_FIRE) {
        if (this.bBurning) {
          SoundManager.playSfx('Alarm_Fire');
        } else if (this.bBreach || this.bPendingBreach) {
          SoundManager.playSfx('Alarm_Breach');
        } else if (this.getOxygenScore() < OXYGEN_SUFFOCATING) {
          SoundManager.playSfx('Alarm_LowOxygen');
        } else {
          SoundManager.playSfx('Alarm_Alert');
        }
      }
    }
  }

  /** Update visibility state (Lua Room:tickVisibility). */
  tickVisibility(): void {
    let nVisibility = VISIBILITY_HIDDEN;

    if (this.nTeam === TEAM_ID_PLAYER) {
      nVisibility = VISIBILITY_FULL;
    } else if (this.nLastSeen > 0) {
      const nDiff = GameRules.elapsedTime - this.nLastSeen;
      if (nDiff < LOSE_VISIBILITY_TIME) {
        nVisibility = VISIBILITY_FULL;
      }
      // Check if any player characters are in the room
      // (tCharacters only contains IDs — the CharacterManager update loop handles nLastSeen)
      if (nVisibility !== VISIBILITY_FULL && nDiff < LOSE_REVEALED_TIME) {
        nVisibility = VISIBILITY_DIM;
      }
    }

    if (this.nLastVisibility !== nVisibility) {
      this.nLastVisibility = nVisibility;
      this.updateEmergency();
    }
  }

  /** Get characters in room as Set (Lua Room:getCharactersInRoom). */
  getCharactersInRoom(): Set<number> {
    return this.tCharacters;
  }

  /** Get fires in room (Lua Room:getFiresInRoom). */
  getFiresInRoom(): Set<string> {
    return this.tFires;
  }

  // ── Tick methods — mirrors Room.lua _tickRoom ─────────────────────────────

  /** Whether this room should receive slow ticks (Lua Room:shouldTickRoom).
   *  Player rooms and recently-visible rooms always tick. Others are culled. */
  shouldTickRoom(): boolean {
    if (this.nTeam === TEAM_ID_PLAYER) return true;
    if (this.nLastVisibility === VISIBILITY_FULL) return true;
    if (this.bForceSim) return true;
    if (this.zoneObj && (this.zoneObj as any).bForceSim === true) return true;
    return false;
  }

  /** Fast tick: update character count, burning status. Called every frame. */
  tickFast(_dt: number): void {
    this.nCharacters = this.tCharacters.size;
  }

  /** Whether walla loop is active for this room. */
  private wallaActive = false;

  /** Slow tick: update hazard status, visibility, lighting. Round-robin'd by RoomManager. */
  tickSlow(_dt: number): void {
    this.tickVisibility();
    this._updateWalla();
  }

  /** Update room walla (background crowd noise). Lua: rooms with ≥3 characters. */
  private _updateWalla(): void {
    const charCount = this.tCharacters.size;
    const wallaKey = `walla_room_${this.id}`;

    if (charCount > 4 && !this.wallaActive) {
      // O-8: Lua Room.lua:1103 triggers walla at >4 (5+ characters)
      const cue = this.nTeam === TEAM_ID_PLAYER ? 'WallaPos' : 'WallaNeg';
      const center = this._getRoomCenter();
      SpatialAudio.startLoop(wallaKey, cue, center.x, center.y);
      this.wallaActive = true;
    } else if (charCount <= 4 && this.wallaActive) {
      SpatialAudio.stopLoop(wallaKey);
      this.wallaActive = false;
    }
  }

  /** Get approximate center tile of the room. */
  private _getRoomCenter(): { x: number; y: number } {
    if (this.tiles.length === 0) return { x: 0, y: 0 };
    let sx = 0, sy = 0;
    for (const t of this.tiles) { sx += t.x; sy += t.y; }
    return { x: Math.round(sx / this.tiles.length), y: Math.round(sy / this.tiles.length) };
  }

  /** Last combat alert timestamp. */
  nLastCombatAlert = 0;

  // ── Hover highlight — mirrors Room.lua:hover/unHover ──────────────────────

  /** Room highlight intensity for mouse hover (0.0 = none, 0.3 = hovered). */
  nHighlightPercent = 0;

  /** Highlight room tiles on mouse hover (Lua Room:hover).
   *  Only in INSPECT/PICK mode. */
  hover(): void {
    this.nHighlightPercent = 0.3;
  }

  /** Remove hover highlight (Lua Room:unHover). */
  unHover(): void {
    this.nHighlightPercent = 0;
  }

  // ── Claim / Unclaim — mirrors Room.lua:2893-2905 ─────────────────────────

  /** Claim room for player team (Lua Room:claim). */
  claim(): void {
    this.nLastSeen = GameRules.elapsedTime;
    this._setTeam(TEAM_ID_PLAYER);
  }

  /** Unclaim room — revert to abandoned or original team (Lua Room:unclaim). */
  unclaim(): void {
    this.nLastSeen = GameRules.elapsedTime;
    if (!this.nOriginalTeam || this.nOriginalTeam === TEAM_ID_PLAYER) {
      this._setTeam(TEAM_ID_PLAYER_ABANDONED);
    } else {
      this._setTeam(this.nOriginalTeam);
    }
  }

  /** Internal team setter (Lua Room:_setTeam). */
  private _setTeam(nTeam: number): void {
    this.nTeam = nTeam;
    this.updateEmergency();
  }

  // ── Emergency Alarm — mirrors Room.lua:3437-3458 ────────────────────────

  /** Whether emergency alarm is on (Lua Room:isEmergencyAlarmOn). */
  isEmergencyAlarmOn(): boolean {
    return this.bEmergencyAlarmEnabled;
  }

  /** Toggle emergency alarm (Lua Room:setEmergencyAlarmOn). */
  setEmergencyAlarmOn(bOn: boolean): void {
    this.bEmergencyAlarmEnabled = bOn;
    this.updateEmergency();
  }

  /** Check if room has a functioning EmergencyAlarm object (Lua Room:hasFunctioningEmergencyAlarm). */
  hasFunctioningEmergencyAlarm(getObjectsInRoom: (roomId: number) => { sName: string; isFunctioning: () => boolean }[]): boolean {
    for (const rProp of getObjectsInRoom(this.id)) {
      if (rProp.sName === 'EmergencyAlarm' && rProp.isFunctioning()) {
        return true;
      }
    }
    return false;
  }

  /** Handle alarm destruction — disable if no functioning alarms remain (Lua Room:onEmergencyAlarmDestroyed). */
  onEmergencyAlarmDestroyed(getObjectsInRoom: (roomId: number) => { sName: string; isFunctioning: () => boolean }[]): void {
    if (this.bEmergencyAlarmEnabled && !this.hasFunctioningEmergencyAlarm(getObjectsInRoom)) {
      this.bEmergencyAlarmEnabled = false;
      this.updateEmergency();
    }
  }

  // ── Float-away — mirrors Room.lua:1951-2017 ─────────────────────────────

  /** Tick float-away timer for hidden non-player rooms. */
  tickFloatAway(context?: FloatAwayContext): boolean {
    if (this.nLastVisibility !== VISIBILITY_HIDDEN) {
      this.nFloatAwayTimerStart = null;
      return false;
    }

    if (this.nFloatAwayTimerStart === null) {
      this.nFloatAwayTimerStart = GameRules.elapsedTime;
    }

    if (GameRules.elapsedTime - this.nFloatAwayTimerStart > FLOAT_AWAY_TIME) {
      if (this.nNextFloatAwayTest === null || this.nNextFloatAwayTest < GameRules.elapsedTime) {
        this.nNextFloatAwayTest = GameRules.elapsedTime + 30;
        if (!this._canFloatAway()) {
          return false;
        }
        if (context) {
          this._doFloatAway(context);
        }
        return true;
      }
    }

    return false;
  }

  /** Check if this room + its team's rooms can float away (Lua Room:_attemptFloatAway). */
  private _canFloatAway(): boolean {
    // Player rooms and rooms without original team don't float away
    if (!this.nOriginalTeam || this.nOriginalTeam === TEAM_ID_PLAYER) return false;

    // Check contiguity — don't float away if connected to rooms of a different team
    for (const contig of this.tContiguousRooms) {
      if (contig.nOriginalTeam !== this.nOriginalTeam) return false;
    }

    return true;
  }

  private _doFloatAway(context: FloatAwayContext): void {
    const tilesToDestroy = new Map<string, { x: number; y: number }>();

    for (const tile of this.tiles) {
      tilesToDestroy.set(`${tile.x},${tile.y}`, tile);
    }
    for (const wall of this.tWalls.values()) {
      tilesToDestroy.set(`${wall.x},${wall.y}`, wall);
    }

    const deathCause = context.deathCause ?? 7;
    for (const tile of tilesToDestroy.values()) {
      const objects = context.getObjectsAtTile?.(tile.x, tile.y) ?? [];
      for (const obj of objects) {
        obj.remove();
      }

      const characters = context.getCharactersAtTile?.(tile.x, tile.y) ?? [];
      for (const char of characters) {
        char.kill(deathCause);
      }

      context.grid.set(tile.x, tile.y, TileType.SPACE);
    }

    context.removeRoom?.(this);
  }

  /** Adjoining rooms (connected through doors). Set by RoomManager/PowerSystem contiguity. */
  getAdjoiningRooms(): Room[] {
    return this.tContiguousRooms;
  }
}
