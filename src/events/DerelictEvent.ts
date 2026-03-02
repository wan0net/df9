/**
 * DerelictEvent.ts — Derelict ship appears for exploration.
 * Mirrors GameEvents/DerelictEvent.lua.
 */

import { Event } from './Event';

export class DerelictEvent extends Event {
  readonly name = 'Derelict';
  readonly description = 'A derelict ship has been detected nearby';

  protected onUpdate(dt: number) {
    // Derelict stays until explored or timeout
    if (this.elapsedTime >= 600) {
      this.complete();
    }
  }
}
