/**
 * ChatPartner.ts — Partner side of cooperative chat.
 * Mirrors Lua OptionData: Needs={Social=9}, BaseScore=10.
 * Initiated when another character starts a Chat; this is the receiver.
 */

import { Task, type NeedAdvertisement } from '../Task';
import {
  MORALE_HAPPY_CHAT_BASE,
  ANGER_BAD_CONVO_WITH_NORMAL,
} from '../../characters/CharacterConstants';

export class ChatPartner extends Task {
  readonly name = 'ChatPartner';

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [{ need: 'social', amount: 30 }];
  }

  protected onStart() {
    this.duration = 10;
  }

  protected onUpdate(dt: number) {
    if (this.elapsedTime >= this.duration) {
      if (this.character) {
        if (Math.random() < 0.7) {
          this.character.addMorale(MORALE_HAPPY_CHAT_BASE);
        } else {
          this.character.addAnger(ANGER_BAD_CONVO_WITH_NORMAL);
        }
      }
      this.complete();
    }
  }
}
