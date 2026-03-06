/**
 * OxygenSystem — per-tile O2 simulation with room-level caching.
 *
 * Mirrors Oxygen.lua + Room.lua _shareOxygen:
 * - Per-tile O2 stored in TileGrid.o2 (Uint16Array, 0-65535 Lua scale).
 * - Recyclers distribute O2 equally across room tiles.
 * - Characters and fire drain from their current tile.
 * - Breached rooms drain all tiles toward 0.
 * - Inter-room sharing flows through door tiles toward equilibrium.
 * - Room.oxygen is derived as average of per-tile values, mapped to 0-255.
 */

import { RoomManager } from '../rooms/RoomManager';
import { EnvObjectManager } from '../envobjects/EnvObjectManager';
import { O2_MAX, O2_DRAIN_RATE } from '../config';
import { OXYGEN_PER_SECOND } from '../characters/CharacterConstants';
import { TileGrid, O2_MAX as TILE_O2_MAX } from '../world/TileGrid';

/** Scale from our room 0-255 → Lua tile 0-65535. */
const ROOM_TO_TILE = TILE_O2_MAX / O2_MAX;
/** Scale from Lua tile 0-65535 → our room 0-255. */
const TILE_TO_ROOM = O2_MAX / TILE_O2_MAX;

// ── Inter-room sharing constants (Room.lua:1328-1414) ──────────────────
/** Minimum O2 difference (tile scale) for sharing to occur. */
const MIN_O2_DIFF_TILE = 10;
/** Minimum source room average O2 (tile scale) for sharing. */
const MIN_O2_FOR_SHARING_TILE = 200;
/** Max O2 transfer per shared tile per second (tile scale). */
const MAX_O2_GIVE_PER_TILE = 50;

export class OxygenSystem {
  private roomManager: RoomManager;
  private grid: TileGrid;
  private tickAccumulator = 0;
  private tickInterval = 500; // ms between O2 ticks

  constructor(roomManager: RoomManager, grid: TileGrid) {
    this.roomManager = roomManager;
    this.grid = grid;
  }

  update(delta: number) {
    this.tickAccumulator += delta;
    if (this.tickAccumulator < this.tickInterval) return;
    this.tickAccumulator -= this.tickInterval;

    const dt = this.tickInterval / 1000;
    const grid = this.grid;

    for (const room of this.roomManager.getRooms()) {
      if (!room.sealed) {
        // Breached room: drain all tiles toward vacuum
        const drain = Math.round(O2_DRAIN_RATE * ROOM_TO_TILE);
        for (const t of room.tiles) {
          const cur = grid.getO2(t.x, t.y);
          if (cur > 0) {
            grid.setO2(t.x, t.y, Math.max(0, cur - drain));
          }
        }
        this._updateRoomOxygen(room);
        continue;
      }

      // ── Generation: recyclers distribute O2 equally across room tiles ──
      let totalO2Output = 0;
      for (const obj of EnvObjectManager.getObjectsInRoom(room)) {
        totalO2Output += obj.getOxygenOutput();
      }

      if (totalO2Output > 0 && room.tiles.length > 0) {
        // totalO2Output is in Lua units; distribute per tile
        const perTile = Math.round(totalO2Output / room.tiles.length);
        for (const t of room.tiles) {
          grid.addO2(t.x, t.y, perTile);
        }
      }

      // ── Consumption: characters drain from their tile, fire from fire tiles ──
      // Character consumption handled per-character in CharacterManager (below)
      // Fire consumption: drain from each fire tile
      if (room.nFireTiles > 0) {
        const fireDrain = Math.round(OXYGEN_PER_SECOND * dt);
        for (const fireKey of room.tFires) {
          const [fx, fy] = fireKey.split(',').map(Number);
          grid.addO2(fx, fy, -fireDrain);
        }
      }

      this._updateRoomOxygen(room);
    }

    // ── Inter-room O2 sharing (through doors) ────────────────────────
    this.shareOxygen(dt);
  }

  /**
   * Drain O2 from a character's tile (called from CharacterManager per-character loop).
   * Mirrors Lua character O2 consumption from their tile.
   */
  drainCharacterO2(tileX: number, tileY: number, dt: number): void {
    const drain = Math.round(OXYGEN_PER_SECOND * dt);
    this.grid.addO2(tileX, tileY, -drain);
  }

