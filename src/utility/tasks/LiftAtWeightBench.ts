/**
 * LiftAtWeightBench.ts — Exercise at weight bench in Fitness zone.
 * Mirrors Lua LiftAtWeightBench: Amusement=7.
 * Uses 3-phase interaction: walk → interact → complete.
 */

import { Task, type NeedAdvertisement } from '../Task';
import { MORALE_DID_HOBBY } from '../../characters/CharacterConstants';

export class LiftAtWeightBench extends Task {
  readonly name = 'LiftAtWeightBench';
  nJobExperience = 0;
  private interacting = false;

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [
      { need: 'amusement', amount: 7 },
    ];
  }

  protected onStart() {
    this.duration = 10;
  }

  protected onUpdate(dt: number) {
    if (!this.character) return;

    // Phase 1: Wait for walk to finish
    if (this.character.moving || this.character.path.length > 0) return;

    // Phase 2: Start interaction with bench
    if (!this.interacting && this.rTargetObject) {
      if (this.attemptInteractWithObject(this.rTargetObject, this.duration)) {
        this.interacting = true;
      }
    }

    // Phase 3: Tick interaction
    if (this.interacting) {
      if (this.tickInteraction(dt)) {
        this.character.addMorale(MORALE_DID_HOBBY);
        this.complete();
      }
    } else if (this.elapsedTime >= this.duration) {
      // Fallback: complete after duration if interaction never started
      this.character.addMorale(MORALE_DID_HOBBY);
      this.complete();
    }
  }
}
