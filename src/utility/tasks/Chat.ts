/**
 * Chat.ts — Social interaction task.
 */

import { Task, type NeedAdvertisement } from '../Task';

export class Chat extends Task {
  readonly name = 'Chat';

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [
      { need: 'social', amount: 30 },
      { need: 'amusement', amount: 10 },
    ];
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
