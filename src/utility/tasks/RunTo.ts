/**
 * RunTo.ts — Generic run-to-location task.
 * Mirrors Lua OptionData: used by FleeEmergencyAlarm, FleeTemperTantrum,
 * FireFleeArea, FleeThreat, OxygenFleeArea, GoOutsideStandalone, GoInsideStandalone.
 * Character runs to target tile and completes.
 */

import { Task, type NeedAdvertisement } from '../Task';

export class RunTo extends Task {
  readonly name = 'RunTo';
  nJobExperience = 0;

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [];
  }

  protected onStart() {
    this.duration = 8;
  }

  protected onUpdate(dt: number) {
    // RunTo completes when character reaches target tile or duration expires
    if (!this.character) { this.fail(); return; }

    const atTarget = this.character.tileX === this.targetX &&
                     this.character.tileY === this.targetY;
    if (atTarget || this.elapsedTime >= this.duration) {
      this.complete();
    }
  }
}
