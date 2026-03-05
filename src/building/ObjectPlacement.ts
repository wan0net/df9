/**
 * ObjectPlacement.ts — Object placement validation and execution.
 * Handles zone checks, cost checks, space validation, and ghost preview.
 */

import { tObjects, type EnvObjectDef, getMenuForZone } from '../envobjects/EnvObjectData';
import { EnvObjectManager } from '../envobjects/EnvObjectManager';
import { GameRules, MAT_BUILD_DOOR } from '../core/GameRules';
import { CommandQueue } from '../core/CommandQueue';
import { TileType } from '../world/TileTypes';
import type { TileGrid } from '../world/TileGrid';
import type { RoomManager } from '../rooms/RoomManager';
import type { Room } from '../rooms/Room';
import { ZoneType } from '../world/ZoneType';
import { researchSystem } from '../research/ResearchSystem';

export class ObjectPlacement {
  private grid: TileGrid;
  private roomManager: RoomManager;

  constructor(grid: TileGrid, roomManager: RoomManager) {
    this.grid = grid;
    this.roomManager = roomManager;
  }

  /** Check if an object can be placed at a tile position. */
  canPlace(sName: string, tileX: number, tileY: number): { valid: boolean; reason: string } {
    const data = tObjects[sName];
    if (!data) return { valid: false, reason: 'Unknown object' };

    // Cost check
    if (GameRules.nMatter < data.matterCost) {
      return { valid: false, reason: 'Not enough matter' };
    }

    // Research check
    if (data.researchPrereq) {
      if (!researchSystem.isCompleted(data.researchPrereq)) {
        return { valid: false, reason: 'Research not completed' };
      }
    }

    // Tile type check — accept pending tiles too (they'll be built by the time object is constructed)
    const tileType = this.grid.get(tileX, tileY);
    if (data.againstWall) {
      if (tileType !== TileType.WALL && tileType !== TileType.WALL_PENDING) {
        return { valid: false, reason: 'Must place on wall' };
      }
    } else if (data.door) {
      if (tileType !== TileType.WALL && tileType !== TileType.WALL_PENDING) {
        return { valid: false, reason: 'Doors must be placed on walls' };
      }
    } else {
      if (tileType !== TileType.FLOOR && tileType !== TileType.FLOOR_PENDING) {
        return { valid: false, reason: 'Must place on floor' };
      }
    }

    // Zone check
    if (data.zoneName) {
      const room = this.roomManager.getRoomAt(tileX, tileY);
      if (!room) return { valid: false, reason: 'Must be in a room' };

      if (room.zone !== data.zoneName) {
        // Check additional zones
        if (!data.additionalZones.includes(room.zone)) {
          return { valid: false, reason: `Requires ${data.zoneName} zone` };
        }
      }
    }

    // Multi-tile footprint check (skip for doors/wall objects — they occupy a single wall tile,
    // width/height is visual sprite size only)
    if ((data.width > 1 || data.height > 1) && !data.door && !data.againstWall) {
      for (let dy = 0; dy < data.height; dy++) {
        for (let dx = 0; dx < data.width; dx++) {
          if (dx === 0 && dy === 0) continue;
          const tx = tileX + dx;
          const ty = tileY + dy;
          const tt = this.grid.get(tx, ty);
          if (tt !== TileType.FLOOR && tt !== TileType.FLOOR_PENDING) {
            return { valid: false, reason: 'Not enough space' };
          }
        }
      }
    }

    return { valid: true, reason: '' };
  }

  /** Place an object as a ghost (unbuilt). Returns the cost deducted, or 0 if failed. */
  placeObject(sName: string, tileX: number, tileY: number): number {
    const check = this.canPlace(sName, tileX, tileY);
    if (!check.valid) return 0;

    const data = tObjects[sName];

    const obj = EnvObjectManager.createObject(sName, tileX, tileY, false, false, false);
    if (!obj) return 0;

    // Door-type objects convert the wall tile to a DOOR tile
    if (data.door) {
      this.grid.set(tileX, tileY, TileType.DOOR);
    }

    // Queue a build command for the AI
    CommandQueue.addCommand('build_object', tileX, tileY, sName);

    GameRules.nMatter -= data.matterCost;
    return data.matterCost;
  }

  /** Get available objects for the given room's zone. */
  getAvailableObjects(room: Room): string[] {
    return getMenuForZone(room.zone);
  }
}
