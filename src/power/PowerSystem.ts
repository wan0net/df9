/**
 * PowerSystem.ts — Room power distribution.
 * Mirrors Room.lua power sections: contiguity via doors, generator output distribution.
 */

import type { Room } from '../rooms/Room';
import type { RoomManager } from '../rooms/RoomManager';
import { EnvObjectManager } from '../envobjects/EnvObjectManager';
import { TileType } from '../world/TileTypes';
import type { TileGrid } from '../world/TileGrid';

/** Power draw per tile of floor (from Lua: POWER_DRAW_PER_TILE=1) */
export const POWER_DRAW_PER_TILE = 1;

export class PowerSystem {
  private grid: TileGrid;
  private roomManager: RoomManager;

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

    // 2. For each contiguity blob, sum power output and draw
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

        for (const neighbor of r.tContiguousRooms) {
          if (!visited.has(neighbor.id)) {
            visited.add(neighbor.id);
            queue.push(neighbor);
          }
        }
      }

      // Sum power in blob
      let totalOutput = 0;
      let totalDraw = 0;

      for (const r of blob) {
        totalOutput += EnvObjectManager.getRoomPowerOutput(r);
        totalDraw += EnvObjectManager.getRoomPowerDraw(r);
        totalDraw += r.size * POWER_DRAW_PER_TILE;
      }

      // Distribute power status
      const hasPower = totalOutput >= totalDraw;
      for (const r of blob) {
        r.nPowerOutput = totalOutput;
        r.nPowerDraw = totalDraw;
        r.nPowerSupply = totalOutput - totalDraw;

        // Update power status on objects in room
        for (const obj of EnvObjectManager.getObjectsInRoom(r)) {
          obj.bHasPower = hasPower;
        }
      }
    }
  }

  /**
   * Compute room contiguity through doors.
   * Two rooms are contiguous if they share a door tile between them.
   */
  private computeContiguity(rooms: Room[]) {
    // Clear existing
    for (const room of rooms) {
      room.tContiguousRooms = [];
    }

    // For each room, check if any of its wall neighbors are doors
    // and if so, find the room on the other side
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
  }
}
