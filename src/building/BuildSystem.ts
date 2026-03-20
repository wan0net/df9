import { TileGrid } from '../world/TileGrid';
import { TileType } from '../world/TileTypes';
import { WallAutoGen } from '../world/WallAutoGen';
import { MAT_BUILD_FLOOR, MAT_BUILD_DOOR, MAT_VAPE_FLOOR, MAT_VAPE_OBJECT_PCT } from '../core/GameRules';
import { CommandQueue } from '../core/CommandQueue';
import { EnvObjectManager } from '../envobjects/EnvObjectManager';
import { isAsteroid, vaporizeTile } from '../world/Asteroid';
import { RoomManager } from '../rooms/RoomManager';
import { getWallDirection, WallDirection } from '../world/WallDirection';
import { getDiamondFootprint } from '../world/IsometricUtils';
import { tObjects } from '../envobjects/EnvObjectData';

/**
 * Build modes matching original Lua GameRules MODE_ constants:
 *  'none'     = MODE_INSPECT
 *  'room'     = MODE_BUILD_ROOM   (C) — floor + auto-wall perimeter
 *  'floor'    = MODE_BUILD_FLOOR  (B) — floor only, no walls
 *  'wall'     = MODE_BUILD_WALL       — wall only
 *  'door'     = MODE_BUILD_DOOR   (D) — door on wall
 *  'demolish' = MODE_DEMOLISH     (X) — tear down (walls→FLOOR, objects removed)
 *  'vaporize' = MODE_VAPORIZE     (V) — instant removal (everything→SPACE)
 *  'zone'     = (zone assignment)  (Z)
 *  'object'   = MODE_PLACE_PROP   (P) — place env object
 *  'mine'     = MODE_MINE         (M) — mine asteroid
 */
export type BuildMode = 'none' | 'room' | 'floor' | 'wall' | 'door' | 'demolish' | 'vaporize' | 'erase' | 'zone' | 'object' | 'mine' | 'beacon';

export class BuildSystem {
  private grid: TileGrid;
  private wallAutoGen: WallAutoGen;
  private roomManager: RoomManager | null = null;

  constructor(grid: TileGrid, wallAutoGen: WallAutoGen) {
    this.grid = grid;
    this.wallAutoGen = wallAutoGen;
  }

  /** Set room manager reference (needed for canBuildWall prop margin checks). */
  setRoomManager(rm: RoomManager) {
    this.roomManager = rm;
  }

  /**
   * Build a room: all dragged tiles become FLOOR_PENDING, then WallAutoGen
   * places WALL_PENDING at floor/space boundaries (iso-diamond adjacency).
   * Lua: drag tiles → floor, walls auto-generated around the perimeter.
   */
  buildRoom(tiles: { x: number; y: number }[], availableMatter: number): number {
    if (tiles.length === 0) return 0;

    let cost = 0;
    const placed: { x: number; y: number }[] = [];

    for (const t of tiles) {
      const current = this.grid.get(t.x, t.y);
      if (current !== TileType.SPACE && current !== TileType.WALL && current !== TileType.WALL_DESTROYED) continue;
      if (cost + MAT_BUILD_FLOOR > availableMatter) break;

      this.grid.set(t.x, t.y, TileType.FLOOR_PENDING);
      CommandQueue.addCommand('build_tile', t.x, t.y, 'floor');
      cost += MAT_BUILD_FLOOR;
      placed.push(t);
    }

    if (placed.length > 0) {
      this.wallAutoGen.updatePending(placed);
    }

    return cost;
  }

  /** Place PENDING floor tiles only — no wall generation (Lua MODE_BUILD_FLOOR). */
  placeFloors(tiles: { x: number; y: number }[], availableMatter: number): number {
    let cost = 0;

    for (const t of tiles) {
      const tile = this.grid.get(t.x, t.y);
      // Lua: countsAsFloor check — can build floor on SPACE or WALL_DESTROYED
      if (tile !== TileType.SPACE && tile !== TileType.WALL_DESTROYED) continue;
      if (cost + MAT_BUILD_FLOOR > availableMatter) break;
      this.grid.set(t.x, t.y, TileType.FLOOR_PENDING);
      CommandQueue.addCommand('build_tile', t.x, t.y, 'floor');
      cost += MAT_BUILD_FLOOR;
    }

    return cost;
  }

