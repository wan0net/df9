/**
 * UtilityAI.ts — Decision engine for character task selection.
 * Mirrors Utility/UtilityAI.lua: gather options, evaluate, pick highest.
 */

import type { Character } from '../characters/Character';
import { type ActivityOption, PRIORITY } from './ActivityOption';
import type { Task } from './Task';

export class UtilityAI {
  /**
   * Select the best task from available options.
   * Bug 29 fix: Lua requires new option to have STRICTLY HIGHER priority level
   * than current task. A NORMAL task cannot interrupt another NORMAL task.
   * Only survival/puppet priority can interrupt.
   */
  static selectTask(character: Character, options: ActivityOption[], currentTaskPriority = PRIORITY.NO_ACTIVITY): Task | null {
    if (options.length === 0) return null;

    // Lua: nRequiredPri = getCurrentTaskPriority() + 1
    // Only consider options with priority > current task's priority,
    // OR if no current task (NO_ACTIVITY), accept any
    const requiredPri = currentTaskPriority + 1;

    let bestOption: ActivityOption | null = null;
    let bestScore = -Infinity;

    for (const option of options) {
      // Bug 29: Skip options that can't interrupt current task
      if (option.priorityLevel < requiredPri && currentTaskPriority > PRIORITY.NO_ACTIVITY) continue;

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
      // Transfer target object for reservation system
      if (bestOption.targetObject) {
        task.rTargetObject = bestOption.targetObject;
      }
      return task;
    }

    return null;
  }
}
