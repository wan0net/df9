/**
 * HarvestAndDeliverFood.ts — Botanist harvests food from plants and delivers to fridge.
 * Mirrors Lua HarvestAndDeliverFood: Duty=7, Botanist job, nJobExperience=15.
 */

import { Task, type NeedAdvertisement } from '../Task';
import { MORALE_DELIVERED_FOOD } from '../../characters/CharacterConstants';

export class HarvestAndDeliverFood extends Task {
  readonly name = 'HarvestAndDeliverFood';
  nJobExperience = 15;

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [
      { need: 'duty', amount: 7 },
    ];
  }

  protected onStart() {
    this.duration = 10;
  }

  protected onUpdate(dt: number) {
    if (this.elapsedTime >= this.duration) {
      this.character?.addMorale(MORALE_DELIVERED_FOOD);
      this.complete();
    }
  }
}
