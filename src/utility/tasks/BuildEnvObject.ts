/**
 * BuildEnvObject.ts — Build ghost/queued environment objects.
 */

import { Task, type NeedAdvertisement } from '../Task';

export class BuildEnvObject extends Task {
  readonly name = 'BuildEnvObject';

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [{ need: 'duty', amount: 25 }];
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
