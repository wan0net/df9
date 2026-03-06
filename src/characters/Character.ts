import { Needs } from './Needs';
import { Base } from '../core/Base';
import { tileToScreen } from '../world/IsometricUtils';
import { TILE_HALF_W, TILE_HALF_H } from '../config';
import { generateName } from './CitizenNames';
import { generatePersonality, type PersonalityTraits } from './Personality';
import { getAllTopics, getTopicForActivity } from './Topics';
import {
  UNEMPLOYED, TEAM_ID_PLAYER, JOB_NAMES, tJobs,
  BUILDER, TECHNICIAN, MINER, EMERGENCY, BARTENDER, BOTANIST, SCIENTIST, DOCTOR, JANITOR,
  STARTING_HIT_POINTS, BASE_SPEED,
  MORALE_MAX, MORALE_MIN, MORALE_TICK,
  MAX_ROOM_MORALE_BOOST, ROOM_MORALE_TICK, ROOM_MORALE_FALLOFF_END,
  ANGER_MAX, ANGER_REDUCTION_PER_MORALE_TICK,
  MORALE_COMPETENCY_THRESHOLD, MORALE_COMPETENCY_MODIFIER,
  MORALE_SPEED_THRESHOLD, MORALE_LOW_SPEED_MODIFIER, MORALE_HIGH_SPEED_MODIFIER,
  MORALE_LOW_OXYGEN, MORALE_LOW_OXYGEN_THRESHOLD, MORALE_NEEDS_MET_BONUS,
  MORALE_NEEDS_LOW, MORALE_NEEDS_DECREASE, MORALE_NEEDS_HIGH, MORALE_NEEDS_INCREASE,
  NEEDS_STUFF_LOW, STUFF_NEED_LOG_FREQUENCY, MEMORY_STUFF_NEED,
  LOG_MORALE_NEEDS_RATE, MEMORY_LOGGED_MORALE_RECENTLY,
  ROOM_MORALE_LOG_THRESHOLD, GENERIC_LOG_FREQUENCY, MEMORY_GENERIC_LOG,
  EXPERIENCE_PER_LEVEL, MAX_COMPETENCY, STARTING_SKILL_POINTS,
  MAX_CHANCE_TO_FAIL, NO_FAIL_COMPETENCY_THRESHOLD,
  STATUS_HEALTHY, STATUS_DEAD, STATUS_SICK, STATUS_ILL, STATUS_INCAPACITATED,
  STATUS_RAMPAGE, STATUS_RAMPAGE_NONVIOLENT, STATUS_RAMPAGE_VIOLENT,
  CAUSE_OF_DEATH,
  SPACESUIT_MAX_OXYGEN,
  OXYGEN_SUFFOCATING, OXYGEN_SUFFOCATION_UNTIL_DEATH,
  UNNECESSARY_SPACESUIT_REMOVE,
  ANGER_REDUCTION_PER_MORALE_TICK_BRIG, VIOLENT_RAMPAGE_CHANCE,
  MAX_AFFINITY, STARTING_AFFINITY,
  MORALE_CITIZEN_DIES_MIN, MORALE_CITIZEN_DIES_MAX,
  MORALE_MAX_FAMILIARITY_DEATH, MORALE_MAX_AFFINITY_DEATH,
  DUTY_AFFINITY_XP_MAX_RATE, DUTY_AFFINITY_MORALE_MAX,
  RACE_HUMAN, RACE_TYPE, type RaceTypeDef,
  HUMAN_RACE_PCT, CAT_RACE_PCT,
  RACE_CAT, RACE_JELLY, RACE_TOBIAN, RACE_BIRDSHARK, RACE_CHICKEN, RACE_SHAMON,
} from './CharacterConstants';
import { GameRules } from '../core/GameRules';
import { Malady, type MaladyInstance } from '../malady/Malady';
import { CharacterInventory, createRandomStartingStuff } from '../inventory/Inventory';
import { ITEM_TEMPLATES } from '../inventory/InventoryData';
import type { Task } from '../utility/Task';
import { type LogEntry, addLog, postLogFromQueue, getLogCooldown, setElapsedTimeProvider } from './Log';
import { researchSystem } from '../research/ResearchSystem';

/** Character stats block (mirrors Lua tStats) */
export interface CharacterStats {
  sName: string;
  nJob: number;
  nTeam: number;
  nRace: number;
  nHP: number;
  nMaxHP: number;
  nStatus: number;
  personality: PersonalityTraits;
  nXP: number;
  /** Per-job competency (0-1) */
  tCompetency: Record<number, number>;
}

export class Character {
  id: number;
  tileX: number;
  tileY: number;
  screenX: number;
  screenY: number;
  needs: Needs;

  // ── Stats (mirrors Lua tStats) ──────────────────────────────
  tStats: CharacterStats;
  nMorale = 50;
  nAnger = 0;

  // ── Affinity & Familiarity (mirrors Lua Character.tAffinity/tFamiliarity) ──
  /** Topic-keyed affinity map. Keys: person IDs, 'DUTY_Builder', 'TAG_Red', etc. */
  tAffinity: Map<string, number> = new Map();
  /** Person-keyed familiarity map. Keys: character unique IDs. */
  tFamiliarity: Map<number, number> = new Map();

  // Spacewalking (original: tStatus.bSpacewalking)
  bSpacewalking = false;
  // On fire (original: Character.onFire)
  bOnFire = false;
  /** Total times this character has caught fire (for log). */
  nTotalTimesOnFire = 0;

