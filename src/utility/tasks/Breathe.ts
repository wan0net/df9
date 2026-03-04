/**
 * Breathe.ts — Absolute fallback task when nothing else is available.
 * Mirrors Lua Breathe: BaseScore=0.001, no needs.
 */

import { Task, type NeedAdvertisement } from '../Task';

export class Breathe extends Task {
  readonly name = 'Breathe';
  nJobExperience = 0;

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [];
  }

  protected onStart() {
    this.duration = 3;
  }

  protected onUpdate(dt: number) {
    if (this.elapsedTime >= this.duration) {
      this.complete();
    }
  }
}
