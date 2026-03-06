/**
 * PanicOxygen.ts — Panic when oxygen is low (low bravery characters).
 * Mirrors Lua PanicOxygen: SURVIVAL_NORMAL, BaseScore=1, nBravery={0,0.4}.
 */

import { Task, type NeedAdvertisement } from '../Task';
import { addLog } from '../../characters/Log';

export class PanicOxygen extends Task {
  readonly name = 'PanicOxygen';
  nJobExperience = 0;

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [];
  }

  protected onStart() {
    this.duration = 5;
    if (this.character) addLog('DISASTER_BREACH', this.character);
  }

  protected onUpdate(dt: number) {
    if (this.elapsedTime >= this.duration) {
      this.complete();
    }
  }
}