  // ── Equipment & inventory ───────────────────────────────────
  /** Active diseases/maladies. */
  maladies: MaladyInstance[] = [];
  /** Items carried. */
  inventory = new CharacterInventory();
  /** Max items in inventory. */
  static readonly MAX_INVENTORY = 5;
  /** Equipped weapon name, null if unarmed */
  weapon: string | null = null;
  /** Currently held item name, null if empty hands */
  heldItem: string | null = null;
  /** Whether character is cuffed (brig/security) */
  bCuffed = false;
  /** Whether character is wearing a spacesuit */
  bSpacesuit = false;
  /** Remaining suit oxygen (in O2 units) */
  nSuitOxygen = 0;
  /** Cause of death (0 = alive) */
  nCauseOfDeath = 0;
  /** Rampage state (Lua tStatus.bRampageViolent / bRampageNonviolent) */
  bRampaging = false;
  bViolentRampage = false;
  bNonviolentRampage = false;
  /** Whether rampage has been observed by nearby characters. */
  bRampageObserved = false;
  /** Marked for cuffing by security (Lua tStatus.bMarkedForCuff). */
  bMarkedForCuff = false;
  /** Marked for execution by security (Lua tStatus.bMarkedForExecution). */
  bMarkedForExecution = false;
  /** Brawl partners keyed by character ID → start time (Lua tStatus.tBrawlingWith). */
  tBrawlingWith = new Map<number, number>();

  // ── Log/journal system (mirrors Lua Character.tLog/tLogQueue) ──
  tLog: LogEntry[] = [];
  tLogQueue: LogEntry[] = [];
  /** Cooldown timer for log posting. */
  private logCooldown = 0;

  /** Duty cycle: countdown timer (Lua nRemainingDutyTime).
   *  Positive = on duty, negative = off duty. Decrements every frame. */
  nRemainingDutyTime = 0;
  /** Shift duration in seconds */
  static readonly SHIFT_DURATION = 270;
  /** Rest duration in seconds */
  static readonly SHIFT_COOLDOWN = 360;

  // ── Survival state ─────────────────────────────────────────
  /** Suffocation timer in seconds (Lua tStatus.suffocationTime). Accumulates while O2 < OXYGEN_SUFFOCATING. */
  suffocationTime = 0;
  /** Low oxygen flag (Lua tStatus.bLowOxygen). */
  bLowOxygen = false;
  /** Timer for auto-removing unnecessary spacesuit in pressurized rooms. */
  private nUnnecessarySpacesuit = -1; // -1 = not tracking
  /** Time this character joined (immigration timestamp). */
  nJoinTime = 0;

  // Movement
  path: { x: number; y: number }[] = [];
  moving = false;
  /** Facing angle in radians (Y-axis rotation for 3D model). Updated on movement. */
  facingAngle = 0;
  private moveProgress = 0;
  private moveFrom = { x: 0, y: 0 };
  private moveTo = { x: 0, y: 0 };

  // AI
  idleTimer = 0;
  currentTask: Task | null = null;

  // Morale tick accumulator
  private moraleTickAccum = 0;
  /** Rolling room morale buffer (Lua tRoomScores, 5 samples averaged). */
  private tRoomScores: number[] = [];

  // ── Memory system (mirrors Lua Character.tMemory) ────────────
  /** Timed memory store: key → { value, expiry (GameRules.elapsedTime) } */
  private tMemory = new Map<string, { value: unknown; expiry: number }>();

  constructor(id: number, tileX: number, tileY: number) {
    this.id = id;
    this.tileX = tileX;
    this.tileY = tileY;
    this.needs = new Needs();

    // Generate character stats
    const name = generateName();
    const personality = generatePersonality();

    // Assign a random starting job
    const startingJob = tJobs[Math.floor(Math.random() * tJobs.length)];

    this.tStats = {
      sName: name,
      nJob: startingJob,
      nTeam: TEAM_ID_PLAYER,
      nRace: Character.rollRace(),
      nHP: STARTING_HIT_POINTS,
      nMaxHP: STARTING_HIT_POINTS,
      nStatus: STATUS_HEALTHY,
      personality,
      nXP: 0,
      tCompetency: {},
    };

    // Skill-point budget allocation (Lua: STARTING_SKILL_POINTS=8 across random jobs)
    const availableJobs = [...tJobs];
    let nPoints = STARTING_SKILL_POINTS;
    while (availableJobs.length > 0 && nPoints > 0) {
      const idx = Math.floor(Math.random() * availableJobs.length);
      const job = availableJobs.splice(idx, 1)[0];
      let pts: number;
      if (availableJobs.length === 0) {
        // Last job gets all remaining points (up to max starting competency)
        pts = Math.min(nPoints, Math.round(MAX_COMPETENCY * 0.2)); // ~2 points max
      } else {
        pts = Math.floor(Math.random() * Math.min(nPoints, 3)) + 1;
      }
      this.tStats.tCompetency[job] = Math.min(1, pts / MAX_COMPETENCY);
      nPoints -= pts;
    }

    // Init duty cycle to random off-duty state (Lua: -SHIFT_COOLDOWN * random(0.1, 1))
    this.nRemainingDutyTime = -Character.SHIFT_COOLDOWN * (0.1 + Math.random() * 0.9);

    // Join time
    this.nJoinTime = GameRules.elapsedTime;

    const pos = tileToScreen(tileX, tileY);
    this.screenX = pos.x + TILE_HALF_W;
    this.screenY = pos.y + TILE_HALF_H;
  }

