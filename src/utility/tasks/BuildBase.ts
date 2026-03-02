/**
 * BuildBase.ts — Build floor/wall construction task.
 */

import { Task, type NeedAdvertisement } from '../Task';

export class BuildBase extends Task {
  readonly name = 'BuildBase';

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [{ need: 'duty', amount: 20 }];
  }

  protected onStart() {
    this.duration = 5;
  }

  protected onUpdate(dt: number) {
    if (this.elapsedTime >= this.duration) {
      this.complete();
    }
  }
}