  /** Derive room.oxygen (0-255) from average of per-tile O2 values. */
  private _updateRoomOxygen(room: { tiles: { x: number; y: number }[]; oxygen: number; invalidateOxygenScore: () => void }): void {
    if (room.tiles.length === 0) {
      room.oxygen = 0;
      room.invalidateOxygenScore();
      return;
    }
    let sum = 0;
    for (const t of room.tiles) {
      sum += this.grid.getO2(t.x, t.y);
    }
    const avg = sum / room.tiles.length;
    room.oxygen = Math.round(avg * TILE_TO_ROOM);
    room.invalidateOxygenScore();
  }

  /**
   * Inter-room O2 equalization through doors.
   * Mirrors Room.lua:1328-1414 _o2shareSlowedAverage.
   */
  private shareOxygen(dt: number): void {
    const rooms = this.roomManager.getRooms();
    const grid = this.grid;

    for (const room of rooms) {
      if (!room.sealed || room.bUserBlockOxygen) continue;
      const airlock = room.zoneObj as any;
      if (airlock?.disallowO2Propagation?.()) continue;

      // Compute room average O2 (tile scale)
      const roomAvg = this._getRoomAvgO2(room);
      if (roomAvg < MIN_O2_FOR_SHARING_TILE) continue;

      for (const adj of room.tContiguousRooms) {
        if (!adj.sealed || adj.bUserBlockOxygen) continue;
        const adjAirlock = adj.zoneObj as any;
        if (adjAirlock?.disallowO2Propagation?.()) continue;

        // Only process each pair once
        if (adj.id <= room.id) continue;

        const adjAvg = this._getRoomAvgO2(adj);
        const diff = roomAvg - adjAvg;
        if (Math.abs(diff) < MIN_O2_DIFF_TILE) continue;

        // Combined average
        const totalO2 = roomAvg * room.tiles.length + adjAvg * adj.tiles.length;
        const totalTiles = room.tiles.length + adj.tiles.length;
        if (totalTiles === 0) continue;
        const combinedAvg = totalO2 / totalTiles;

        const sharedTiles = Math.min(room.tiles.length, adj.tiles.length);
        const maxTransfer = sharedTiles * MAX_O2_GIVE_PER_TILE * dt;

        let transfer: number;
        if (diff > 0) {
          transfer = Math.min(maxTransfer, roomAvg - combinedAvg);
          transfer = Math.max(0, transfer);
        } else {
          transfer = -Math.min(maxTransfer, adjAvg - combinedAvg);
          transfer = Math.min(0, transfer);
        }

        if (Math.abs(transfer) < 1) continue;

        // Apply to per-tile: spread evenly across room tiles
        const perTileRoom = Math.round(-transfer / room.tiles.length);
        const perTileAdj = Math.round(transfer / adj.tiles.length);
        for (const t of room.tiles) grid.addO2(t.x, t.y, perTileRoom);
        for (const t of adj.tiles) grid.addO2(t.x, t.y, perTileAdj);
      }
    }

    // Re-derive room.oxygen after sharing
    for (const room of rooms) {
      this._updateRoomOxygen(room);
    }
  }

  /** Get average O2 across room tiles (tile scale 0-65535). */
  private _getRoomAvgO2(room: { tiles: { x: number; y: number }[] }): number {
    if (room.tiles.length === 0) return 0;
    let sum = 0;
    for (const t of room.tiles) {
      sum += this.grid.getO2(t.x, t.y);
    }
    return sum / room.tiles.length;
  }

  /**
   * Set all tiles in a room to a specific O2 level (tile scale).
   * Used by buildSealedRoom test helper and room initialization.
   */
  setRoomO2(room: { tiles: { x: number; y: number }[]; oxygen: number; invalidateOxygenScore: () => void }, o2_255: number): void {
    const tileVal = Math.round(o2_255 * ROOM_TO_TILE);
    for (const t of room.tiles) {
      this.grid.setO2(t.x, t.y, tileVal);
    }
    room.oxygen = o2_255;
    room.invalidateOxygenScore();
  }
}
