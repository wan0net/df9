/**
 * DerelictEvent.ts — Derelict ship appears for exploration.
 * Simplified: provides matter bonus when discovered.
 * Mirrors GameEvents/DerelictEvent.lua.
 */

import { Event } from './Event';

export class DerelictEvent extends Event {
  readonly name = 'Derelict';
  readonly description = 'A derelict ship has been detected nearby';

  /** Matter reward from salvaging. */
  readonly matterReward: number;

  constructor() {
    super();
    this.matterReward = 200 + Math.floor(Math.random() * 300); // 200-500 matter
  }

  getMatterReward(): number {
    return this.matterReward;
  }

  protected onUpdate(_dt: number) {
    // Auto-complete after short delay (simplified — no physical ship to explore)
    if (this.elapsedTime >= 30) {
      this.complete();
    }
  }
}
