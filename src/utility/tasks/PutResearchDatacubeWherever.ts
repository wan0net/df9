/**
 * PutResearchDatacubeWherever.ts — Scientist drops datacube on floor.
 * Mirrors Lua OptionData: PutResearchDatacubeWherever —
 * ClassPath='Utility.Tasks.DropEverything', Needs={Duty=7},
 * Tags={WorkShift, DestOwned, DestSafe, Job=SCIENTIST},
 * Prerequisites={HeldItem='ResearchDatacube', Spacewalking=false,
 *                HeldItemInDanger='ResearchDatacube'}.
 *
 * Fallback when no research desk is available: just drop the datacube
 * as a pickup on the current tile.
 */

import { Task, type NeedAdvertisement } from '../Task';
import { ResearchDatacube } from '../../pickups/ResearchDatacube';
import type { Pickup } from '../../pickups/Pickup';

export class PutResearchDatacubeWherever extends Task {
  readonly name = 'PutResearchDatacubeWherever';
  nJobExperience = 0;

  private onPickupCreated: ((pickup: Pickup) => void) | null;

  constructor(onPickupCreated?: (pickup: Pickup) => void) {
    super();
    this.onPickupCreated = onPickupCreated ?? null;
  }

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [{ need: 'duty', amount: 7 }];
  }

  protected onStart() {
    this.duration = 1;
  }

  protected onUpdate(dt: number) {
    if (!this.character) { this.fail(); return; }

    if (this.elapsedTime >= this.duration) {
      // Drop the datacube as a pickup on the floor
      if (this.character.heldItem === 'ResearchDatacube') {
        const datacube = new ResearchDatacube(
          this.character.tileX,
          this.character.tileY,
        );
        if (this.onPickupCreated) {
          this.onPickupCreated(datacube);
        }
        this.character.heldItem = null;
      }
      this.complete();
    }
  }
}
