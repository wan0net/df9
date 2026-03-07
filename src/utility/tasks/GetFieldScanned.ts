/**
 * GetFieldScanned.ts — Patient side of cooperative scan task.
 * Mirrors Lua OptionData: Needs={Duty=3, Social=3}, BaseScore=10, Tags={DestSafe}.
 * Patient walks to infirmary and waits for a doctor to perform FieldScanAndHeal.
 */

import { Task, type NeedAdvertisement } from '../Task';

export class GetFieldScanned extends Task {
  readonly name = 'GetFieldScanned';
  nJobExperience = 0;

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [
      { need: 'duty', amount: 3 },
      { need: 'social', amount: 3 },
    ];
  }

  protected onStart() {
    // Wait up to 60 seconds for a doctor. If no doctor comes, complete anyway.
    this.duration = 60;
  }

  protected onUpdate(dt: number) {
    if (!this.character) { this.fail(); return; }

    // Complete when duration expires (doctor scan completes via FieldScanAndHeal)
    if (this.elapsedTime >= this.duration) {
      this.complete();
    }
  }
}
