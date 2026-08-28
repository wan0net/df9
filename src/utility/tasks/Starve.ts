/**
 * Starve.ts — Universal starving fallback (C-16).
 * Character wanders randomly when starving with no food source.
 * Duration: until food found. Priority: SURVIVAL_LOW.
 */

import { Task, type NeedAdvertisement } from '../Task';

export class Starve extends Task {
  readonly name = 'Starve';
  nJobExperience = 0;

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [];
  }

  protected onStart() {
    this.duration = 30; // wander until food found (re-evaluated by AI)
  }

  protected onUpdate(dt: number) {
    if (this.elapsedTime >= this.duration) {
      this.complete();
    }
  }
}
