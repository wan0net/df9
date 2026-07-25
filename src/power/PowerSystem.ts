/**
 * PowerSystem.ts — Room power distribution.
 * Mirrors Room.lua power sections: contiguity via doors, generator output distribution.
 */

import type { Room } from '../rooms/Room';
import type { RoomManager } from '../rooms/RoomManager';
import type { EnvObject } from '../envobjects/EnvObject';
import { EnvObjectManager } from '../envobjects/EnvObjectManager';
import { TileType } from '../world/TileTypes';
import type { TileGrid } from '../world/TileGrid';
import { GameRules } from '../core/GameRules';
import { SoundManager } from '../audio/SoundManager';

/** Power draw per tile of floor (from Lua: POWER_DRAW_PER_TILE=1) */
export const POWER_DRAW_PER_TILE = 1;

export class PowerSystem {
  private grid: TileGrid;
  private roomManager: RoomManager;
  /** Track previous powered state per room for A-11 PowerUp/PowerDown sounds. */
  private prevPowered = new Map<number, boolean>();

  constructor(grid: TileGrid, roomManager: RoomManager) {
    this.grid = grid;
    this.roomManager = roomManager;
  }

  /**
   * Compute power distribution across all rooms.
   * Called after room detection changes.
   */
  update() {
    const rooms = this.roomManager.getRooms();

    // 1. Compute contiguity blobs (rooms connected through doors)
    this.computeContiguity(rooms);

    const powerLeechesByRoom = this.computePowerLeeches();

    const visited = new Set<number>();
    for (const room of rooms) {
      if (visited.has(room.id)) continue;

      // BFS through contiguous rooms
      const blob: Room[] = [];
      const queue = [room];
      visited.add(room.id);

      while (queue.length > 0) {
        const r = queue.shift()!;
        blob.push(r);

        // Follow door connections and wall-adjacent connections for power
        for (const neighbor of r.tContiguousRooms) {
          if (!visited.has(neighbor.id)) {
            visited.add(neighbor.id);
            queue.push(neighbor);
          }
        }
        for (const neighbor of r.tWallAdjacentRooms) {
          if (!visited.has(neighbor.id)) {
            visited.add(neighbor.id);
            queue.push(neighbor);
          }
        }
      }

      const generatorRemaining = new Map<Room, number>();
      for (const r of blob) {
        const output = EnvObjectManager.getRoomPowerOutput(r);
        if (output > 0) {
          generatorRemaining.set(r, output);
        }
      }

      for (const r of blob) {
        const roomPowerOutput = EnvObjectManager.getRoomPowerOutput(r);
        const roomObjects = EnvObjectManager.getObjectsInRoom(r);
        const leeches = powerLeechesByRoom.get(r.id) ?? [];

        const objectConsumers = roomObjects
          .map(obj => ({ obj, draw: obj.getPowerDraw() }))
          .filter(c => c.draw > 0);
        const leechConsumers = leeches
          .map(obj => ({ obj, draw: obj.getPowerDraw() }))
          .filter(c => c.draw > 0);

        const nRoomDraw = r.size * POWER_DRAW_PER_TILE;
        const nObjectDraw = objectConsumers.reduce((sum, c) => sum + c.draw, 0);
        const nLeechDraw = leechConsumers.reduce((sum, c) => sum + c.draw, 0);
        const nTotalPowerDraw = nRoomDraw + nObjectDraw + nLeechDraw;

        let nTotalPowerSupplied = 0;
        if (GameRules.bPowerHoliday) {
          nTotalPowerSupplied = 999;
        } else if (nTotalPowerDraw > 0) {
          const center = this.getRoomCenter(r);
          const availablePower = Array.from(generatorRemaining.entries())
            .map(([sourceRoom, remaining]) => {
              const srcCenter = this.getRoomCenter(sourceRoom);
              const dx = center.x - srcCenter.x;
              const dy = center.y - srcCenter.y;
              return { sourceRoom, remaining, dist2: dx * dx + dy * dy };
            })
            .sort((a, b) => a.dist2 - b.dist2);

          let nNeeded = nTotalPowerDraw;
          for (const source of availablePower) {
            if (nNeeded <= 0) break;
            const nRemaining = generatorRemaining.get(source.sourceRoom) ?? 0;
            if (nRemaining <= 0) continue;

            const nPowerDrawn = Math.min(nNeeded, nRemaining);
            nTotalPowerSupplied += nPowerDrawn;
            nNeeded -= nPowerDrawn;
            generatorRemaining.set(source.sourceRoom, nRemaining - nPowerDrawn);
          }
        }

        r.nPowerOutput = roomPowerOutput;
        r.nPowerDraw = nTotalPowerDraw;
        r.nPowerSupply = nTotalPowerSupplied;

        // A-11: Play PowerUp/PowerDown when a room's power state changes
        const bPowered = nTotalPowerDraw === 0 || nTotalPowerSupplied >= nTotalPowerDraw;
        const bWasPowered = this.prevPowered.get(r.id);
        if (bWasPowered !== undefined && bPowered !== bWasPowered) {
          SoundManager.playSfx(bPowered ? 'PowerUp' : 'PowerDown');
        }
        this.prevPowered.set(r.id, bPowered);

        // Lua includes the room itself in tPowerConsumers, so its per-tile
        // draw consumes supply before that same supply can power props.
        let nRemainingForConsumers = Math.max(0, nTotalPowerSupplied - nRoomDraw);
        for (const consumer of objectConsumers) {
          if (consumer.draw <= nRemainingForConsumers) {
            consumer.obj.bHasPower = true;
            nRemainingForConsumers -= consumer.draw;
          } else {
            consumer.obj.bHasPower = false;
          }
        }
        for (const consumer of leechConsumers) {
          if (consumer.draw <= nRemainingForConsumers) {
            consumer.obj.bHasPower = true;
            nRemainingForConsumers -= consumer.draw;
          } else {
            consumer.obj.bHasPower = false;
          }
        }

        for (const leech of leeches) {
          if (!leechConsumers.some(c => c.obj === leech)) {
            leech.bHasPower = false;
          }
        }
      }
    }

    for (const obj of EnvObjectManager.getObjects()) {
      if (obj.rRoom !== null) continue;
      if (obj.getPowerDraw() <= 0) continue;
      if (!this.isAssignedAsPowerLeech(obj, powerLeechesByRoom)) {
        obj.bHasPower = false;
      }
    }
  }

