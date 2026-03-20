/**
 * MaintainEnvObject.ts — Repair damaged objects.
 * Uses 3-phase interaction: walk → interact → complete.
 */

import { Task, type NeedAdvertisement } from '../Task';
import type { EnvObject } from '../../envobjects/EnvObject';
import { researchSystem } from '../../research/ResearchSystem';
import { RESEARCH_DEFS } from '../../research/ResearchData';
import { MORALE_MAINTAIN_OBJECT } from '../../characters/CharacterConstants';
import { SpatialAudio } from '../../audio/SpatialAudio';

export class MaintainEnvObject extends Task {
  readonly name = 'MaintainEnvObject';
  private targetObj: EnvObject;
  private interacting = false;

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
    if (!this.character) return;

    // Phase 1: Wait for walk to finish
    if (this.character.moving || this.character.path.length > 0) return;

    // Phase 2: Start interaction with object
    if (!this.interacting) {
      if (this.attemptInteractWithObject(this.targetObj, this.duration)) {
        this.interacting = true;
        SpatialAudio.playAtTile('TechMaintain', this.character.tileX, this.character.tileY);
      }
    }

    // Phase 3: Tick interaction, repair on completion
    if (this.interacting && this.tickInteraction(dt)) {
      this._doMaintain();
      this.complete();
    } else if (!this.interacting && this.elapsedTime >= this.duration) {
      // Fallback: complete after duration if interaction never started
      this._doMaintain();
      this.complete();
    }
  }

  private _doMaintain() {
    if (!this.character) return;
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

    this.character.addMorale(MORALE_MAINTAIN_OBJECT);
  }
}
