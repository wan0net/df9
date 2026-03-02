/**
 * Door.ts — Door environment object subclass.
 * Mirrors EnvObjects/Door.lua: states, auto-open, oxygen blocking.
 */

import { EnvObject } from './EnvObject';

export const DOOR_STATE = {
  OPEN: 1,
  CLOSED: 2,
  LOCKED: 3,
  BROKEN_OPEN: 4,
  BROKEN_CLOSED: 5,
} as const;

export const DOOR_OPERATION = {
  FORCED_OPEN: 1,
  NORMAL: 2,
  LOCKED: 3,
} as const;

export class Door extends EnvObject {
  state: number = DOOR_STATE.CLOSED;
  operation: number = DOOR_OPERATION.NORMAL;

  /** Track if a character is adjacent (for auto-open). */
  private characterNearby = false;

  constructor(sName: string, tileX: number, tileY: number, bFlipX = false, bFlipY = false) {
    super(sName, tileX, tileY, bFlipX, bFlipY);
    this._updateDoorState(true);
  }

  // ── State management ──────────────────────────────────────────

  open() {
    if (this.operation === DOOR_OPERATION.NORMAL) {
      this.state = DOOR_STATE.OPEN;
      this._updateBlockingFlags();
    }
  }

  close() {
    if (this.operation === DOOR_OPERATION.NORMAL) {
      this.state = DOOR_STATE.CLOSED;
      this._updateBlockingFlags();
    }
  }

  /** Cycle operation: NORMAL → LOCKED → FORCED_OPEN → NORMAL */
  cycle() {
    if (this.operation === DOOR_OPERATION.NORMAL) {
      this.setOperation(DOOR_OPERATION.LOCKED);
    } else if (this.operation === DOOR_OPERATION.LOCKED) {
      this.setOperation(DOOR_OPERATION.FORCED_OPEN);
    } else {
      this.setOperation(DOOR_OPERATION.NORMAL);
    }
  }

  setOperation(op: number) {
    this.operation = op;
    this._updateDoorState(true);
  }

  getOperation(): number {
    return this.operation;
  }

  isOpen(): boolean {
    return this.state === DOOR_STATE.OPEN || this.state === DOOR_STATE.BROKEN_OPEN;
  }

  isClosed(): boolean {
    return this.state === DOOR_STATE.CLOSED || this.state === DOOR_STATE.LOCKED || this.state === DOOR_STATE.BROKEN_CLOSED;
  }

  isLocked(): boolean {
    return this.state === DOOR_STATE.LOCKED || this.state === DOOR_STATE.BROKEN_CLOSED;
  }

  // ── Auto-open proximity ───────────────────────────────────────

  setCharacterNearby(nearby: boolean) {
    const wasNearby = this.characterNearby;
    this.characterNearby = nearby;
    if (nearby !== wasNearby) {
      this._updateDoorState(false);
    }
  }

  // ── State update logic (mirrors Door.lua _updateDoorState) ────

  private _updateDoorState(bForce: boolean) {
    let newState = this.state;

    if (this.isDestroyed()) {
      // Broken doors stay in their broken variant
      if (this.state === DOOR_STATE.OPEN || this.state === DOOR_STATE.BROKEN_OPEN) {
        newState = DOOR_STATE.BROKEN_OPEN;
      } else {
        newState = DOOR_STATE.BROKEN_CLOSED;
      }
    } else if (this.operation === DOOR_OPERATION.FORCED_OPEN) {
      newState = DOOR_STATE.OPEN;
    } else if (this.operation === DOOR_OPERATION.LOCKED) {
      newState = DOOR_STATE.LOCKED;
    } else if (bForce) {
      // Loading: set to default for operation
      if (this.operation === DOOR_OPERATION.NORMAL) {
        newState = DOOR_STATE.CLOSED;
      }
    } else {
      // NORMAL operation: auto-open/close based on character proximity
      if (this.characterNearby && this.hasPower()) {
        newState = DOOR_STATE.OPEN;
      } else {
        newState = DOOR_STATE.CLOSED;
      }
    }

    this.state = newState;
    this._updateBlockingFlags();
  }

  private _updateBlockingFlags() {
    const tag = this._ObjectList_ObjectMarker;
    if (!tag) return;

    // Oxygen blocking: closed/locked doors block oxygen
    tag.bBlocksOxygen = this.isClosed();

    // Path blocking: only locked doors block pathing
    tag.bBlocksPathing = this.isLocked();
  }

  // ── Tick override ─────────────────────────────────────────────

  onTick(dt: number) {
    super.onTick(dt);
    this._updateDoorState(false);
  }

  // ── Sprite ────────────────────────────────────────────────────

  getSpriteKey(): string {
    if (this.isOpen()) return 'tile_door_open';
    return 'tile_door_closed';
  }

  // ── Save data ─────────────────────────────────────────────────

  getSaveData(): Record<string, unknown> {
    const data = super.getSaveData();
    data.operation = this.operation;
    return data;
  }
}
