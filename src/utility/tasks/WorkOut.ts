/**
 * WorkOut.ts — Exercise without gym equipment (anywhere).
 * Mirrors Lua WorkOutNoGym: Amusement=3.
 */

import { Task, type NeedAdvertisement } from '../Task';

export class WorkOut extends Task {
  readonly name = 'WorkOut';
  nJobExperience = 0;

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [
      { need: 'amusement', amount: 3 },
    ];
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
