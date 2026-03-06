/**
 * ObjectPlacement.ts — Object placement validation and execution.
 * Mirrors World.lua: _findPropFit, _checkPropFit, _getPropFootprint.
 */

import { tObjects, type EnvObjectDef, getMenuForZone } from '../envobjects/EnvObjectData';
import { EnvObjectManager } from '../envobjects/EnvObjectManager';
import { Door } from '../envobjects/Door';
import { GameRules, MAT_BUILD_DOOR } from '../core/GameRules';
import { CommandQueue } from '../core/CommandQueue';
import { TileType } from '../world/TileTypes';
import { getWallDirection, WallDirection } from '../world/WallDirection';
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

  /** Check if an object can be placed at a tile position.
   *  Mirrors Lua: World._checkPropFit + EnvObject.allowObjInRoom. */
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

    const tileType = this.grid.get(tileX, tileY);

    if (data.door) {
      // ── Door objects ────────────────────────────────────────────
      // Mirrors _checkPropFit door section: must be WALL, must be a straight
      // segment (NESW or NWSE only — corners/T/pillars rejected), and for
      // 2-wide doors all footprint tiles must share the same direction.
      if (tileType !== TileType.WALL && tileType !== TileType.WALL_PENDING) {
        return { valid: false, reason: 'Doors must be placed on walls' };
      }
      const dir = getWallDirection(this.grid, tileX, tileY);
      if (dir !== WallDirection.NESW && dir !== WallDirection.NWSE) {
        return { valid: false, reason: 'Door requires a straight wall' };
      }
      // 2-wide doors: second footprint tile must exist and share the same direction.
      // Mirrors _getDiamondPropFootprint + the per-tile direction validation.
      if (data.width > 1) {
        const adj = this.findAdjacentWallTile(tileX, tileY);
        if (!adj) {
          return { valid: false, reason: 'Need adjacent wall tile for 2-wide door' };
        }
        if (getWallDirection(this.grid, adj.x, adj.y) !== dir) {
          return { valid: false, reason: 'Door tiles must be on the same straight wall' };
        }
      }

    } else if (data.againstWall) {
      // ── Wall-mounted objects ────────────────────────────────────
      // Mirrors _findPropFit: player clicks the WALL tile; we find the adjacent
      // floor tile in the perpendicular direction (_findPropFit shifts txTest,tyTest
      // via _getAdjacentTile(wall, awayFromWallDir)).
      // The actual placement is AT the floor tile (mirrors _checkPropFit receiving
      // a floor tile tileX/tileY with bAgainstWall validated by checking adjacent dir).
      if (tileType !== TileType.WALL && tileType !== TileType.WALL_PENDING) {
        return { valid: false, reason: 'Must place on wall' };
      }
      const floorTile = this.findFloorTileForWallObject(tileX, tileY);
      if (!floorTile) {
        return { valid: false, reason: 'No adjacent floor tile' };
      }

      // Occupied-tile check — mirrors _checkPropFit: ObjectList.getObjAtTile.
      const occupant = EnvObjectManager.getObjectAt(floorTile.x, floorTile.y);
      if (occupant && occupant.tData.bBlocksPathing) {
        return { valid: false, reason: 'Tile is occupied' };
      }

      // Zone check — mirrors allowObjInRoom(tData, rRoom) on the floor tile's room.
      if (!data.noRoom && data.zoneName) {
        const room = this.roomManager.getRoomAt(floorTile.x, floorTile.y);
        if (!room) return { valid: false, reason: 'Must be in a room' };
        if (room.zone !== data.zoneName && !data.additionalZones.includes(room.zone)) {
          return { valid: false, reason: `Requires ${data.zoneName} zone` };
        }
      }

    } else {
      // ── Floor objects ───────────────────────────────────────────
      // Mirrors _checkPropFit: tile must be pathable (floor); accepts pending tiles.
      if (tileType !== TileType.FLOOR && tileType !== TileType.FLOOR_PENDING) {
        return { valid: false, reason: 'Must place on floor' };
      }

      // Zone check — mirrors allowObjInRoom.
      if (!data.noRoom && data.zoneName) {
        const room = this.roomManager.getRoomAt(tileX, tileY);
        if (!room) return { valid: false, reason: 'Must be in a room' };
        if (room.zone !== data.zoneName && !data.additionalZones.includes(room.zone)) {
          return { valid: false, reason: `Requires ${data.zoneName} zone` };
        }
      }

      // Occupied-tile check — mirrors _checkPropFit: ObjectList.getObjAtTile.
      const occupant = EnvObjectManager.getObjectAt(tileX, tileY);
      if (occupant) {
        if (occupant.tData.bBlocksPathing || data.margin === 0) {
          return { valid: false, reason: 'Tile is occupied' };
        }
      }

      // Multi-tile footprint check.
      // Mirrors _getDiamondPropFootprint + per-tile pathability check.
      if (data.width > 1 || data.height > 1) {
        for (let dy = 0; dy < data.height; dy++) {
          for (let dx = 0; dx < data.width; dx++) {
            if (dx === 0 && dy === 0) continue;
            const tx = tileX + dx;
            const ty = tileY + dy;
            const tt = this.grid.get(tx, ty);
            if (tt !== TileType.FLOOR && tt !== TileType.FLOOR_PENDING) {
              return { valid: false, reason: 'Not enough space' };
            }
            const occupantAt = EnvObjectManager.getObjectAt(tx, ty);
            if (occupantAt) return { valid: false, reason: 'Tile is occupied' };
          }
        }
      }
    }

    return { valid: true, reason: '' };
  }

  /** Place an object as a ghost (unbuilt). Returns the cost deducted, or 0 if failed.
   *  Mirrors Lua: EnvObject.createEnvObject after _findPropFit resolves placement. */
  placeObject(sName: string, tileX: number, tileY: number): number {
    const check = this.canPlace(sName, tileX, tileY);
    if (!check.valid) return 0;

    const data = tObjects[sName];

    // ── Determine placement tile and flip ──────────────────────────
    // Mirrors Lua Door:init autoFlip: if dir == NWSE then bFlipX = true.
    // Mirrors _findPropFit: for againstWall, txTest/tyTest shifts to floor tile.
    let placeTileX = tileX;
    let placeTileY = tileY;
    let bFlipX = false;
    let bFlipY = false;

    if (data.door) {
      // Mirrors Lua Door:init: getWallDirection → bFlipX = (dir == NWSE)
      const dir = getWallDirection(this.grid, tileX, tileY);
      bFlipX = (dir === WallDirection.NWSE);
    } else if (data.againstWall) {
      // Mirrors _findPropFit: shift from wall tile to adjacent floor tile.
      const floorTile = this.findFloorTileForWallObject(tileX, tileY)!;
      placeTileX = floorTile.x;
      placeTileY = floorTile.y;
      bFlipX = floorTile.bFlipX;
      bFlipY = floorTile.bFlipY;
    }

    const obj = EnvObjectManager.createObject(sName, placeTileX, placeTileY, bFlipX, bFlipY, false);
    if (!obj) return 0;

    // Door-type objects convert wall tile(s) to DOOR.
    // Mirrors Lua Door:setLoc → _getInteriorTiles → g_World._setTile(tx, ty, DOOR).
    if (data.door) {
      this.grid.set(tileX, tileY, TileType.DOOR);
      // 2-wide doors (Airlock): second tile along the same wall axis.
      // Mirrors _getDiamondPropFootprint for width=2, height=1.
      if (data.width > 1) {
        const adj = this.findAdjacentWallTile(tileX, tileY);
        if (adj) {
          this.grid.set(adj.x, adj.y, TileType.DOOR);
          const door = EnvObjectManager.getDoorAt(tileX, tileY);
          if (door instanceof Door) {
            door.secondTileX = adj.x;
            door.secondTileY = adj.y;
          }
        }
      }
    }

    // Queue a build command for the AI.
    // Use the actual placement tile (floor for againstWall, wall for doors/floor objects)
    // so CharacterManager's object lookup matches obj.tileX/tileY.
    CommandQueue.addCommand('build_object', placeTileX, placeTileY, sName);

    GameRules.nMatter -= data.matterCost;
    return data.matterCost;
  }

  /**
   * For a 2-wide door: find the adjacent wall tile along the same axis.
   * Mirrors Lua _getDiamondPropFootprint for width=2, height=1:
   *   - bFlipX=false (NESW wall): second tile in NE/SW axis direction.
   *   - bFlipX=true  (NWSE wall): second tile in NW/SE axis direction.
   * Uses getWallDirection to restrict to the axis and prevent corner-of-doors.
   */
  findAdjacentWallTile(x: number, y: number): { x: number; y: number } | null {
    const isOdd = y & 1;
    const xLeft = isOdd ? 0 : -1;

    const ne = { x: x + xLeft + 1, y: y - 1 };
    const nw = { x: x + xLeft,     y: y - 1 };
    const se = { x: x + xLeft + 1, y: y + 1 };
    const sw = { x: x + xLeft,     y: y + 1 };

    const isWall = (c: { x: number; y: number }) => {
      const t = this.grid.get(c.x, c.y);
      return t === TileType.WALL || t === TileType.WALL_PENDING;
    };

    const dir = getWallDirection(this.grid, x, y);
    if (dir === WallDirection.NESW) {
      if (isWall(ne)) return ne;
      if (isWall(sw)) return sw;
    } else if (dir === WallDirection.NWSE) {
      if (isWall(nw)) return nw;
      if (isWall(se)) return se;
    } else {
      for (const c of [ne, nw, se, sw]) {
        if (isWall(c)) return c;
      }
    }
    return null;
  }

  /**
   * For an againstWall object: given the WALL tile the player clicked, find
   * the adjacent floor tile in the perpendicular direction, plus the correct
   * bFlipX/bFlipY for the object to face the wall.
   *
   * Mirrors Lua _findPropFit → _getAdjacentTile(wall, awayFromWallDir):
   *   NESW wall: perpendicular floor tiles are at NW or SE of the wall.
   *   NWSE wall: perpendicular floor tiles are at NE or SW of the wall.
   *
   * Flip derivation (verified against _getPropFootprint bAgainstWall checks):
   *   - Object at NW of wall (wall is at SE of floor): bFlipX=true,  bFlipY=false
   *   - Object at SE of wall (wall is at NW of floor): bFlipX=false, bFlipY=true
   *   - Object at NE of wall (wall is at SW of floor): bFlipX=false, bFlipY=false
   *   - Object at SW of wall (wall is at NE of floor): bFlipX=true,  bFlipY=true
   */
  private findFloorTileForWallObject(wallX: number, wallY: number):
    { x: number; y: number; bFlipX: boolean; bFlipY: boolean } | null
  {
    const isOdd = wallY & 1;
    const xLeft = isOdd ? 0 : -1;

    const ne = { x: wallX + xLeft + 1, y: wallY - 1 };
    const nw = { x: wallX + xLeft,     y: wallY - 1 };
    const se = { x: wallX + xLeft + 1, y: wallY + 1 };
    const sw = { x: wallX + xLeft,     y: wallY + 1 };

    const isFloor = (c: { x: number; y: number }) => {
      const t = this.grid.get(c.x, c.y);
      return t === TileType.FLOOR || t === TileType.FLOOR_PENDING;
    };

    const dir = getWallDirection(this.grid, wallX, wallY);

    if (dir === WallDirection.NESW) {
      // NESW ("/"): perpendicular sides are NW and SE of the wall.
      if (isFloor(nw)) return { ...nw, bFlipX: true,  bFlipY: false };
      if (isFloor(se)) return { ...se, bFlipX: false, bFlipY: true  };
    } else if (dir === WallDirection.NWSE) {
      // NWSE ("\"): perpendicular sides are NE and SW of the wall.
      if (isFloor(ne)) return { ...ne, bFlipX: false, bFlipY: false };
      if (isFloor(sw)) return { ...sw, bFlipX: true,  bFlipY: true  };
    } else {
      // Corner/T/pillar: try all four, pick first floor neighbor.
      if (isFloor(nw)) return { ...nw, bFlipX: true,  bFlipY: false };
      if (isFloor(ne)) return { ...ne, bFlipX: false, bFlipY: false };
      if (isFloor(sw)) return { ...sw, bFlipX: true,  bFlipY: true  };
      if (isFloor(se)) return { ...se, bFlipX: false, bFlipY: true  };
    }
    return null;
  }

  /** Get available objects for the given room's zone. */
  getAvailableObjects(room: Room): string[] {
    return getMenuForZone(room.zone);
  }
}
