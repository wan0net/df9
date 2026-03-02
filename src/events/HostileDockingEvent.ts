/**
 * HostileDockingEvent.ts — Hostile ship docks at station.
 * Mirrors GameEvents/HostileDockingEvent.lua.
 */

import { Event } from './Event';

export class HostileDockingEvent extends Event {
  readonly name = 'HostileDocking';
  readonly description = 'A hostile ship is docking!';

  protected onUpdate(dt: number) {
    if (this.elapsedTime >= 20) {
      this.complete();
    }
  }
}
