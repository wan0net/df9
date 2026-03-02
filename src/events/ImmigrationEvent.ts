/**
 * ImmigrationEvent.ts — New crew arrives at the station.
 * Mirrors GameEvents/ImmigrationEvent.lua.
 */

import { Event } from './Event';

export class ImmigrationEvent extends Event {
  readonly name = 'Immigration';
  readonly description = 'New crew members arriving';

  /** Number of immigrants for this event. */
  private immigrantCount: number;

  constructor() {
    super();
    this.immigrantCount = 1 + Math.floor(Math.random() * 3); // 1-3 immigrants
  }

  getImmigrantCount(): number {
    return this.immigrantCount;
  }

  protected onUpdate(dt: number) {
    // Event completes after docking period (simplified: immediate)
    if (this.elapsedTime >= 10) {
      this.complete();
    }
  }
}