  // ── Race generation (Lua CharacterConstants spawn rates) ──

  /** Roll a random citizen race. 60% human, 2% cat, rest split evenly. */
  static rollRace(): number {
    const roll = Math.random() * 100;
    if (roll < HUMAN_RACE_PCT) return RACE_HUMAN;
    if (roll < HUMAN_RACE_PCT + CAT_RACE_PCT) return RACE_CAT;
    // Remaining races split evenly among: JELLY, TOBIAN, BIRDSHARK, CHICKEN, SHAMON
    const remainingRaces = [RACE_JELLY, RACE_TOBIAN, RACE_BIRDSHARK, RACE_CHICKEN, RACE_SHAMON];
    return remainingRaces[Math.floor(Math.random() * remainingRaces.length)];
  }

  // ── Accessors ──────────────────────────────────────────────

  getName(): string { return this.tStats.sName; }
  getRace(): number { return this.tStats.nRace; }
  getRaceDef(): RaceTypeDef { return RACE_TYPE[this.tStats.nRace] ?? RACE_TYPE[RACE_HUMAN]; }
  getJob(): number { return this.tStats.nJob; }
  getJobName(): string { return JOB_NAMES[this.tStats.nJob] ?? 'Unknown'; }
  getHP(): number { return this.tStats.nHP; }
  setHP(hp: number) { this.tStats.nHP = Math.max(0, Math.min(this.tStats.nMaxHP, hp)); }
  /** Apply damage to this character. Kills if HP drops to 0. */
  takeDamage(amount: number) {
    this.tStats.nHP = Math.max(0, this.tStats.nHP - amount);
  }
  /** Whether character has been stunned/knocked out (Lua KnockedOut malady). */
  bIncapacitated = false;
  isAlive(): boolean { return this.tStats.nStatus !== STATUS_DEAD; }
  /** Whether this character breathes (MONSTER/KILLBOT do not). */
  doesBreathe(): boolean { return this.getRaceDef().bBreathes; }
  /** Whether this character can be cuffed (MONSTER/KILLBOT cannot). */
  canBeCuffed(): boolean { return this.getRaceDef().bCanBeCuffed; }
  /** Whether this character can receive medical treatment (MONSTER/KILLBOT cannot). */
  canBeTreated(): boolean { return this.getRaceDef().bCanBeTreated; }
  /** Get melee damage for this character's race. */
  getMeleeDamage(): number { return this.getRaceDef().nMeleeDamage; }

  setJob(job: number) {
    this.tStats.nJob = job;
    // Lua Character.lua:744 — security officers auto-equip weapon based on research
    if (job === EMERGENCY) {
      this.weapon = researchSystem.isCompleted('LaserRifles') ? 'LaserRifle' : 'Pistol';
    }
  }

  /**
   * Get the autocreate weapon template for this character's job.
   * Lua Character.lua:744 _getAutocreateWeaponTemplate.
   */
  getAutocreateWeapon(): string | null {
    if (this.tStats.nJob === EMERGENCY) {
      return researchSystem.isCompleted('LaserRifles') ? 'LaserRifle' : 'Pistol';
    }
    return null;
  }

  /**
   * Put on a spacesuit. Lua Character.lua:4167-4169.
   * SpaceSuit2 research increases capacity from 480 to 600 seconds.
   */
  spacesuitOn(): void {
    this.bSpacesuit = true;
    const seconds = researchSystem.isCompleted('SpaceSuit2') ? 600 : 480;
    this.nSuitOxygen = seconds * 200; // OXYGEN_PER_SECOND = 200
  }

  // ── Affinity methods (mirrors Lua Character:getAffinity/addAffinity) ──

  /** Check if affinity exists for a topic without auto-generating. */
  hasAffinity(key: string): boolean {
    return this.tAffinity.has(key);
  }

  /** Generate initial random affinity for a topic (Lua Character:generateAffinityFor). */
  generateAffinityFor(topicID: string): void {
    if (this.tAffinity.has(topicID)) return;
    const nMin = -STARTING_AFFINITY;
    const nMax = STARTING_AFFINITY;
    this.tAffinity.set(topicID, nMin + Math.random() * (nMax - nMin));
  }

  /** Get affinity for a topic key. Auto-generates random initial value if missing. */
  getAffinity(key: string): number {
    if (!this.tAffinity.has(key)) {
      this.generateAffinityFor(key);
    }
    return this.tAffinity.get(key)!;
  }

  /** Add to affinity, clamped to [-MAX_AFFINITY, MAX_AFFINITY]. */
  addAffinity(key: string, delta: number): void {
    const current = this.getAffinity(key);
    this.tAffinity.set(key, Math.max(-MAX_AFFINITY, Math.min(MAX_AFFINITY, current + delta)));
  }

  /** Get normalized affinity (0-1 range). -20→0, 0→0.5, +20→1. */
  getNormalizedAffinity(key: string): number {
    return 0.5 + 0.5 * this.getAffinity(key) / MAX_AFFINITY;
  }

  /** Get job affinity. */
  getJobAffinity(jobId?: number): number {
    const job = jobId ?? this.tStats.nJob;
    return this.getAffinity(`DUTY_${JOB_NAMES[job] ?? 'Unknown'}`);
  }

  /** Get affinity for an activity (Lua Character:getAffinityForActivity). */
  getAffinityForActivity(activityName: string): number | null {
    const topic = getTopicForActivity(activityName);
    if (topic) return this.getAffinity(topic);
    return null;
  }

