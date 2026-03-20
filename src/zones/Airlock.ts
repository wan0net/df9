/**
 * Airlock.ts — Airlock zone subclass.
 * Mirrors Zones/Airlock.lua: pressurisation sequence, door control, O2 venting.
 */

import { Zone } from './Zone';
import { ZoneType } from '../world/ZoneType';
import { O2_MAX } from '../config';
import { LIGHTING_SCHEME_VACUUM } from '../rooms/Room';
import { EnvObjectManager } from '../envobjects/EnvObjectManager';

/** Stage constants — mirrors Airlock.lua:21-27 */
export const AIRLOCK_STAGE = {
  IDLE:          0,
  CLOSE_DOORS:   1,
  VENT:          2,
  OPEN_DOORS:    3,
  LEAVE:         4,
  RECLOSE_DOORS: 5,
  REPRESSURIZE:  6,
  UNLOCK:        7,
} as const;

/** O2 display level on airlock door — mirrors AirlockDoor.monitorStates */
export const OXY_LEVEL = {
  NONE: 'OXYNONE',
  LOW:  'OXYLOW',
  MED:  'OXYMED',
  FULL: 'OXYFULL',
} as const;

/** Fraction of O2_MAX vented/filled per second — Airlock.lua:32 */
const OXYGEN_INCREASE_RATE = 0.3;
/** Seconds before giving up on a door operation — Airlock.lua timeout */
const STAGE_TIMEOUT = 5;
/** Seconds to wait for occupants to leave in STAGE_LEAVE — Airlock.lua:29 */
const MAX_OPEN_WAIT_TIME = 4;

export class Airlock extends Zone {
  /** True while pressurisation sequence is running — mirrors self.bRunning */
  bRunning = false;
  /** True when the airlock meets all functional requirements */
  bFunctional = false;

  private stage: number = AIRLOCK_STAGE.IDLE;
  private stageTimer = 0;
  /** O2 level captured at the start of each vent/fill phase */
  private ventingO2: number | null = null;
  /** Current door oxygen display state */
  doorMonitorState: string = OXY_LEVEL.NONE;

  /**
   * Optional callback to check if any citizen without a spacesuit is in the room.
   * Set from main.ts or CharacterManager. Returns true if unsafe.
   */
  safetyCheck: (() => boolean) | null = null;

  constructor() {
    super(ZoneType.AIRLOCK);
  }

  protected generateUniqueName(): string {
    const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
    return `Airlock ${letter}`;
  }

  getStage(): number { return this.stage; }

  /**
   * While running, O2 system should not propagate into/out of this room.
   * Mirrors Airlock:disallowO2Propagation().
   */
  disallowO2Propagation(): boolean {
    return this.bRunning;
  }

  /**
   * Lighting override — VACUUM when airlock is non-functional.
   * Mirrors Airlock:getLightingOverride().
   */
  getLightingOverride(): number | null {
    return this.bFunctional ? null : LIGHTING_SCHEME_VACUUM;
  }

  /**
   * Returns true if a citizen without a spacesuit is in the room.
   * Mirrors Airlock:_testSafetyInterrupt().
   */
  private testSafetyInterrupt(): boolean {
    return this.safetyCheck?.() ?? false;
  }

  /** Request an open sequence if idle and safe. Mirrors Airlock:requestOpen(). */
  requestOpen(): boolean {
    if (!this.bRunning && !this.testSafetyInterrupt()) {
      this.beginOpenSequence();
      return true;
    }
    return false;
  }

  /** True during STAGE_LEAVE — character may cross to outside. */
  canGoOutside(): boolean {
    return this.stage === AIRLOCK_STAGE.LEAVE;
  }

  /**
   * True when the airlock is in a stable safe state with full O2.
   * Mirrors Airlock:isSafe().
   */
  isSafe(): boolean {
    if (this.bRunning) return false;
    return (this.room?.oxygen ?? 0) > O2_MAX * 0.8;
  }

  private beginOpenSequence() {
    this.bRunning = true;
    this.stage = AIRLOCK_STAGE.CLOSE_DOORS;
    this.stageTimer = 0;
    this.ventingO2 = null;
  }

  endOpenSequence() {
    this.bRunning = false;
    this.stage = AIRLOCK_STAGE.IDLE;
    this.stageTimer = 0;
    this.ventingO2 = null;
  }

