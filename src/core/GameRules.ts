/**
 * GameRules.ts — Central game state controller.
 * Mirrors GameRules.lua: constants, mode system, time scaling, star dates, tick order.
 */

// ── Matter economy ──────────────────────────────────────────────────────
export const STARTING_MATTER = 2000;
export const MAT_BUILD_FLOOR = 6;
export const MAT_BUILD_DOOR = 12;
export const MAT_BUILD_AIRLOCK_DOOR = 15;
export const MAT_BUILD_HEAVY_DOOR = 20;
export const MAT_VAPE_FLOOR = 4;
export const MAT_MINE_ROCK_MIN = 30;
export const MAT_MINE_ROCK_MAX = 50;
export const MAT_MINE_ROCK_MIN_LVL2 = 40;
export const MAT_MINE_ROCK_MAX_LVL2 = 60;
export const MAT_VAPE_OBJECT_PCT = 0.75;
export const MAT_CORPSE_MIN = 130;
export const MAT_CORPSE_MAX = 170;

// ── Life support ────────────────────────────────────────────────────────
export const RECYCLERS_PER_CITIZEN = 3;

// ── Time scaling ────────────────────────────────────────────────────────
export const MAX_PLAYER_TIME_SCALE = 4;
export const MIN_PLAYER_TIME_SCALE = 0.25;

// ── Spacedate ───────────────────────────────────────────────────────────
export const SPACEDATE_BASE_DEFAULT = 9091;
export const SPACEDATE_BASE_RANDOM_OFFSET = 9;

// ── Derelicts ───────────────────────────────────────────────────────────
export const MIN_DERELICTS = 7;
export const MAX_DERELICTS = 9;
export const DERELICT_MARGIN = 5;

// ── Character upgrade music threshold ───────────────────────────────────
export const CHARACTER_UPGRADE_MIN = 12;

// ── Edit / interaction modes (from GameRules.lua:147-169) ───────────────
export const MODE_INSPECT = 0;
export const MODE_VAPORIZE = 1;
export const MODE_MAKE_CHARACTER = 2;
export const MODE_BUILD_ROOM = 3;
export const MODE_BUILD_WALL = 4;
export const MODE_MINE = 5;
export const MODE_CANCEL_COMMAND = 6;
export const MODE_PICK = 7;
export const MODE_NOTHING = 8;
export const MODE_BUILD_DOOR = 15;
export const MODE_PLACE_PROP = 16;
export const MODE_GLOBAL_JOB = 17;
export const MODE_PLACE_ASTEROID = 18;
export const MODE_DELETE_CHARACTER = 19;
export const MODE_PLACE_SPAWNER = 20;
export const MODE_BEACON = 21;
export const MODE_BUILD_FLOOR = 22;
export const MODE_DAMAGE_WORLD_TILE = 23;
export const MODE_DEMOLISH = 24;
export const MODE_PLACE_WORLDOBJECT = 25;
export const MODE_ERROR = -1;

// ── Savegame ────────────────────────────────────────────────────────────
export const SAVEGAME_VERSION = 7;

/**
 * Subsystem tick interface — any system that participates in the game loop.
 */
export interface TickableSystem {
  onTick(dt: number): void;
}

/**
 * GameRules — singleton managing global game state and the master tick loop.
 *
 * Mirrors GameRules.lua:
 *  - nMatter, simTime, elapsedTime, deltaTime
 *  - playerTimeScale (1x .. 4x)
 *  - stardate calculation
 *  - onTick() calling all subsystems in the original Lua order
 */
class GameRulesClass {
  // ── Runtime state ───────────────────────────────────────────────────
  nMatter = STARTING_MATTER;
  simTime = 0;
  elapsedTime = 0;
  deltaTime = 0;

  playerTimeScale = 1;
  prePauseSpeed = 1;
  bRunning = true;

  currentMode = MODE_INSPECT;

  /** Lua GameRules.selectedCharIndex — for ,/. character cycling. */
  selectedCharIndex = 0;
  /** Lua GameRules.selectedRoomIndex — for Shift+,/. room cycling. */
  selectedRoomIndex = 0;

  /** Matter cost multiplier (Lua GameRules.matterMult, default 1). */
  matterMult = 1;

