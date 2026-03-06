/**
 * OxygenSystem — per-room O2 simulation.
 *
 * Mirrors Oxygen.lua + Room.lua _shareOxygen:
 * - Recyclers generate O2 (oxygenLevel per 0.1s, scaled to our 0-255 range).
 * - Characters and fire consume O2 (OXYGEN_PER_SECOND=200 in Lua tile scale).
 * - Inter-room sharing: sealed adjacent rooms equalize O2 through doors.
 * - Breached rooms drain to vacuum.
 * - Airlocks block O2 propagation.
 */

import { RoomManager } from '../rooms/RoomManager';
import { EnvObjectManager } from '../envobjects/EnvObjectManager';
import { O2_MAX, O2_DRAIN_RATE } from '../config';
import { OXYGEN_PER_SECOND } from '../characters/CharacterConstants';

// Lua DFOxygenGrid OXYGEN_TILE_MAX ≈ 65535
const LUA_O2_SCALE = 65535;
const O2_FILL_PER_UNIT = O2_MAX / LUA_O2_SCALE;
/** Scale Lua O2 consumption rates to our 0-255 range. */
const CONSUMPTION_SCALE = O2_MAX / LUA_O2_SCALE;

// ── Inter-room sharing constants (Room.lua:1328-1414) ──────────────────
/** Minimum O2 difference (our scale) for sharing to occur. */
const MIN_O2_DIFF = 10 * CONSUMPTION_SCALE;  // Lua MIN_O2_DIFF = 10
/** Minimum source room O2 for sharing (Lua 1000 * 0.2 = 200). */
const MIN_O2_FOR_SHARING = 200 * CONSUMPTION_SCALE;
/** Max O2 transfer per shared tile per second (Lua MAX_O2_GIVE_PER_TILE = 50). */
const MAX_O2_GIVE_PER_TILE = 50 * CONSUMPTION_SCALE;

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

    const dt = this.tickInterval / 1000; // seconds elapsed this tick

    for (const room of this.roomManager.getRooms()) {
      if (!room.sealed) {
        // Breached room: O2 drains to vacuum
        room.oxygen = Math.max(0, room.oxygen - O2_DRAIN_RATE);
        room.invalidateOxygenScore();
        continue;
      }

      // ── Generation: recyclers add O2 ──────────────────────────
      let totalO2Output = 0;
      for (const obj of EnvObjectManager.getObjectsInRoom(room)) {
        totalO2Output += obj.getOxygenOutput();
      }

      if (totalO2Output > 0) {
        const fillRate = totalO2Output * O2_FILL_PER_UNIT;
        room.oxygen = Math.min(O2_MAX, room.oxygen + fillRate);
      }

      // ── Consumption: characters and fire drain O2 (Lua Room._shareOxygen) ──
      const nChars = room.nCharacters;
      const nFires = room.nFireTiles;
      if ((nChars > 0 || nFires > 0) && room.tiles.length > 0) {
        // Lua: o2consumption = (nChars * 200 + nFireTiles * 200) * dt
        const consumptionLua = (nChars * OXYGEN_PER_SECOND + nFires * OXYGEN_PER_SECOND) * dt;
        const consumptionOurs = consumptionLua * CONSUMPTION_SCALE;
        // Distribute evenly across room tiles (same as Lua o2perTile)
        // But since we use per-room O2, just subtract total
        room.oxygen = Math.max(0, room.oxygen - consumptionOurs);
      }

      room.invalidateOxygenScore();
    }

    // ── Inter-room O2 sharing (Lua Room._o2shareSlowedAverage) ────────
    this.shareOxygen(dt);
  }

  /**
   * Inter-room O2 equalization through doors.
   * Mirrors Room.lua:1328-1414 _o2shareSlowedAverage.
   * Adjacent sealed rooms (connected via tContiguousRooms) share O2
   * toward the combined average, capped by MAX_O2_GIVE_PER_TILE.
   */
  private shareOxygen(dt: number): void {
    const rooms = this.roomManager.getRooms();
    // Track net O2 changes to apply atomically
    const deltas = new Map<number, number>();

    for (const room of rooms) {
      if (!room.sealed || room.bUserBlockOxygen) continue;
      const airlock = room.zoneObj as any;
      if (airlock?.disallowO2Propagation?.()) continue;
      if (room.oxygen < MIN_O2_FOR_SHARING) continue;

      for (const adj of room.tContiguousRooms) {
        if (!adj.sealed || adj.bUserBlockOxygen) continue;
        const adjAirlock = adj.zoneObj as any;
        if (adjAirlock?.disallowO2Propagation?.()) continue;

        // Only process each pair once (lower ID initiates)
        if (adj.id <= room.id) continue;

        const diff = room.oxygen - adj.oxygen;
        if (Math.abs(diff) < MIN_O2_DIFF) continue;

        // Combined average
        const totalO2 = room.oxygen * room.tiles.length + adj.oxygen * adj.tiles.length;
        const totalTiles = room.tiles.length + adj.tiles.length;
        if (totalTiles === 0) continue;
        const avg = totalO2 / totalTiles;

        // How much the room with less O2 needs to reach avg
        const sharedTiles = Math.min(room.tiles.length, adj.tiles.length);
        const maxTransfer = sharedTiles * MAX_O2_GIVE_PER_TILE * dt;

        // Transfer from higher to lower
        let transfer: number;
        if (diff > 0) {
          // room has more, give to adj
          transfer = Math.min(maxTransfer, (room.oxygen - avg));
          transfer = Math.max(0, transfer);
        } else {
          // adj has more, give to room (negative transfer = room receives)
          transfer = -Math.min(maxTransfer, (adj.oxygen - avg));
          transfer = Math.min(0, transfer);
        }

        deltas.set(room.id, (deltas.get(room.id) ?? 0) - transfer);
        deltas.set(adj.id, (deltas.get(adj.id) ?? 0) + transfer);
      }
    }

    // Apply deltas
    for (const room of rooms) {
      const d = deltas.get(room.id);
      if (d !== undefined && d !== 0) {
        room.oxygen = Math.max(0, Math.min(O2_MAX, room.oxygen + d));
        room.invalidateOxygenScore();
      }
    }
  }
}