  /** Get favorite topic in a category (highest affinity). Lua: Character:getFavorite. */
  getFavorite(category: string): string | null {
    const topics = getAllTopics();
    let favorite: string | null = null;
    let favAff = -MAX_AFFINITY;
    for (const [topicID, tData] of Object.entries(topics)) {
      if (tData.category === category) {
        const aff = this.getAffinity(topicID);
        if (aff > favAff) {
          favorite = topicID;
          favAff = aff;
        }
      }
    }
    return favorite;
  }

  /** Get people with affinity above/below threshold. Lua: Character:getPeopleOfAffinity. */
  getPeopleOfAffinity(nAffinity: number, bGreaterThan: boolean): { sID: string; nAffinity: number }[] {
    const results: { sID: string; nAffinity: number }[] = [];
    const topics = getAllTopics();
    for (const [topicID, tData] of Object.entries(topics)) {
      if (tData.category !== 'People' || topicID === String(this.id)) continue;
      const aff = this.getAffinity(topicID);
      if (bGreaterThan ? aff >= nAffinity : aff < nAffinity) {
        results.push({ sID: topicID, nAffinity: aff });
      }
    }
    return results;
  }

  // ── Familiarity methods (mirrors Lua Character:getFamiliarity/addFamiliarity) ──

  /** Get familiarity with another character (0 = stranger). */
  getFamiliarity(charId: number): number {
    return this.tFamiliarity.get(charId) ?? 0;
  }

  /** Add familiarity with another character. */
  addFamiliarity(charId: number, amount: number): void {
    this.tFamiliarity.set(charId, (this.tFamiliarity.get(charId) ?? 0) + amount);
  }

  /** Calculate morale loss from a death based on affinity/familiarity.
   * Lua: lerp(-4, -60, (familiarity * affinity) / (100 * 10)) */
  getDeathMoraleLoss(deadCharId: number): number {
    const familiarity = Math.min(this.getFamiliarity(deadCharId), MORALE_MAX_FAMILIARITY_DEATH);
    const affinity = Math.max(0, Math.min(this.getAffinity(String(deadCharId)), MORALE_MAX_AFFINITY_DEATH));
    const pct = (familiarity * affinity) / (MORALE_MAX_FAMILIARITY_DEATH * MORALE_MAX_AFFINITY_DEATH);
    return MORALE_CITIZEN_DIES_MIN + (MORALE_CITIZEN_DIES_MAX - MORALE_CITIZEN_DIES_MIN) * pct;
  }

  /** Get job affinity XP multiplier (0.5x to 1.5x). */
  getJobXPMultiplier(jobId?: number): number {
    const norm = this.getNormalizedAffinity(`DUTY_${JOB_NAMES[jobId ?? this.tStats.nJob] ?? 'Unknown'}`);
    return (1 - DUTY_AFFINITY_XP_MAX_RATE) + 2 * DUTY_AFFINITY_XP_MAX_RATE * norm;
  }

  /** Get job affinity morale modifier (-0.4 to +0.4). */
  getJobMoraleModifier(jobId?: number): number {
    const norm = this.getNormalizedAffinity(`DUTY_${JOB_NAMES[jobId ?? this.tStats.nJob] ?? 'Unknown'}`);
    return -DUTY_AFFINITY_MORALE_MAX + 2 * DUTY_AFFINITY_MORALE_MAX * norm;
  }

  /**
   * Get stuff satisfaction score (-100 to +100).
   * Lua Character:getStuffSatisfaction — based on owned items and affinity.
   * Simplified: counts owned stuff items, applies log10 curve.
   */
  getStuffSatisfaction(): number {
    // Count stuff items in inventory (check template bStuff flag)
    const nStuff = this.inventory.getAll().filter(i => ITEM_TEMPLATES[i.sTemplate]?.bStuff).length;
    // Base value 1, each stuff item adds ~1 (simplified from affinity * 0.1)
    let nTotal = 1 + nStuff;
    nTotal = Math.max(1, Math.min(10, nTotal));
    // Log10 curve: [1,10] → [0,1], then remap to [-100, +100]
    return Math.log10(nTotal) * 200 - 100;
  }

  // ── Memory system ──────────────────────────────────────────

  /** Store a memory with a duration in seconds (Lua Character:storeMemory). */
  storeMemory(key: string, value: unknown, duration: number): void {
    this.tMemory.set(key, { value, expiry: GameRules.elapsedTime + duration });
  }

  /** Retrieve a memory, returning null if expired or absent (Lua Character:retrieveMemory). */
  retrieveMemory(key: string): unknown {
    const entry = this.tMemory.get(key);
    if (!entry) return null;
    if (GameRules.elapsedTime >= entry.expiry) {
      this.tMemory.delete(key);
      return null;
    }
    return entry.value;
  }

  /** Remove a specific memory. */
  clearMemory(key: string): void {
    this.tMemory.delete(key);
  }

  /** Tick memory: purge expired entries (called from update). */
  private tickMemory(): void {
    const now = GameRules.elapsedTime;
    for (const [key, entry] of this.tMemory) {
      if (now >= entry.expiry) {
        this.tMemory.delete(key);
      }
    }
  }

  /** Get all memory entries (for save/load). */
  getMemoryEntries(): [string, { value: unknown; expiry: number }][] {
    return Array.from(this.tMemory.entries());
  }

  /** Restore memory entries (from save data). */
  loadMemoryEntries(entries: [string, { value: unknown; expiry: number }][]): void {
    this.tMemory.clear();
    for (const [key, entry] of entries) {
      this.tMemory.set(key, entry);
    }
  }

