/**
 * MonsterAttackEquipment.ts — Monster attacks environment objects.
 * Mirrors Lua OptionData.MonsterAttackEquipment: BaseScore=2,
 * ClassPath='Utility.Tasks.AttackEnemy', bAllowHostilePathing=true.
 *
 * Monster walks to a built object and damages it over time.
 */

import { Task, type NeedAdvertisement } from '../Task';
import type { EnvObject } from '../../envobjects/EnvObject';
import { EnvObjectManager } from '../../envobjects/EnvObjectManager';

/** Damage dealt to the object per hit. */
const DAMAGE_PER_HIT = 15;
/** Time between hits (seconds). */
const HIT_INTERVAL = 3;

export class MonsterAttackEquipment extends Task {
  readonly name = 'MonsterAttackEquipment';

  private targetObj: EnvObject;
  private hitTimer = 0;

  constructor(obj: EnvObject) {
    super();
    this.targetObj = obj;
    this.targetX = obj.tileX;
    this.targetY = obj.tileY;
  }

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [];
  }

  protected onStart() {
    this.duration = 30;
  }

  protected onUpdate(dt: number) {
    if (!this.character) { this.fail(); return; }

    // Object destroyed or removed
    if (!this.targetObj || this.targetObj.nCondition <= 0) {
      this.complete();
      return;
    }

    // Timeout
    if (this.elapsedTime >= this.duration) {
      this.complete();
      return;
    }

    // Deal periodic damage when adjacent
    const dist = Math.max(
      Math.abs(this.character.tileX - this.targetObj.tileX),
      Math.abs(this.character.tileY - this.targetObj.tileY),
    );
    if (dist <= 1) {
      this.hitTimer += dt;
      if (this.hitTimer >= HIT_INTERVAL) {
        this.hitTimer = 0;
        this.targetObj.nCondition = Math.max(0, this.targetObj.nCondition - DAMAGE_PER_HIT);
        if (this.targetObj.nCondition <= 0) {
          EnvObjectManager.removeObject(this.targetObj);
          this.complete();
        }
      }
    }
  }
}
