/**
 * Chat.ts — Social interaction task.
 * Mirrors Activities/Chat.lua: chat outcome affects morale and anger.
 */

import { Task, type NeedAdvertisement } from '../Task';
import {
  MORALE_HAPPY_CHAT_BASE,
  ANGER_BAD_CONVO_WITH_NORMAL, ANGER_BAD_CONVO_WITH_JERK,
} from '../../characters/CharacterConstants';

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
      // Chat outcome: 70% good, 30% bad
      if (this.character) {
        if (Math.random() < 0.7) {
          // Good chat
          this.character.addMorale(MORALE_HAPPY_CHAT_BASE);
        } else {
          // Bad chat — anger increase
          this.character.addAnger(ANGER_BAD_CONVO_WITH_NORMAL);
        }
      }
      this.complete();
    }
  }
}
