/**
 * FleeThreat.ts — Flee from hostile threats (moderate bravery characters).
 * Mirrors Lua FleeThreat: SURVIVAL_NORMAL, BaseScore=110, nBravery={0.4,1}.
 */

import { Task, type NeedAdvertisement } from '../Task';

export class FleeThreat extends Task {
  readonly name = 'FleeThreat';
  nJobExperience = 0;

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [];
  }

  protected onStart() {
    this.duration = 8;
  }

  protected onUpdate(dt: number) {
    if (this.elapsedTime >= this.duration) {
      this.complete();
    }
  }
}
