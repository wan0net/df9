/**
 * Cuff.ts — Security arrests a rampaging citizen.
 * Mirrors Utility/Tasks/Cuff.lua: on completion, cuffs the target
 * and assigns them to the nearest available brig room.
 */

import { Task, type NeedAdvertisement } from '../Task';
import { BrigZone } from '../../zones/BrigZone';

export class Cuff extends Task {
  readonly name = 'Cuff';
  private targetCharId: number;

  /** Time to cuff a citizen. */
  private static readonly CUFF_TIME = 5;

  constructor(targetCharId: number) {
    super();
    this.targetCharId = targetCharId;
    this.nJobExperience = 15;
  }

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [{ need: 'duty', amount: 20 }];
  }

  getTargetCharId(): number {
    return this.targetCharId;
  }

  protected onStart() {
    this.duration = Cuff.CUFF_TIME;
  }

  protected onUpdate(_dt: number) {
    if (this.elapsedTime >= this.duration) {
      this.complete();
    }
  }

  protected override onComplete(): void {
    // Cuff the target character and assign to nearest brig
    // The caller (CharacterManager) resolves the target by ID and calls cuff()
    // We store a flag so the manager knows this completed successfully
    this._brigAssignTarget();
  }

  /** Find the nearest brig and assign the target. */
  private _brigAssignTarget(): void {
    // We can't import CharacterManager here (circular dep), so we rely on
    // the exposed window.__df9 or the manager wiring in CharacterManager.
    // Instead, we use BrigZone statics to find an available brig.
    const brigs = BrigZone.getAllBrigs();
    if (brigs.length === 0) return;

    // Pick the brig with fewest prisoners (simple heuristic for "nearest available")
    let bestBrig: BrigZone | null = null;
    let bestCount = Infinity;
    for (const brig of brigs) {
      if (!brig.room) continue;
      const count = brig.getPrisonerCount();
      if (count < bestCount) {
        bestCount = count;
        bestBrig = brig;
      }
    }

    if (bestBrig && bestBrig.room) {
      // Store brig room ID so CharacterManager can call assignedToBrig on the target
      this._assignedBrigRoomId = bestBrig.room.id;
    }
  }

  /** Room ID of the brig this target should be assigned to (set on completion). */
  _assignedBrigRoomId: number | null = null;
}
