import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Door, DOOR_OPERATION, DOOR_STATE } from '../../src/envobjects/Door';
import { Direction, getAdjacentTile } from '../../src/world/TileGrid';
import { TileType } from '../../src/world/TileTypes';

const poweredRoom = {
  zone: 'PLAIN',
  hasPowerFlag: true,
  bUserBlockOxygen: false,
  getOxygenScore: () => 65_535,
};

describe('door Lua parity', () => {
  let oxygen = new Map<string, number>();

  beforeEach(() => {
    oxygen = new Map();
    Door.tileTypeAt = () => TileType.FLOOR;
    Door.tileOxygenAt = (x, y) => oxygen.get(`${x},${y}`) ?? 65_535;
    Door.roomAtTile = () => poweredRoom as never;
    Door.tileObstructionCheck = () => false;
  });

  afterEach(() => {
    Door.resetRegistry();
    Door.tileTypeAt = null;
    Door.tileOxygenAt = null;
    Door.roomAtTile = null;
    Door.tileObstructionCheck = null;
  });

  it.each([
    { flipped: false, west: Direction.NW, east: Direction.SE },
    { flipped: true, west: Direction.SW, east: Direction.NE },
  ])('samples direction-correct side tiles for flipped=$flipped', ({ flipped, west, east }) => {
    const [westX, westY] = getAdjacentTile(20, 20, west);
    const [eastX, eastY] = getAdjacentTile(20, 20, east);
    oxygen.set(`${westX},${westY}`, 99);
    oxygen.set(`${eastX},${eastY}`, 100);

    const door = new Door('Door', 20, 20, flipped);
    door.updateSpaceStatus(poweredRoom as never, poweredRoom as never);

    expect(door.bWestSideVacuum).toBe(true);
    expect(door.bEastSideVacuum).toBe(false);
    expect(door.state).toBe(DOOR_STATE.LOCKED);
  });

  it('forces the requested operation before applying destroyed condition', () => {
    const door = new Door('Door', 20, 20);
    door.setCondition(0);
    door.setOperation(DOOR_OPERATION.FORCED_OPEN);
    expect(door.state).toBe(DOOR_STATE.OPEN);

    door.onTick(0.1);
    expect(door.state).toBe(DOOR_STATE.BROKEN_OPEN);
  });
});
