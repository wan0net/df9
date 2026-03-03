/**
 * ServeDrink.ts — Bartender serves a drink at the bar.
 * Mirrors Activities/ServeDrink.lua.
 */

import { Task, type NeedAdvertisement } from '../Task';
import { MORALE_SERVED_MEAL } from '../../characters/CharacterConstants';

export class ServeDrink extends Task {
  readonly name = 'ServeDrink';
  nJobExperience = 15;

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [{ need: 'duty', amount: 4 }, { need: 'social', amount: 2 }];
  }

  protected onStart() {
    this.duration = 8;
  }

  protected onUpdate(dt: number) {
    if (this.elapsedTime >= this.duration) {
      this.complete();
    }
  }
}
