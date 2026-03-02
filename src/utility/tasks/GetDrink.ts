/**
 * GetDrink.ts — Path to bar, drink, satisfy amusement and hunger.
 */

import { Task, type NeedAdvertisement } from '../Task';
import { MORALE_DRANK_BASE } from '../../characters/CharacterConstants';

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
        this.character.nMorale = Math.min(100, this.character.nMorale + MORALE_DRANK_BASE);
      }
      this.complete();
    }
  }
}
