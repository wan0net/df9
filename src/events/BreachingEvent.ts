/**
 * BreachingEvent.ts — Raiders cut through hull, creating a breach.
 * Mirrors GameEvents/BreachingEvent.lua.
 */

import { Event } from './Event';

export class BreachingEvent extends Event {
  readonly name = 'Breach';
  readonly description = 'Raiders are cutting through the hull!';

  /** Time for raiders to cut through. */
  private static readonly BREACH_TIME = 10;

  protected onUpdate(_dt: number) {
    // Breach occurs after cutting time
    if (this.elapsedTime >= BreachingEvent.BREACH_TIME) {
      this.complete();
    }
  }
}
