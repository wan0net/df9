import { TileGrid } from '../world/TileGrid';
import { TileType } from '../world/TileTypes';
import type { RoomManager } from '../rooms/RoomManager';
import { DOOR_STATE, tDoorsByAddr } from '../envobjects/Door';

interface Node {
  x: number;
  y: number;
  g: number;
  h: number;
  f: number;
  bSuited: boolean;
  parent: Node | null;
}

export interface PathNode {
  x: number;
  y: number;
  bSuited: boolean;
}

export interface FindPathOptions {
  roomManager?: RoomManager;
  startSuited?: boolean;
  allowLockedDoors?: boolean;
  softBlockPenalty?: number;
  breachPenalty?: number;
  /** @deprecated Paths are no longer cached because grid/door mutations are external. */
  cacheTtlMs?: number;
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

const DEFAULT_SOFT_BLOCK_PENALTY = 6;
const DEFAULT_BREACH_PENALTY = 60;
const AIRLOCK_TRAVERSAL_COST = 15;

// ── Binary min-heap for O(log n) open list ───────────────────────────────

class MinHeap {
  private data: Node[] = [];

  get length(): number { return this.data.length; }

  push(node: Node): void {
    this.data.push(node);
    this.bubbleUp(this.data.length - 1);
  }

  pop(): Node {
    const top = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.data[i].f >= this.data[parent].f) break;
      [this.data[i], this.data[parent]] = [this.data[parent], this.data[i]];
      i = parent;
    }
  }

  private sinkDown(i: number): void {
    const n = this.data.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && this.data[left].f < this.data[smallest].f) smallest = left;
      if (right < n && this.data[right].f < this.data[smallest].f) smallest = right;
      if (smallest === i) break;
      [this.data[i], this.data[smallest]] = [this.data[smallest], this.data[i]];
      i = smallest;
    }
  }
}

