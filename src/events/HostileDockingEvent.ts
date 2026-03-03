/**
 * HostileDockingEvent.ts — Hostile ship docks at station, raiders pour in.
 * Mirrors GameEvents/HostileDockingEvent.lua.
 */

import { Event } from './Event';

export class HostileDockingEvent extends Event {
  readonly name = 'HostileDocking';
  readonly description = 'A hostile ship is docking!';

  private raiderCount: number;

  /** Docking time before raiders board. */
  private static readonly DOCKING_TIME = 20;

  constructor(raiderCount?: number) {
    super();
    this.raiderCount = raiderCount ?? (2 + Math.floor(Math.random() * 3));
  }

  getRaiderCount(): number {
    return this.raiderCount;
  }

  protected onUpdate(_dt: number) {
    if (this.elapsedTime >= HostileDockingEvent.DOCKING_TIME) {
      this.complete();
    }
  }
}