  /**
   * Check if a wall can be placed at a tile.
   * Mirrors Lua World.canBuildWall():
   *  - WALL_DESTROYED: always allowed (rebuild)
   *  - Must be SPACE or counts-as-floor
   *  - Blocked by path-blocking objects
   *  - Blocked by doors at the tile
   *  - Blocked by room prop margins (Lua testWallPlacementIntersectsProp)
   *  - Blocked if in front of a door
   */
  canBuildWall(tx: number, ty: number): boolean {
    const tile = this.grid.get(tx, ty);

    // Lua: "if tile == World.logicalTiles.WALL_DESTROYED then return true end"
    if (tile === TileType.WALL_DESTROYED) return true;

    // Lua: must be SPACE or counts-as-floor (FLOOR, FLOOR_PENDING)
    if (tile !== TileType.SPACE && tile !== TileType.FLOOR && tile !== TileType.FLOOR_PENDING) {
      return false;
    }

    // Lua: "if ObjectList.pathBlockedByObject(tx,ty) then return false end"
    const obj = EnvObjectManager.getObjectAt(tx, ty);
    if (obj && obj.tData.bBlocksPathing) return false;

    // Lua: "if ObjectList.getDoorAtTile(tx,ty) then return false end"
    const door = EnvObjectManager.getDoorAt(tx, ty);
    if (door) return false;

    // Lua: check room props' margins block wall placement
    if (this.roomManager) {
      const room = this.roomManager.getRoomAt(tx, ty);
      if (room) {
        // Check built props (Lua rRoom.tProps)
        for (const prop of EnvObjectManager.getObjectsInRoom(room)) {
          if (this._testWallPlacementIntersectsProp(
            prop.sName, tx, ty, prop.tileX, prop.tileY, prop.bFlipX, prop.bFlipY
          )) {
            return false;
          }
        }

        // Lua: check doors' isInFrontOfDoor — wall can't block door access
        for (const prop of EnvObjectManager.getObjectsInRoom(room)) {
          if (prop.tData.door) {
            // Door's front tiles are the floor tiles perpendicular to the door axis
            const neighbors = this.grid.getDiagonalNeighbors(prop.tileX, prop.tileY);
            for (const n of neighbors) {
              if (n.x === tx && n.y === ty) {
                const nType = this.grid.get(n.x, n.y);
                if (nType === TileType.FLOOR || nType === TileType.FLOOR_PENDING) {
                  return false; // wall would block door access
                }
              }
            }
          }
        }

        // Lua: check tPropPlacements (pending build_object commands)
        for (const cmd of CommandQueue.getAllActive()) {
          if (cmd.type === 'build_object' && cmd.status !== 'cancelled' && cmd.objectName) {
            const propRoom = this.roomManager.getRoomAt(cmd.tileX, cmd.tileY);
            if (propRoom === room) {
              if (this._testWallPlacementIntersectsProp(
                cmd.objectName, tx, ty, cmd.tileX, cmd.tileY, false, false
              )) {
                return false;
              }
            }
          }
        }
      }
    }

    return true;
  }

  /** Place PENDING wall tiles only (Lua MODE_BUILD_WALL). */
  placeWalls(tiles: { x: number; y: number }[], availableMatter: number): number {
    let cost = 0;

    for (const t of tiles) {
      if (!this.canBuildWall(t.x, t.y)) continue;
      if (cost + MAT_BUILD_FLOOR > availableMatter) break;
      this.grid.set(t.x, t.y, TileType.WALL_PENDING);
      CommandQueue.addCommand('build_tile', t.x, t.y, 'wall');
      cost += MAT_BUILD_FLOOR;
    }

    return cost;
  }

  /** Complete construction of a pending tile (called by builder task). */
  completeTile(x: number, y: number) {
    const current = this.grid.get(x, y);
    if (current === TileType.FLOOR_PENDING) {
      this.grid.set(x, y, TileType.FLOOR);
    } else if (current === TileType.WALL_PENDING) {
      this.grid.set(x, y, TileType.WALL);
    }
  }

  /** Place a door on a completed wall tile, return matter cost */
  placeDoor(x: number, y: number, availableMatter: number): number {
    const current = this.grid.get(x, y);
    if (current !== TileType.WALL) return 0;
    if (availableMatter < MAT_BUILD_DOOR) return 0;
    this.grid.set(x, y, TileType.DOOR);
    return MAT_BUILD_DOOR;
  }