  /** Sandbox mode — disables hostile events until 100+ population (Lua NewBase.lua sandbox). */
  bSandboxMode = false;
  /** Disaster mode unlocked (Lua GameRules.bDisasterMode). */
  bDisasterMode = false;
  /** Game is in a cutscene (Lua GameRules.bInCutscene). */
  bInCutscene = false;
  /** Time is locked (pause override, Lua GameRules.bTimeLocked). */
  bTimeLocked = false;
  /** Power holiday — tutorial grace period, all objects get power (Lua g_PowerHoliday). */
  bPowerHoliday = false;
  /** Time when power holiday expires (Lua GameRules.powerHolidayEndTime). */
  powerHolidayEndTime: number | null = null;
  /** Power holiday duration: 10 minutes (Lua 60*10 = 600 seconds). */
  static readonly POWER_HOLIDAY_DURATION = 600;
  /** Prohibit suffocation (Lua GameRules.bProhibitSuffocation). */
  bProhibitSuffocation = false;
  /** Cutaway mode — hide back walls to show interior (Lua GameRules.cutawayMode). */
  cutawayMode = false;

  sStarDate = '0.0';
  sStarTime = '00';

  SPACEDATE_BASE = SPACEDATE_BASE_DEFAULT;

  // Hint state (mirrors Lua)
  bHasHadEnclosedRooms = false;
  bHasZoned = false;
  bHasStartedResearch = false;

  // Timestamps
  nLastDutyAccident = 0;
  nLastNewShip = 0;

  /**
   * Registered subsystems, ticked in order.
   * Slots match the Lua tick order from GameRules.lua:338-437.
   * Null slots are skipped (system not yet implemented).
   *
   * Index → System:
   *  0  Pathfinder.staticTick
   *  1  EventController.onTick
   *  2  Oxygen.onTick
   *  3  Fire.onTick
   *  4  Projectile.onTick
   *  5  AnimatedSprite.tickAll
   *  6  Room.onTick
   *  7  EnvObject.staticTick
   *  8  Turret.tick
   *  9  World.onTick
   * 10  Lighting.onTick
   * 11  CharacterManager.onTick
   * 12  WorldObject.staticTick
   * 13  Base.onTick
   * 14  CommandObject.onTick
   * 15  Hint.onTick
   * 16  Goal.onTick
   */
  private systems: (TickableSystem | null)[] = new Array(17).fill(null);

  /** Labels for debug profiling */
  private systemLabels: string[] = [
    'Pathfinder',
    'EventController',
    'Oxygen',
    'Fire',
    'Projectile',
    'AnimatedSprite',
    'Room',
    'EnvObject',
    'Turret',
    'World',
    'Lighting',
    'CharacterManager',
    'WorldObject',
    'Base',
    'CommandObject',
    'Hint',
    'Goal',
  ];

  // ── Initialization ──────────────────────────────────────────────────

  init() {
    this.nMatter = STARTING_MATTER;
    this.simTime = 0;
    this.elapsedTime = 0;
    this.deltaTime = 0;
    this.playerTimeScale = 1;
    this.prePauseSpeed = 1;
    this.bRunning = true;
    this.currentMode = MODE_INSPECT;

    // Lua GameRules.randomSetup — reset state fields
    this.nLastDutyAccident = 0;
    this.nLastNewShip = 0;
    this.bHasHadEnclosedRooms = false;
    this.bHasZoned = false;
    this.bHasStartedResearch = false;

    // Reset flags
    this.matterMult = 1;
    // Note: bSandboxMode is NOT reset here — it's set before game start
    this.bDisasterMode = false;
    this.bInCutscene = false;
    this.bTimeLocked = false;
    this.bProhibitSuffocation = false;
    this.cutawayMode = false;

    // Start power holiday — 10 minute grace period (Lua GameRules.lua)
    this.bPowerHoliday = true;
    this.powerHolidayEndTime = GameRulesClass.POWER_HOLIDAY_DURATION;

    // Randomize spacedate base (matches Lua: SPACEDATE_BASE + random(0, OFFSET))
    this.SPACEDATE_BASE =
      SPACEDATE_BASE_DEFAULT + Math.floor(Math.random() * (SPACEDATE_BASE_RANDOM_OFFSET + 1));
    this.sStarDate = this.SPACEDATE_BASE + '.0';
    this.sStarTime = '00';
  }

  // ── Subsystem registration ─────────────────────────────────────────

  /** Register a tickable system at the given slot index. */
  registerSystem(slot: number, system: TickableSystem) {
    if (slot < 0 || slot >= this.systems.length) {
      console.warn(`GameRules: invalid system slot ${slot}`);
      return;
    }
    this.systems[slot] = system;
  }

  /** Unregister a tickable system. */
  unregisterSystem(slot: number) {
    if (slot >= 0 && slot < this.systems.length) {
      this.systems[slot] = null;
    }
  }

  /** Get system label for debugging */
  getSystemLabel(slot: number): string {
    return this.systemLabels[slot] ?? `System${slot}`;
  }

