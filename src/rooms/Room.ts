import { ZoneType } from '../world/ZoneType';
import type { ObjectTag } from '../core/ObjectList';
import type { Zone } from '../zones/Zone';
import { TEAM_ID_PLAYER, OXYGEN_LOW, OXYGEN_SUFFOCATING } from '../characters/CharacterConstants';
import { GameRules } from '../core/GameRules';

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

  /** Power fields (populated in Phase 6). */
  nPowerOutput = 0;
  nPowerDraw = 0;
  nPowerSupply = 0;

  /** Does this room have sufficient power? (Lua Room:hasPower) */
  get hasPowerFlag(): boolean { return this.nPowerSupply >= 0 && this.nPowerOutput > 0; }

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
  /** User-initiated oxygen lockdown. */
  bUserBlockOxygen = false;
  /** Team that owns this room (default: TEAM_ID_PLAYER). */
  nTeam = TEAM_ID_PLAYER;
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
    } else if (this.nPowerOutput === 0) {
      // No generator at all → vacuum/dark lighting (Lua: LIGHTING_SCHEME_VACUUM)
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
      this.nLightingScheme = nNewScheme;
      this.nLightFadeTimer = 0;
      this.nLightFadesPerSecond = 0.5;
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

  /** Fast tick: update character count, burning status. Called every frame. */
  tickFast(_dt: number): void {
    this.nCharacters = this.tCharacters.size;
  }

  /** Slow tick: update hazard status, visibility, lighting. Round-robin'd by RoomManager. */
  tickSlow(_dt: number): void {
    this.tickVisibility();
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

  /** Adjoining rooms (connected through doors). Set by RoomManager/PowerSystem contiguity. */
  getAdjoiningRooms(): Room[] {
    return this.tContiguousRooms;
  }
}
