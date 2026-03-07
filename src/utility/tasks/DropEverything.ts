/**
 * DropEverything.ts — Drop all held items on the floor.
 * Mirrors Lua OptionData: BaseScore=-2, Needs={Duty=-10},
 * Satisfies EmptyHands prerequisite. Used as prereq satisfier.
 */

import { Task, type NeedAdvertisement } from '../Task';

export class DropEverything extends Task {
  readonly name = 'DropEverything';
  nJobExperience = 0;

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [{ need: 'duty', amount: -10 }];
  }

  protected onStart() {
    this.duration = 1;
  }

  protected onUpdate(dt: number) {
    if (!this.character) { this.fail(); return; }

    if (this.elapsedTime >= this.duration) {
      // Drop held item
      if (this.character.heldItem) {
        this.character.heldItem = null;
      }
      this.complete();
    }
  }
}