  private computePowerLeeches(): Map<number, EnvObject[]> {
    const result = new Map<number, EnvObject[]>();
    const allObjects = EnvObjectManager.getObjects();

    for (const obj of allObjects) {
      if (obj.rRoom !== null) continue;
      if (obj.getPowerDraw() <= 0) continue;

      const adjacentRooms = new Map<number, Room>();
      for (const n of this.grid.getAllNeighbors(obj.tileX, obj.tileY)) {
        const room = this.roomManager.getRoomAt(n.x, n.y);
        if (room) {
          adjacentRooms.set(room.id, room);
        }
      }
      if (adjacentRooms.size === 0) continue;

      let bestRoom: Room | null = null;
      let bestDist2 = Infinity;
      for (const room of adjacentRooms.values()) {
        const center = this.getRoomCenter(room);
        const dx = obj.tileX - center.x;
        const dy = obj.tileY - center.y;
        const dist2 = dx * dx + dy * dy;
        if (dist2 < bestDist2 || (dist2 === bestDist2 && bestRoom !== null && room.id < bestRoom.id)) {
          bestRoom = room;
          bestDist2 = dist2;
        } else if (dist2 === bestDist2 && bestRoom === null) {
          bestRoom = room;
        }
      }

      if (!bestRoom) continue;

      const list = result.get(bestRoom.id) ?? [];
      list.push(obj);
      result.set(bestRoom.id, list);
    }

    return result;
  }

  private isAssignedAsPowerLeech(obj: EnvObject, leechesByRoom: Map<number, EnvObject[]>): boolean {
    for (const leeches of leechesByRoom.values()) {
      if (leeches.includes(obj)) return true;
    }
    return false;
  }

  private getRoomCenter(room: Room): { x: number; y: number } {
    if (room.tiles.length === 0) return { x: 0, y: 0 };
    let sx = 0;
    let sy = 0;
    for (const tile of room.tiles) {
      sx += tile.x;
      sy += tile.y;
    }
    return {
      x: sx / room.tiles.length,
      y: sy / room.tiles.length,
    };
  }

  /**
   * Compute room contiguity through doors and wall adjacency.
   * Two rooms are door-contiguous if they share a door tile between them.
   * Two rooms are wall-adjacent if a floor tile's diagonal neighbor is a WALL
   * tile, and that WALL tile's diagonal neighbor is a floor tile in a different room.
   */
  private computeContiguity(rooms: Room[]) {
    // Clear existing
    for (const room of rooms) {
      room.tContiguousRooms = [];
      room.tWallAdjacentRooms = [];
    }

    // Pass 1: Door-based contiguity
    for (const room of rooms) {
      for (const tile of room.tiles) {
        const neighbors = this.grid.getDiagonalNeighbors(tile.x, tile.y);
        for (const n of neighbors) {
          if (this.grid.get(n.x, n.y) !== TileType.DOOR) continue;

          // Found a door. Find rooms adjacent to this door (the other side)
          const doorNeighbors = this.grid.getDiagonalNeighbors(n.x, n.y);
          for (const dn of doorNeighbors) {
            if (this.grid.get(dn.x, dn.y) !== TileType.FLOOR) continue;
            const otherRoom = this.roomManager.getRoomAt(dn.x, dn.y);
            if (otherRoom && otherRoom !== room && !room.tContiguousRooms.includes(otherRoom)) {
              room.tContiguousRooms.push(otherRoom);
            }
          }
        }
      }
    }

    // Pass 2: Wall-blob adjacency (power conducts through shared walls)
    for (const room of rooms) {
      for (const tile of room.tiles) {
        const neighbors = this.grid.getDiagonalNeighbors(tile.x, tile.y);
        for (const n of neighbors) {
          if (this.grid.get(n.x, n.y) !== TileType.WALL) continue;

          // Found a wall. Check the wall's other neighbors for floor tiles in different rooms
          const wallNeighbors = this.grid.getDiagonalNeighbors(n.x, n.y);
          for (const wn of wallNeighbors) {
            if (this.grid.get(wn.x, wn.y) !== TileType.FLOOR) continue;
            const otherRoom = this.roomManager.getRoomAt(wn.x, wn.y);
            if (otherRoom && otherRoom !== room &&
                !room.tWallAdjacentRooms.includes(otherRoom) &&
                !room.tContiguousRooms.includes(otherRoom)) {
              room.tWallAdjacentRooms.push(otherRoom);
            }
          }
        }
      }
    }
  }
}
