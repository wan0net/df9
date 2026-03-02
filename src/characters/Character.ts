import { Needs } from './Needs';
import { tileToScreen } from '../world/IsometricUtils';
import { TILE_HALF_W, TILE_HALF_H } from '../config';
import { generateName } from './CitizenNames';
import { generatePersonality, type PersonalityTraits } from './Personality';
import {
  UNEMPLOYED, TEAM_ID_PLAYER, JOB_NAMES, tJobs,
  BUILDER, TECHNICIAN, MINER, EMERGENCY, BARTENDER, BOTANIST, SCIENTIST, DOCTOR, JANITOR,
  STARTING_HIT_POINTS, BASE_SPEED,
  MORALE_MAX, MORALE_MIN, MORALE_TICK,
  ANGER_MAX, ANGER_REDUCTION_PER_MORALE_TICK,
  STATUS_HEALTHY, STATUS_DEAD,
} from './CharacterConstants';
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
    if (this.moving) {
      this.moveProgress += (delta / 1000) * BASE_SPEED;
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
  updateMorale(dt: number) {
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
    }
  }

  /** Apply damage to HP */
  damage(amount: number) {
    this.tStats.nHP = Math.max(0, this.tStats.nHP - amount);
    if (this.tStats.nHP <= 0) {
      this.tStats.nStatus = STATUS_DEAD;
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

  destroy() {
    // Rendering cleanup is handled by CharacterRenderer
  }
}
