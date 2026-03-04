/**
 * PanicThreat.ts — Panic in place when hostiles nearby (very low bravery).
 * Mirrors Lua PanicThreat: SURVIVAL_NORMAL, BaseScore=110, nBravery={0,0.2}.
 */

import { Task, type NeedAdvertisement } from '../Task';

export class PanicThreat extends Task {
  readonly name = 'PanicThreat';
  nJobExperience = 0;

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [];
  }

  protected onStart() {
    this.duration = 6;
  }

  protected onUpdate(dt: number) {
    if (this.elapsedTime >= this.duration) {
      this.complete();
    }
  }
}
