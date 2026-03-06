/**
 * UtilityAI.ts — Decision engine for character task selection.
 * Mirrors Utility/UtilityAI.lua: gather options, evaluate, pick highest.
 */

import type { Character } from '../characters/Character';
import type { ActivityOption } from './ActivityOption';
import type { Task } from './Task';

export class UtilityAI {
  /**
   * Select the best task from available options.
   * Returns the task from the highest-scoring option, or null if none available.
   */
  static selectTask(character: Character, options: ActivityOption[]): Task | null {
    if (options.length === 0) return null;

    let bestOption: ActivityOption | null = null;
    let bestScore = -Infinity;

    for (const option of options) {
      const score = option.evaluate(character);
      if (score > bestScore) {
        bestScore = score;
        bestOption = option;
      }
    }

    if (bestOption) {
      const task = bestOption.task;
      task.targetX = bestOption.targetX;
      task.targetY = bestOption.targetY;
      // Copy activity tags to task for duty cycle checks
      if (bestOption.tags) {
        task.tags = { ...bestOption.tags } as Record<string, boolean>;
      }
      return task;
    }

    return null;
  }
}
