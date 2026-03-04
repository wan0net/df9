/**
 * ListenToJukebox.ts — Listen to jukebox in Pub zone.
 * Mirrors Lua ListenToJukebox: Amusement=7, Social=0.00001.
 */

import { Task, type NeedAdvertisement } from '../Task';

export class ListenToJukebox extends Task {
  readonly name = 'ListenToJukebox';
  nJobExperience = 0;

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [
      { need: 'amusement', amount: 7 },
      { need: 'social', amount: 0.00001 },
    ];
  }

  protected onStart() {
    this.duration = 12;
  }

  protected onUpdate(dt: number) {
    if (this.elapsedTime >= this.duration) {
      this.complete();
    }
  }
}
