/**
 * SleepInBed.ts — Sleep in a bed to restore energy.
 */

import { Task, type NeedAdvertisement } from '../Task';
import { MORALE_WOKE_UP_BED } from '../../characters/CharacterConstants';
import { SpatialAudio } from '../../audio/SpatialAudio';

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
        SpatialAudio.playAtTile('OutofBed', this.character.tileX, this.character.tileY);
        this.character.addMorale(MORALE_WOKE_UP_BED);
      }
      this.complete();
    }
  }
}
