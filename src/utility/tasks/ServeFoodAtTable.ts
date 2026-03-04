/**
 * ServeFoodAtTable.ts — Bartender serves food at a standing table.
 * Mirrors Lua ServeFoodAtTable: Duty=6, Bartender job, nJobExperience=30.
 */

import { Task, type NeedAdvertisement } from '../Task';
import { Base } from '../../core/Base';

export class ServeFoodAtTable extends Task {
  readonly name = 'ServeFoodAtTable';
  nJobExperience = 30;

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [
      { need: 'duty', amount: 6 },
    ];
  }

  protected onStart() {
    this.duration = 8;
  }

  protected onUpdate(dt: number) {
    if (this.elapsedTime >= this.duration) {
      Base.incrementStat('nMealsServed');
      this.complete();
    }
  }
}
