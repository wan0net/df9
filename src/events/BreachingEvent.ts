/**
 * BreachingEvent.ts — Hull breach event.
 * Mirrors GameEvents/BreachingEvent.lua.
 */

import { Event } from './Event';

export class BreachingEvent extends Event {
  readonly name = 'Breach';
  readonly description = 'Hull breach detected!';

  protected onUpdate(dt: number) {
    // Breach is instantaneous — complete immediately
    this.complete();
  }
}
