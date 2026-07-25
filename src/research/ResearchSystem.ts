/**
 * ResearchSystem.ts — Research queue, scientist work, unlock.
 * Mirrors research mechanics from GameRules + ResearchData.
 */

import { RESEARCH_DEFS, type ResearchDef } from './ResearchData';
import { Base } from '../core/Base';
import { line } from '../localization/Localization';

export class ResearchSystem {
  /** Completed research IDs. */
  private completed: Set<string> = new Set();

  /** Current active research. */
  private activeResearch: string | null = null;

  /** Global progress per research key, matching Base.tS.tResearch in Lua. */
  private progressByKey = new Map<string, number>();

  /** Start researching a topic. Returns false if prerequisites not met. */
  startResearch(researchId: string): boolean {
    if (!this.canResearch(researchId)) return false;
    this.activeResearch = researchId;
    return true;
  }

  /** Whether a topic is currently available to research (Lua Base.canResearch). */
  canResearch(researchId: string): boolean {
    const def = RESEARCH_DEFS[researchId];
    return !!def &&
      !def.bDiscoverOnly &&
      !this.completed.has(researchId) &&
      def.prerequisites.every(prereq => this.completed.has(prereq));
  }

  /**
   * Add global progress to a specific key, matching Base.addResearch(sKey, nAmount).
   * The one-argument form remains for datacube/debug compatibility.
   */
  addProgress(researchId: string, amount: number): boolean;
  addProgress(amount: number): boolean;
  addProgress(researchIdOrAmount: string | number, maybeAmount?: number): boolean {
    const researchId = typeof researchIdOrAmount === 'string'
      ? researchIdOrAmount
      : this.activeResearch;
    const amount = typeof researchIdOrAmount === 'string'
      ? (maybeAmount ?? 0)
      : researchIdOrAmount;
    if (!researchId || !this.canResearch(researchId)) return false;

    const def = RESEARCH_DEFS[researchId];
    const roundedAmount = Math.floor(amount + 0.5);
    const progress = Math.min(def.nCost, (this.progressByKey.get(researchId) ?? 0) + roundedAmount);
    this.progressByKey.set(researchId, progress);
    if (progress >= def.nCost) {
      this.completeResearch(researchId);
      return true;
    }
    return false;
  }

  private completeResearch(researchId: string) {
    this.completed.add(researchId);
    const def = RESEARCH_DEFS[researchId];
    this.progressByKey.set(researchId, def?.nCost ?? this.progressByKey.get(researchId) ?? 0);
    if (this.activeResearch === researchId) this.activeResearch = null;
    if (def?.bDiscoverOnly) {
      Base.addAlert('research', line('ALERTS019TEXT', { research: def.friendlyName }));
    } else {
      Base.addAlert('research', line('ALERTS019TEXT', { research: def?.friendlyName ?? researchId }));
    }
  }

  /**
   * Directly complete a discovery blueprint (e.g. from datacube pickup).
   * bDiscoverOnly items are normally completed this way, not via the research queue.
   */
  discoverBlueprint(researchId: string): boolean {
    const def = RESEARCH_DEFS[researchId];
    if (!def || !def.bDiscoverOnly) return false;
    if (this.completed.has(researchId)) return false;
    this.completeResearch(researchId);
    return true;
  }

  /** Check if a research topic is completed. */
  isCompleted(researchId: string): boolean {
    return this.completed.has(researchId);
  }

  /** Get available research topics (prerequisites met, not completed, not discovery-only). */
  getAvailable(): ResearchDef[] {
    const available: ResearchDef[] = [];
    for (const [id, def] of Object.entries(RESEARCH_DEFS)) {
      if (this.completed.has(id)) continue;
      // Discovery blueprints are not manually researchable — they come from datacubes/events
      if (def.bDiscoverOnly) continue;
      const prereqsMet = def.prerequisites.every(p => this.completed.has(p));
      if (prereqsMet) available.push(def);
    }
    return available;
  }

  /** Get all research defs including discoveries (for UI/debug). */
  getAllResearch(): Record<string, ResearchDef & { completed: boolean; available: boolean }> {
    const result: Record<string, ResearchDef & { completed: boolean; available: boolean }> = {};
    for (const [id, def] of Object.entries(RESEARCH_DEFS)) {
      const completed = this.completed.has(id);
      const prereqsMet = def.prerequisites.every(p => this.completed.has(p));
      result[id] = { ...def, completed, available: !completed && prereqsMet };
    }
    return result;
  }

  /** Restore research state from save data. */
  loadSaveData(data: {
    active: string | null;
    progress: number;
    completed: string[];
    progressByKey?: Record<string, number>;
  }) {
    this.completed.clear();
    this.progressByKey.clear();
    for (const id of data.completed) this.completed.add(id);
    this.activeResearch = data.active;
    if (data.progressByKey) {
      for (const [id, progress] of Object.entries(data.progressByKey)) {
        if (RESEARCH_DEFS[id] && Number.isFinite(progress) && progress >= 0) {
          this.progressByKey.set(id, Math.min(progress, RESEARCH_DEFS[id].nCost));
        }
      }
    } else if (data.active && RESEARCH_DEFS[data.active]) {
      this.progressByKey.set(data.active, Math.min(Math.max(0, data.progress), RESEARCH_DEFS[data.active].nCost));
    }
  }

  getActiveResearch(): string | null { return this.activeResearch; }
  getProgress(researchId: string | null = this.activeResearch): number {
    return researchId ? (this.progressByKey.get(researchId) ?? 0) : 0;
  }
  getProgressData(): Record<string, number> {
    return Object.fromEntries(this.progressByKey);
  }
  getCompletedCount(): number { return this.completed.size; }
  getCompletedList(): string[] { return Array.from(this.completed); }
}

/** Global singleton */
export const researchSystem = new ResearchSystem();
