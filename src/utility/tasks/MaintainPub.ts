/**
 * MaintainPub.ts — Bartender opens/maintains pub.
 * Mirrors Lua OptionData: OpenPub Needs={Duty=8}, MaintainPub Needs={Duty=1}.
 * Bartender maintains bar equipment and prepares drinks.
 */

import { Task, type NeedAdvertisement } from '../Task';

export class MaintainPub extends Task {
  readonly name = 'MaintainPub';
  nJobExperience = 5;

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [{ need: 'duty', amount: 8 }];
  }

  protected onStart() {
    this.duration = 15;
  }

  protected onUpdate(dt: number) {
    if (!this.character) { this.fail(); return; }

    if (this.character.moving || this.character.path.length > 0) return;

    if (this.rTargetObject && !this.nInteracting) {
      this.attemptInteractWithObject(this.rTargetObject, this.duration);
    }

    if (this.nInteracting !== null) {
      if (this.tickInteraction(dt)) {
        this.complete();
      }
    } else if (this.elapsedTime >= this.duration) {
      this.complete();
    }
  }
}