  // ── Update ─────────────────────────────────────────────────

  update(delta: number) {
    const dtSec = delta / 1000;

    // Duty cycle countdown (Lua Character.lua:2358)
    this.nRemainingDutyTime -= dtSec;

    // Violent-rampage auto-end: if only 1 character left on team (Lua Character.lua:2347-2351)
    // (checked by CharacterManager which has team info)

    // Tick memory expiry
    this.tickMemory();

    // Tick maladies (contagion, stages, specials, expiry)
    Malady.tickMaladies(this, dtSec);

    // Update status based on maladies
    if (this.maladies.length > 0 && this.tStats.nStatus === STATUS_HEALTHY) {
      const hasSevere = this.maladies.some(m => m.bSymptomatic && m.nSeverity >= 0.5);
      this.tStats.nStatus = hasSevere ? STATUS_ILL : STATUS_SICK;
    } else if (this.maladies.length === 0 && (this.tStats.nStatus === STATUS_SICK || this.tStats.nStatus === STATUS_ILL)) {
      this.tStats.nStatus = STATUS_HEALTHY;
    }

    // Log tick — post queued log entry when cooldown expires
    this.logCooldown -= dtSec;
    if (this.logCooldown <= 0 && this.tLogQueue.length > 0) {
      postLogFromQueue(this);
      this.logCooldown = getLogCooldown(this);
    }

    if (this.moving) {
      this.moveProgress += (delta / 1000) * this.getEffectiveSpeed();
      if (this.moveProgress >= 1) {
        this.tileX = this.moveTo.x;
        this.tileY = this.moveTo.y;
        this.moveProgress = 0;
        this.moving = false;

        if (this.path.length > 0) {
          this.moveToNext();
        }
      }

      const fromPos = tileToScreen(this.moveFrom.x, this.moveFrom.y);
      const toPos = tileToScreen(this.moveTo.x, this.moveTo.y);
      this.screenX = fromPos.x + TILE_HALF_W + (toPos.x - fromPos.x) * this.moveProgress;
      this.screenY = fromPos.y + TILE_HALF_H + (toPos.y - fromPos.y) * this.moveProgress;
    }
  }

  /** Update morale and anger per tick. dt in seconds (game-scaled). */
  updateMorale(dt: number, roomMoraleScore = 0, roomZoneName?: string) {
    this.moraleTickAccum += dt;
    if (this.moraleTickAccum >= MORALE_TICK) {
      this.moraleTickAccum -= MORALE_TICK;

      // Anger reduction first (Lua tickMorale lines 5996-6001)
      if (this.bCuffed) {
        this.angerReduction(ANGER_REDUCTION_PER_MORALE_TICK_BRIG);
      } else {
        this.angerReduction(ANGER_REDUCTION_PER_MORALE_TICK);
      }

      // Hostiles skip morale
      if (this.tStats.nTeam !== TEAM_ID_PLAYER) return;

      // Skip morale tick while sleeping or rampaging (Lua Character.lua:6045)
      const taskName = this.currentTask?.name;
      if (taskName === 'SleepInBed' || taskName === 'SleepOnFloor' || this.bRampaging) {
        return;
      }

      // Low O2 morale penalty — mirrors Character.lua:6063-6069
      // Fires when no spacesuit and average O2 < MORALE_LOW_OXYGEN_THRESHOLD (Lua tile scale 0-65535)
      const o2LuaScale = this.needs.oxygen / 100 * 65535;
      if (!this.bSpacesuit && o2LuaScale < MORALE_LOW_OXYGEN_THRESHOLD) {
        this.addMorale(MORALE_LOW_OXYGEN);
        return; // Skip other morale effects this tick (mirrors Lua early return)
      }

      // Morale drifts based on needs (needs range -100..+100)
      // Lua tickMorale lines 6036-6061
      let bLogged = false;
      const needValues = {
        Hunger: this.needs.hunger,
        Energy: this.needs.energy,
        Fun: this.needs.amusement,
        Social: this.needs.social,
      };
      const avgNeed = (needValues.Hunger + needValues.Energy + needValues.Fun + needValues.Social) / 4;
      let sLowestNeed: string | null = null;
      let sHighestNeed: string | null = null;
      let nLowest = Infinity;
      let nHighest = -Infinity;
      for (const [name, val] of Object.entries(needValues)) {
        if (val < nLowest) { nLowest = val; sLowestNeed = name; }
        if (val > nHighest) { nHighest = val; sHighestNeed = name; }
      }

      if (avgNeed < MORALE_NEEDS_LOW) {
        this.addMorale(MORALE_NEEDS_DECREASE);
      } else if (avgNeed > MORALE_NEEDS_HIGH) {
        this.addMorale(MORALE_NEEDS_INCREASE);
      }

      // Needs-based log (Lua Character.lua:6049-6061, rate-limited)
      if ((sLowestNeed || sHighestNeed) && !this.retrieveMemory(MEMORY_LOGGED_MORALE_RECENTLY)) {
        if (avgNeed < MORALE_NEEDS_LOW && sLowestNeed) {
          addLog('MORALE_LOW_NEED', this);
          bLogged = true;
        } else if (avgNeed > MORALE_NEEDS_HIGH && sHighestNeed) {
          addLog('MORALE_HIGH_NEED', this);
          bLogged = true;
        }
        if (bLogged) {
          this.storeMemory(MEMORY_LOGGED_MORALE_RECENTLY, true, LOG_MORALE_NEEDS_RATE);
        }
      }

      // Needs-met bonus — mirrors Character.lua:6067-6069
      const bAllNeedsMet = this.needs.hunger > 0 && this.needs.energy > 0 &&
        this.needs.amusement > 0 && this.needs.social > 0;
      if (bAllNeedsMet && this.nMorale < 0) {
        this.addMorale(MORALE_NEEDS_MET_BONUS);
      }

      // Stuff satisfaction log (Lua Character.lua:6072-6076)
      const nStuffNeed = this.getStuffSatisfaction();
      if (nStuffNeed < NEEDS_STUFF_LOW && !this.retrieveMemory(MEMORY_STUFF_NEED) &&
          Math.random() < (this.tStats.personality.nChattiness ?? 0.5)) {
        this.storeMemory(MEMORY_STUFF_NEED, true, STUFF_NEED_LOG_FREQUENCY);
        addLog('MORALE_LOW_STUFF', this);
      }

      // Generic/social logs (Lua Character.lua:6078-6108, rate-limited)
      if (!bLogged && Math.random() < (this.tStats.personality.nChattiness ?? 0.5) &&
          !this.retrieveMemory(MEMORY_GENERIC_LOG)) {
        addLog('GENERIC', this);
        this.storeMemory(MEMORY_GENERIC_LOG, true, GENERIC_LOG_FREQUENCY);
      }

      // Job morale modifier (Lua Character.lua:6075 — duty affinity)
      this.addMorale(this.getJobMoraleModifier());

      // Room morale drift — rolling 5-sample average (Lua tRoomScores buffer)
      // Diminishing returns: no room morale bonus above morale 60 (Lua ROOM_MORALE_FALLOFF_END)
      this.tRoomScores.push(roomMoraleScore);
      if (this.tRoomScores.length > 5) this.tRoomScores.shift();
      const avgRoomMorale = this.tRoomScores.reduce((a, b) => a + b, 0) / this.tRoomScores.length;
      if (avgRoomMorale !== 0) {
        const drift = Math.min(MAX_ROOM_MORALE_BOOST, Math.abs(avgRoomMorale) * 0.1);
        if (avgRoomMorale > 0) {
          if (this.nMorale < ROOM_MORALE_FALLOFF_END) {
            this.nMorale = Math.min(MORALE_MAX, this.nMorale + drift);
          }
        } else {
          this.nMorale = Math.max(MORALE_MIN, this.nMorale - drift);
        }
      }

      // Room morale log (Lua Character.lua:6153-6167)
      if (!bLogged && avgRoomMorale > ROOM_MORALE_LOG_THRESHOLD && roomZoneName) {
        if (roomZoneName === 'PUB') {
          addLog('MORALE_COOL_PUB', this);
        } else if (roomZoneName === 'GARDEN') {
          addLog('MORALE_COOL_GARDEN', this);
        } else {
          addLog('MORALE_COOL_ROOM_GENERIC', this);
        }
      }
    }
  }

