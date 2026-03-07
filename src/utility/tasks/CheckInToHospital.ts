/**
 * CheckInToHospital.ts — Character checks into hospital for treatment.
 * Mirrors Lua OptionData: Tags={DestOwned, DestSafe}.
 * Character walks to hospital bed and waits for a doctor.
 */

import { Task, type NeedAdvertisement } from '../Task';

export class CheckInToHospital extends Task {
  readonly name = 'CheckInToHospital';
  nJobExperience = 0;

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [];
  }

  protected onStart() {
    this.duration = 30;
  }

  protected onUpdate(dt: number) {
    if (!this.character) { this.fail(); return; }

    // Wait at hospital bed for doctor to treat
    if (this.elapsedTime >= this.duration) {
      this.complete();
    }
  }
}