  /** Tear Down (MODE_DEMOLISH). Lua World._demolishTile if/elseif/else chain:
   *    1. object on tile → remove object only (don't change tile type)
   *    2. wall → convert to FLOOR (ZONE_LIST_START)
   *    3. asteroid → vaporizeTile(bCompletely=false) — partial decay
   *  Does NOT remove floor/door (that's vaporize). */
  demolish(tiles: { x: number; y: number }[]): number {
    let refund = 0;
    const changed: { x: number; y: number }[] = [];

    for (const t of tiles) {
      const current = this.grid.get(t.x, t.y);
      let bDemolished = false;

      // O-20: Cancel any pending build commands at this tile (Lua _demolishTile checks CommandObject)
      CommandQueue.cancelAt(t.x, t.y);

      // Lua _demolishTile: obj→remove() gives NO matter refund (only vaporize does)
      const obj = EnvObjectManager.getObjectAt(t.x, t.y);
      if (obj) {
        // Lua Door:remove() converts DOOR tiles back to WALL
        if (obj.tData.door && current === TileType.DOOR) {
          this.grid.set(t.x, t.y, TileType.WALL);
        }
        EnvObjectManager.removeObject(obj);
        bDemolished = true;
      } else if (current === TileType.WALL || current === TileType.WALL_PENDING ||
                 current === TileType.WALL_DESTROYED) {
        this.grid.set(t.x, t.y, TileType.FLOOR);
        refund += MAT_VAPE_FLOOR;
        bDemolished = true;
      } else if (isAsteroid(current)) {
        const { removed } = vaporizeTile(this.grid, t.x, t.y, false);
        bDemolished = removed || true;
      }

      if (bDemolished) {
        this.grid.clearTileHP(t.x, t.y);
        this._cheatOxygen(t.x, t.y);
        changed.push(t);
      }
    }

    if (changed.length > 0) {
      this.wallAutoGen.cleanupOrphans(changed);
    }
    return refund;
  }

  /** Vaporize (MODE_VAPORIZE). Lua World._vaporizeTile — instant removal:
   *    1. object on tile → vaporize object, then remove tile
   *    2. wall: also remove wall-mounted object on adjacent tile (Lua _getEnvObjectOnWall)
   *    3. tile → SPACE (floor, wall, door all become space)
   *    4. asteroid → vaporizeTile(bCompletely=true) — full removal
   *    5. Average O2 from neighbors (Lua _cheatOxygen) */
  vaporize(tiles: { x: number; y: number }[]): number {
    let refund = 0;
    const changed: { x: number; y: number }[] = [];

    for (const t of tiles) {
      const current = this.grid.get(t.x, t.y);
      let bVaporized = false;

      const obj = EnvObjectManager.getObjectAt(t.x, t.y);
      if (obj) {
        refund += obj.getVaporizeMatterYield();
        EnvObjectManager.removeObject(obj);
      }

      if (current === TileType.WALL || current === TileType.WALL_PENDING ||
          current === TileType.WALL_DESTROYED) {
        // Lua: also vaporize wall-mounted object on adjacent tile
        const wallObj = this._getObjectOnWall(t.x, t.y);
        if (wallObj) {
          refund += wallObj.getVaporizeMatterYield();
          EnvObjectManager.removeObject(wallObj);
        }
        this.grid.set(t.x, t.y, TileType.SPACE);
        refund += MAT_VAPE_FLOOR;
        bVaporized = true;
      } else if (current === TileType.FLOOR || current === TileType.FLOOR_PENDING) {
        this.grid.set(t.x, t.y, TileType.SPACE);
        refund += MAT_VAPE_FLOOR;
        bVaporized = true;
      } else if (current === TileType.DOOR) {
        this.grid.set(t.x, t.y, TileType.SPACE);
        refund += Math.floor(MAT_BUILD_DOOR * MAT_VAPE_OBJECT_PCT);
        bVaporized = true;
      } else if (isAsteroid(current)) {
        const { removed } = vaporizeTile(this.grid, t.x, t.y, true);
        bVaporized = removed || true;
      }

      if (bVaporized) {
        this.grid.clearTileHP(t.x, t.y);
        this._cheatOxygen(t.x, t.y);
        changed.push(t);
      }
    }

    if (changed.length > 0) {
      this.wallAutoGen.cleanupOrphans(changed);
    }
    return refund;
  }

  /**
   * Lua testWallPlacementIntersectsProp: check if wall at (wtx,wty) intersects
   * a prop's footprint+margin. Uses getDiamondFootprint for accurate iso geometry.
   */
  private _testWallPlacementIntersectsProp(
    sPropName: string, wtx: number, wty: number,
    ptx: number, pty: number, bFlipX: boolean, bFlipY: boolean
  ): boolean {
    const tPropData = tObjects[sPropName];
    if (!tPropData) return false;

    // Lua: againstWall check — prop at same tile blocks wall
    if (tPropData.againstWall) {
      return ptx === wtx && pty === wty;
    }

    // Lua: margin check via _getPropFootprint(bBuffer=true, bIndexByAddr=true)
    // The buffered footprint expands width/height by margin on each side
    if (tPropData.margin && tPropData.margin > 0) {
      const dx = Math.abs(wtx - ptx);
      const dy = Math.abs(wty - pty);
      if (dx + dy <= tPropData.margin + Math.max(tPropData.width, tPropData.height)) {
        // Lua _getPropFootprint with bBuffer: expands footprint by margin in each direction
        // For a 1x1 object with margin=1, the buffered footprint is a 3x3 diamond
        const bufferedW = tPropData.width + tPropData.margin * 2;
        const bufferedH = tPropData.height + tPropData.margin * 2;
        // Offset origin back by margin tiles in each axis to center the buffer
        let originX = ptx;
        let originY = pty;
        for (let m = 0; m < tPropData.margin; m++) {
          // Step NW (reverse of SE): y-1, x adjusted
          const odd = originY & 1;
          if (!odd) originX--;
          originY--;
        }
        const footprint = getDiamondFootprint(originX, originY, bufferedW, bufferedH, bFlipX, bFlipY);
        for (const ft of footprint) {
          if (ft.x === wtx && ft.y === wty) return true;
        }
      }
    }

    return false;
  }

