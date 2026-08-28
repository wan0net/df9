/**
 * ResearchInLab.ts — Scientist works at a research desk.
 * Mirrors Activities/ResearchInLab.lua.
 */

import { Task, type NeedAdvertisement } from '../Task';
import { researchSystem, type ResearchSystem } from '../../research/ResearchSystem';
import { RESEARCH_DEFS } from '../../research/ResearchData';
import type { ResearchZone } from '../../zones/ResearchZone';
import { Malady } from '../../malady/Malady';

export class ResearchInLab extends Task {
  readonly name = 'ResearchInLab';
  nJobExperience = 20;

  /** Progress added per completion, scaled by competency. */
  private baseProgress = 50;

  constructor(
    private readonly researchZone: ResearchZone,
    private readonly research: ResearchSystem = researchSystem,
  ) {
    super();
  }

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [{ need: 'duty', amount: 5 }];
  }

  protected onStart() {
    this.duration = 30;
  }

  protected onUpdate(dt: number) {
    if (this.elapsedTime >= this.duration) {
      // Add research progress scaled by scientist competency
      const competency = this.character?.getEffectiveCompetency() ?? 0.1;
      const progress = this.baseProgress * (0.5 + competency);
      const researchId = this.researchZone.getActiveResearch();
      if (researchId) {
        if (RESEARCH_DEFS[researchId]) {
          this.research.addProgress(researchId, progress);
        } else {
          Malady.addResearch(researchId, progress);
        }
      }
      this.complete();
    }
  }
}
