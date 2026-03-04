/**
 * MaintainEnvObject.ts — Repair damaged objects.
 */

import { Task, type NeedAdvertisement } from '../Task';
import type { EnvObject } from '../../envobjects/EnvObject';
import { researchSystem } from '../../research/ResearchSystem';
import { RESEARCH_DEFS } from '../../research/ResearchData';

export class MaintainEnvObject extends Task {
  readonly name = 'MaintainEnvObject';
  private targetObj: EnvObject;

  constructor(targetObj: EnvObject) {
    super();
    this.targetObj = targetObj;
  }

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [{ need: 'duty', amount: 30 }];
  }

  protected onStart() {
    this.duration = 15;
  }

  protected onUpdate(dt: number) {
    if (this.elapsedTime >= this.duration) {
      // Repair the object — use the object's maintainJob for competency lookup
      if (this.targetObj && this.character) {
        const jobId = this.targetObj.tData.maintainJob;
        const competency = this.character.tStats.tCompetency[jobId] ?? 0;
        const condBefore = this.targetObj.getCondition();
        this.targetObj.maintain(condBefore, competency);

        // Apply research multiplier if MaintenanceLevel2 is completed
        if (researchSystem.isCompleted('MaintenanceLevel2')) {
          const multiplier = RESEARCH_DEFS.MaintenanceLevel2.nConditionMultiplier ?? 1;
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
