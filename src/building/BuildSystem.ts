import { TileGrid } from '../world/TileGrid';
import { TileType } from '../world/TileTypes';
import { WallAutoGen } from '../world/WallAutoGen';
import { MAT_BUILD_FLOOR, MAT_BUILD_DOOR, MAT_VAPE_FLOOR, MAT_VAPE_OBJECT_PCT } from '../core/GameRules';
import { CommandQueue } from '../core/CommandQueue';
import { EnvObjectManager } from '../envobjects/EnvObjectManager';
import { isAsteroid, vaporizeTile } from '../world/Asteroid';

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

  constructor(grid: TileGrid, wallAutoGen: WallAutoGen) {
    this.grid = grid;
    this.wallAutoGen = wallAutoGen;
  }

  /**
   * Build a room: the dragged rectangle IS the full room including walls.
   * Perimeter tiles become WALL_PENDING, interior tiles become FLOOR_PENDING.
   * Matches original Lua: drag area = room area, walls are not added outside.
   */
  buildRoom(tiles: { x: number; y: number }[], availableMatter: number): number {
    if (tiles.length === 0) return 0;

    // Find bounds to determine perimeter vs interior
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const t of tiles) {
      if (t.x < minX) minX = t.x;
      if (t.x > maxX) maxX = t.x;
      if (t.y < minY) minY = t.y;
      if (t.y > maxY) maxY = t.y;
    }

    // Build a set of all tiles in the drag for fast lookup
    const tileSet = new Set<string>();
    for (const t of tiles) tileSet.add(`${t.x},${t.y}`);

    let cost = 0;

    for (const t of tiles) {
      const current = this.grid.get(t.x, t.y);
      if (current !== TileType.SPACE && current !== TileType.WALL && current !== TileType.WALL_DESTROYED) continue;
      if (cost + MAT_BUILD_FLOOR > availableMatter) break;

      // A tile is perimeter if it's on the edge of the bounding box
      // or if any of its neighbors in the drag rectangle are missing
      const isPerimeter = t.x === minX || t.x === maxX || t.y === minY || t.y === maxY;

      if (isPerimeter) {
        this.grid.set(t.x, t.y, TileType.WALL_PENDING);
        CommandQueue.addCommand('build_tile', t.x, t.y, 'wall');
      } else {
        this.grid.set(t.x, t.y, TileType.FLOOR_PENDING);
        CommandQueue.addCommand('build_tile', t.x, t.y, 'floor');
      }
      cost += MAT_BUILD_FLOOR;
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

      const obj = EnvObjectManager.getObjectAt(t.x, t.y);
      if (obj) {
        refund += obj.getVaporizeMatterYield();
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
   *    2. wall-mounted objects on adjacent walls → vaporize those too
   *    3. tile → SPACE (floor, wall, door all become space)
   *    4. asteroid → vaporizeTile(bCompletely=true) — full removal */
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
        changed.push(t);
      }
    }

    if (changed.length > 0) {
      this.wallAutoGen.cleanupOrphans(changed);
    }
    return refund;
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
