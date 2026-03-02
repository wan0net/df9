import { RoomManager } from '../rooms/RoomManager';
import { O2_MAX, O2_FILL_RATE, O2_DRAIN_RATE } from '../config';

export class OxygenSystem {
  private roomManager: RoomManager;
  private tickAccumulator = 0;
  private tickInterval = 500; // ms between O2 ticks

  constructor(roomManager: RoomManager) {
    this.roomManager = roomManager;
  }

  update(delta: number) {
    this.tickAccumulator += delta;
    if (this.tickAccumulator < this.tickInterval) return;
    this.tickAccumulator -= this.tickInterval;

    for (const room of this.roomManager.getRooms()) {
      if (room.sealed) {
        // Sealed room: O2 rises
        room.oxygen = Math.min(O2_MAX, room.oxygen + O2_FILL_RATE);
      } else {
        // Breached room: O2 drains
        room.oxygen = Math.max(0, room.oxygen - O2_DRAIN_RATE);
      }
    }
  }
}
