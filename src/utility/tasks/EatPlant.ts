/**
 * EatPlant.ts — Eat a plant directly for hunger.
 * Mirrors Lua OptionData: Needs={Hunger=15}. Higher satisfaction than replicator.
 */

import { Task, type NeedAdvertisement } from '../Task';
import { MORALE_ATE_MEAL_BASE } from '../../characters/CharacterConstants';
import { Base } from '../../core/Base';

export class EatPlant extends Task {
  readonly name = 'EatPlant';

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [{ need: 'hunger', amount: 45 }];
  }

  protected onStart() {
    this.duration = 10;
  }

  protected onUpdate(dt: number) {
    if (!this.character) { this.fail(); return; }

    if (this.character.moving || this.character.path.length > 0) return;

    if (this.rTargetObject && this.nInteracting === null) {
      this.attemptInteractWithObject(this.rTargetObject, this.duration);
    }

    if (this.nInteracting !== null) {
      if (this.tickInteraction(dt)) {
        this.character.addMorale(MORALE_ATE_MEAL_BASE + 2);
        Base.incrementStat('nMealsServed');
        this.complete();
      }
    } else if (this.elapsedTime >= this.duration) {
      this.character.addMorale(MORALE_ATE_MEAL_BASE + 2);
      Base.incrementStat('nMealsServed');
      this.complete();
    }
  }
}
