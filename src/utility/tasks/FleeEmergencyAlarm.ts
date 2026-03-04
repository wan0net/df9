/**
 * FleeEmergencyAlarm.ts — Flee to safe area when emergency alarm sounds.
 * Mirrors Lua FleeEmergencyAlarm: SURVIVAL_NORMAL, BaseScore=100.
 */

import { Task, type NeedAdvertisement } from '../Task';

export class FleeEmergencyAlarm extends Task {
  readonly name = 'FleeEmergencyAlarm';
  nJobExperience = 0;

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [];
  }

  protected onStart() {
    this.duration = 10;
  }

  protected onUpdate(dt: number) {
    if (this.elapsedTime >= this.duration) {
      this.complete();
    }
  }
}
