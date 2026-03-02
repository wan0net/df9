/**
 * Airlock.ts — Airlock zone subclass.
 * Mirrors Zones/Airlock.lua: pressurization sequence, door control.
 */

import { Zone } from './Zone';
import { ZoneType } from '../world/ZoneType';

/** Airlock sequence stages matching Lua */
export const AIRLOCK_STAGE = {
  IDLE: 0,
  CLOSE_DOORS: 1,
  VENT: 2,
  OPEN_DOORS: 3,
  LEAVE: 4,
  RECLOSE_DOORS: 5,
  REPRESSURIZE: 6,
  UNLOCK: 7,
} as const;

/** Oxygen display levels */
export const OXY_LEVEL = {
  NONE: 'OXYNONE',
  LOW: 'OXYLOW',
  MED: 'OXYMED',
  FULL: 'OXYFULL',
} as const;

export class Airlock extends Zone {
  static OXYGEN_INCREASE_RATE = 0.3;
  static MAX_OPEN_WAIT_TIME = 4;

  private stage: number = AIRLOCK_STAGE.IDLE;
  private stageTimer = 0;

  constructor() {
    super(ZoneType.AIRLOCK);
  }

  protected generateUniqueName(): string {
    const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
    return `Airlock ${letter}`;
  }

  getStage(): number {
    return this.stage;
  }

  /** Request the airlock to begin an open sequence. */
  requestOpen() {
    if (this.stage === AIRLOCK_STAGE.IDLE) {
      this.beginOpenSequence();
    }
  }

  private beginOpenSequence() {
    this.stage = AIRLOCK_STAGE.CLOSE_DOORS;
    this.stageTimer = 0;
  }

  endOpenSequence() {
    this.stage = AIRLOCK_STAGE.RECLOSE_DOORS;
    this.stageTimer = 0;
  }

  onTick(dt: number) {
    if (this.stage === AIRLOCK_STAGE.IDLE) return;

    this.stageTimer += dt;

    switch (this.stage) {
      case AIRLOCK_STAGE.CLOSE_DOORS:
        // Close all doors in the room (will be implemented when Door objects exist)
        this.stage = AIRLOCK_STAGE.VENT;
        this.stageTimer = 0;
        break;
      case AIRLOCK_STAGE.VENT:
        // Vent atmosphere (reduce O2)
        if (this.stageTimer >= 2) {
          this.stage = AIRLOCK_STAGE.OPEN_DOORS;
          this.stageTimer = 0;
        }
        break;
      case AIRLOCK_STAGE.OPEN_DOORS:
        // Open exterior doors
        this.stage = AIRLOCK_STAGE.LEAVE;
        this.stageTimer = 0;
        break;
      case AIRLOCK_STAGE.LEAVE:
        // Wait for character to leave
        if (this.stageTimer >= Airlock.MAX_OPEN_WAIT_TIME) {
          this.endOpenSequence();
        }
        break;
      case AIRLOCK_STAGE.RECLOSE_DOORS:
        // Close exterior doors
        this.stage = AIRLOCK_STAGE.REPRESSURIZE;
        this.stageTimer = 0;
        break;
      case AIRLOCK_STAGE.REPRESSURIZE:
        // Re-pressurize (increase O2)
        if (this.stageTimer >= 3) {
          this.stage = AIRLOCK_STAGE.UNLOCK;
          this.stageTimer = 0;
        }
        break;
      case AIRLOCK_STAGE.UNLOCK:
        // Unlock interior doors
        this.stage = AIRLOCK_STAGE.IDLE;
        this.stageTimer = 0;
        break;
    }
  }
}
