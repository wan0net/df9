/**
 * ResearchInLab.ts — Scientist works at a research desk.
 * Mirrors Activities/ResearchInLab.lua.
 */

import { Task, type NeedAdvertisement } from '../Task';
import { researchSystem } from '../../research/ResearchSystem';

export class ResearchInLab extends Task {
  readonly name = 'ResearchInLab';
  nJobExperience = 20;

  /** Progress added per completion, scaled by competency. */
  private baseProgress = 50;

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
      researchSystem.addProgress(progress);
      this.complete();
    }
  }
}
