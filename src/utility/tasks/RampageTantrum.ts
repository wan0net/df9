/**
 * RampageTantrum.ts — Violent rampage tantrum (break things, attack people).
 * Mirrors Lua ViolentRampageBreathe + ViolentRampagePatrol: Status=RAMPAGE_VIOLENT,
 * SURVIVAL_NORMAL, BaseScore=100.
 */

import { Task, type NeedAdvertisement } from '../Task';
import { addLog } from '../../characters/Log';

export class RampageTantrum extends Task {
  readonly name = 'RampageTantrum';
  nJobExperience = 0;

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [];
  }

  protected onStart() {
    this.duration = 10;
    if (this.character) {
      addLog('RAMPAGE_START', this.character);
    }
  }

  protected onUpdate(dt: number) {
    if (!this.character) { this.fail(); return; }

    // Rampage drains anger
    if (this.elapsedTime >= this.duration) {
      this.character.nAnger = Math.max(0, this.character.nAnger - 30);
      this.complete();
    }
  }
}
