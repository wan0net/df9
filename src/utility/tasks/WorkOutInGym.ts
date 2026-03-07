/**
 * WorkOutInGym.ts — Exercise in gym with equipment.
 * Mirrors Lua OptionData: Needs={Amusement=6}. Better than WorkOutNoGym.
 */

import { Task, type NeedAdvertisement } from '../Task';
import { MORALE_DID_HOBBY } from '../../characters/CharacterConstants';

export class WorkOutInGym extends Task {
  readonly name = 'WorkOutInGym';
  nJobExperience = 0;

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [{ need: 'amusement', amount: 6 }];
  }

  protected onStart() {
    this.duration = 12;
  }

  protected onUpdate(dt: number) {
    if (!this.character) { this.fail(); return; }

    if (this.character.moving || this.character.path.length > 0) return;

    if (this.rTargetObject && this.nInteracting === null) {
      this.attemptInteractWithObject(this.rTargetObject, this.duration);
    }

    if (this.nInteracting !== null) {
      if (this.tickInteraction(dt)) {
        this.character?.addMorale(MORALE_DID_HOBBY);
        this.complete();
      }
    } else if (this.elapsedTime >= this.duration) {
      this.character?.addMorale(MORALE_DID_HOBBY);
      this.complete();
    }
  }
}
