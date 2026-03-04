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

function heuristic(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by);
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
 * @param walkableFilter — controls which tile types are traversable.
 *   Defaults to FLOOR + DOOR. Use WALKABLE_SPACEWALK for spacewalking.
 */
export function findPath(
  grid: TileGrid,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  maxNodes = 1000,
  walkableFilter: WalkableFilter = WALKABLE_DEFAULT,
): { x: number; y: number }[] | null {
  if (startX === endX && startY === endY) return [];

  const endType = grid.get(endX, endY);
  if (!walkableFilter(endType)) return null;

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
    // Find lowest f-cost node
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[bestIdx].f) bestIdx = i;
    }
    const current = open.splice(bestIdx, 1)[0];
    const key = `${current.x},${current.y}`;

    if (current.x === endX && current.y === endY) {
      // Reconstruct path
      const path: { x: number; y: number }[] = [];
      let node: Node | null = current;
      while (node) {
        path.unshift({ x: node.x, y: node.y });
        node = node.parent;
      }
      return path;
    }

    closed.add(key);
    nodesChecked++;

    // Check diagonal neighbors
    const neighbors = grid.getDiagonalNeighbors(current.x, current.y);
    for (const n of neighbors) {
      const nKey = `${n.x},${n.y}`;
      if (closed.has(nKey)) continue;

      const nType = grid.get(n.x, n.y);
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
