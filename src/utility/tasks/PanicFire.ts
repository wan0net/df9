/**
 * PanicFire.ts — Panic when fire is nearby (low bravery characters).
 * Mirrors Lua PanicFire: SURVIVAL_NORMAL, BaseScore=2, nBravery={0,0.4}.
 */

import { Task, type NeedAdvertisement } from '../Task';
import { addLog } from '../../characters/Log';

export class PanicFire extends Task {
  readonly name = 'PanicFire';
  nJobExperience = 0;

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [];
  }

  protected onStart() {
    this.duration = 5;
    if (this.character) addLog('DISASTER_FIRE', this.character);
  }

  protected onUpdate(dt: number) {
    // Panic: character stands still or wanders erratically
    if (this.elapsedTime >= this.duration) {
      this.complete();
    }
  }
}
