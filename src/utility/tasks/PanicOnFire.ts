/**
 * PanicOnFire.ts — Character is literally on fire, panicking.
 * Mirrors Lua OptionData: SURVIVAL_NORMAL priority, PUPPET level.
 * Character flails around while taking fire damage.
 */

import { Task, type NeedAdvertisement } from '../Task';
import { FIRE_DAMAGE_PER_SECOND } from '../../hazards/Fire';
import { addLog } from '../../characters/Log';

export class PanicOnFire extends Task {
  readonly name = 'PanicOnFire';
  nJobExperience = 0;

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [];
  }

  protected onStart() {
    this.duration = 5;
    if (this.character) addLog('DISASTER_FIRE', this.character);
  }

  protected onUpdate(dt: number) {
    if (!this.character) { this.fail(); return; }

    // Take fire damage while on fire
    this.character.takeDamage(FIRE_DAMAGE_PER_SECOND * dt);

    if (this.elapsedTime >= this.duration) {
      this.complete();
    }
  }
}
