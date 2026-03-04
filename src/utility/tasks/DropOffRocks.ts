/**
 * DropOffRocks.ts — Miner drops off rocks at refinery.
 * Mirrors Lua DropOffRocks: Duty=7, Miner job, requires HeldItem='Rock'.
 */

import { Task, type NeedAdvertisement } from '../Task';
import { GameRules } from '../../core/GameRules';

export class DropOffRocks extends Task {
  readonly name = 'DropOffRocks';
  nJobExperience = 5;

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [
      { need: 'duty', amount: 7 },
    ];
  }

  protected onStart() {
    this.duration = 4;
  }

  protected onUpdate(dt: number) {
    if (!this.character) { this.fail(); return; }

    if (this.elapsedTime >= this.duration) {
      // Drop held rock item and convert to matter
      if (this.character.heldItem === 'Rock') {
        this.character.heldItem = null;
        // Yield matter from rock
        const yield_ = 30 + Math.random() * 20;
        GameRules.nMatter += Math.floor(yield_);
      }
      this.complete();
    }
  }
}
