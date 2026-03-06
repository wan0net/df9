/**
 * ResearchDatacube.ts — Pickup containing random research data.
 * Mirrors Pickups/PickupData.lua ResearchDatacube entry.
 * Scientists pick these up to discover bDiscoverOnly blueprints
 * or grant progress toward the active research topic.
 */

import { Pickup } from './Pickup';
import { researchSystem } from '../research/ResearchSystem';
import { RESEARCH_DEFS } from '../research/ResearchData';

/** Amount of research progress a datacube grants if no discovery available. */
export const DATACUBE_RESEARCH_AMOUNT = 50;

export class ResearchDatacube extends Pickup {
  /** The research tech key this datacube contains data for (if any). */
  sResearchKey: string | null;
  /** Whether the data has been consumed. */
  bEmpty = false;

  constructor(tileX: number, tileY: number) {
    super('ResearchDatacube', tileX, tileY);
    // Pick a random undiscovered bDiscoverOnly blueprint, or null
    this.sResearchKey = this.pickRandomDiscovery();
  }

  /** Pick a random bDiscoverOnly research that isn't completed yet. */
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

  /** Consume the datacube data. Returns true if consumed. */
  consume(): boolean {
    if (this.bEmpty) return false;
    this.bEmpty = true;
    if (this.sResearchKey) {
      // Discover a blueprint
      researchSystem.discoverBlueprint(this.sResearchKey);
    } else {
      // Grant progress toward active research
      researchSystem.addProgress(DATACUBE_RESEARCH_AMOUNT);
    }
    return true;
  }
}