  /**
   * Lua World._cheatOxygen: average O2 from diagonal neighbors to avoid instant vacuum.
   * Uses directions 2-5 (diagonal/edge-sharing neighbors), checks bIndoors + not occluded.
   */
  private _cheatOxygen(tx: number, ty: number) {
    const neighbors = this.grid.getDiagonalNeighbors(tx, ty);
    let totalO2 = 0;
    let count = 0;
    for (const n of neighbors) {
      const nType = this.grid.get(n.x, n.y);
      // Lua: bIndoors and not bOcclude — floor/door tiles that aren't walls
      if (nType === TileType.FLOOR || nType === TileType.DOOR ||
          nType === TileType.FLOOR_PENDING) {
        totalO2 += this.grid.getO2(n.x, n.y);
        count++;
      }
    }
    const newO2 = count > 0 ? Math.round(totalO2 / count) : 0;
    this.grid.setO2(tx, ty, newO2);
  }

  /**
   * Lua World._getEnvObjectOnWall: find wall-mounted object on adjacent tile.
   * When vaporizing a wall, also remove any againstWall object mounted to it.
   * Lua checks a specific offset based on wall flip, then verifies via getWallTile().
   */
  private _getObjectOnWall(wallTileX: number, wallTileY: number) {
    const isOdd = wallTileY & 1;
    const xLeft = isOdd ? 0 : -1;

    // Lua: nOffsetX=1, nOffsetY=-1, but flipped walls use nOffsetX=-1
    // nOffsetY=-1 = NE/NW neighbor row; nOffsetX=1 = right side (SE/NE)
    const dir = getWallDirection(this.grid, wallTileX, wallTileY);
    const bFlip = dir === WallDirection.NWSE;

    // Lua offsets: (tileX+nOffsetX, tileY+nOffsetY)
    // In staggered grid: nOffsetY=-1 means y-1 row, nOffsetX maps to xLeft+1 (right) or xLeft (left)
    const checkX = bFlip ? (wallTileX + xLeft) : (wallTileX + xLeft + 1);
    const checkY = wallTileY - 1;

    if (this.grid.inBounds(checkX, checkY)) {
      const obj = EnvObjectManager.getObjectAt(checkX, checkY);
      if (obj && obj.tData.againstWall) {
        // Lua verification: objAtTile:getWallTile() must match this wall
        if (obj.wallTileX === wallTileX && obj.wallTileY === wallTileY) {
          return obj;
        }
      }
    }

    // Fallback: also check all diagonal neighbors (covers objects placed without wallTile tracking)
    const neighbors = this.grid.getDiagonalNeighbors(wallTileX, wallTileY);
    for (const n of neighbors) {
      if (n.x === checkX && n.y === checkY) continue; // already checked
      const obj = EnvObjectManager.getObjectAt(n.x, n.y);
      if (obj && obj.tData.againstWall) {
        if (obj.wallTileX === wallTileX && obj.wallTileY === wallTileY) {
          return obj;
        }
      }
    }
    return null;
  }

  /** Erase (MODE_CANCEL_COMMAND). Cancel pending build/mine commands at tiles.
   *  Reverts FLOOR_PENDING→SPACE, WALL_PENDING→SPACE, removes commands. */
  erase(tiles: { x: number; y: number }[]): number {
    let refund = 0;
    const changed: { x: number; y: number }[] = [];

    for (const t of tiles) {
      const current = this.grid.get(t.x, t.y);

      if (current === TileType.FLOOR_PENDING) {
        this.grid.set(t.x, t.y, TileType.SPACE);
        CommandQueue.cancelAt(t.x, t.y);
        refund += MAT_BUILD_FLOOR;
        changed.push(t);
      } else if (current === TileType.WALL_PENDING) {
        this.grid.set(t.x, t.y, TileType.SPACE);
        CommandQueue.cancelAt(t.x, t.y);
        refund += MAT_BUILD_FLOOR;
        changed.push(t);
      } else {
        // Cancel any mine command at this tile
        CommandQueue.cancelAt(t.x, t.y);
      }
    }

    if (changed.length > 0) {
      this.wallAutoGen.cleanupOrphans(changed);
    }
    return refund;
  }
}
