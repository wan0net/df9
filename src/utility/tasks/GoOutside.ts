/**
 * GoOutside.ts — Transition character to spacewalking state.
 * Mirrors Lua OptionData: ClassPath=Utility.Tasks.GoOutside,
 * Satisfies={WearingSuit=true}. Character walks to airlock and goes outside.
 */

import { Task, type NeedAdvertisement } from '../Task';

export class GoOutside extends Task {
  readonly name = 'GoOutside';
  nJobExperience = 0;

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [];
  }

  protected onStart() {
    this.duration = 2;
  }

  protected onUpdate(dt: number) {
    if (!this.character) { this.fail(); return; }

    if (this.elapsedTime >= this.duration) {
      this.character.bSpacewalking = true;
      this.complete();
    }
  }
}
