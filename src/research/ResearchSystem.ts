/**
 * ResearchSystem.ts — Research queue, scientist work, unlock.
 * Mirrors research mechanics from GameRules + ResearchData.
 */

import { RESEARCH_DEFS, type ResearchDef } from './ResearchData';
import { Base } from '../core/Base';

export class ResearchSystem {
  /** Completed research IDs. */
  private completed: Set<string> = new Set();

  /** Current active research. */
  private activeResearch: string | null = null;

  /** Progress on active research (0 to cost). */
  private progress = 0;

  /** Start researching a topic. Returns false if prerequisites not met. */
  startResearch(researchId: string): boolean {
    const def = RESEARCH_DEFS[researchId];
    if (!def) return false;
    if (this.completed.has(researchId)) return false;

    // Check prerequisites
    for (const prereq of def.prerequisites) {
      if (!this.completed.has(prereq)) return false;
    }

    this.activeResearch = researchId;
    this.progress = 0;
    return true;
  }

  /** Add research progress (called when scientists work). */
  addProgress(amount: number) {
    if (!this.activeResearch) return;

    this.progress += amount;
    const def = RESEARCH_DEFS[this.activeResearch];
    if (def && this.progress >= def.nCost) {
      this.completeResearch(this.activeResearch);
    }
  }

  private completeResearch(researchId: string) {
    this.completed.add(researchId);
    const def = RESEARCH_DEFS[researchId];
    this.activeResearch = null;
    this.progress = 0;
    if (def?.bDiscoverOnly) {
      Base.addAlert('research', `Blueprint discovered: ${def.friendlyName}`);
    } else {
      Base.addAlert('research', `Research complete: ${def?.friendlyName ?? researchId}`);
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
  loadSaveData(data: { active: string | null; progress: number; completed: string[] }) {
    this.completed.clear();
    for (const id of data.completed) this.completed.add(id);
    this.activeResearch = data.active;
    this.progress = data.progress;
  }

  getActiveResearch(): string | null { return this.activeResearch; }
  getProgress(): number { return this.progress; }
  getCompletedCount(): number { return this.completed.size; }
  getCompletedList(): string[] { return Array.from(this.completed); }
}

/** Global singleton */
export const researchSystem = new ResearchSystem();
