/**
 * MaintainPlants.ts — Botanist tends to garden plants.
 * Mirrors Activities/MaintainPlants.lua.
 */

import { Task, type NeedAdvertisement } from '../Task';
import type { EnvObject } from '../../envobjects/EnvObject';
import { researchSystem } from '../../research/ResearchSystem';
import { RESEARCH_DEFS } from '../../research/ResearchData';

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
        const condBefore = this.targetObj.nCondition;
        this.targetObj.maintain(condBefore, competence);

        // Apply research multiplier if PlantLevel2 is completed
        if (researchSystem.isCompleted('PlantLevel2')) {
          const multiplier = RESEARCH_DEFS.PlantLevel2.nConditionMultiplier ?? 1;
          const healed = this.targetObj.getCondition() - condBefore;
          const extraHeal = healed * (multiplier - 1);
          if (extraHeal > 0) {
            this.targetObj.setCondition(
              Math.min(100, this.targetObj.getCondition() + extraHeal),
            );
          }
        }
      }
      this.complete();
    }
  }
}
