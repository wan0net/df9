/**
 * Clean.ts — Cleaning task (janitor).
 */

import { Task, type NeedAdvertisement } from '../Task';

export class Clean extends Task {
  readonly name = 'Clean';

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [{ need: 'duty', amount: 10 }];
  }

  protected onStart() {
    this.duration = 8;
  }

  protected onUpdate(dt: number) {
    if (this.elapsedTime >= this.duration) {
      this.complete();
    }
  }
}
