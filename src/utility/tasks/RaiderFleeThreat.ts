/**
 * RaiderFleeThreat.ts — Raider-specific flee from threat (C-22).
 * Same as FleeThreat but for raiders. Walk to random safe tile. Duration: 8s.
 */

import { Task, type NeedAdvertisement } from '../Task';

export class RaiderFleeThreat extends Task {
  readonly name = 'RaiderFleeThreat';
  nJobExperience = 0;

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [];
  }

  protected onStart() {
    this.duration = 8;
  }

  protected onUpdate(dt: number) {
    if (this.elapsedTime >= this.duration) {
      this.complete();
    }
  }
}
