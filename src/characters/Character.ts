import { Needs } from './Needs';
import { Base } from '../core/Base';
import { tileToScreen } from '../world/IsometricUtils';
import { TILE_HALF_W, TILE_HALF_H } from '../config';
import { generateName } from './CitizenNames';
import { generatePersonality, type PersonalityTraits } from './Personality';
import {
  UNEMPLOYED, TEAM_ID_PLAYER, JOB_NAMES, tJobs,
  BUILDER, TECHNICIAN, MINER, EMERGENCY, BARTENDER, BOTANIST, SCIENTIST, DOCTOR, JANITOR,
  STARTING_HIT_POINTS, BASE_SPEED,
  MORALE_MAX, MORALE_MIN, MORALE_TICK,
  MAX_ROOM_MORALE_BOOST, ROOM_MORALE_TICK,
  ANGER_MAX, ANGER_REDUCTION_PER_MORALE_TICK,
  MORALE_COMPETENCY_THRESHOLD, MORALE_COMPETENCY_MODIFIER,
  MORALE_SPEED_THRESHOLD, MORALE_LOW_SPEED_MODIFIER, MORALE_HIGH_SPEED_MODIFIER,
  EXPERIENCE_PER_LEVEL, MAX_COMPETENCY,
  MAX_CHANCE_TO_FAIL, NO_FAIL_COMPETENCY_THRESHOLD,
  STATUS_HEALTHY, STATUS_DEAD, STATUS_SICK, STATUS_ILL, STATUS_INCAPACITATED,
  CAUSE_OF_DEATH,
  SPACESUIT_MAX_OXYGEN,
} from './CharacterConstants';
import { Malady, type MaladyInstance } from '../malady/Malady';
import { CharacterInventory, createRandomStartingStuff } from '../inventory/Inventory';
import type { Task } from '../utility/Task';

/** Character stats block (mirrors Lua tStats) */
export interface CharacterStats {
  sName: string;
  nJob: number;
  nTeam: number;
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

  // ── Affinity tracking ───────────────────────────────────────
  tAffinity: Map<number, number> = new Map();

  // Spacewalking (original: tStatus.bSpacewalking)
  bSpacewalking = false;

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
  /** Rampage state */
  bRampaging = false;
  bViolentRampage = false;

  /** Work shift tracking */
  bOnShift = true;
  private shiftTimer = 0;
  /** Shift duration in seconds */
  static readonly SHIFT_DURATION = 270;
  /** Rest duration in seconds */
  static readonly SHIFT_COOLDOWN = 360;

  // Movement
  path: { x: number; y: number }[] = [];
  moving = false;
  private moveProgress = 0;
  private moveFrom = { x: 0, y: 0 };
  private moveTo = { x: 0, y: 0 };

  // AI
  idleTimer = 0;
  currentTask: Task | null = null;

