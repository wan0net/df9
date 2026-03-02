/**
 * ResearchSystem.ts — Research queue, scientist work, unlock.
 * Mirrors research mechanics from GameRules + ResearchData.
 */

import { RESEARCH_DEFS, type ResearchDef } from './ResearchData';

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
    this.activeResearch = null;
    this.progress = 0;
  }

  /** Check if a research topic is completed. */
  isCompleted(researchId: string): boolean {
    return this.completed.has(researchId);
  }

  /** Get available research topics (prerequisites met, not completed). */
  getAvailable(): ResearchDef[] {
    const available: ResearchDef[] = [];
    for (const [id, def] of Object.entries(RESEARCH_DEFS)) {
      if (this.completed.has(id)) continue;
      const prereqsMet = def.prerequisites.every(p => this.completed.has(p));
      if (prereqsMet) available.push(def);
    }
    return available;
  }

  getActiveResearch(): string | null { return this.activeResearch; }
  getProgress(): number { return this.progress; }
  getCompletedCount(): number { return this.completed.size; }
}
