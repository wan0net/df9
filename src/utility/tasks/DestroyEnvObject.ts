/**
 * DestroyEnvObject.ts — Vaporize/demolish an environment object.
 * Mirrors Lua OptionData: Needs={Duty=10}, Tags={WorkShift, Job=BUILDER},
 * Used for demolish commands and research teardown.
 */

import { Task, type NeedAdvertisement } from '../Task';
import type { EnvObject } from '../../envobjects/EnvObject';
import { EnvObjectManager } from '../../envobjects/EnvObjectManager';

/** Time to destroy an object (seconds). */
const DESTROY_DURATION = 8;

export class DestroyEnvObject extends Task {
  readonly name = 'DestroyEnvObject';
  nJobExperience = 2;

  private targetObj: EnvObject;

  constructor(obj: EnvObject) {
    super();
    this.targetObj = obj;
  }

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [{ need: 'duty', amount: 10 }];
  }

  protected onStart() {
    this.duration = DESTROY_DURATION;
  }

  protected onUpdate(dt: number) {
    if (!this.character) { this.fail(); return; }

    // Check object still exists
    if (!this.targetObj || this.targetObj.nCondition <= 0) {
      this.complete();
      return;
    }

    if (this.elapsedTime >= this.duration) {
      // Destroy the object
      EnvObjectManager.removeObject(this.targetObj);
      this.complete();
    }
  }
}
