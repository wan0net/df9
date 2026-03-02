import { TileGrid } from './TileGrid';
import { TileType } from './TileTypes';
import { ZoneType, ZONE_SPRITES } from './ZoneType';

/**
 * Wall direction enum — matches original Lua World.wallDirections.
 * Determines the visual shape of a wall tile based on neighboring walls.
 */
export enum WallDirection {
  INVALID = -1,
  NWSE = 1,       // Straight wall "\" direction (flip of NESW)
  NESW = 2,       // Straight wall "/" direction
  V = 3,          // Corner pointing north (∧)
  CARAT = 4,      // Corner pointing south (∨)
  LESSTHAN = 5,   // Corner pointing east (<)
  GREATERTHAN = 6,// Corner pointing west (>)
  X = 7,          // Cross (4-way junction)
  PILLAR = 8,     // Isolated pillar (no wall neighbors)
  T_NE = 9,       // T-junction with stem NE
  T_SE = 10,      // T-junction with stem SE
  T_SW = 11,      // T-junction with stem SW
  T_NW = 12,      // T-junction with stem NW
}

/**
 * Sprite keys for bottom and top wall layers, plus flip flag.
 */
export interface WallSpriteInfo {
  bottomKey: string;
  topKey: string;
  flip: boolean;
}

function isWallOrDoor(grid: TileGrid, x: number, y: number): boolean {
  if (!grid.inBounds(x, y)) return false;
  const t = grid.get(x, y);
  return t === TileType.WALL || t === TileType.DOOR;
}

/**
 * Compute wall direction from diagonal neighbors, matching the original
 * Lua _getWallDirection / _getWallTileDetails logic exactly.
 *
 * Checks which diagonal neighbors are WALL or DOOR, then selects
 * the direction based on the configuration.
 */
export function getWallDirection(grid: TileGrid, x: number, y: number): WallDirection {
  const odd = y & 1;
  const xLeft = odd ? 0 : -1;

  // Diagonal neighbors in the staggered grid.
  // y-1 = screen UP = visual North; y+1 = screen DOWN = visual South.
  // xLeft side = screen LEFT; xLeft+1 side = screen RIGHT.
  const nw = isWallOrDoor(grid, x + xLeft, y - 1);
  const ne = isWallOrDoor(grid, x + xLeft + 1, y - 1);
  const sw = isWallOrDoor(grid, x + xLeft, y + 1);
  const se = isWallOrDoor(grid, x + xLeft + 1, y + 1);

  // Exact match: original _getWallTileDetails priority order
  // Straight pieces: full NE+SW line or full NW+SE line
  if (ne && !se && sw && !nw) return WallDirection.NESW;
  if (!ne && se && !sw && nw) return WallDirection.NWSE;

  // 2-neighbor corners
  if (!ne && se && sw && !nw) return WallDirection.CARAT;
  if (ne && se && !sw && !nw) return WallDirection.LESSTHAN;
  if (ne && !se && !sw && nw) return WallDirection.V;
  if (!ne && !se && sw && nw) return WallDirection.GREATERTHAN;

  // T-junctions (3 wall neighbors)
  if (ne && se && !sw && nw) return WallDirection.T_NE;
  if (ne && se && sw && !nw) return WallDirection.T_SE;
  if (!ne && se && sw && nw) return WallDirection.T_SW;
  if (ne && !se && sw && nw) return WallDirection.T_NW;

  // Cross (all 4 wall neighbors)
  if (ne && se && sw && nw) return WallDirection.X;

  // Pillar (no wall neighbors)
  if (!ne && !se && !sw && !nw) return WallDirection.PILLAR;

  // Fallback: single neighbor → treat as straight end-cap
  if (ne || sw) return WallDirection.NESW;
  if (nw || se) return WallDirection.NWSE;

  return WallDirection.PILLAR;
}

/**
 * Map a wall direction + zone to the sprite keys for bottom and top layers.
 * Builds keys dynamically from zone prefix: {Prefix}_Straight01_bottom, etc.
 */
export function getWallSprites(direction: WallDirection, zone: ZoneType = ZoneType.PLAIN): WallSpriteInfo {
  const p = ZONE_SPRITES[zone].wallPrefix;

  switch (direction) {
    case WallDirection.NESW:
      return { bottomKey: `${p}_Straight01_bottom`, topKey: `${p}_Straight01_top`, flip: false };
    case WallDirection.NWSE:
      return { bottomKey: `${p}_Straight01_bottom`, topKey: `${p}_Straight01_top`, flip: true };
    case WallDirection.V:
      return { bottomKey: `${p}_Corner_outer01_bottom`, topKey: `${p}_Corner_outer01_top`, flip: false };
    case WallDirection.CARAT:
      return { bottomKey: `${p}_Corner_inner01_bottom`, topKey: `${p}_Corner_inner01_top`, flip: false };
    case WallDirection.LESSTHAN:
      return { bottomKey: `${p}_Corner_lb_bottom`, topKey: `${p}_Corner_lb_top`, flip: false };
    case WallDirection.GREATERTHAN:
      return { bottomKey: `${p}_Corner_rb_bottom`, topKey: `${p}_Corner_rb_top`, flip: false };
    case WallDirection.T_NE:
      return { bottomKey: `${p}_Corner_T_NE_bottom`, topKey: `${p}_Corner_T_NE_top`, flip: false };
    case WallDirection.T_SE:
      return { bottomKey: `${p}_Corner_T_SE_bottom`, topKey: `${p}_Corner_T_SE_top`, flip: false };
    case WallDirection.T_SW:
      return { bottomKey: `${p}_Corner_T_SW_bottom`, topKey: `${p}_Corner_T_SW_top`, flip: false };
    case WallDirection.T_NW:
      return { bottomKey: `${p}_Corner_T_NW_bottom`, topKey: `${p}_Corner_T_NW_top`, flip: false };
    case WallDirection.X:
      return { bottomKey: `${p}_Corner_cross_bottom`, topKey: `${p}_Corner_cross_top`, flip: false };
    case WallDirection.PILLAR:
      return { bottomKey: `${p}_Corner_cross_bottom`, topKey: `${p}_Corner_cross_top`, flip: false };
    default:
      return { bottomKey: `${p}_Straight01_bottom`, topKey: `${p}_Straight01_top`, flip: false };
  }
}
