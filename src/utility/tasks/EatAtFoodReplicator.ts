/**
 * EatAtFoodReplicator.ts — Eat at a food replicator specifically.
 * Mirrors Lua OptionData: Needs={Hunger=10}. Lower satisfaction than EatAtTable.
 */

import { Task, type NeedAdvertisement } from '../Task';
import { MORALE_ATE_MEAL_BASE } from '../../characters/CharacterConstants';
import { Base } from '../../core/Base';

export class EatAtFoodReplicator extends Task {
  readonly name = 'EatAtFoodReplicator';

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [{ need: 'hunger', amount: 30 }];
  }

  protected onStart() {
    this.duration = 8;
  }

  protected onUpdate(dt: number) {
    if (!this.character) { this.fail(); return; }

    if (this.character.moving || this.character.path.length > 0) return;

    if (this.rTargetObject && this.nInteracting === null) {
      this.attemptInteractWithObject(this.rTargetObject, this.duration);
    }

    if (this.nInteracting !== null) {
      if (this.tickInteraction(dt)) {
        this.character.addMorale(MORALE_ATE_MEAL_BASE);
        Base.incrementStat('nMealsServed');
        this.complete();
      }
    } else if (this.elapsedTime >= this.duration) {
      this.character.addMorale(MORALE_ATE_MEAL_BASE);
      Base.incrementStat('nMealsServed');
      this.complete();
    }
  }
}
