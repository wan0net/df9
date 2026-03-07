/**
 * GoInside.ts — Transition character from spacewalking to interior.
 * Mirrors Lua OptionData: ClassPath=Utility.Tasks.GoInside,
 * bAllowHostilePathing=true. Character walks to airlock and goes inside.
 */

import { Task, type NeedAdvertisement } from '../Task';

export class GoInside extends Task {
  readonly name = 'GoInside';
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
      this.character.bSpacewalking = false;
      this.complete();
    }
  }
}
