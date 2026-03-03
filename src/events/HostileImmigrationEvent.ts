/**
 * HostileImmigrationEvent.ts — Hostile raiders arrive.
 * Mirrors GameEvents/HostileImmigrationEvent.lua.
 */

import { Event } from './Event';

export class HostileImmigrationEvent extends Event {
  readonly name = 'HostileImmigration';
  readonly description = 'Hostile raiders approaching!';

  private raiderCount: number;

  /** Approach time before raiders arrive. */
  private static readonly APPROACH_TIME = 15;

  constructor(raiderCount?: number) {
    super();
    this.raiderCount = raiderCount ?? (2 + Math.floor(Math.random() * 3)); // 2-4 raiders
  }

  getRaiderCount(): number {
    return this.raiderCount;
  }

  protected onUpdate(_dt: number) {
    // Raiders arrive after approach period
    if (this.elapsedTime >= HostileImmigrationEvent.APPROACH_TIME) {
      this.complete();
    }
  }
}
