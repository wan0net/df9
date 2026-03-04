/**
 * OxygenFleeArea.ts — Flee from low-oxygen area.
 * Mirrors Lua OxygenFleeArea: SURVIVAL_NORMAL, BaseScore=200.
 */

import { Task, type NeedAdvertisement } from '../Task';

export class OxygenFleeArea extends Task {
  readonly name = 'OxygenFleeArea';
  nJobExperience = 0;

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [];
  }

  protected onStart() {
    this.duration = 5;
  }

  protected onUpdate(dt: number) {
    if (this.elapsedTime >= this.duration) {
      this.complete();
    }
  }
}
