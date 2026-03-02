/**
 * HostileImmigrationEvent.ts — Hostile raiders arrive.
 * Mirrors GameEvents/HostileImmigrationEvent.lua.
 */

import { Event } from './Event';

export class HostileImmigrationEvent extends Event {
  readonly name = 'HostileImmigration';
  readonly description = 'Hostile raiders approaching!';

  private raiderCount: number;

  constructor() {
    super();
    this.raiderCount = 2 + Math.floor(Math.random() * 3); // 2-4 raiders
  }

  getRaiderCount(): number {
    return this.raiderCount;
  }

  protected onUpdate(dt: number) {
    // Raiders arrive after approach period
    if (this.elapsedTime >= 15) {
      this.complete();
    }
  }
}
