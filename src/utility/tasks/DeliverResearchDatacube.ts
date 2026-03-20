/**
 * DeliverResearchDatacube.ts — Scientist carries a datacube to a research desk.
 * Mirrors Lua OptionData: DeliverResearchDatacube — Needs={Duty=20},
 * Tags={WorkShift, DestOwned, DestSafe, Job=SCIENTIST},
 * Prerequisites={HeldItem='ResearchDatacube', Spacewalking=false}.
 *
 * Scientist walks to research desk, interacts for 5s, then consumes the
 * datacube (granting research progress or discovering a blueprint) and
 * clears the held item.
 */

import { Task, type NeedAdvertisement } from '../Task';
import { researchSystem } from '../../research/ResearchSystem';
import { DATACUBE_RESEARCH_AMOUNT } from '../../pickups/ResearchDatacube';
import { RESEARCH_DEFS } from '../../research/ResearchData';

/** Time to deliver a datacube to the desk (seconds). */
const DELIVER_DURATION = 5;

export class DeliverResearchDatacube extends Task {
  readonly name = 'DeliverResearchDatacube';
  nJobExperience = 20;

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [{ need: 'duty', amount: 20 }];
  }

  protected onStart() {
    this.duration = DELIVER_DURATION;
  }

  protected onUpdate(dt: number) {
    if (!this.character) { this.fail(); return; }

    // Must still be holding the datacube
    if (this.character.heldItem !== 'ResearchDatacube') {
      this.fail();
      return;
    }

    if (this.elapsedTime >= this.duration) {
      // Consume the datacube: try to discover a random bDiscoverOnly blueprint,
      // otherwise add progress to active research.
      const discovery = this.pickRandomDiscovery();
      if (discovery) {
        researchSystem.discoverBlueprint(discovery);
      } else {
        researchSystem.addProgress(DATACUBE_RESEARCH_AMOUNT);
      }

      // Clear held item
      this.character.heldItem = null;

      this.complete();
    }
  }

  /** Pick a random undiscovered bDiscoverOnly research. */
  private pickRandomDiscovery(): string | null {
    const available: string[] = [];
    for (const [key, def] of Object.entries(RESEARCH_DEFS)) {
      if (def.bDiscoverOnly && !researchSystem.isCompleted(key)) {
        available.push(key);
      }
    }
    if (available.length === 0) return null;
    return available[Math.floor(Math.random() * available.length)];
  }
}
