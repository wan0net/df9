/**
 * Mine.ts — Mining task for extracting matter from asteroids.
 */

import { Task, type NeedAdvertisement } from '../Task';

export class Mine extends Task {
  readonly name = 'Mine';

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [{ need: 'duty', amount: 35 }];
  }

  protected onStart() {
    this.duration = 20;
  }

  protected onUpdate(dt: number) {
    if (this.elapsedTime >= this.duration) {
      this.complete();
    }
  }
}
