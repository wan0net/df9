import { beforeEach, describe, expect, it } from 'vitest';
import { EnvObjectManager } from '../../src/envobjects/EnvObjectManager';
import { OxygenSystem } from '../../src/oxygen/OxygenSystem';
import { VacuumSystem } from '../../src/oxygen/VacuumSystem';
import { TileGrid } from '../../src/world/TileGrid';

function breachedRoom() {
  let oxygen = 0;
  return {
    id: 1,
    tiles: [{ x: 10, y: 10 }],
    sealed: false,
    bUserBlockOxygen: false,
    zoneObj: null,
    nCharacters: 0,
    nFireTiles: 0,
    tContiguousRooms: [],
    setOxygenStats: (display: number) => { oxygen = display; },
    invalidateOxygenScore: () => undefined,
    get oxygen() { return oxygen; },
  };
}

describe('oxygen vacuum drain', () => {
  beforeEach(() => EnvObjectManager.clearAll());

  it('is invariant to frame partitioning', () => {
    const run = (steps: number, milliseconds: number) => {
      const grid = new TileGrid();
      const room = breachedRoom();
      grid.setO2(10, 10, 65_535);
      const rooms = {
        getRooms: () => [room],
        getRoomAt: () => room,
      };
      const oxygen = new OxygenSystem(rooms as never, grid);
      oxygen.setCharacterProvider(() => []);
      for (let i = 0; i < steps; i++) oxygen.update(milliseconds);
      return grid.getO2(10, 10);
    };

    expect(run(10, 100)).toBe(run(4, 250));
    expect(run(10, 100)).toBe(run(1, 1_000));
  });
});

describe('vacuum vectors', () => {
  it('ticks on a fixed interval and points toward lower adjacent oxygen', () => {
    const grid = new TileGrid();
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) grid.setO2(x, y, 65_535);
    }
    grid.setO2(10, 10, 40);
    grid.setO2(9, 9, 0);
    const vacuum = new VacuumSystem(grid, 100);

    vacuum.update(99);
    expect(vacuum.getVacuumVec(10, 10).magnitude).toBe(0);
    vacuum.update(1);

    expect(vacuum.isVacuumTile(10, 10)).toBe(true);
    expect(vacuum.getVacuumVec(10, 10).magnitude).toBeGreaterThan(0);
  });
});