  // Morale tick accumulator
  private moraleTickAccum = 0;

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
      nHP: STARTING_HIT_POINTS,
      nMaxHP: STARTING_HIT_POINTS,
      nStatus: STATUS_HEALTHY,
      personality,
      nXP: 0,
      tCompetency: {},
    };

    // Start with some competency in assigned job
    this.tStats.tCompetency[startingJob] = Math.random() * 0.3;

    const pos = tileToScreen(tileX, tileY);
    this.screenX = pos.x + TILE_HALF_W;
    this.screenY = pos.y + TILE_HALF_H;
  }

  // ── Accessors ──────────────────────────────────────────────

  getName(): string { return this.tStats.sName; }
  getJob(): number { return this.tStats.nJob; }
  getJobName(): string { return JOB_NAMES[this.tStats.nJob] ?? 'Unknown'; }
  getHP(): number { return this.tStats.nHP; }
  isAlive(): boolean { return this.tStats.nStatus !== STATUS_DEAD; }

  setJob(job: number) {
    this.tStats.nJob = job;
  }

  // ── Update ─────────────────────────────────────────────────

  update(delta: number) {
    // Work shift timer
    const dtSec = delta / 1000;
    this.shiftTimer += dtSec;
    if (this.bOnShift && this.shiftTimer >= Character.SHIFT_DURATION) {
      this.bOnShift = false;
      this.shiftTimer = 0;
    } else if (!this.bOnShift && this.shiftTimer >= Character.SHIFT_COOLDOWN) {
      this.bOnShift = true;
      this.shiftTimer = 0;
    }

    // Tick maladies (contagion, stages, specials, expiry)
    Malady.tickMaladies(this, dtSec);

    // Update status based on maladies
    if (this.maladies.length > 0 && this.tStats.nStatus === STATUS_HEALTHY) {
      const hasSevere = this.maladies.some(m => m.bSymptomatic && m.nSeverity >= 0.5);
      this.tStats.nStatus = hasSevere ? STATUS_ILL : STATUS_SICK;
    } else if (this.maladies.length === 0 && (this.tStats.nStatus === STATUS_SICK || this.tStats.nStatus === STATUS_ILL)) {
      this.tStats.nStatus = STATUS_HEALTHY;
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
  updateMorale(dt: number, roomMoraleScore = 0) {
    this.moraleTickAccum += dt;
    if (this.moraleTickAccum >= MORALE_TICK) {
      this.moraleTickAccum -= MORALE_TICK;

      // Decay anger
      this.nAnger = Math.max(0, this.nAnger - ANGER_REDUCTION_PER_MORALE_TICK);

      // Morale drifts based on needs
      const avgNeed = (this.needs.hunger + this.needs.energy + this.needs.amusement + this.needs.social) / 4;
      if (avgNeed < 30) {
        this.nMorale = Math.max(MORALE_MIN, this.nMorale - 2);
      } else if (avgNeed > 70) {
        this.nMorale = Math.min(MORALE_MAX, this.nMorale + 1);
      }

      // Room morale drift — characters drift toward the room's morale score
      if (roomMoraleScore !== 0) {
        const drift = Math.min(MAX_ROOM_MORALE_BOOST, Math.abs(roomMoraleScore) * 0.1);
        if (roomMoraleScore > 0) {
          this.nMorale = Math.min(MORALE_MAX, this.nMorale + drift);
        } else {
          this.nMorale = Math.max(MORALE_MIN, this.nMorale - drift);
        }
      }
    }
  }

  /** Apply a morale change (from event, chat, etc.) */
  addMorale(amount: number) {
    this.nMorale = Math.max(MORALE_MIN, Math.min(MORALE_MAX, this.nMorale + amount));
  }

  /** Apply anger change (scaled by temper trait and morale). */
  addAnger(amount: number) {
    let scaled = amount;
    // Temper personality trait scales anger gain
    const temper = this.tStats.personality.nTemper ?? 0.5;
    scaled *= 0.5 + temper;
    // Good morale reduces anger gain, bad morale amplifies it
    if (this.nMorale > 50) scaled *= 0.4;
    else if (this.nMorale < -50) scaled *= 2.0;
    this.nAnger = Math.min(ANGER_MAX, Math.max(0, this.nAnger + scaled));
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
  damage(amount: number, cause: number = CAUSE_OF_DEATH.UNSPECIFIED) {
    this.tStats.nHP = Math.max(0, this.tStats.nHP - amount);
    if (this.tStats.nHP <= 0) {
      this.kill(cause);
    }
  }

  /** Kill the character with a specific cause of death. */
  kill(cause: number = CAUSE_OF_DEATH.UNSPECIFIED) {
    if (this.tStats.nStatus === STATUS_DEAD) return; // Already dead
    this.tStats.nHP = 0;
    this.tStats.nStatus = STATUS_DEAD;
    this.nCauseOfDeath = cause;
    this.moving = false;
    this.path = [];
    if (this.currentTask) {
      this.currentTask = null;
    }

    // Track hostile kill statistics
    if (this.tStats.nTeam !== TEAM_ID_PLAYER) {
      Base.incrementStat('nHostilesKilled');
      if (cause === CAUSE_OF_DEATH.SUFFOCATION) {
        Base.incrementStat('nHostilesAsphyxiated');
      }
      // TODO: nHostilesKilledByTurret — Turret system (GameRules tick slot 8)
      // is not yet implemented. When turrets deal damage, pass a turret-specific
      // cause of death or a killedByTurret flag so we can call
      // Base.incrementStat('nHostilesKilledByTurret') here.
    }
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
