/**
 * Puppet.ts — Controlled character state for cinematics/forced movement.
 * Mirrors Lua OptionData: Priority=PUPPET (highest), UIText='UITASK038TEXT'.
 * Character is locked into this task until explicitly released.
 */

import { Task, type NeedAdvertisement } from '../Task';

export class Puppet extends Task {
  readonly name = 'Puppet';
  nJobExperience = 0;

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [];
  }

  protected onUpdate(_dt: number) {
    // Puppet tasks never self-complete — must be released externally
  }

  /** Release puppet control (Lua Character:releasePuppet). */
  release(): void {
    this.complete();
  }
}
