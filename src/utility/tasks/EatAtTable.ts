/**
 * EatAtTable.ts — Eat at a standing table (better than replicator).
 * Mirrors Lua EatAtTable: Hunger=25, Amusement=2.
 */

import { Task, type NeedAdvertisement } from '../Task';
import { MORALE_ATE_MEAL_BASE } from '../../characters/CharacterConstants';
import { Base } from '../../core/Base';

export class EatAtTable extends Task {
  readonly name = 'EatAtTable';
  nJobExperience = 0;

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [
      { need: 'hunger', amount: 25 },
      { need: 'amusement', amount: 2 },
    ];
  }

  protected onStart() {
    this.duration = 10;
  }

  protected onUpdate(dt: number) {
    if (this.elapsedTime >= this.duration) {
      if (this.character) {
        this.character.addMorale(MORALE_ATE_MEAL_BASE);
      }
      Base.incrementStat('nMealsServed');
      this.complete();
    }
  }
}
