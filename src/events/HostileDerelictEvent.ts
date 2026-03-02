/**
 * HostileDerelictEvent.ts — Trapped derelict with hostiles.
 * Mirrors GameEvents/HostileDerelictEvent.lua.
 */

import { Event } from './Event';

export class HostileDerelictEvent extends Event {
  readonly name = 'HostileDerelict';
  readonly description = 'The derelict ship contains hostile crew!';

  protected onUpdate(dt: number) {
    if (this.elapsedTime >= 30) {
      this.complete();
    }
  }
}
