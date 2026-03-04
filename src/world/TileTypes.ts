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
