/**
 * Task.ts — Base task class for character AI.
 * Mirrors Utility/Task.lua: promised needs, priority, path execution, duration.
 */

import type { Character } from '../characters/Character';
import type { NeedName } from '../characters/Needs';

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
    this.onComplete();
  }

  /** Fail the task. */
  fail() {
    this.status = TASK_STATUS.FAILED;
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

  /** Override: completion logic (apply need satisfaction). */
  protected onComplete() {
    if (!this.character) return;
    for (const adv of this.getAdvertisedNeeds()) {
      this.character.needs.satisfy(adv.need, adv.amount);
    }
  }
}
