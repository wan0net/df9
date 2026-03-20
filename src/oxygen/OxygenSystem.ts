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
  // O-2: Lua ticks O2 every frame. Use 100ms for near-frame-rate fidelity.
  private tickInterval = 100;

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
      if (!room.sealed || room.bUserBlockOxygen || this._disallowO2Propagation(room)) continue;

      const selfTiles = room.tiles.length;
      if (selfTiles === 0) continue;

      const averageO2Self = this._getRoomAvgO2(room);
      if (averageO2Self < MIN_O2_FOR_SHARING_TILE) continue;

      const totalO2Self = averageO2Self * selfTiles;
      let totalRequest = 0;
      let totalO2 = totalO2Self;
      let totalTiles = selfTiles;
      const roomRequests = new Map<number, number>();

      for (const adj of room.tContiguousRooms) {
        if (!adj.sealed || adj.bUserBlockOxygen || this._disallowO2Propagation(adj)) continue;

        const adjTiles = adj.tiles.length;
        if (adjTiles === 0) continue;

        const adjAverageO2 = this._getRoomAvgO2(adj);
        const adjTotalO2 = adjAverageO2 * adjTiles;
        const avg = (totalO2Self + adjTotalO2) / (selfTiles + adjTiles);

        let request = (avg - adjAverageO2) * adjTiles;
        const maxRequest = Math.min(selfTiles, adjTiles) * MAX_O2_GIVE_PER_TILE * dt;
        if (request > maxRequest) request = maxRequest;
        else if (request < -maxRequest) request = -maxRequest;

        roomRequests.set(adj.id, request);
        totalRequest += request;
        totalO2 += adjTotalO2;
        totalTiles += adjTiles;
      }

      if (roomRequests.size === 0 || totalTiles === 0) continue;

      const targetAvg = totalO2 / totalTiles;
      let inMult = 1;
      let outMult = 1;
      const isLuaFlawCase =
        (totalRequest > 0 && averageO2Self < targetAvg) ||
        (totalRequest < 0 && averageO2Self > targetAvg);

      if (!isLuaFlawCase && totalRequest > 1 && (totalO2Self - totalRequest) < targetAvg * selfTiles) {
        outMult = ((averageO2Self - targetAvg) * selfTiles) / totalRequest;
      } else if (!isLuaFlawCase && totalRequest < -1 && (totalO2Self - totalRequest) > targetAvg * selfTiles) {
        inMult = ((averageO2Self - targetAvg) * selfTiles) / totalRequest;
      }

      let netChange = 0;
      for (const adj of room.tContiguousRooms) {
        const baseRequest = roomRequests.get(adj.id);
        if (baseRequest === undefined || Math.abs(baseRequest) <= MIN_O2_DIFF_TILE || adj.tiles.length === 0) continue;

        const scaledRequest = baseRequest * (baseRequest > 0 ? outMult : inMult);
        netChange -= scaledRequest;

        const perAdjTile = scaledRequest / adj.tiles.length;
        for (const t of adj.tiles) {
          grid.addO2(t.x, t.y, perAdjTile);
        }
      }

      if (Math.abs(netChange) > MIN_O2_DIFF_TILE) {
        const perSelfTile = netChange / selfTiles;
        for (const t of room.tiles) {
          grid.addO2(t.x, t.y, perSelfTile);
        }
      }
    }

    // Re-derive room.oxygen after sharing
    for (const room of rooms) {
      this._updateRoomOxygen(room);
    }
  }

  private _disallowO2Propagation(room: { zoneObj: unknown }): boolean {
    const zoneObj = room.zoneObj;
    if (!zoneObj || typeof zoneObj !== 'object' || !('disallowO2Propagation' in zoneObj)) {
      return false;
    }
    const disallow = (zoneObj as { disallowO2Propagation: unknown }).disallowO2Propagation;
    if (typeof disallow !== 'function') {
      return false;
    }
    return disallow();
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
