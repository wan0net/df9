/**
 * Task.ts — Base task class for character AI.
 * Mirrors Utility/Task.lua: promised needs, priority, path execution, duration.
 */

import type { Character } from '../characters/Character';
import type { NeedName } from '../characters/Needs';
import type { EnvObject } from '../envobjects/EnvObject';
import { areTilesAdjacent } from '../world/TileGrid';

export const TASK_STATUS = {
  PENDING: 0,
  IN_PROGRESS: 1,
  COMPLETE: 2,
  FAILED: 3,
} as const;

/** Needs advertisement: what needs this task promises to satisfy. */
export interface NeedAdvertisement {
  need: NeedName;
  amount: number;
}

export abstract class Task {
  /** Display name for debugging */
  abstract readonly name: string;

  /** Needs this task promises to satisfy. */
  abstract getAdvertisedNeeds(): NeedAdvertisement[];

  status: number = TASK_STATUS.PENDING;
  protected elapsedTime = 0;
  protected duration = 0;

  /** Character performing this task. */
  character: Character | null = null;

  /** Priority score (higher = more important). */
  priority = 0;

  /** Target tile (for pathfinding). */
  targetX = -1;
  targetY = -1;

  /** Activity tags (set from ActivityOption when task is created). */
  tags: Record<string, boolean> = {};

  /** Target environment object (for reservation release on complete/fail). */
  rTargetObject?: EnvObject;

  /** Called when the task starts. */
  start(character: Character) {
    this.character = character;
    this.status = TASK_STATUS.IN_PROGRESS;
    this.onStart();
  }

  /** Called every tick while task is active. dt in seconds. */
  update(dt: number) {
    if (this.status !== TASK_STATUS.IN_PROGRESS) return;
    this.elapsedTime += dt;
    this.onUpdate(dt);
  }

  /** Complete the task successfully. */
  complete() {
    this.status = TASK_STATUS.COMPLETE;
    this._releaseReservation();
    this.onComplete();
  }

  /** Fail the task. */
  fail() {
    this.status = TASK_STATUS.FAILED;
    this._releaseReservation();
    this.onFail();
  }

  /** Override in subclasses to release CommandQueue claims on failure. */
  protected onFail() {}


  /** Release object reservation and end interaction when task ends. */
  private _releaseReservation() {
    this._endInteraction();
    if (this.rTargetObject && this.character) {
      this.rTargetObject.unreserve(this.character.id);
    }
  }

  isComplete(): boolean {
    return this.status === TASK_STATUS.COMPLETE;
  }

  isFailed(): boolean {
    return this.status === TASK_STATUS.FAILED;
  }

  isActive(): boolean {
    return this.status === TASK_STATUS.IN_PROGRESS;
  }

  /** Override: initialization logic. */
  protected onStart() {}

  /** Override: per-tick logic. */
  protected abstract onUpdate(dt: number): void;

  // ── Interaction state machine (Lua Task:tickInteraction) ──────────
  /** Remaining interaction time (null = not interacting). */
  nInteracting: number | null = null;
  /** Object being interacted with. */
  rInteractionObject: EnvObject | null = null;

  /**
   * Attempt to start interacting with an object.
   * Character must be adjacent to a footprint tile of the object.
   * Returns true if interaction started, false if not adjacent.
   */
  attemptInteractWithObject(rObj: EnvObject, nDuration: number): boolean {
    if (!this.character) return false;
    const cx = this.character.tileX;
    const cy = this.character.tileY;

    // Check if character is on or adjacent to the object's tile
    if (!areTilesAdjacent(cx, cy, rObj.tileX, rObj.tileY, false, true)) {
      return false;
    }

    this.nInteracting = nDuration;
    this.rInteractionObject = rObj;
    rObj.onInteract(true, this.character);
    return true;
  }

  /**
   * Tick the interaction timer. Returns true when interaction is complete.
   */
  tickInteraction(dt: number): boolean {
    if (this.nInteracting === null) return true;
    this.nInteracting -= dt;
    if (this.nInteracting <= 0) {
      this._endInteraction();
      return true;
    }
    return false;
  }

  /** End the current interaction and notify the object. */
  protected _endInteraction(): void {
    if (this.rInteractionObject && this.character) {
      this.rInteractionObject.onInteract(false, this.character);
    }
    this.rInteractionObject = null;
    this.nInteracting = null;
  }

  /** Job experience granted on completion (override in subclasses). */
  nJobExperience = 10;

  /** Override: completion logic (apply need satisfaction + XP). */
  protected onComplete() {
    if (!this.character) return;
    for (const adv of this.getAdvertisedNeeds()) {
      this.character.needs.satisfy(adv.need, adv.amount);
    }
    // Grant job XP
    this.character.addJobExperience(this.nJobExperience);
  }
}