  /** Apply a morale change (from event, chat, etc.) */
  addMorale(amount: number) {
    this.nMorale = Math.max(MORALE_MIN, Math.min(MORALE_MAX, this.nMorale + amount));
  }

  /** Apply anger change (scaled by temper trait and morale).
   * Mirrors Lua Character:angerEvent exactly:
   *   nMoraleMult = 2 - 1.6 * nMorale / 100  (maps [100→0.4, -100→3.6])
   *   if random() > nTemper then nAmt *= 0.25  (low temper usually deflects)
   */
  addAnger(amount: number) {
    // Linear morale multiplier: good mood deflects anger, bad mood amplifies it
    const moraleMult = 2 - 1.6 * this.nMorale / 100;
    let scaled = amount * moraleMult;
    // Temper as probability gate: high temper rarely deflects, low temper usually does
    const temper = this.tStats.personality.nTemper ?? 0.5;
    if (Math.random() > temper) {
      scaled *= 0.25;
    }
    this.nAnger = Math.min(ANGER_MAX, Math.max(0, this.nAnger + scaled));

    // Trigger rampage at max anger (Lua Character.lua:5827-5830)
    if (this.nAnger >= ANGER_MAX && !this.bRampaging && !this.bCuffed) {
      const eType = Math.random() < VIOLENT_RAMPAGE_CHANCE
        ? STATUS_RAMPAGE_VIOLENT : STATUS_RAMPAGE_NONVIOLENT;
      this.beginRampage(eType);
    }
  }

  /** Reduce anger with morale multiplier (Lua Character:angerReduction).
   *  Violent rampagers don't cool down unless in prison. */
  angerReduction(amount: number) {
    if (this.bViolentRampage && !this.bCuffed) return;

    // Remap morale to [0.7, 1.3) multiplier (Lua: .7 + .6 * nMorale / 100)
    const moraleMult = 0.7 + 0.6 * this.nMorale / 100;
    this.nAnger = Math.max(0, this.nAnger - amount * moraleMult);
    if (this.nAnger === 0 && this.bRampaging) {
      this.endRampage();
    }
  }

  /** Start a rampage (Lua Character:beginRampage). */
  beginRampage(eStatusType: number) {
    this.nAnger = ANGER_MAX;
    this.bRampaging = true;

    if (eStatusType === STATUS_RAMPAGE_NONVIOLENT) {
      if (!this.bViolentRampage) {
        this.bNonviolentRampage = true;
      }
      addLog('TANTRUM_START', this);
    } else if (eStatusType === STATUS_RAMPAGE_VIOLENT) {
      this.bViolentRampage = true;
      this.bNonviolentRampage = false;
      addLog('RAMPAGE_START', this);
    }

    // Interrupt current task
    if (this.currentTask) {
      this.currentTask = null;
    }
  }

