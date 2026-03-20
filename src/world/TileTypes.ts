export enum TileType {
  SPACE = 1,
  WALL = 4,
  DOOR = 5,
  WALL_DESTROYED = 6,
  FLOOR = 8,
  /** Planned floor — awaiting builder construction. */
  FLOOR_PENDING = 9,
  /** Planned wall — awaiting builder construction. */
  WALL_PENDING = 10,
}

/**
 * Whether a tile counts as floor for room detection and pathfinding.
 * Mirrors Lua World.countsAsFloor(): checks tile >= ZONE_LIST_START.
 * In our implementation: FLOOR, DOOR, and FLOOR_PENDING are walkable floor.
 */
export function countsAsFloor(tile: number): boolean {
  return tile === TileType.FLOOR || tile === TileType.DOOR || tile === TileType.FLOOR_PENDING;
}

/**
 * Whether a tile counts as a wall for room boundaries.
 * Lua WorldConstants.lua: only WALL (value 4) is a wall boundary.
 * WALL_DESTROYED is a broken wall that allows O2/flood-fill through.
 */
export function countsAsWall(tile: number): boolean {
  return tile === TileType.WALL;
}