/**
 * A* pathfinding on the diamond isometric grid.
 * Moves through diagonal neighbors only (edge-sharing tiles).
 * Uses Chebyshev distance heuristic (Lua MiscUtil.isoDist).
 * Open list uses a binary min-heap for O(log n) extraction.
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
  bPathToNearestOrOptions: boolean | FindPathOptions = false,
  softBlockedTiles?: Set<string>,
  explicitOptions?: FindPathOptions,
): PathNode[] | null {
  const bPathToNearest = typeof bPathToNearestOrOptions === 'boolean' ? bPathToNearestOrOptions : false;
  const options = typeof bPathToNearestOrOptions === 'boolean' ? (explicitOptions ?? {}) : bPathToNearestOrOptions;

  const startType = grid.get(startX, startY);
  const startSuited = options.startSuited ?? (
    startType === TileType.SPACE || walkableFilter === WALKABLE_SPACEWALK
  );

  if (startType === TileType.SPACE && !startSuited) return null;
  if (startX === endX && startY === endY) return [];

  // If pathToNearest, allow non-walkable dest (we path to adjacent tile)
  if (!bPathToNearest) {
    const endType = grid.get(endX, endY);
    if (!walkableFilter(endType)) return null;
  }

  // Lua Pathfinder.lua:264-267 — bCharacterStartOnWallCheat:
  // Characters can end up on wall tiles due to construction. The start tile
  // is never checked against walkableFilter, so they can path off naturally
  // (neighbors that are FLOOR pass the filter and get expanded).

  const open = new MinHeap();
  const closed = new Set<number>();
  // Track best g-score per tile for duplicate detection
  const gScores = new Map<number, number>();

  const startNode: Node = {
    x: startX,
    y: startY,
    g: 0,
    h: heuristic(startX, startY, endX, endY),
    f: 0,
    bSuited: startSuited,
    parent: null,
  };
  startNode.f = startNode.g + startNode.h;
  open.push(startNode);
  gScores.set(startY * grid.width + startX, 0);

  let nodesChecked = 0;

  while (open.length > 0 && nodesChecked < maxNodes) {
    const current = open.pop();
    const idx = current.y * grid.width + current.x;

    // Skip if we already found a better path to this node
    if (closed.has(idx)) continue;
    closed.add(idx);
    nodesChecked++;

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

    // Check diagonal neighbors
    const neighbors = grid.getDiagonalNeighbors(current.x, current.y);
    for (const n of neighbors) {
      const nIdx = n.y * grid.width + n.x;
      if (closed.has(nIdx)) continue;

      const nType = grid.get(n.x, n.y);
      const curType = grid.get(current.x, current.y);

      // For bPathToNearest, treat the dest tile as unwalkable (route around it)
      if (bPathToNearest && n.x === endX && n.y === endY) continue;

      if (!walkableFilter(nType)) continue;

      const transition = resolveSuitAndDoorTransition(
        grid,
        current,
        n.x,
        n.y,
        curType,
        nType,
        options,
      );
      if (!transition.allowed) continue;

      const roomPenalty = getRoomTransitionPenalty(
        options.roomManager,
        current.x,
        current.y,
        n.x,
        n.y,
        transition.nextSuited,
        options.breachPenalty ?? DEFAULT_BREACH_PENALTY,
      );

      const softPenalty = softBlockedTiles?.has(tileKey(n.x, n.y))
        ? (options.softBlockPenalty ?? DEFAULT_SOFT_BLOCK_PENALTY)
        : 0;

      const g = current.g + 1 + transition.additionalCost + roomPenalty + softPenalty;
      const existingG = gScores.get(nIdx);

      if (existingG === undefined || g < existingG) {
        gScores.set(nIdx, g);
        const h = heuristic(n.x, n.y, endX, endY);
        open.push({
          x: n.x,
          y: n.y,
          g,
          h,
          f: g + h,
          bSuited: transition.nextSuited,
          parent: current,
        });
      }
    }
  }

  return null; // No path found
}

function reconstructPath(node: Node): PathNode[] {
  const path: PathNode[] = [];
  let n: Node | null = node;
  while (n) {
    path.unshift({ x: n.x, y: n.y, bSuited: n.bSuited });
    n = n.parent;
  }
  return path;
}

function getRoomTransitionPenalty(
  roomManager: RoomManager | undefined,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  bSuited: boolean,
  breachPenalty: number,
): number {
  if (!roomManager) return 0;

  const srcRoom = roomManager.getRoomAt(fromX, fromY);
  const dstRoom = roomManager.getRoomAt(toX, toY);
  if (!dstRoom) return 0;
  if (dstRoom.sealed) return 0;

  if (!bSuited) {
    if (srcRoom?.sealed ?? false) return breachPenalty;
    return Math.floor(breachPenalty / 2);
  }

  return 2;
}

function resolveSuitAndDoorTransition(
  grid: TileGrid,
  current: Node,
  nextX: number,
  nextY: number,
  curType: number,
  nextType: number,
  options: FindPathOptions,
): { allowed: boolean; nextSuited: boolean; additionalCost: number } {
  let nextSuited = current.bSuited;
  let additionalCost = 0;

  const doorData = resolveDoorForTransition(current.x, current.y, nextX, nextY, curType, nextType);
  if (doorData) {
    const door = doorData.door;
    if (door) {
      const locked = door.state === DOOR_STATE.LOCKED || door.state === DOOR_STATE.BROKEN_CLOSED;
      if (locked && !options.allowLockedDoors) {
        return { allowed: false, nextSuited, additionalCost };
      }

      const isAirlockDoor = door.sName === 'Airlock';
      if (isAirlockDoor && door.bTouchesVacuum) {
        additionalCost += AIRLOCK_TRAVERSAL_COST;
      }

      const parentType = current.parent ? grid.get(current.parent.x, current.parent.y) : curType;

      if (nextType === TileType.SPACE && curType !== TileType.SPACE) {
        if (isAirlockDoor) {
          nextSuited = true;
        } else if (!current.bSuited) {
          return { allowed: false, nextSuited, additionalCost };
        }
      }

      if (curType === TileType.SPACE && nextType !== TileType.SPACE) {
        if (isAirlockDoor) {
          nextSuited = false;
        }
      } else if (curType === TileType.DOOR && nextType !== TileType.SPACE && isAirlockDoor && parentType === TileType.SPACE) {
        nextSuited = false;
      }
    }
  }

  if (nextType === TileType.SPACE && !nextSuited) {
    return { allowed: false, nextSuited, additionalCost };
  }

  return { allowed: true, nextSuited, additionalCost };
}

function resolveDoorForTransition(
  curX: number,
  curY: number,
  nextX: number,
  nextY: number,
  curType: number,
  nextType: number,
): { door: (typeof tDoorsByAddr extends Map<string, infer T> ? T : never) | undefined } | null {
  if (nextType === TileType.DOOR) {
    return { door: tDoorsByAddr.get(tileKey(nextX, nextY)) };
  }
  if (curType === TileType.DOOR) {
    return { door: tDoorsByAddr.get(tileKey(curX, curY)) };
  }
  return null;
}

function tileKey(x: number, y: number): string {
  return `${x},${y}`;
}
