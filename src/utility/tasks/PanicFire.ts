/**
 * PanicFire.ts — Panic when fire is nearby (low bravery characters).
 * Mirrors Lua PanicFire: SURVIVAL_NORMAL, BaseScore=2, nBravery={0,0.4}.
 */

import { Task, type NeedAdvertisement } from '../Task';

export class PanicFire extends Task {
  readonly name = 'PanicFire';
  nJobExperience = 0;

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [];
  }

  protected onStart() {
    this.duration = 5;
  }

  protected onUpdate(dt: number) {
    // Panic: character stands still or wanders erratically
    if (this.elapsedTime >= this.duration) {
      this.complete();
    }
  }
}
