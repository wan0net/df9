import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameRules } from '../../src/core/GameRules';
import { EnvObjectManager } from '../../src/envobjects/EnvObjectManager';
import { PowerSystem } from '../../src/power/PowerSystem';
import { Room } from '../../src/rooms/Room';
import { SoundManager } from '../../src/audio/SoundManager';

function room(id: number, ...tiles: [number, number][]) {
  const result = new Room(id);
  for (const [x, y] of tiles) result.addTile(x, y);
  return result;
}

function consumer(draw: number, rRoom: Room | null) {
  return {
    rRoom,
    tileX: 0,
    tileY: 0,
    bHasPower: false,
    getPowerDraw: () => draw,
  };
}

function harness(rooms: Room[], objects: ReturnType<typeof consumer>[] = []) {
  const roomManager = {
    getRooms: () => rooms,
    getRoomAt: vi.fn(),
  };
  const grid = {
    getDiagonalNeighbors: vi.fn(() => []),
    getAllNeighbors: vi.fn(() => []),
    get: vi.fn(),
  };
  vi.spyOn(EnvObjectManager, 'getObjects').mockReturnValue(objects as never);
  vi.spyOn(EnvObjectManager, 'getObjectsInRoom')
    .mockImplementation(r => objects.filter(o => o.rRoom === r) as never);
  vi.spyOn(EnvObjectManager, 'getRoomPowerOutput').mockReturnValue(0);
  const system = new PowerSystem(grid as never, roomManager as never);
  return { system, grid, roomManager };
}

beforeEach(() => {
  GameRules.bPowerHoliday = false;
});

afterEach(() => {
  vi.restoreAllMocks();
  GameRules.bPowerHoliday = false;
});

describe('PowerSystem distribution', () => {
  it('reports exact room/object draw and consumes room-tile power before props', () => {
    const r = room(1, [0, 0], [1, 0]);
    const a = consumer(3, r);
    const b = consumer(2, r);
    const { system } = harness([r], [a, b]);
    vi.mocked(EnvObjectManager.getRoomPowerOutput).mockReturnValue(6);

    system.update();

    expect(r).toMatchObject({ nPowerOutput: 6, nPowerDraw: 7, nPowerSupply: 6 });
    expect(a.bHasPower).toBe(true);
    expect(b.bHasPower).toBe(false);
  });

  it.each(['door', 'wall'] as const)('shares finite generation across %s connectivity', kind => {
    const source = room(1, [0, 0]);
    const sink = room(2, [2, 0]);
    const load = consumer(4, sink);
    const { system } = harness([source, sink], [load]);
    vi.mocked(EnvObjectManager.getRoomPowerOutput)
      .mockImplementation(r => r === source ? 10 : 0);
    if (kind === 'door') source.tContiguousRooms = [sink];
    else source.tWallAdjacentRooms = [sink];
    vi.spyOn(system as never, 'computeContiguity').mockImplementation(() => undefined);

    system.update();

    expect(source.nPowerSupply).toBe(1);
    expect(sink.nPowerSupply).toBe(5);
    expect(load.bHasPower).toBe(true);
  });

  it('does not share generation between disconnected rooms', () => {
    const source = room(1, [0, 0]);
    const sink = room(2, [4, 0]);
    const load = consumer(1, sink);
    const { system } = harness([source, sink], [load]);
    vi.mocked(EnvObjectManager.getRoomPowerOutput)
      .mockImplementation(r => r === source ? 100 : 0);

    system.update();

    expect(source.nPowerSupply).toBe(1);
    expect(sink.nPowerSupply).toBe(0);
    expect(load.bHasPower).toBe(false);
  });

  it('uses the nearest source first and exhausts generators across a connected blob', () => {
    const near = room(1, [0, 0]);
    const far = room(2, [20, 0]);
    const sink = room(3, [2, 0]);
    const load = consumer(6, sink);
    const { system } = harness([near, far, sink], [load]);
    near.tContiguousRooms = [far, sink];
    far.tContiguousRooms = [near, sink];
    sink.tContiguousRooms = [near, far];
    vi.spyOn(system as never, 'computeContiguity').mockImplementation(() => undefined);
    vi.mocked(EnvObjectManager.getRoomPowerOutput)
      .mockImplementation(r => r === near ? 4 : r === far ? 6 : 0);

    system.update();

    expect(near.nPowerSupply).toBe(1);
    expect(far.nPowerSupply).toBe(1);
    expect(sink.nPowerSupply).toBe(7);
    expect(load.bHasPower).toBe(true);
  });

  it('powers rooms and props during a power holiday without consuming generators', () => {
    const r = room(1, [0, 0]);
    const load = consumer(500, r);
    const { system } = harness([r], [load]);
    GameRules.bPowerHoliday = true;

    system.update();

    expect(r.nPowerSupply).toBe(999);
    expect(load.bHasPower).toBe(true);
  });

  it('assigns an exterior leech to an adjacent room then resets it when removed', () => {
    const r = room(1, [1, 0]);
    const leech = consumer(2, null);
    const { system, grid, roomManager } = harness([r], [leech]);
    vi.mocked(EnvObjectManager.getRoomPowerOutput).mockReturnValue(10);
    grid.getAllNeighbors.mockReturnValue([{ x: 1, y: 0 }]);
    roomManager.getRoomAt.mockReturnValue(r);

    system.update();
    expect(leech.bHasPower).toBe(true);

    grid.getAllNeighbors.mockReturnValue([]);
    system.update();
    expect(leech.bHasPower).toBe(false);
  });

  it('emits one transition sound per state change and none for stable updates', () => {
    const r = room(1, [0, 0]);
    const { system } = harness([r]);
    const sound = vi.spyOn(SoundManager, 'playSfx').mockImplementation(() => undefined);

    vi.mocked(EnvObjectManager.getRoomPowerOutput).mockReturnValue(0);
    system.update();
    system.update();
    expect(sound).not.toHaveBeenCalled();

    vi.mocked(EnvObjectManager.getRoomPowerOutput).mockReturnValue(1);
    system.update();
    system.update();
    expect(sound).toHaveBeenCalledTimes(1);
    expect(sound).toHaveBeenLastCalledWith('PowerUp');

    vi.mocked(EnvObjectManager.getRoomPowerOutput).mockReturnValue(0);
    system.update();
    expect(sound).toHaveBeenCalledTimes(2);
    expect(sound).toHaveBeenLastCalledWith('PowerDown');
  });
});
