/**
 * Event.ts — Base event class.
 * Mirrors GameEvents/Event.lua: base class for all game events.
 */

export const EVENT_STATUS = {
  PENDING: 0,
  ACTIVE: 1,
  COMPLETE: 2,
} as const;

export abstract class Event {
  abstract readonly name: string;
  abstract readonly description: string;

  status: number = EVENT_STATUS.PENDING;
  startTime = 0;
  elapsedTime = 0;

  /** Callback fired when event completes. Set by EventController. */
  onCompleteCallback: ((event: Event) => void) | null = null;

  /** Called when event starts. */
  start(simTime: number) {
    this.status = EVENT_STATUS.ACTIVE;
    this.startTime = simTime;
  }

  /** Called every tick while event is active. */
  update(dt: number) {
    if (this.status !== EVENT_STATUS.ACTIVE) return;
    this.elapsedTime += dt;
    this.onUpdate(dt);
  }

  /** Override: per-tick logic. */
  protected abstract onUpdate(dt: number): void;

  /** Mark event as complete. */
  complete() {
    this.status = EVENT_STATUS.COMPLETE;
    this.onCompleteCallback?.(this);
  }

  isActive(): boolean {
    return this.status === EVENT_STATUS.ACTIVE;
  }
}
