/**
 * PanicOxygen.ts — Panic when oxygen is low (low bravery characters).
 * Mirrors Lua PanicOxygen: SURVIVAL_NORMAL, BaseScore=1, nBravery={0,0.4}.
 */

import { Task, type NeedAdvertisement } from '../Task';

export class PanicOxygen extends Task {
  readonly name = 'PanicOxygen';
  nJobExperience = 0;

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [];
  }

  protected onStart() {
    this.duration = 5;
  }

  protected onUpdate(dt: number) {
    if (this.elapsedTime >= this.duration) {
      this.complete();
    }
  }
}
