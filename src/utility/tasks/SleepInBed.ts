/**
 * SleepInBed.ts — Sleep in a bed to restore energy.
 */

import { Task, type NeedAdvertisement } from '../Task';
import { MORALE_WOKE_UP_BED } from '../../characters/CharacterConstants';

export class SleepInBed extends Task {
  readonly name = 'SleepInBed';

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [{ need: 'energy', amount: 80 }];
  }

  protected onStart() {
    this.duration = 120; // 2 game minutes
  }

  protected onUpdate(dt: number) {
    if (this.elapsedTime >= this.duration) {
      // Morale bonus for sleeping in bed
      if (this.character) {
        this.character.nMorale = Math.min(100, this.character.nMorale + MORALE_WOKE_UP_BED);
      }
      this.complete();
    }
  }
}
