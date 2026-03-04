/**
 * Brawl.ts — Fight another citizen (anger-driven).
 * Mirrors Lua Brawl: SURVIVAL_LOW, BaseScore=60.
 */

import { Task, type NeedAdvertisement } from '../Task';

export class Brawl extends Task {
  readonly name = 'Brawl';
  nJobExperience = 0;

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [];
  }

  protected onStart() {
    this.duration = 6;
  }

  protected onUpdate(dt: number) {
    if (!this.character) { this.fail(); return; }

    // Brawl reduces anger
    if (this.elapsedTime >= this.duration) {
      this.character.nAnger = Math.max(0, this.character.nAnger - 20);
      this.complete();
    }
  }
}
