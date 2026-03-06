/**
 * PickUpFloorItem.ts — Character picks up a floor pickup.
 * Mirrors Lua Utility/Tasks/PickUpFloorItem.lua.
 * Prerequisites: EmptyHands=true. Satisfies: HeldItem=<itemType>.
 * Character walks to pickup, picks it up (sets heldItem), pickup is consumed.
 */

import { Task, type NeedAdvertisement } from '../Task';
import type { Pickup } from '../../pickups/Pickup';

export class PickUpFloorItem extends Task {
  readonly name = 'PickUpFloorItem';

  private pickup: Pickup;
  private onPickedUp: ((pickup: Pickup) => void) | null;

  constructor(pickup: Pickup, onPickedUp?: (pickup: Pickup) => void) {
    super();
    this.pickup = pickup;
    this.onPickedUp = onPickedUp ?? null;
  }

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [{ need: 'duty', amount: 5 }];
  }

  protected onStart() {
    this.duration = 1; // Quick pickup
  }

  protected onUpdate(dt: number) {
    if (!this.character) { this.fail(); return; }

    // If pickup was already picked up by someone else, fail
    if (this.pickup.bPickedUp) {
      this.fail();
      return;
    }

    if (this.elapsedTime >= this.duration) {
      // Set character's held item to the pickup type
      this.character.heldItem = this.pickup.sName;
      this.pickup.pickUp();

      // Notify manager to remove the pickup
      if (this.onPickedUp) {
        this.onPickedUp(this.pickup);
      }

      this.complete();
    }
  }
}
