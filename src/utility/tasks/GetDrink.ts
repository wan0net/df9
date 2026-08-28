/**
 * GetDrink.ts — Path to bar, drink, satisfy amusement and hunger.
 */

import { Task, type NeedAdvertisement } from '../Task';
import { MORALE_DRANK_BASE } from '../../characters/CharacterConstants';
import { SpatialAudio } from '../../audio/SpatialAudio';

export class GetDrink extends Task {
  readonly name = 'GetDrink';

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [
      { need: 'amusement', amount: 25 },
      { need: 'hunger', amount: 10 },
    ];
  }

  protected onStart() {
    this.duration = 8;
  }

  protected onUpdate(dt: number) {
    if (this.elapsedTime >= this.duration) {
      // Morale bonus for drinking
      if (this.character) {
        SpatialAudio.playAtTile('Citizen_Drink', this.character.tileX, this.character.tileY);
        this.character.addMorale(MORALE_DRANK_BASE);
      }
      this.complete();
    }
  }
}
