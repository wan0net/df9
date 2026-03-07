/**
 * GoalSystem.ts — Achievement/goal tracking.
 * Mirrors GoalData.lua: 16 goals with Lua-exact check conditions.
 */

import { GOAL_DEFS, TARGET_HAPPY_MORALE, type GoalDef } from './GoalData';
import { Base } from '../core/Base';
import { line } from '../localization/Localization';

/** Callback providers for checking goal conditions. */
export interface GoalCheckProviders {
  getPopulation: () => number;
  getMatter: () => number;
  getOwnedTileCount: () => number;
  /** Count of unique env object types built (showInObjectMenu only). */
  getBuiltObjectTypeCount: () => { built: number; total: number };
  /** Count of non-discover-only techs researched. */
  getResearchedTechCount: () => { researched: number; total: number };
  /** Count citizens with morale > threshold. */
  getHappyCitizenCount: (moraleThreshold: number) => number;
  /** Check final siege: mega-event ran + 120s + friendly alive in safe room + all hostiles dead. */
  checkFinalSiege: () => boolean;
  /** Count unique bStuff+bDisplayable items in player-owned rooms (Lua GoalData.allPossessions). */
  getAllPossessionsCount: () => { collected: number; total: number };
}

export class GoalSystem {
  private completed: Set<string> = new Set();
  private providers: GoalCheckProviders;
  private tickAccum = 0;
  /** Check one goal per second to spread load. */
  private static readonly CHECK_INTERVAL = 1;
  private checkIndex = 0;
  /** Suppress alerts on first few ticks (prevents alerts on game load). */
  private suppressAlerts = true;
  private totalElapsed = 0;
  private static readonly SUPPRESS_DURATION = 5; // seconds

  constructor(providers: GoalCheckProviders) {
    this.providers = providers;
  }

  update(dt: number) {
    this.totalElapsed += dt;
    if (this.suppressAlerts && this.totalElapsed >= GoalSystem.SUPPRESS_DURATION) {
      this.suppressAlerts = false;
    }

    this.tickAccum += dt;
    if (this.tickAccum < GoalSystem.CHECK_INTERVAL) return;
    this.tickAccum -= GoalSystem.CHECK_INTERVAL;

    // Check one goal per tick
    if (GOAL_DEFS.length === 0) return;
    this.checkIndex = this.checkIndex % GOAL_DEFS.length;
    const goal = GOAL_DEFS[this.checkIndex];
    this.checkIndex++;

    if (this.completed.has(goal.sName)) return;

    if (this.checkGoal(goal)) {
      this.completed.add(goal.sName);
      if (!this.suppressAlerts) {
        Base.addAlert('goal', line('ALERTS039TEXT', { name: goal.friendlyName }));
      }
    }
  }

  private checkGoal(goal: GoalDef): boolean {
    const stats = Base.getStats();
    switch (goal.checkType) {
      case 'citizens':
        return this.providers.getPopulation() >= goal.nThreshold;
      case 'matter':
        return this.providers.getMatter() >= goal.nThreshold;
      case 'builtEverything': {
        const { built, total } = this.providers.getBuiltObjectTypeCount();
        return built >= total;
      }
      case 'hostilesKilled':
        return stats.nHostilesKilled >= goal.nThreshold;
      case 'baseTiles':
        return this.providers.getOwnedTileCount() >= goal.nThreshold;
      case 'mealsServed':
        return stats.nMealsServed >= goal.nThreshold;
      case 'curesResearched':
        return stats.nCuresResearched >= goal.nThreshold;
      case 'allTechs': {
        const { researched, total } = this.providers.getResearchedTechCount();
        return researched >= total;
      }
      case 'happyCitizens':
        return this.providers.getHappyCitizenCount(TARGET_HAPPY_MORALE) >= goal.nThreshold;
      case 'breachShipsDestroyed':
        return stats.nBreachShipsDestroyed >= goal.nThreshold;
      case 'allPossessions': {
        const { collected, total } = this.providers.getAllPossessionsCount();
        return collected >= total;
      }
      case 'raidersConverted':
        return stats.nRaidersConverted >= goal.nThreshold;
      case 'hostilesAsphyxiated':
        return stats.nHostilesAsphyxiated >= goal.nThreshold;
      case 'hostilesKilledByTurrets':
        return stats.nHostilesKilledByTurret >= goal.nThreshold;
      case 'bodiesRefined':
        return stats.nCorpsesRecycled >= goal.nThreshold;
      case 'finalSiege':
        return this.providers.checkFinalSiege();
      default:
        return false;
    }
  }

  getCompleted(): string[] {
    return Array.from(this.completed);
  }

  getCompletedCount(): number {
    return this.completed.size;
  }

