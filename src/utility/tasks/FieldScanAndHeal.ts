/**
 * FieldScanAndHeal.ts — Doctor healing task.
 */

import { Task, type NeedAdvertisement } from '../Task';

export class FieldScanAndHeal extends Task {
  readonly name = 'FieldScanAndHeal';

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [{ need: 'duty', amount: 30 }];
  }

  protected onStart() {
    this.duration = 15;
  }

  protected onUpdate(dt: number) {
    if (this.elapsedTime >= this.duration) {
      this.complete();
    }
  }
}