  // ── Matter economy ──────────────────────────────────────────────

  /** Add matter (positive) or subtract (negative). Applies matterMult for gains. */
  addMatter(amount: number): void {
    if (amount > 0) {
      this.nMatter += Math.floor(amount * this.matterMult);
    } else {
      this.nMatter += amount; // costs not multiplied
    }
  }

  // ── Cutaway mode (Lua GameRules.lua:1547-1559) ──────────────────

  /** Toggle cutaway mode (Lua GameRules.cycleCutawayMode). */
  cycleCutawayMode() {
    this.cutawayMode = !this.cutawayMode;
  }

  /** Enable or disable cutaway mode (Lua GameRules.enableCutawayMode). */
  enableCutawayMode(bEnable: boolean) {
    this.cutawayMode = bEnable;
  }

  /** Check if cutaway mode is enabled (Lua GameRules.isCutawayModeEnabled). */
  isCutawayModeEnabled(): boolean {
    return this.cutawayMode;
  }

  // ── Time scaling ──────────────────────────────────────────────────

  setTimeScale(scale: number) {
    if (this.bTimeLocked) return;
    this.playerTimeScale = Math.max(
      MIN_PLAYER_TIME_SCALE,
      Math.min(MAX_PLAYER_TIME_SCALE, scale),
    );
  }

  /** Lua GameRules.togglePause — spacebar pause toggle. */
  togglePause() {
    if (this.bTimeLocked) return;
    if (this.playerTimeScale === 0) {
      this.playerTimeScale = this.prePauseSpeed;
    } else {
      this.prePauseSpeed = this.playerTimeScale;
      this.playerTimeScale = 0;
    }
  }

  /** Lua GameRules.timeFaster — ] key, doubles speed or unpauses to 1x. */
  timeFaster() {
    if (this.playerTimeScale === 0) {
      this.setTimeScale(1);
    } else {
      this.setTimeScale(Math.min(MAX_PLAYER_TIME_SCALE, this.playerTimeScale * 2));
    }
  }

  /** Lua GameRules.timeSlower — [ key, halves speed or pauses. */
  timeSlower() {
    if (this.playerTimeScale <= 1) {
      this.setTimeScale(0);
    } else {
      this.setTimeScale(Math.max(MIN_PLAYER_TIME_SCALE, this.playerTimeScale * 0.5));
    }
  }

  // ── Stardate calculation (GameRules.lua:1073-1104) ────────────────

  getStardateMinute(time?: number): number {
    const t = time ?? this.simTime;
    return Math.floor(t % 60);
  }

  getStardateMinuteString(time?: number): string {
    const m = this.getStardateMinute(time);
    return m < 10 ? '0' + m : String(m);
  }

  getStardateHour(time?: number): number {
    const t = time ?? this.simTime;
    const elapsedHours = t / 60;
    return Math.floor(elapsedHours % 24);
  }

  getStardateTotalDays(time?: number): number {
    const t = time ?? this.simTime;
    const elapsedDays = t / (60 * 24);
    return this.SPACEDATE_BASE + Math.floor(elapsedDays);
  }

  getFullStarDateString(time?: number): string {
    const days = this.getStardateTotalDays(time);
    const hours = this.getStardateHour(time);
    const minutes = this.getStardateMinuteString(time);
    return `${days}.${hours}:${minutes}`;
  }

  // ── Master tick (GameRules.lua:338-437) ────────────────────────────

  /**
   * Called every frame from GameScene.update().
   * @param dt Wall-clock delta in seconds (already converted from ms).
   */
  onTick(dt: number) {
    if (!this.bRunning) return;

    // Scale wall-clock time by player speed
    this.deltaTime = dt * this.playerTimeScale;
    this.simTime += this.deltaTime;
    this.elapsedTime += this.deltaTime;

    // Check power holiday expiry (Lua GameRules.lua)
    if (this.powerHolidayEndTime !== null && this.elapsedTime >= this.powerHolidayEndTime) {
      this.powerHolidayEndTime = null;
      this.bPowerHoliday = false;
    }

    // Tick all registered subsystems in order
    const gameDt = this.deltaTime;
    for (let i = 0; i < this.systems.length; i++) {
      const sys = this.systems[i];
      if (sys) {
        sys.onTick(gameDt);
      }
    }

    // Update stardate strings
    this.sStarDate = this.getStardateTotalDays() + '.' + this.getStardateHour();
    this.sStarTime =
      String(this.getStardateHour()).padStart(2, '0') +
      ':' +
      this.getStardateMinuteString();
  }
}

/** Global singleton, mirrors `g_GameRules` in Lua. */
export const GameRules = new GameRulesClass();
