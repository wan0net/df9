/**
 * FireFleeArea.ts — Flee from fire area (moderate+ bravery characters).
 * Mirrors Lua FireFleeArea: SURVIVAL_NORMAL, BaseScore=4, nBravery={0.2,1}.
 */

import { Task, type NeedAdvertisement } from '../Task';

export class FireFleeArea extends Task {
  readonly name = 'FireFleeArea';
  nJobExperience = 0;

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [];
  }

  protected onStart() {
    this.duration = 6;
  }

  protected onUpdate(dt: number) {
    if (this.elapsedTime >= this.duration) {
      this.complete();
    }
  }
}
