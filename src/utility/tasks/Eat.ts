/**
 * Eat.ts — Eat at a food replicator or fridge to satisfy hunger.
 */

import { Task, type NeedAdvertisement } from '../Task';
import { MORALE_ATE_MEAL_BASE } from '../../characters/CharacterConstants';
import { Base } from '../../core/Base';

export class Eat extends Task {
  readonly name = 'Eat';

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [{ need: 'hunger', amount: 40 }];
  }

  protected onStart() {
    this.duration = 10;
  }

  protected onUpdate(dt: number) {
    if (this.elapsedTime >= this.duration) {
      // Morale bonus for eating
      if (this.character) {
        this.character.addMorale(MORALE_ATE_MEAL_BASE);
      }
      Base.incrementStat('nMealsServed');
      this.complete();
    }
  }
}