  private incrementStage() {
    this.stage = (this.stage % 7) + 1;
    this.stageTimer = 0;
    this.ventingO2 = null;
  }

  /**
   * Vent or refill the room's oxygen.
   * Mirrors Airlock:_tickVenting(dt, bIncreasing).
   * Returns true when the phase is complete.
   */
  private tickVenting(dt: number, bIncreasing: boolean): boolean {
    const room = this.room;
    if (!room) return true;

    if (this.ventingO2 === null) {
      this.ventingO2 = room.oxygen;
    }

    // Apply O2 change to room
    const rate = OXYGEN_INCREASE_RATE * O2_MAX * dt;
    if (bIncreasing) {
      this.ventingO2 = Math.min(O2_MAX, this.ventingO2 + rate);
      room.oxygen = this.ventingO2;
      return this.ventingO2 >= O2_MAX;
    } else {
      this.ventingO2 = Math.max(0, this.ventingO2 - rate);
      room.oxygen = this.ventingO2;
      return this.ventingO2 <= 0;
    }
  }

  /**
   * Update door O2 monitor state — mirrors Airlock:_updateDoorMonitor().
   * Thresholds: >80% → FULL, ≥55% → MED, ≥35% → LOW, else → NONE.
   */
  private updateDoorMonitor() {
    const rel = (this.room?.oxygen ?? 0) / O2_MAX;
    if (rel > 0.8)       this.doorMonitorState = OXY_LEVEL.FULL;
    else if (rel >= 0.55) this.doorMonitorState = OXY_LEVEL.MED;
    else if (rel >= 0.35) this.doorMonitorState = OXY_LEVEL.LOW;
    else                  this.doorMonitorState = OXY_LEVEL.NONE;
  }

  onTick(dt: number) {
    this.updateDoorMonitor();

    // ── Functional check (idle state) ──────────────────────────────────────
    // G-9: Lua Airlock.lua requires: sealed, not breached, AirlockLocker present,
    // at least one airlock door with space access, no broken-open doors
    if (!this.bRunning) {
      let functional = this.room?.sealed ?? false;
      if (functional && this.room) {
        // Check for AirlockLocker object in room
        const hasLocker = EnvObjectManager.getObjectsByType('AirlockLocker')
          .some(o => o.bBuilt && o.rRoom === this.room);
        if (!hasLocker) functional = false;
      }
      this.bFunctional = functional;
    }

    if (!this.bRunning) return;

    this.stageTimer += dt;

    switch (this.stage) {
      case AIRLOCK_STAGE.CLOSE_DOORS:
        // Lock all doors. We don't have full door control yet, so advance after
        // a brief pause (mirrors timeout-based fallback in Lua).
        if (this.stageTimer >= 0.5 || this.stageTimer >= STAGE_TIMEOUT) {
          this.incrementStage();
        }
        break;

      case AIRLOCK_STAGE.VENT:
        // Abort if unsafe (citizen without spacesuit entered)
        if (this.testSafetyInterrupt()) {
          this.stage = AIRLOCK_STAGE.REPRESSURIZE;
          this.stageTimer = 0;
          this.ventingO2 = null;
          break;
        }
        if (this.tickVenting(dt, false)) {
          this.incrementStage();
        }
        break;

      case AIRLOCK_STAGE.OPEN_DOORS:
        // Safety check before opening outer door
        if (this.testSafetyInterrupt()) {
          this.stage = AIRLOCK_STAGE.RECLOSE_DOORS;
          this.stageTimer = 0;
          break;
        }
        // Open exterior door (door control deferred) — advance immediately
        this.incrementStage();
        break;

      case AIRLOCK_STAGE.LEAVE:
        // Wait for occupants to exit before reclosing
        if (this.stageTimer >= MAX_OPEN_WAIT_TIME) {
          this.incrementStage();
        }
        break;

      case AIRLOCK_STAGE.RECLOSE_DOORS:
        // Close exterior door — advance after brief pause
        if (this.stageTimer >= 0.5) {
          this.incrementStage();
        }
        break;

      case AIRLOCK_STAGE.REPRESSURIZE:
        if (this.tickVenting(dt, true)) {
          this.incrementStage();
        }
        break;

      case AIRLOCK_STAGE.UNLOCK:
        // Unlock interior doors — mirrors Airlock:STAGE_UNLOCK
        this.endOpenSequence();
        break;
    }
  }
}
