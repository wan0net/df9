import { afterEach, describe, expect, it } from 'vitest';
import {
  findPath,
  WALKABLE_DEFAULT,
  WALKABLE_SPACEWALK,
} from '../../src/pathfinding/AStar';
import { TileGrid } from '../../src/world/TileGrid';
import { TileType } from '../../src/world/TileTypes';
import { DOOR_STATE, tDoorsByAddr } from '../../src/envobjects/Door';

function floorRect(grid: TileGrid, minX: number, minY: number, maxX: number, maxY: number) {
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) grid.set(x, y, TileType.FLOOR);
  }
}

function setFakeDoor(x: number, y: number, state: number, sName = 'Door') {
  tDoorsByAddr.set(`${x},${y}`, {
    state,
    sName,
    bTouchesVacuum: sName === 'Airlock',
  } as never);
}

afterEach(() => tDoorsByAddr.clear());

describe('findPath', () => {
  it('uses the original even/odd-row diamond adjacency', () => {
    const grid = new TileGrid();
    expect(grid.getDiagonalNeighbors(10, 10)).toEqual([
      { x: 9, y: 11 }, { x: 10, y: 11 }, { x: 9, y: 9 }, { x: 10, y: 9 },
    ]);
    expect(grid.getDiagonalNeighbors(10, 11)).toEqual([
      { x: 10, y: 12 }, { x: 11, y: 12 }, { x: 10, y: 10 }, { x: 11, y: 10 },
    ]);
  });

  it('does not reuse a path after floor changes to wall', () => {
    const grid = new TileGrid();
    grid.set(10, 10, TileType.FLOOR);
    grid.set(10, 11, TileType.FLOOR);
    grid.set(10, 12, TileType.FLOOR);
    expect(findPath(grid, 10, 10, 10, 12)?.map(n => [n.x, n.y])).toEqual([
      [10, 10], [10, 11], [10, 12],
    ]);
    grid.set(10, 11, TileType.WALL);
    expect(findPath(grid, 10, 10, 10, 12)).toBeNull();
  });

  it('observes a door becoming locked immediately', () => {
    const grid = new TileGrid();
    grid.set(10, 10, TileType.FLOOR);
    grid.set(10, 11, TileType.DOOR);
    grid.set(10, 12, TileType.FLOOR);
    setFakeDoor(10, 11, DOOR_STATE.CLOSED);
    expect(findPath(grid, 10, 10, 10, 12)).not.toBeNull();
    setFakeDoor(10, 11, DOOR_STATE.LOCKED);
    expect(findPath(grid, 10, 10, 10, 12)).toBeNull();
    expect(findPath(grid, 10, 10, 10, 12, 1000, WALKABLE_DEFAULT, {
      allowLockedDoors: true,
    })).not.toBeNull();
  });

  it('keeps distinct soft-block sets larger than 128 entries independent', () => {
    const grid = new TileGrid();
    floorRect(grid, 8, 8, 20, 20);
    const baseline = findPath(grid, 10, 10, 15, 15)!;
    const blockedA = `${baseline[1].x},${baseline[1].y}`;
    const fillers = Array.from({ length: 128 }, (_, i) => `1000,${i}`);
    const setA = new Set([blockedA, ...fillers]);
    const pathA = findPath(grid, 10, 10, 15, 15, 1000, WALKABLE_DEFAULT, false, setA, {
      softBlockPenalty: 1000,
    })!;
    const blockedB = `${pathA[1].x},${pathA[1].y}`;
    const setB = new Set([blockedB, ...fillers]);
    const pathB = findPath(grid, 10, 10, 15, 15, 1000, WALKABLE_DEFAULT, false, setB, {
      softBlockPenalty: 1000,
    })!;
    expect(pathA.map(n => `${n.x},${n.y}`)).not.toContain(blockedA);
    expect(pathB.map(n => `${n.x},${n.y}`)).not.toContain(blockedB);
    expect(pathB).not.toEqual(pathA);
  });

  it('handles invalid, unreachable, maxNodes, and path-to-nearest targets', () => {
    const grid = new TileGrid();
    grid.set(10, 10, TileType.FLOOR);
    grid.set(10, 11, TileType.FLOOR);
    grid.set(10, 12, TileType.FLOOR);
    grid.set(10, 13, TileType.WALL);
    expect(findPath(grid, 10, 10, -1, -1)).toBeNull();
    expect(findPath(grid, 10, 10, 12, 12)).toBeNull();
    expect(findPath(grid, 10, 10, 10, 12, 1)).toBeNull();
    expect(findPath(grid, 10, 12, 10, 13, 1000, WALKABLE_DEFAULT, true)).toEqual([
      { x: 10, y: 12, bSuited: false },
    ]);
  });

  it('puts on and removes a suit when crossing vacuum through an airlock', () => {
    const grid = new TileGrid();
    grid.set(10, 10, TileType.FLOOR);
    grid.set(10, 11, TileType.DOOR);
    for (const [x, y] of [[9, 9], [10, 9], [9, 11], [9, 13], [10, 13]]) {
      grid.set(x, y, TileType.WALL);
    }
    setFakeDoor(10, 11, DOOR_STATE.CLOSED, 'Airlock');
    const outbound = findPath(grid, 10, 10, 10, 12, 1000, WALKABLE_SPACEWALK, {
      startSuited: false,
    });
    expect(outbound?.at(-1)).toEqual({ x: 10, y: 12, bSuited: true });
    const inbound = findPath(grid, 10, 12, 10, 10, 1000, WALKABLE_SPACEWALK, {
      startSuited: true,
    });
    expect(inbound?.at(-1)).toEqual({ x: 10, y: 10, bSuited: false });
  });
});
