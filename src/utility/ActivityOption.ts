/**
 * ActivityOption.ts — Activity option for utility AI evaluation.
 * Mirrors Utility/ActivityOption.lua: needs advertisement, utility scoring.
 */

import type { Task, NeedAdvertisement } from './Task';
import type { Character } from '../characters/Character';
import { isoSquareDist } from '../core/MiscUtil';

/** Distance penalty factor for utility scoring. */
const DISTANCE_PENALTY_FACTOR = 0.05;

export class ActivityOption {
  /** The task this option would create. */
  task: Task;

  /** Target tile for distance calculation. */
  targetX: number;
  targetY: number;

  /** Base priority bonus. */
  basePriority: number;

  constructor(task: Task, targetX: number, targetY: number, basePriority = 0) {
    this.task = task;
    this.targetX = targetX;
    this.targetY = targetY;
    this.basePriority = basePriority;
  }

  /**
   * Evaluate the utility of this option for a character.
   * Higher score = character wants this more.
   * Considers need satisfaction and distance penalty.
   */
  evaluate(character: Character): number {
    let score = this.basePriority;

    // Need satisfaction utility
    const advertisedNeeds = this.task.getAdvertisedNeeds();
    for (const adv of advertisedNeeds) {
      const currentValue = this.getNeedValue(character, adv.need);
      // Lower current value = higher utility for satisfying it
      // Curve: utility scales as need becomes more urgent
      const urgency = Math.max(0, 100 - currentValue) / 100;
      score += urgency * adv.amount;
    }

    // Distance penalty
    const dist = isoSquareDist(character.tileX, character.tileY, this.targetX, this.targetY);
    score -= dist * DISTANCE_PENALTY_FACTOR;

    return score;
  }

  private getNeedValue(character: Character, need: string): number {
    switch (need) {
      case 'oxygen': return character.needs.oxygen;
      case 'hunger': return character.needs.hunger;
      case 'energy': return character.needs.energy;
      case 'amusement': return character.needs.amusement;
      case 'social': return character.needs.social;
      case 'duty': return character.needs.duty;
      default: return 100;
    }
  }
}
