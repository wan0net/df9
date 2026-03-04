/**
 * IncapacitatedOnFloor.ts — Character is incapacitated and lying on floor.
 * Mirrors Lua IncapacitatedOnFloor: BaseScore=0.002, NonThreatening.
 */

import { Task, type NeedAdvertisement } from '../Task';

export class IncapacitatedOnFloor extends Task {
  readonly name = 'IncapacitatedOnFloor';
  nJobExperience = 0;

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [];
  }

  protected onStart() {
    this.duration = 30;
  }

  protected onUpdate(dt: number) {
    if (!this.character) { this.fail(); return; }

    // Stay incapacitated until healed or timer expires
    if (this.character.tStats.nHP > 20 || this.elapsedTime >= this.duration) {
      this.complete();
    }
  }
}
