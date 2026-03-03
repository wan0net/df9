/**
 * ObjectPlacement.ts — Object placement validation and execution.
 * Handles zone checks, cost checks, space validation, and ghost preview.
 */

import { tObjects, type EnvObjectDef, getMenuForZone } from '../envobjects/EnvObjectData';
import { EnvObjectManager } from '../envobjects/EnvObjectManager';
import { GameRules } from '../core/GameRules';
import { CommandQueue } from '../core/CommandQueue';
import { TileType } from '../world/TileTypes';
import type { TileGrid } from '../world/TileGrid';
import type { RoomManager } from '../rooms/RoomManager';
import type { Room } from '../rooms/Room';
import { ZoneType } from '../world/ZoneType';

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

    // Research check (stub — always passes until Phase 9)
    if (data.researchPrereq) {
      // TODO: check research completion
    }

    // Tile type check
    const tileType = this.grid.get(tileX, tileY);
    if (data.againstWall) {
      if (tileType !== TileType.WALL) {
        return { valid: false, reason: 'Must place on wall' };
      }
    } else if (data.door) {
      if (tileType !== TileType.WALL) {
        return { valid: false, reason: 'Doors must be placed on walls' };
      }
    } else {
      if (tileType !== TileType.FLOOR) {
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

    // Multi-tile footprint check
    if (data.width > 1 || data.height > 1) {
      for (let dy = 0; dy < data.height; dy++) {
        for (let dx = 0; dx < data.width; dx++) {
          if (dx === 0 && dy === 0) continue;
          const tx = tileX + dx;
          const ty = tileY + dy;
          const tt = this.grid.get(tx, ty);
          if (tt !== TileType.FLOOR) {
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
    const obj = EnvObjectManager.createObject(sName, tileX, tileY);
    if (!obj) return 0;

    // Start as ghost (unbuilt) — builder must construct it
    obj.bBuilt = false;

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
