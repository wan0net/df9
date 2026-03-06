/**
 * GoalSystem.ts — Achievement/goal tracking.
 * Mirrors GoalData.lua: 16 goals with Lua-exact check conditions.
 */

import { GOAL_DEFS, TARGET_HAPPY_MORALE, type GoalDef } from './GoalData';
import { Base } from '../core/Base';

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
        Base.addAlert('goal', `Goal completed: ${goal.friendlyName} — ${goal.description}`);
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
      case 'allPossessions':
        // TODO: implement when possession tracking is complete
        return false;
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
