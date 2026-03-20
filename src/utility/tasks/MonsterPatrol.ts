/**
 * MonsterPatrol.ts — Monster patrols between rooms.
 * Mirrors Lua OptionData.MonsterPatrol: BaseScore=1, ClassPath='Utility.Tasks.Patrol',
 * bAllowHostilePathing=true.
 */

import { Task, type NeedAdvertisement } from '../Task';

export class MonsterPatrol extends Task {
  readonly name = 'MonsterPatrol';

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [];
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
