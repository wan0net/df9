/**
 * ResearchInLab.ts — Scientist works at a research desk.
 * Mirrors Activities/ResearchInLab.lua.
 */

import { Task, type NeedAdvertisement } from '../Task';

export class ResearchInLab extends Task {
  readonly name = 'ResearchInLab';
  nJobExperience = 20;

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [{ need: 'duty', amount: 5 }];
  }

  protected onStart() {
    this.duration = 30;
  }

  protected onUpdate(dt: number) {
    if (this.elapsedTime >= this.duration) {
      // Research progress added by ResearchSystem (M8)
      this.complete();
    }
  }
}
