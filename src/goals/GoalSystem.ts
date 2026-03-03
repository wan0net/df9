/**
 * GoalSystem.ts — Achievement/goal tracking.
 * Mirrors GoalData.lua: check conditions, fire completion alerts.
 */

import { GOAL_DEFS, type GoalDef } from './GoalData';
import { Base } from '../core/Base';
import { GameRules } from '../core/GameRules';

/** Callback providers for checking goal conditions. */
export interface GoalCheckProviders {
  getRoomCount: () => number;
  getPopulation: () => number;
  getResearchCompleted: () => number;
  getHostilesDefeated: () => number;
  getMatter: () => number;
  getUniqueZones: () => number;
  getSiegeSurvived: () => number;
  getAllMoraleAbove: (threshold: number) => boolean;
}

export class GoalSystem {
  private completed: Set<string> = new Set();
  private providers: GoalCheckProviders;
  private tickAccum = 0;
  /** Check one goal per second to spread load. */
  private static readonly CHECK_INTERVAL = 1;
  private checkIndex = 0;

  /** Track hostiles defeated (incremented externally). */
  hostilesDefeated = 0;
  /** Track siege survived (set externally). */
  siegeSurvived = 0;

  constructor(providers: GoalCheckProviders) {
    this.providers = providers;
  }

  update(dt: number) {
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
      Base.addAlert('goal', `Goal completed: ${goal.friendlyName} — ${goal.description}`);
    }
  }

  private checkGoal(goal: GoalDef): boolean {
    switch (goal.checkType) {
      case 'roomCount':
        return this.providers.getRoomCount() >= goal.nThreshold;
      case 'population':
        return this.providers.getPopulation() >= goal.nThreshold;
      case 'researchCompleted':
        return this.providers.getResearchCompleted() >= goal.nThreshold;
      case 'hostilesDefeated':
        return this.hostilesDefeated >= goal.nThreshold;
      case 'simTime':
        return GameRules.simTime >= goal.nThreshold;
      case 'matter':
        return this.providers.getMatter() >= goal.nThreshold;
      case 'uniqueZones':
        return this.providers.getUniqueZones() >= goal.nThreshold;
      case 'siegeSurvived':
        return this.siegeSurvived >= goal.nThreshold;
      case 'allMoraleAbove':
        return this.providers.getAllMoraleAbove(goal.nThreshold);
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
      hostilesDefeated: this.hostilesDefeated,
      siegeSurvived: this.siegeSurvived,
    };
  }

  /** Load data. */
  loadSaveData(data: { completed: string[]; hostilesDefeated: number; siegeSurvived: number }) {
    this.completed = new Set(data.completed);
    this.hostilesDefeated = data.hostilesDefeated;
    this.siegeSurvived = data.siegeSurvived;
  }
}
