/**
 * AttackEnemy.ts — Combat task for engaging hostiles.
 * Character moves to target and engages in combat.
 */

import { Task, type NeedAdvertisement } from '../Task';

export class AttackEnemy extends Task {
  readonly name = 'AttackEnemy';
  private targetCharId: number;

  /** Max time before disengaging. */
  private static readonly MAX_COMBAT_TIME = 60;

  constructor(targetCharId: number) {
    super();
    this.targetCharId = targetCharId;
  }

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [{ need: 'duty', amount: 40 }];
  }

  getTargetCharId(): number {
    return this.targetCharId;
  }

  protected onStart() {
    this.duration = 0; // continuous until target dead or out of range
  }

  protected onUpdate(dt: number) {
    // Combat resolution is driven by CombatSystem in CharacterManager.
    // This task completes when the target is dead or timeout.
    if (this.elapsedTime >= AttackEnemy.MAX_COMBAT_TIME) {
      this.complete();
    }
  }
}
