/**
 * SleepOnFloor.ts — Floor sleeping fallback (no bed available).
 */

import { Task, type NeedAdvertisement } from '../Task';
import { MORALE_SLEPT_ON_FLOOR } from '../../characters/CharacterConstants';

export class SleepOnFloor extends Task {
  readonly name = 'SleepOnFloor';

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [{ need: 'energy', amount: 30 }];
  }

  protected onStart() {
    this.duration = 60; // 60 game seconds
  }

  protected onUpdate(dt: number) {
    if (this.elapsedTime >= this.duration) {
      // Apply morale penalty for sleeping on floor
      if (this.character) {
        this.character.addMorale(MORALE_SLEPT_ON_FLOOR);
      }
      this.complete();
    }
  }
}
