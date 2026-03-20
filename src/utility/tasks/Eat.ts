/**
 * Eat.ts — Eat at a food replicator or fridge to satisfy hunger.
 * Uses 3-phase interaction: walk → interact → complete.
 */

import { Task, type NeedAdvertisement } from '../Task';
import { MORALE_ATE_MEAL_BASE } from '../../characters/CharacterConstants';
import { Base } from '../../core/Base';
import { SpatialAudio } from '../../audio/SpatialAudio';

export class Eat extends Task {
  readonly name = 'Eat';
  private interacting = false;

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [{ need: 'hunger', amount: 40 }];
  }

  protected onStart() {
    this.duration = 10;
  }

  protected onUpdate(dt: number) {
    if (!this.character) return;

    // Phase 1: Wait for walk to finish
    if (this.character.moving || this.character.path.length > 0) return;

    // Phase 2: Start interaction with food source
    if (!this.interacting && this.rTargetObject) {
      if (this.attemptInteractWithObject(this.rTargetObject, this.duration)) {
        this.interacting = true;
      }
    }

    // Phase 3: Tick interaction
    if (this.interacting) {
      if (this.tickInteraction(dt)) {
        SpatialAudio.playAtTile('Citizen_Drink', this.character.tileX, this.character.tileY);
        this.character.addMorale(MORALE_ATE_MEAL_BASE);
        Base.incrementStat('nMealsServed');
        this.complete();
      }
    } else if (this.elapsedTime >= this.duration) {
      // Fallback: complete after duration if interaction never started
      SpatialAudio.playAtTile('Citizen_Drink', this.character.tileX, this.character.tileY);
      this.character.addMorale(MORALE_ATE_MEAL_BASE);
      Base.incrementStat('nMealsServed');
      this.complete();
    }
  }
}
