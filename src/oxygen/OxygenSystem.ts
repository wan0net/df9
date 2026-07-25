/**
 * OxygenSystem — per-tile O2 simulation with room-level caching.
 *
 * Mirrors Oxygen.lua + Room.lua _shareOxygen:
 * - Per-tile O2 stored in TileGrid.o2 (Uint16Array, 0-65535 Lua scale).
 * - Recyclers emit O2 at their own tile.
 * - Character and fire consumption is spread across every room tile.
 * - Breached rooms drain all tiles toward 0.
 * - Inter-room sharing flows through door tiles toward equilibrium.
 * - Room.oxygen is derived as average of per-tile values, mapped to 0-255.
 */

import { RoomManager } from '../rooms/RoomManager';
import { EnvObjectManager } from '../envobjects/EnvObjectManager';
import { O2_MAX, O2_DRAIN_RATE } from '../config';
import { OXYGEN_PER_SECOND } from '../characters/CharacterConstants';
import { FIRE_OXYGEN_PER_SECOND } from '../hazards/Fire';
import { TileGrid, O2_MAX as TILE_O2_MAX } from '../world/TileGrid';

/** Scale from our room 0-255 → Lua tile 0-65535. */
const ROOM_TO_TILE = TILE_O2_MAX / O2_MAX;
/** Scale from Lua tile 0-65535 → our room 0-255. */
const TILE_TO_ROOM = O2_MAX / TILE_O2_MAX;

// ── Inter-room sharing constants (Room.lua:1328-1414) ──────────────────
/** Lua Room.MIN_O2_DIFF; requests/net changes at or below this are ignored. */
const MIN_O2_DIFF_TILE = 10;
/** Max O2 transfer per shared tile per second (tile scale). */
const MAX_O2_GIVE_PER_TILE = 50;
/** Preserve the former 100 ms vacuum tick as a frame-independent rate. */
const VACUUM_DRAIN_PER_SECOND = O2_DRAIN_RATE * ROOM_TO_TILE * 10;

export class OxygenSystem {
  private roomManager: RoomManager;
  private grid: TileGrid;
  private getCharacters: (() => {
    tileX: number;
    tileY: number;
    isAlive: () => boolean;
    doesBreathe: () => boolean;
  }[]) | null = null;
  private generationRemainders = new Map<string, number>();
  private consumptionRemainders = new Map<number, number>();
  private breachDrainRemainders = new Map<number, number>();

  constructor(roomManager: RoomManager, grid: TileGrid) {
    this.roomManager = roomManager;
    this.grid = grid;
  }

  /** Character lookup is injected to keep the oxygen simulation independent. */
  setCharacterProvider(provider: () => {
    tileX: number;
    tileY: number;
    isAlive: () => boolean;
    doesBreathe: () => boolean;
  }[]): void {
    this.getCharacters = provider;
  }

  update(delta: number) {
    const dt = delta / 1000;
    if (dt <= 0) return;
    const grid = this.grid;

    for (const room of this.roomManager.getRooms()) {
      // Room.lua:_shareOxygen spreads aggregate breathing and fire consumption
      // evenly across all tiles, before checking whether propagation is allowed.
      if (room.tiles.length > 0) {
        const breathingCharacters = this.getCharacters
          ? this.getCharacters().filter(char =>
              char.isAlive() &&
              char.doesBreathe() &&
              this.roomManager.getRoomAt(char.tileX, char.tileY) === room
            ).length
          : room.nCharacters;
        const totalConsumption =
          (breathingCharacters * OXYGEN_PER_SECOND +
            room.nFireTiles * FIRE_OXYGEN_PER_SECOND) * dt;
        const exactPerTile =
          totalConsumption / room.tiles.length +
          (this.consumptionRemainders.get(room.id) ?? 0);
        const perTile = Math.floor(exactPerTile);
        this.consumptionRemainders.set(room.id, exactPerTile - perTile);
        if (perTile > 0) {
          for (const tile of room.tiles) {
            grid.addO2(tile.x, tile.y, -perTile);
          }
        }
      }

      if (!room.sealed) {
        // Breached room: drain all tiles toward vacuum
        const exactDrain =
          VACUUM_DRAIN_PER_SECOND * dt +
          (this.breachDrainRemainders.get(room.id) ?? 0);
        const drain = Math.floor(exactDrain);
        this.breachDrainRemainders.set(room.id, exactDrain - drain);
        for (const t of room.tiles) {
          const cur = grid.getO2(t.x, t.y);
          if (cur > 0) {
            grid.setO2(t.x, t.y, Math.max(0, cur - drain));
          }
        }
        this._updateRoomOxygen(room);
        continue;
      }

      // Oxygen.lua registers each recycler as a generator at its own tile.
      for (const obj of EnvObjectManager.getObjectsInRoom(room)) {
        const output = obj.getOxygenOutput();
        if (output <= 0) continue;
        const key = `${obj.tileX},${obj.tileY}`;
        const exactOutput = output * dt + (this.generationRemainders.get(key) ?? 0);
        const emitted = Math.floor(exactOutput);
        this.generationRemainders.set(key, exactOutput - emitted);
        if (emitted > 0) grid.addO2(obj.tileX, obj.tileY, emitted);
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

  /** Derive room.oxygen (0-255 UI scale) and Lua-scale oxygen score from room tiles. */
  private _updateRoomOxygen(room: {
    tiles: { x: number; y: number }[];
    setOxygenStats: (displayOxygen: number, oxygenScore: number, totalOxygen: number) => void;
    invalidateOxygenScore: () => void;
  }): void {
    if (room.tiles.length === 0) {
      room.setOxygenStats(0, 0, 0);
      room.invalidateOxygenScore();
      return;
    }
    let sum = 0;
    for (const t of room.tiles) {
      sum += this.grid.getO2(t.x, t.y);
    }
    const avg = sum / room.tiles.length;
    room.setOxygenStats(Math.round(avg * TILE_TO_ROOM), avg, sum);
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
        const transferred = Math.round(scaledRequest);
        netChange -= transferred;
        this._distributeO2(adj.tiles, transferred);
      }

      if (Math.abs(netChange) > MIN_O2_DIFF_TILE) {
        this._distributeO2(room.tiles, netChange);
      }
    }

    // Re-derive room.oxygen after sharing
    for (const room of rooms) {
      this._updateRoomOxygen(room);
    }
  }

  /** Spread an integer total without losing fractional per-tile remainders. */
  private _distributeO2(tiles: { x: number; y: number }[], total: number): void {
    if (tiles.length === 0 || total === 0) return;
    const sign = total < 0 ? -1 : 1;
    const magnitude = Math.abs(total);
    const perTile = Math.floor(magnitude / tiles.length);
    let remainder = magnitude - perTile * tiles.length;
    for (const tile of tiles) {
      const amount = (perTile + (remainder > 0 ? 1 : 0)) * sign;
      if (remainder > 0) remainder--;
      if (amount !== 0) this.grid.addO2(tile.x, tile.y, amount);
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
  setRoomO2(room: {
    tiles: { x: number; y: number }[];
    setOxygenStats: (displayOxygen: number, oxygenScore: number, totalOxygen: number) => void;
    invalidateOxygenScore: () => void;
  }, o2_255: number): void {
    const tileVal = Math.round(o2_255 * ROOM_TO_TILE);
    for (const t of room.tiles) {
      this.grid.setO2(t.x, t.y, tileVal);
    }
    room.setOxygenStats(o2_255, tileVal, tileVal * room.tiles.length);
  }
}