  /** End rampage (Lua Character:endRampage). */
  endRampage() {
    this.bRampaging = false;
    this.bViolentRampage = false;
    this.bNonviolentRampage = false;
    this.bRampageObserved = false;
  }

  // ── Cuff/execute marking (Lua Character:setMarkedForCuff) ────────────────

  /** Mark character for cuffing. Angers non-authoritarian citizens. */
  setMarkedForCuff(bMarked: boolean): void {
    if (this.bMarkedForCuff === bMarked) return;
    this.bMarkedForCuff = bMarked;
    if (bMarked) {
      // Anger citizen (scaled by inverse of authoritarian trait)
      if (this.tStats.nTeam === TEAM_ID_PLAYER) {
        const auth = this.tStats.personality.nAuthoritarian ?? 0.5;
        this.addAnger(ANGER_MAX * (1 - auth));
      }
    } else if (this.bCuffed) {
      this.bCuffed = false; // uncuff
    }
  }

  /** Whether character is marked for cuffing. */
  isMarkedForCuff(): boolean {
    return this.bMarkedForCuff;
  }

  // ── Brawling (Lua Character:isBrawling/startBrawling/stopBrawling) ────────

  /** Check if brawling with another character. */
  isBrawling(otherId: number): boolean {
    return this.tBrawlingWith.has(otherId);
  }

  /** Start a brawl with another character. */
  startBrawling(otherId: number): void {
    this.tBrawlingWith.set(otherId, GameRules.elapsedTime);
  }

  /** Stop brawling with another character. */
  stopBrawling(otherId: number): void {
    this.tBrawlingWith.delete(otherId);
  }

  /** Cuff the character — ends rampage, sets bCuffed. */
  cuff(): void {
    this.bCuffed = true;
    this.bMarkedForCuff = false;
    this.endRampage();
  }

  // ── Duty cycle queries (Lua Character:onDuty / wantsWorkShiftTask) ──

  /** Whether currently on duty (positive nRemainingDutyTime). */
  onDuty(): boolean {
    return this.nRemainingDutyTime > 0;
  }

  /** Whether character wants to start/continue a work shift task. */
  wantsWorkShiftTask(): boolean {
    if (this.bCuffed) return false;
    if (this.nRemainingDutyTime > 0) return true;
    // Currently doing a work task — continue it
    if (this.currentTask?.tags?.WorkShift) return true;
    // Been off duty for a long time — favor work (Lua: < -SHIFT_COOLDOWN * 1.5)
    if (this.nRemainingDutyTime < -Character.SHIFT_COOLDOWN * 1.5) return true;
    return false;
  }

  /** Called when a new task starts — reset duty timer if WorkShift task after cooldown.
   *  Lua Character:_newTaskStarted (lines 2963-2970). */
  onNewTaskStarted(task: Task) {
    if (this.nRemainingDutyTime < -Character.SHIFT_COOLDOWN && task.tags?.WorkShift) {
      this.nRemainingDutyTime = Character.SHIFT_DURATION;
    }
  }

  /** Get effective competency for a job, modified by morale. */
  getEffectiveCompetency(jobId?: number): number {
    const job = jobId ?? this.tStats.nJob;
    const base = this.tStats.tCompetency[job] ?? 0;
    if (Math.abs(this.nMorale) > MORALE_COMPETENCY_THRESHOLD) {
      const sign = this.nMorale > 0 ? 1 : -1;
      return Math.max(0, Math.min(1, base + sign * MORALE_COMPETENCY_MODIFIER * base));
    }
    return base;
  }

  /** Get effective movement speed, modified by morale and maladies. */
  getEffectiveSpeed(): number {
    let speed = BASE_SPEED;
    if (this.nMorale < -MORALE_SPEED_THRESHOLD) {
      speed *= (1 + MORALE_LOW_SPEED_MODIFIER);
    } else if (this.nMorale > MORALE_SPEED_THRESHOLD) {
      speed *= (1 + MORALE_HIGH_SPEED_MODIFIER);
    }
    // Apply malady speed modifier
    speed *= Malady.getSpeedModifier(this);
    return speed;
  }

  // ── Job XP ────────────────────────────────────────────────

  /** Add job experience. May trigger competency level-up. */
  addJobExperience(amount: number) {
    this.tStats.nXP += amount;
    // Level up: every EXPERIENCE_PER_LEVEL XP → +1 competency (normalized 0-1)
    const job = this.tStats.nJob;
    const current = this.tStats.tCompetency[job] ?? 0;
    const levelsEarned = Math.floor(this.tStats.nXP / EXPERIENCE_PER_LEVEL) * (1 / MAX_COMPETENCY);
    const newComp = Math.min(1, Math.max(current, levelsEarned));
    if (newComp > current) {
      this.tStats.tCompetency[job] = newComp;
    }
  }

  /** Check if a task attempt fails based on job competency. */
  rollTaskFail(): boolean {
    const comp = this.getEffectiveCompetency();
    if (comp >= NO_FAIL_COMPETENCY_THRESHOLD) return false;
    const failChance = MAX_CHANCE_TO_FAIL * (1 - comp);
    return Math.random() < failChance;
  }

