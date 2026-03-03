/**
 * Cuff.ts — Security arrests a rampaging citizen.
 * Mirrors Utility/Tasks/Cuff.lua.
 */

import { Task, type NeedAdvertisement } from '../Task';

export class Cuff extends Task {
  readonly name = 'Cuff';
  private targetCharId: number;

  /** Time to cuff a citizen. */
  private static readonly CUFF_TIME = 5;

  constructor(targetCharId: number) {
    super();
    this.targetCharId = targetCharId;
    this.nJobExperience = 15;
  }

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [{ need: 'duty', amount: 20 }];
  }

  getTargetCharId(): number {
    return this.targetCharId;
  }

  protected onStart() {
    this.duration = Cuff.CUFF_TIME;
  }

  protected onUpdate(_dt: number) {
    if (this.elapsedTime >= this.duration) {
      this.complete();
    }
  }
}
