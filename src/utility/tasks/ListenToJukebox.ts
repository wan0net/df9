/**
 * ListenToJukebox.ts — Listen to jukebox in Pub zone.
 * Mirrors Lua ListenToJukebox: Amusement=7, Social=0.00001.
 * Uses 3-phase interaction: walk → interact → complete.
 */

import { Task, type NeedAdvertisement } from '../Task';
import { MORALE_DID_HOBBY } from '../../characters/CharacterConstants';

export class ListenToJukebox extends Task {
  readonly name = 'ListenToJukebox';
  nJobExperience = 0;
  private interacting = false;

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [
      { need: 'amusement', amount: 7 },
      { need: 'social', amount: 0.00001 },
    ];
  }

  protected onStart() {
    this.duration = 12;
  }

  protected onUpdate(dt: number) {
    if (!this.character) return;

    // Phase 1: Wait for character to finish walking
    if (this.character.moving || this.character.path.length > 0) return;

    // Phase 2: Start interaction with jukebox
    if (!this.interacting && this.rTargetObject) {
      if (this.attemptInteractWithObject(this.rTargetObject, this.duration)) {
        this.interacting = true;
      }
    }

    // Phase 3: Tick interaction timer
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
