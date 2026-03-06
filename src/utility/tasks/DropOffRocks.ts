/**
 * DropOffRocks.ts — Miner drops off rocks at refinery for matter.
 * Mirrors Lua DropOffRocks: Duty=7, Miner job, requires HeldItem='Rock'.
 */

import { Task, type NeedAdvertisement } from '../Task';
import { GameRules, MAT_MINE_ROCK_MIN, MAT_MINE_ROCK_MAX } from '../../core/GameRules';
import { Base } from '../../core/Base';
import { MORALE_MINE_ASTEROID } from '../../characters/CharacterConstants';

export class DropOffRocks extends Task {
  readonly name = 'DropOffRocks';
  nJobExperience = 5;

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [
      { need: 'duty', amount: 7 },
    ];
  }

  protected onStart() {
    this.duration = 2; // Lua: nDuration = 2
  }

  protected onUpdate(dt: number) {
    if (!this.character) { this.fail(); return; }

    if (this.elapsedTime >= this.duration) {
      // Drop held rock item and convert to matter
      if (this.character.heldItem === 'Rock') {
        this.character.heldItem = null;
        // Yield matter from rock (Lua: math.random(MAT_MINE_ROCK_MIN, MAT_MINE_ROCK_MAX))
        const yield_ = MAT_MINE_ROCK_MIN + Math.floor(Math.random() * (MAT_MINE_ROCK_MAX - MAT_MINE_ROCK_MIN + 1));
        GameRules.addMatter(yield_);
        Base.incrementStat('nRocksRecycled');

        // Morale reward
        this.character.addMorale(MORALE_MINE_ASTEROID);

        Base.addAlert('recycle', `Rock refined for ${yield_} matter`);
      }
      this.complete();
    }
  }
}
