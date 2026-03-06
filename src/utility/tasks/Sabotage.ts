/**
 * Sabotage.ts — Non-violent rampage: sabotage equipment.
 * Mirrors Lua NonviolentRampageSabotage: Status=RAMPAGE_NONVIOLENT,
 * SURVIVAL_LOW, BaseScore=105.
 */

import { Task, type NeedAdvertisement } from '../Task';
import type { EnvObject } from '../../envobjects/EnvObject';
import { addLog } from '../../characters/Log';

export class Sabotage extends Task {
  readonly name = 'Sabotage';
  nJobExperience = 0;
  private targetObj: EnvObject | null;

  constructor(targetObj: EnvObject | null = null) {
    super();
    this.targetObj = targetObj;
  }

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [];
  }

  protected onStart() {
    this.duration = 5;
    if (this.character) addLog('TANTRUM_START', this.character);
  }

  protected onUpdate(dt: number) {
    if (!this.character) { this.fail(); return; }

    if (this.elapsedTime >= this.duration) {
      // Damage the target object
      if (this.targetObj && this.targetObj.bBuilt) {
        this.targetObj.nCondition = Math.max(0, this.targetObj.nCondition - 30);
      }
      this.character.nAnger = Math.max(0, this.character.nAnger - 25);
      this.complete();
    }
  }
}
