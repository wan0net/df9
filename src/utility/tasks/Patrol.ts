/**
 * Patrol.ts — Security character patrols a room.
 * Mirrors Activities/Patrol.lua.
 */

import { Task, type NeedAdvertisement } from '../Task';

export class Patrol extends Task {
  readonly name = 'Patrol';
  nJobExperience = 5;

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [{ need: 'duty', amount: 2 }];
  }

  protected onStart() {
    this.duration = 20;
  }

  protected onUpdate(dt: number) {
    if (this.elapsedTime >= this.duration) {
      this.complete();
    }
  }
}
