/**
 * LiftAtWeightBench.ts — Exercise at weight bench in Fitness zone.
 * Mirrors Lua LiftAtWeightBench: Amusement=7.
 */

import { Task, type NeedAdvertisement } from '../Task';

export class LiftAtWeightBench extends Task {
  readonly name = 'LiftAtWeightBench';
  nJobExperience = 0;

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [
      { need: 'amusement', amount: 7 },
    ];
  }

  protected onStart() {
    this.duration = 10;
  }

  protected onUpdate(dt: number) {
    if (this.elapsedTime >= this.duration) {
      this.complete();
    }
  }
}
