/**
 * VacuumPull.ts — Character is being pulled toward space by decompression.
 * Mirrors Lua OptionData: Priority=PUPPET. Character is dragged toward
 * the nearest space tile by vacuum forces.
 */

import { Task, type NeedAdvertisement } from '../Task';

/** Duration of vacuum pull effect. */
const VACUUM_PULL_DURATION = 3;

export class VacuumPull extends Task {
  readonly name = 'VacuumPull';
  nJobExperience = 0;

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [];
  }

  protected onStart() {
    this.duration = VACUUM_PULL_DURATION;
  }

  protected onUpdate(dt: number) {
    if (!this.character) { this.fail(); return; }

    // Vacuum pull: character slides toward target (space tile)
    // The movement is handled by the character's pathfinding toward targetX/Y
    if (this.elapsedTime >= this.duration) {
      this.complete();
    }
  }
}
