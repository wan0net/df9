import { TileGrid } from '../world/TileGrid';
import { TileType } from '../world/TileTypes';
import { WallAutoGen } from '../world/WallAutoGen';
import { MAT_BUILD_FLOOR, MAT_BUILD_DOOR, MAT_VAPE_FLOOR } from '../core/GameRules';

/**
 * Build modes matching original Lua GameRules MODE_ constants:
 *  'none'    = MODE_INSPECT
 *  'room'    = MODE_BUILD_ROOM   (C) — floor + auto-wall perimeter
 *  'floor'   = MODE_BUILD_FLOOR  (B) — floor only, no walls
 *  'wall'    = MODE_BUILD_WALL       — wall only
 *  'door'    = MODE_BUILD_DOOR   (D) — door on wall
 *  'demolish'= MODE_DEMOLISH     (X) — remove tile
 *  'zone'    = (zone assignment)  (Z)
 *  'object'  = MODE_PLACE_PROP   (P) — place env object
 *  'mine'    = MODE_MINE         (M) — mine asteroid
 */
export type BuildMode = 'none' | 'room' | 'floor' | 'wall' | 'door' | 'demolish' | 'zone' | 'object' | 'mine';

export class BuildSystem {
  private grid: TileGrid;
  private wallAutoGen: WallAutoGen;

  constructor(grid: TileGrid, wallAutoGen: WallAutoGen) {
    this.grid = grid;
    this.wallAutoGen = wallAutoGen;
  }

  /**
   * Build a room: place floor tiles AND auto-generate walls at the perimeter.
   * Matches Lua MODE_BUILD_ROOM — the primary construction mode.
   */
  buildRoom(tiles: { x: number; y: number }[], availableMatter: number): number {
    let cost = 0;
    const placed: { x: number; y: number }[] = [];

    for (const t of tiles) {
      const current = this.grid.get(t.x, t.y);
      // Can build on SPACE or WALL tiles (walls get replaced with floor)
      if (current !== TileType.SPACE && current !== TileType.WALL) continue;
      if (cost + MAT_BUILD_FLOOR > availableMatter) break;
      this.grid.set(t.x, t.y, TileType.FLOOR);
      cost += MAT_BUILD_FLOOR;
      placed.push(t);
    }

    // Auto-generate walls around the placed floor
    if (placed.length > 0) {
      this.wallAutoGen.update(placed);
    }
    return cost;
  }

  /** Place floor tiles only — no wall generation (Lua MODE_BUILD_FLOOR). */
  placeFloors(tiles: { x: number; y: number }[], availableMatter: number): number {
    let cost = 0;

    for (const t of tiles) {
      if (this.grid.get(t.x, t.y) !== TileType.SPACE) continue;
      if (cost + MAT_BUILD_FLOOR > availableMatter) break;
      this.grid.set(t.x, t.y, TileType.FLOOR);
      cost += MAT_BUILD_FLOOR;
    }

    return cost;
  }

  /** Place wall tiles only (Lua MODE_BUILD_WALL). */
  placeWalls(tiles: { x: number; y: number }[], availableMatter: number): number {
    let cost = 0;

    for (const t of tiles) {
      if (this.grid.get(t.x, t.y) !== TileType.SPACE) continue;
      if (cost + MAT_BUILD_FLOOR > availableMatter) break;
      this.grid.set(t.x, t.y, TileType.WALL);
      cost += MAT_BUILD_FLOOR;
    }

    return cost;
  }

  /** Place a door on a wall tile, return matter cost */
  placeDoor(x: number, y: number, availableMatter: number): number {
    if (this.grid.get(x, y) !== TileType.WALL) return 0;
    if (availableMatter < MAT_BUILD_DOOR) return 0;
    this.grid.set(x, y, TileType.DOOR);
    return MAT_BUILD_DOOR;
  }

  /** Demolish tiles, return matter refunded. Cleans up orphaned walls without creating new ones. */
  demolish(tiles: { x: number; y: number }[]): number {
    let refund = 0;
    const changed: { x: number; y: number }[] = [];

    for (const t of tiles) {
      const current = this.grid.get(t.x, t.y);
      if (current === TileType.FLOOR) {
        this.grid.set(t.x, t.y, TileType.SPACE);
        refund += MAT_VAPE_FLOOR;
        changed.push(t);
      } else if (current === TileType.DOOR) {
        this.grid.set(t.x, t.y, TileType.SPACE);
        refund += MAT_VAPE_FLOOR;
        changed.push(t);
      } else if (current === TileType.WALL) {
        this.grid.set(t.x, t.y, TileType.SPACE);
        refund += MAT_VAPE_FLOOR;
        changed.push(t);
      }
    }

    // Only clean up orphaned walls — do NOT create new walls.
    // An orphaned wall is one that no longer borders any floor.
    if (changed.length > 0) {
      this.wallAutoGen.cleanupOrphans(changed);
    }

    return refund;
  }
}
