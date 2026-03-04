/**
 * Explore.ts — Explore unvisited areas of the base.
 * Mirrors Lua Explore: Duty=2, WorkShift, AllowHostilePathing.
 */

import { Task, type NeedAdvertisement } from '../Task';

export class Explore extends Task {
  readonly name = 'Explore';
  nJobExperience = 2;

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [
      { need: 'duty', amount: 2 },
    ];
  }

  protected onStart() {
    this.duration = 15;
  }

  protected onUpdate(dt: number) {
    if (this.elapsedTime >= this.duration) {
      this.complete();
    }
  }
}