  /** Apply damage to HP */
  /** Lua Character:catchFire — sets onFire, tracks history, logs. */
  catchFire(): void {
    if (!this.bOnFire) {
      this.bOnFire = true;
      this.nTotalTimesOnFire++;
      const tLogData = { sTimesBurned: String(this.nTotalTimesOnFire) };
      if (this.nTotalTimesOnFire > 1) {
        addLog('CAUGHT_FIRE_MANY', this, tLogData);
      } else {
        addLog('CAUGHT_FIRE', this, tLogData);
      }
    }
  }

  /** Lua Character:douseFire */
  douseFire(): void {
    this.bOnFire = false;
  }

  damage(amount: number, cause: number = CAUSE_OF_DEATH.UNSPECIFIED) {
    this.tStats.nHP = Math.max(0, this.tStats.nHP - amount);
    if (this.tStats.nHP <= 0) {
      this.kill(cause);
    }
  }

  // ── Vacuum death animation state (Lua Character:_vacuumDisappear) ───
  /** Scale for vacuum death shrink animation (starts 0.5, shrinks to 0). */
  nVacuumScale = -1; // -1 = not in vacuum death
  /** Rotation accumulator for vacuum death spin. */
  nVacuumRotation = 0;

  /** Kill the character with a specific cause of death. */
  kill(cause: number = CAUSE_OF_DEATH.UNSPECIFIED) {
    if (this.tStats.nStatus === STATUS_DEAD) return; // Already dead

    // Death log (Lua: per-cause log entries)
    if (cause === CAUSE_OF_DEATH.SUFFOCATION) {
      addLog('DEATH_SUFFOCATION', this);
    } else if (cause === CAUSE_OF_DEATH.STARVATION) {
      addLog('DEATH_STARVATION', this);
    } else if (cause === CAUSE_OF_DEATH.FIRE) {
      addLog('DEATH_FIRE', this);
    }

    this.tStats.nHP = 0;
    this.tStats.nStatus = STATUS_DEAD;
    this.nCauseOfDeath = cause;
    this.moving = false;
    this.path = [];
    if (this.currentTask) {
      this.currentTask = null;
    }

    // Vacuum death animation — shrink + spin (Lua Character:_vacuumDisappear)
    if (cause === CAUSE_OF_DEATH.SUCKED_INTO_SPACE) {
      this.nVacuumScale = 0.5;
      this.nVacuumRotation = 0;
    }

    // Track hostile kill statistics
    if (this.tStats.nTeam !== TEAM_ID_PLAYER) {
      Base.incrementStat('nHostilesKilled');
      if (cause === CAUSE_OF_DEATH.SUFFOCATION) {
        Base.incrementStat('nHostilesAsphyxiated');
      }
    }
  }

  /** Tick vacuum death animation. Returns true if character should be deleted. */
  tickVacuumDeath(dt: number): boolean {
    if (this.nVacuumScale < 0) return false;
    this.nVacuumScale -= dt * 0.2;
    this.nVacuumRotation += 120 * dt * (Math.PI / 180);
    return this.nVacuumScale < 0.001;
  }

  startPath(path: { x: number; y: number }[]) {
    this.path = path.slice(1);
    if (this.path.length > 0) {
      this.moveToNext();
    }
  }

  private moveToNext() {
    const next = this.path.shift()!;
    this.moveFrom = { x: this.tileX, y: this.tileY };
    this.moveTo = { x: next.x, y: next.y };
    this.moveProgress = 0;
    this.moving = true;

    // Update facing angle based on screen-space movement direction
    // Lua convention: S=0°, SE=45°, E=90°, NE=135°, N=180°, NW=225°, W=270°, SW=315°
    // atan2(-dx, dy) gives: screen-down=0, screen-left=+90°, screen-up=180°
    // which matches the Lua S=0° convention for isometric view
    const fromPos = tileToScreen(this.tileX, this.tileY);
    const toPos = tileToScreen(next.x, next.y);
    const dx = toPos.x - fromPos.x;
    const dy = toPos.y - fromPos.y;
    if (dx !== 0 || dy !== 0) {
      // Compute angle matching Lua: S=0, clockwise positive
      let deg = Math.atan2(-dx, dy) * (180 / Math.PI);
      if (deg < 0) deg += 360;
      // Snap to nearest 8 compass direction (Lua ROT_DIR thresholds)
      const DIR_ANGLES = [
        { max: 22.5, deg: 0 },     // S
        { max: 67.5, deg: 45 },    // SE
        { max: 112.5, deg: 90 },   // E
        { max: 157.5, deg: 135 },  // NE
        { max: 202.5, deg: 180 },  // N
        { max: 247.5, deg: 225 },  // NW
        { max: 292.5, deg: 270 },  // W
        { max: 337.5, deg: 315 },  // SW
      ];
      let snapped = 0;
      for (const d of DIR_ANGLES) {
        if (deg < d.max) { snapped = d.deg; break; }
      }
      if (deg >= 337.5) snapped = 0; // wrap to S
      this.facingAngle = snapped * (Math.PI / 180);
    }
  }

  /** Infect with a malady by type name. Returns true if infected. */
  infectWith(maladyType: string): boolean {
    return Malady.infectCharacter(this, maladyType) !== null;
  }

  /** Check if character has a specific malady type. */
  hasMalady(maladyType: string): boolean {
    return this.maladies.some(m => m.sMaladyType === maladyType);
  }

  /** Check if character can carry more items. */
  canCarry(): boolean {
    return this.inventory.getTotalCount() < Character.MAX_INVENTORY;
  }

  destroy() {
    // Rendering cleanup is handled by CharacterRenderer
  }
}