  getTotalGoals(): number {
    return GOAL_DEFS.length;
  }

  isCompleted(goalName: string): boolean {
    return this.completed.has(goalName);
  }

  /** Get numeric progress for a goal (0-1 ratio). Completed goals return 1. */
  getGoalProgress(goal: GoalDef): number {
    if (this.completed.has(goal.sName)) return 1;
    const stats = Base.getStats();
    switch (goal.checkType) {
      case 'citizens':
        return Math.min(1, this.providers.getPopulation() / goal.nThreshold);
      case 'matter':
        return Math.min(1, this.providers.getMatter() / goal.nThreshold);
      case 'builtEverything': {
        const { built, total } = this.providers.getBuiltObjectTypeCount();
        return total > 0 ? Math.min(1, built / total) : 0;
      }
      case 'hostilesKilled':
        return Math.min(1, stats.nHostilesKilled / goal.nThreshold);
      case 'baseTiles':
        return Math.min(1, this.providers.getOwnedTileCount() / goal.nThreshold);
      case 'mealsServed':
        return Math.min(1, stats.nMealsServed / goal.nThreshold);
      case 'allTechs': {
        const { researched, total } = this.providers.getResearchedTechCount();
        return total > 0 ? Math.min(1, researched / total) : 0;
      }
      case 'happyCitizens':
        return Math.min(1, this.providers.getHappyCitizenCount(TARGET_HAPPY_MORALE) / goal.nThreshold);
      case 'bodiesRefined':
        return Math.min(1, stats.nCorpsesRecycled / goal.nThreshold);
      case 'hostilesAsphyxiated':
        return Math.min(1, stats.nHostilesAsphyxiated / goal.nThreshold);
      case 'raidersConverted':
        return Math.min(1, stats.nRaidersConverted / goal.nThreshold);
      case 'allPossessions': {
        const { collected, total } = this.providers.getAllPossessionsCount();
        return total > 0 ? Math.min(1, collected / total) : 0;
      }
      default:
        return 0;
    }
  }

  /** Get numeric progress for a goal (raw count + target). */
  getGoalNumericProgress(goal: GoalDef): { nProgress: number; nTarget: number } {
    const stats = Base.getStats();
    const nTarget = goal.nThreshold;
    let nProgress = 0;
    switch (goal.checkType) {
      case 'citizens':
        nProgress = this.providers.getPopulation(); break;
      case 'matter':
        nProgress = this.providers.getMatter(); break;
      case 'builtEverything': {
        const { built } = this.providers.getBuiltObjectTypeCount();
        nProgress = built; break;
      }
      case 'hostilesKilled':
        nProgress = stats.nHostilesKilled; break;
      case 'baseTiles':
        nProgress = this.providers.getOwnedTileCount(); break;
      case 'mealsServed':
        nProgress = stats.nMealsServed; break;
      case 'curesResearched':
        nProgress = stats.nCuresResearched; break;
      case 'allTechs': {
        const { researched } = this.providers.getResearchedTechCount();
        nProgress = researched; break;
      }
      case 'happyCitizens':
        nProgress = this.providers.getHappyCitizenCount(TARGET_HAPPY_MORALE); break;
      case 'breachShipsDestroyed':
        nProgress = stats.nBreachShipsDestroyed; break;
      case 'allPossessions': {
        const { collected } = this.providers.getAllPossessionsCount();
        nProgress = collected; break;
      }
      case 'raidersConverted':
        nProgress = stats.nRaidersConverted; break;
      case 'hostilesAsphyxiated':
        nProgress = stats.nHostilesAsphyxiated; break;
      case 'hostilesKilledByTurrets':
        nProgress = stats.nHostilesKilledByTurret; break;
      case 'bodiesRefined':
        nProgress = stats.nCorpsesRecycled; break;
      case 'finalSiege':
        nProgress = this.providers.checkFinalSiege() ? 1 : 0; break;
    }
    return { nProgress: Math.min(nProgress, nTarget), nTarget };
  }

  /** Get all goals with their progress. */
  getAllGoalProgress(): { sName: string; friendlyName: string; progress: number; completed: boolean; nProgress: number; nTarget: number }[] {
    return GOAL_DEFS.map(g => {
      const { nProgress, nTarget } = this.getGoalNumericProgress(g);
      return {
        sName: g.sName,
        friendlyName: g.friendlyName,
        progress: this.getGoalProgress(g),
        completed: this.completed.has(g.sName),
        nProgress,
        nTarget,
      };
    });
  }

  /** Save data. */
  getSaveData() {
    return {
      completed: Array.from(this.completed),
    };
  }

  /** Load data. */
  loadSaveData(data: { completed: string[] }) {
    this.completed = new Set(data.completed);
  }
}
