import { TileGrid } from '../world/TileGrid';
import { TileType } from '../world/TileTypes';

interface Node {
  x: number;
  y: number;
  g: number;
  h: number;
  f: number;
  parent: Node | null;
}

/** Chebyshev distance — correct heuristic for diagonal grid (Lua MiscUtil.isoDist). */
function heuristic(ax: number, ay: number, bx: number, by: number): number {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by)) + 1;
}

/** Walkable filter: returns true if a tile type can be traversed. */
export type WalkableFilter = (tileType: number) => boolean;

/** Default filter: FLOOR, DOOR, and PENDING tiles are walkable. */
export const WALKABLE_DEFAULT: WalkableFilter = (t) =>
  t === TileType.FLOOR || t === TileType.DOOR ||
  t === TileType.FLOOR_PENDING || t === TileType.WALL_PENDING;

/** Spacewalk filter: FLOOR, DOOR, SPACE, and PENDING tiles are walkable. */
export const WALKABLE_SPACEWALK: WalkableFilter = (t) =>
  t === TileType.FLOOR || t === TileType.DOOR || t === TileType.SPACE ||
  t === TileType.FLOOR_PENDING || t === TileType.WALL_PENDING;

/**
 * A* pathfinding on the diamond isometric grid.
 * Moves through diagonal neighbors only (edge-sharing tiles).
 * Uses Chebyshev distance heuristic (Lua MiscUtil.isoDist).
 * @param walkableFilter — controls which tile types are traversable.
 * @param bPathToNearest — if true, path to nearest walkable tile adjacent to dest
 *   (used when dest is a wall/asteroid/door for build/mine/interact tasks).
 */
export function findPath(
  grid: TileGrid,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  maxNodes = 1000,
  walkableFilter: WalkableFilter = WALKABLE_DEFAULT,
  bPathToNearest = false,
): { x: number; y: number }[] | null {
  if (startX === endX && startY === endY) return [];

  // If pathToNearest, allow non-walkable dest (we path to adjacent tile)
  if (!bPathToNearest) {
    const endType = grid.get(endX, endY);
    if (!walkableFilter(endType)) return null;
  }

  const open: Node[] = [];
  const closed = new Set<string>();

  const startNode: Node = {
    x: startX,
    y: startY,
    g: 0,
    h: heuristic(startX, startY, endX, endY),
    f: 0,
    parent: null,
  };
  startNode.f = startNode.g + startNode.h;
  open.push(startNode);

  let nodesChecked = 0;

  while (open.length > 0 && nodesChecked < maxNodes) {
    // Find lowest f-cost node (linear scan like Lua)
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[bestIdx].f) bestIdx = i;
    }
    const current = open.splice(bestIdx, 1)[0];
    const key = `${current.x},${current.y}`;

    // Goal check
    if (current.x === endX && current.y === endY) {
      return reconstructPath(current);
    }

    // bPathToNearest: if we're adjacent to the target, we've arrived
    if (bPathToNearest) {
      const neighbors = grid.getDiagonalNeighbors(current.x, current.y);
      for (const n of neighbors) {
        if (n.x === endX && n.y === endY) {
          return reconstructPath(current);
        }
      }
    }

    closed.add(key);
    nodesChecked++;

    // Check diagonal neighbors
    const neighbors = grid.getDiagonalNeighbors(current.x, current.y);
    for (const n of neighbors) {
      const nKey = `${n.x},${n.y}`;
      if (closed.has(nKey)) continue;

      const nType = grid.get(n.x, n.y);

      // For bPathToNearest, treat the dest tile as unwalkable (route around it)
      if (bPathToNearest && n.x === endX && n.y === endY) continue;

      if (!walkableFilter(nType)) continue;

      const g = current.g + 1;
      const existing = open.find(o => o.x === n.x && o.y === n.y);

      if (existing) {
        if (g < existing.g) {
          existing.g = g;
          existing.f = g + existing.h;
          existing.parent = current;
        }
      } else {
        const h = heuristic(n.x, n.y, endX, endY);
        open.push({ x: n.x, y: n.y, g, h, f: g + h, parent: current });
      }
    }
  }

  return null; // No path found
}

function reconstructPath(node: Node): { x: number; y: number }[] {
  const path: { x: number; y: number }[] = [];
  let n: Node | null = node;
  while (n) {
    path.unshift({ x: n.x, y: n.y });
    n = n.parent;
  }
  return path;
}
