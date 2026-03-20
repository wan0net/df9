/**
 * TearDownEnvObjectForResearch.ts — Scientist disassembles a datacube env object.
 * Mirrors Lua OptionData: TearDownEnvObjectForResearch — Needs={Duty=20},
 * Tags={WorkShift, Job=SCIENTIST}, ClassPath='Utility.Tasks.DestroyEnvObject'.
 *
 * Scientist walks to env object, interacts for 10s, then the object is destroyed
 * and a ResearchDatacube pickup is spawned at its tile.
 */

import { Task, type NeedAdvertisement } from '../Task';
import type { EnvObject } from '../../envobjects/EnvObject';
import { EnvObjectManager } from '../../envobjects/EnvObjectManager';
import { ResearchDatacube } from '../../pickups/ResearchDatacube';
import type { Pickup } from '../../pickups/Pickup';

/** Time to tear down an object for research (seconds). */
const TEARDOWN_DURATION = 10;

export class TearDownEnvObjectForResearch extends Task {
  readonly name = 'TearDownEnvObjectForResearch';
  nJobExperience = 2;

  private targetObj: EnvObject;
  private onPickupCreated: ((pickup: Pickup) => void) | null;

  constructor(obj: EnvObject, onPickupCreated?: (pickup: Pickup) => void) {
    super();
    this.targetObj = obj;
    this.onPickupCreated = onPickupCreated ?? null;
  }

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [{ need: 'duty', amount: 20 }];
  }

  protected onStart() {
    this.duration = TEARDOWN_DURATION;
  }

  protected onUpdate(dt: number) {
    if (!this.character) { this.fail(); return; }

    // Check object still exists
    if (!this.targetObj || this.targetObj.nCondition <= 0) {
      this.complete();
      return;
    }

    if (this.elapsedTime >= this.duration) {
      const tx = this.targetObj.tileX;
      const ty = this.targetObj.tileY;

      // Destroy the original env object
      EnvObjectManager.removeObject(this.targetObj);

      // Spawn a ResearchDatacube pickup at the tile
      const datacube = new ResearchDatacube(tx, ty);
      if (this.onPickupCreated) {
        this.onPickupCreated(datacube);
      }

      this.complete();
    }
  }
}
