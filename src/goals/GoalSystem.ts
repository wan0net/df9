/**
 * GoalSystem.ts — Achievement/goal tracking.
 * Mirrors GoalData.lua: check conditions one-per-tick, fire completion alerts.
 * Stats-based checks read directly from Base.getStats().
 */

import { GOAL_DEFS, type GoalDef } from './GoalData';
import { Base, type BaseStats } from '../core/Base';
import { GameRules } from '../core/GameRules';

/** Providers for non-stats-based goal conditions. */
export interface GoalCheckProviders {
  /** Current player population. */
  getPopulation: () => number;
  /** Current matter balance. */
  getMatter: () => number;
  /** Total floor tiles owned (sum of all room tile counts). */
  getBaseTileCount: () => number;
  /**
   * Whether all showInObjectMenu object types have been built at least once.
   * Returns { done: boolean, built: number, total: number }.
   */
  getBuiltEverything: () => { done: boolean; built: number; total: number };
  /**
   * Whether all non-bDiscoverOnly research techs have been completed.
   * Returns { done: boolean, completed: number, total: number }.
   */
  getAllTechs: () => { done: boolean; completed: number; total: number };
  /** Number of citizens with morale > 90. */
  getHappyCitizenCount: () => number;
  /**
   * Whether all bStuff+bDisplayable item types have been collected.
   * Returns { done: boolean, collected: number, total: number }.
   */
  getAllPossessions: () => { done: boolean; collected: number; total: number };
  /**
   * FinalSiege: compound event fired 120s ago, friendly survivor in safe area,
   * all hostiles dead/incapacitated.
   */
  getFinalSiegeStatus: () => boolean;
}

/** Seconds after compound event must pass before FinalSiege can complete. */
export const FINAL_SIEGE_DELAY = 120;

export class GoalSystem {
  private completed: Set<string> = new Set();
  private providers: GoalCheckProviders;
  private tickAccum = 0;
  /** Check one goal per second to spread load. */
  private static readonly CHECK_INTERVAL = 1;
  private checkIndex = 0;
  /** Current progress values keyed by goal sName. */
  private progress: Map<string, number> = new Map();

  constructor(providers: GoalCheckProviders) {
    this.providers = providers;
  }

  update(dt: number) {
    this.tickAccum += dt;
    if (this.tickAccum < GoalSystem.CHECK_INTERVAL) return;
    this.tickAccum -= GoalSystem.CHECK_INTERVAL;

    if (GOAL_DEFS.length === 0) return;
    this.checkIndex = this.checkIndex % GOAL_DEFS.length;
    const goal = GOAL_DEFS[this.checkIndex];
    this.checkIndex++;

    if (this.completed.has(goal.sName)) return;

    const { done, progress } = this.checkGoal(goal);
    this.progress.set(goal.sName, progress);

    if (done) {
      this.completed.add(goal.sName);
      Base.addAlert('goal', `Goal completed: ${goal.friendlyName} — ${goal.description}`);
    }
  }

  private checkGoal(goal: GoalDef): { done: boolean; progress: number } {
    const stats = Base.getStats() as BaseStats;

    // Stat-based goals: checkType = 'stat:<statKey>'
    if (goal.checkType.startsWith('stat:')) {
      const statKey = goal.checkType.slice(5) as keyof BaseStats;
      const value = (stats[statKey] as number) ?? 0;
      return { done: value >= goal.nThreshold, progress: value };
    }

    switch (goal.checkType) {
      case 'population': {
        const v = this.providers.getPopulation();
        return { done: v >= goal.nThreshold, progress: v };
      }
      case 'matter': {
        const v = this.providers.getMatter();
        return { done: v >= goal.nThreshold, progress: v };
      }
      case 'baseTiles': {
        const v = this.providers.getBaseTileCount();
        return { done: v >= goal.nThreshold, progress: v };
      }
      case 'builtEverything': {
        const r = this.providers.getBuiltEverything();
        return { done: r.done, progress: r.built };
      }
      case 'allTechs': {
        const r = this.providers.getAllTechs();
        return { done: r.done, progress: r.completed };
      }
      case 'happyCitizens': {
        const v = this.providers.getHappyCitizenCount();
        return { done: v >= goal.nThreshold, progress: v };
      }
      case 'allPossessions': {
        const r = this.providers.getAllPossessions();
        return { done: r.done, progress: r.collected };
      }
      case 'finalSiege': {
        const done = this.providers.getFinalSiegeStatus();
        return { done, progress: done ? 1 : 0 };
      }
      default:
        return { done: false, progress: 0 };
    }
  }

  /** Get current numeric progress toward a goal (for UI display). */
  getProgress(goalName: string): number {
    return this.progress.get(goalName) ?? 0;
  }

  /** Get threshold for a goal (for UI display). */
  getThreshold(goalName: string): number {
    return GOAL_DEFS.find(g => g.sName === goalName)?.nThreshold ?? 0;
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
      progress: Array.from(this.progress.entries()),
    };
  }

  /** Load data. */
  loadSaveData(data: { completed: string[]; progress?: [string, number][] }) {
    this.completed = new Set(data.completed);
    if (data.progress) {
      this.progress = new Map(data.progress);
    }
  }
}
