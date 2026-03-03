/**
 * MaintainPlants.ts — Botanist tends to garden plants.
 * Mirrors Activities/MaintainPlants.lua.
 */

import { Task, type NeedAdvertisement } from '../Task';
import type { EnvObject } from '../../envobjects/EnvObject';

export class MaintainPlants extends Task {
  readonly name = 'MaintainPlants';
  nJobExperience = 15;

  private targetObj: EnvObject;

  constructor(target: EnvObject) {
    super();
    this.targetObj = target;
  }

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [{ need: 'duty', amount: 5 }];
  }

  protected onStart() {
    this.duration = 15;
  }

  protected onUpdate(dt: number) {
    if (this.elapsedTime >= this.duration) {
      // Heal the plant
      if (this.targetObj && this.character) {
        const competence = this.character.getEffectiveCompetency();
        this.targetObj.maintain(this.targetObj.nCondition, competence);
      }
      this.complete();
    }
  }
}
