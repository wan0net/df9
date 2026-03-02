/**
 * WanderAround.ts — Random wandering in room.
 * Character picks a random tile in current room and walks to it.
 */

import { Task, type NeedAdvertisement } from '../Task';

export class WanderAround extends Task {
  readonly name = 'WanderAround';

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [{ need: 'amusement', amount: 2 }];
  }

  protected onStart() {
    this.duration = 3;
  }

  protected onUpdate(dt: number) {
    if (this.elapsedTime >= this.duration) {
      this.complete();
    }
  }
}
