/**
 * MaintainEnvObject.ts — Repair damaged objects.
 */

import { Task, type NeedAdvertisement } from '../Task';
import { TECHNICIAN } from '../../characters/CharacterConstants';
import type { EnvObject } from '../../envobjects/EnvObject';

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
      // Repair the object
      if (this.targetObj && this.character) {
        const competency = this.character.tStats.tCompetency[TECHNICIAN] ?? 0;
        this.targetObj.maintain(this.targetObj.getCondition(), competency);
      }
      this.complete();
    }
  }
}
