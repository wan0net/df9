/**
 * MaintainEnvObject.ts — Repair damaged objects.
 */

import { Task, type NeedAdvertisement } from '../Task';
import type { EnvObject } from '../../envobjects/EnvObject';

export class MaintainEnvObject extends Task {
  readonly name = 'MaintainEnvObject';
  private targetObj: EnvObject | null = null;

  constructor(targetObj?: EnvObject) {
    super();
    this.targetObj = targetObj ?? null;
  }

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [{ need: 'duty', amount: 30 }];
  }

  protected onStart() {
    this.duration = 15;
  }

  protected onUpdate(dt: number) {
    if (this.elapsedTime >= this.duration) {
      // Repair the object
      if (this.targetObj && this.character) {
        const competency = this.character.tStats.tCompetency[3] ?? 0; // TECHNICIAN
        this.targetObj.maintain(this.targetObj.getCondition(), competency);
      }
      this.complete();
    }
  }
}
