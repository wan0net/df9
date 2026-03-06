/**
 * DropOffCorpse.ts — Janitor carries a corpse to the recycler for matter.
 * Mirrors Activities/DropOffCorpse.lua.
 */

import { Task, type NeedAdvertisement } from '../Task';
import { GameRules, MAT_CORPSE_MIN, MAT_CORPSE_MAX } from '../../core/GameRules';
import { Base } from '../../core/Base';
import { MORALE_MINE_ASTEROID } from '../../characters/CharacterConstants';

export class DropOffCorpse extends Task {
  readonly name = 'DropOffCorpse';
  nJobExperience = 15;

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [{ need: 'duty', amount: 8 }];
  }

  protected onStart() {
    this.duration = 15;
  }

  protected onUpdate(dt: number) {
    if (this.elapsedTime >= this.duration) {
      // Convert corpse to matter
      const matter = MAT_CORPSE_MIN + Math.floor(Math.random() * (MAT_CORPSE_MAX - MAT_CORPSE_MIN + 1));
      GameRules.nMatter += matter;
      Base.incrementStat('nCorpsesRecycled');
      Base.addAlert('recycle', `Corpse recycled for ${matter} matter`);
      // mirrors DropOffCorpse.lua:34 — uses MORALE_MINE_ASTEROID constant on completion
      this.character?.addMorale(MORALE_MINE_ASTEROID);
      this.complete();
    }
  }
}
