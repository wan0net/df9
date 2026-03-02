/**
 * DropOffCorpse.ts — Body disposal task.
 */

import { Task, type NeedAdvertisement } from '../Task';

export class DropOffCorpse extends Task {
  readonly name = 'DropOffCorpse';

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [{ need: 'duty', amount: 15 }];
  }

  protected onStart() {
    this.duration = 10;
  }

  protected onUpdate(dt: number) {
    if (this.elapsedTime >= this.duration) {
      this.complete();
    }
  }
}
