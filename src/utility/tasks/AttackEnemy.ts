/**
 * AttackEnemy.ts — Combat task for engaging hostiles.
 */

import { Task, type NeedAdvertisement } from '../Task';

export class AttackEnemy extends Task {
  readonly name = 'AttackEnemy';
  private targetCharId: number;

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
    // Combat logic will be implemented when combat system is wired
    // For now, complete after timeout
    if (this.elapsedTime >= 30) {
      this.complete();
    }
  }
}
