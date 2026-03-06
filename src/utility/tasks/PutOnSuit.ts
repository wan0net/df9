/**
 * PutOnSuit.ts — Put on a spacesuit from airlock locker.
 * Mirrors Lua PutOnSuit: Satisfies WearingSuit prerequisite.
 */

import { Task, type NeedAdvertisement } from '../Task';

export class PutOnSuit extends Task {
  readonly name = 'PutOnSuit';
  nJobExperience = 0;

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [];
  }

  protected onStart() {
    this.duration = 4;
  }

  protected onUpdate(dt: number) {
    if (!this.character) { this.fail(); return; }

    if (this.elapsedTime >= this.duration) {
      this.character.spacesuitOn();
      this.complete();
    }
  }
}
