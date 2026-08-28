/**
 * FleeTemperTantrum.ts — Flee from rampaging character (C-19).
 * Character walks away from the rampager. Duration: 10s. Priority: SURVIVAL_LOW.
 */

import { Task, type NeedAdvertisement } from '../Task';

export class FleeTemperTantrum extends Task {
  readonly name = 'FleeTemperTantrum';
  nJobExperience = 0;

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [];
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
