import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Base } from '../../src/core/Base';
import { CommandQueue } from '../../src/core/CommandQueue';
import { GameRules, MAT_MINE_ROCK_MIN } from '../../src/core/GameRules';
import { researchSystem } from '../../src/research/ResearchSystem';
import { Task, TASK_STATUS } from '../../src/utility/Task';
import { TileGrid } from '../../src/world/TileGrid';
import { TileType } from '../../src/world/TileTypes';

type TaskConstructor = new (...args: never[]) => Task;
type TaskModule = Record<string, unknown>;

const taskModules = import.meta.glob<TaskModule>(
  '../../src/utility/tasks/*.ts',
  { eager: true },
);

function character(overrides: Record<string, unknown> = {}) {
  return {
    id: 41,
    tileX: 10,
    tileY: 10,
    screenX: 0,
    screenY: 0,
    moving: false,
    path: [],
    maladies: [],
    heldItem: null,
    bSpacewalking: false,
    nAnger: 50,
    nMorale: 0,
    needs: { satisfy: vi.fn() },
    inventory: { hasItem: vi.fn(() => false) },
    tLog: [],
    tLogQueue: [],
    tStats: {
      nHP: 20,
      nMaxHP: 100,
      tCompetency: new Proxy({}, { get: () => 0 }),
      personality: {
        nBravery: 0.5,
        nGregariousness: 0.5,
        nNeatness: 0.5,
        nPositivity: 0.5,
        nTemper: 0.5,
        nWorkEthic: 0.5,
        nAuthoritarian: 0.5,
      },
    },
    weapon: null,
    addMorale: vi.fn(),
    addAnger: vi.fn(),
    addJobExperience: vi.fn(),
    takeDamage: vi.fn(),
    spacesuitOn: vi.fn(),
    getEffectiveCompetency: () => 0,
    getMeleeDamage: () => 5,
    getName: () => 'Contract Tester',
    isAlive: () => true,
    ...overrides,
  };
}

function envObject(overrides: Record<string, unknown> = {}) {
  return {
    tileX: 10,
    tileY: 10,
    bBuilt: true,
    nCondition: 50,
    tData: {
      friendlyName: 'Fixture',
      maintainJob: 0,
      door: false,
    },
    rRoom: null,
    onInteract: vi.fn(),
    unreserve: vi.fn(),
    getCondition: vi.fn(function (this: { nCondition: number }) {
      return this.nCondition;
    }),
    setCondition: vi.fn(function (this: { nCondition: number }, value: number) {
      this.nCondition = value;
    }),
    maintain: vi.fn(),
    markBuilt: vi.fn(),
    ...overrides,
  };
}

function taskClass(module: TaskModule): TaskConstructor {
  const found = Object.values(module).find((value) => (
    typeof value === 'function'
      && value.prototype instanceof Task
  ));
  if (!found) throw new Error('Task module does not export a Task subclass');
  return found as TaskConstructor;
}

const argumentFixtures: Record<string, () => unknown[]> = {
  AttackEnemy: () => [99],
  BedHeal: () => [character()],
  BuildEnvObject: () => [envObject({ bBuilt: false }), 1, new TileGrid()],
  BuildTile: () => [1, new TileGrid()],
  Cuff: () => [99],
  DestroyEnvObject: () => [envObject()],
  ExtinguishFireBareHanded: () => [{
    isOnFire: () => true,
    getNearbyFire: () => null,
    douseTile: vi.fn(),
  }],
  ExtinguishFireWithTool: () => [{
    isOnFire: () => true,
    getNearbyFire: () => null,
    douseTile: vi.fn(),
  }],
  FieldScanAndHeal: () => [character()],
  MaintainEnvObject: () => [envObject()],
  MaintainPlants: () => [envObject()],
  Mine: () => [1, new TileGrid()],
  MonsterAttackEquipment: () => [envObject()],
  PickUpFloorItem: () => [{
    sName: 'Rock',
    bPickedUp: false,
    pickUp: vi.fn(),
  }],
  ResearchInLab: () => [
    { getActiveResearch: () => null },
    { addProgress: vi.fn() },
  ],
  TearDownEnvObjectForResearch: () => [envObject()],
};

function moduleFor(name: string): TaskModule {
  const entry = Object.entries(taskModules).find(([path]) => path.endsWith(`/${name}.ts`));
  if (!entry) throw new Error(`Missing task module ${name}`);
  return entry[1];
}

function construct(name: string): Task {
  const TaskClass = taskClass(moduleFor(name));
  return new TaskClass(...(argumentFixtures[name]?.() ?? []) as never[]);
}

beforeEach(() => {
  Base.init();
  GameRules.init();
  CommandQueue.clear();
  vi.restoreAllMocks();
});

describe('task module contract', () => {
  it('imports and constructs every task module with a meaningful public contract', () => {
    const coveredNames = new Set<string>();

    for (const [path, module] of Object.entries(taskModules)) {
      const fileName = path.split('/').pop()!.replace('.ts', '');
      const task = construct(fileName);
      coveredNames.add(fileName);

      const expectedName = fileName.startsWith('ExtinguishFire')
        ? 'ExtinguishFire'
        : fileName;
      expect(task.name, fileName).toBe(expectedName);
      expect(task.status, fileName).toBe(TASK_STATUS.PENDING);
      expect(Number.isFinite(task.targetX), fileName).toBe(true);
      expect(Number.isFinite(task.targetY), fileName).toBe(true);

      const needs = task.getAdvertisedNeeds();
      expect(Array.isArray(needs), fileName).toBe(true);
      for (const advertised of needs) {
        expect(
          ['duty', 'energy', 'hunger', 'social', 'amusement'].includes(advertised.need),
          `${fileName} advertised an unknown need`,
        ).toBe(true);
        expect(Number.isFinite(advertised.amount), fileName).toBe(true);
      }
    }

    expect(coveredNames.size).toBe(Object.keys(taskModules).length);
    expect(coveredNames.size).toBeGreaterThan(60);
  });
});

describe('representative timed task families', () => {
  const cases = [
    ['Breathe', 3],
    ['BuildBase', 5],
    ['Clean', 8],
    ['Explore', 15],
    ['FireFleeArea', 6],
    ['FleeEmergencyAlarm', 10],
    ['FleeTemperTantrum', 10],
    ['FleeThreat', 8],
    ['GoInside', 2],
    ['GoOutside', 2],
    ['IncapacitatedOnFloor', 30],
    ['MonsterPatrol', 20],
    ['OxygenFleeArea', 5],
    ['PanicThreat', 6],
    ['Patrol', 20],
    ['RaiderFleeThreat', 8],
    ['Starve', 30],
    ['WanderAround', 3],
  ] as const;

  it.each(cases)('%s stays active before %d seconds and completes at the boundary', (name, duration) => {
    const actor = character();
    const task = construct(name);
    task.start(actor as never);

    task.update(duration - 0.001);
    expect(task.isActive()).toBe(true);

    task.update(0.001);
    expect(task.isComplete()).toBe(true);
    for (const reward of task.getAdvertisedNeeds()) {
      expect(actor.needs.satisfy).toHaveBeenCalledWith(reward.need, reward.amount);
    }
    if (task.nJobExperience > 0) {
      expect(actor.addJobExperience).toHaveBeenCalledWith(task.nJobExperience);
    } else {
      expect(actor.addJobExperience).not.toHaveBeenCalled();
    }
  });
});

describe('interaction, interruption, and release families', () => {
  it.each([
    ['EatAtFoodReplicator', 8],
    ['EatPlant', 10],
    ['PlayGameSystem', 15],
    ['WorkOutInGym', 12],
  ] as const)('%s waits for travel, interacts, and releases its reservation', (name, duration) => {
    const actor = character({ moving: true, path: [{ x: 11, y: 11 }] });
    const target = envObject();
    const task = construct(name);
    task.rTargetObject = target as never;
    task.start(actor as never);

    task.update(duration * 2);
    expect(task.isActive()).toBe(true);
    expect(target.onInteract).not.toHaveBeenCalled();

    actor.moving = false;
    actor.path = [];
    task.update(duration);

    expect(task.isComplete()).toBe(true);
    expect(target.onInteract).toHaveBeenNthCalledWith(1, true, actor);
    expect(target.onInteract).toHaveBeenNthCalledWith(2, false, actor);
    expect(target.unreserve).toHaveBeenCalledOnce();
    expect(target.unreserve).toHaveBeenCalledWith(actor.id);
  });

  it('terminal transitions are idempotent and cannot overwrite one another', () => {
    const actor = character();
    const target = envObject();
    const task = construct('Eat');
    task.rTargetObject = target as never;
    task.start(actor as never);
    task.complete();
    task.complete();
    task.fail();

    expect(task.status).toBe(TASK_STATUS.COMPLETE);
    expect(target.unreserve).toHaveBeenCalledOnce();
    expect(actor.needs.satisfy).toHaveBeenCalledOnce();
    expect(actor.addJobExperience).not.toHaveBeenCalled();
  });

  it('Puppet remains active across ticks until explicitly released', () => {
    const task = construct('Puppet') as Task & { release(): void };
    task.start(character() as never);
    task.update(10_000);
    expect(task.isActive()).toBe(true);

    task.release();
    expect(task.isComplete()).toBe(true);
  });

  it('a failed build releases its command claim for another builder', () => {
    const grid = new TileGrid();
    grid.set(5, 5, TileType.FLOOR_PENDING);
    const commandId = CommandQueue.addCommand('build_tile', 5, 5);
    const task = new (taskClass(moduleFor('BuildTile')))(
      commandId,
      grid,
    );
    task.start(character() as never);
    expect(CommandQueue.get(commandId)).toMatchObject({
      assignedTo: 41,
      status: 'in_progress',
    });

    task.fail();
    expect(CommandQueue.get(commandId)).toMatchObject({
      assignedTo: null,
      status: 'pending',
    });
  });

  it('mining an invalid target cancels the obsolete command', () => {
    const grid = new TileGrid();
    grid.set(6, 6, TileType.FLOOR);
    const commandId = CommandQueue.addCommand('mine', 6, 6);
    const task = new (taskClass(moduleFor('Mine')))(commandId, grid);

    task.start(character() as never);

    expect(task.isFailed()).toBe(true);
    expect(CommandQueue.get(commandId)).toBeUndefined();
  });
});

describe('item and security completion hooks', () => {
  it('PickUpFloorItem transfers and consumes the pickup exactly once', () => {
    const actor = character();
    const pickedUp = vi.fn();
    const pickup = {
      sName: 'Rock',
      bPickedUp: false,
      pickUp: vi.fn(function (this: { bPickedUp: boolean }) {
        this.bPickedUp = true;
      }),
    };
    const TaskClass = taskClass(moduleFor('PickUpFloorItem'));
    const task = new TaskClass(pickup, pickedUp);
    task.start(actor as never);
    task.update(1);

    expect(task.isComplete()).toBe(true);
    expect(actor.heldItem).toBe('Rock');
    expect(pickup.pickUp).toHaveBeenCalledOnce();
    expect(pickedUp).toHaveBeenCalledWith(pickup);
  });

  it('DropEverything clears held cargo and rewards its advertised duty penalty', () => {
    const actor = character({ heldItem: 'Corpse' });
    const task = construct('DropEverything');
    task.start(actor as never);
    task.update(1);

    expect(actor.heldItem).toBeNull();
    expect(actor.needs.satisfy).toHaveBeenCalledWith('duty', -10);
  });

  it('DropOffRocks converts the full stack using the Lua competency yield', () => {
    const actor = character({ heldItem: 'Rock' });
    const startingMatter = GameRules.nMatter;
    const TaskClass = taskClass(moduleFor('DropOffRocks'));
    const task = new TaskClass('RefineryDropoff', 3);
    task.start(actor as never);
    task.update(12);

    expect(task.isComplete()).toBe(true);
    expect(actor.heldItem).toBeNull();
    expect(GameRules.nMatter - startingMatter).toBe(3 * MAT_MINE_ROCK_MIN);
    expect(Base.getStats().nRocksRecycled).toBe(1);
    expect(actor.addMorale).toHaveBeenCalledOnce();
  });

  it('DropOffCorpse recycles non-corpse hauling cargo for one matter', () => {
    const actor = character({ heldItem: 'Debris' });
    const startingMatter = GameRules.nMatter;
    const task = construct('DropOffCorpse');
    task.start(actor as never);
    task.update(2);

    expect(task.isComplete()).toBe(true);
    expect(actor.heldItem).toBeNull();
    expect(GameRules.nMatter - startingMatter).toBe(1);
  });

  it('Sabotage damages built equipment and drains the rampager anger', () => {
    const actor = character({ nAnger: 50 });
    const target = envObject({ nCondition: 80, bBuilt: true });
    const TaskClass = taskClass(moduleFor('Sabotage'));
    const task = new TaskClass(target);
    task.start(actor as never);
    task.update(5);

    expect(task.isComplete()).toBe(true);
    expect(target.nCondition).toBe(50);
    expect(actor.nAnger).toBe(25);
  });

  it('MaintainEnvObject waits for travel then repairs through an interaction', () => {
    vi.spyOn(researchSystem, 'isCompleted').mockReturnValue(false);
    const actor = character({ moving: true, path: [{ x: 11, y: 11 }] });
    const target = envObject({
      nCondition: 40,
      maintain: vi.fn(function (this: { nCondition: number }) {
        this.nCondition = 70;
      }),
    });
    const TaskClass = taskClass(moduleFor('MaintainEnvObject'));
    const task = new TaskClass(target);
    task.rTargetObject = target as never;
    task.start(actor as never);
    task.update(30);
    expect(target.maintain).not.toHaveBeenCalled();

    actor.moving = false;
    actor.path = [];
    task.update(15);

    expect(task.isComplete()).toBe(true);
    expect(target.maintain).toHaveBeenCalledWith(40, 0);
    expect(target.nCondition).toBe(70);
    expect(target.onInteract).toHaveBeenCalledTimes(2);
    expect(target.unreserve).toHaveBeenCalledWith(actor.id);
    expect(actor.addMorale).toHaveBeenCalledOnce();
  });

  it('Cuff uses the Lua duty promise and still runs base completion rewards', () => {
    const actor = character();
    const task = construct('Cuff');
    task.start(actor as never);
    task.update(5);

    expect(task.isComplete()).toBe(true);
    expect(task.getAdvertisedNeeds()).toEqual([{ need: 'duty', amount: 10 }]);
    expect(actor.needs.satisfy).toHaveBeenCalledWith('duty', 10);
    expect(actor.addJobExperience).not.toHaveBeenCalled();
  });
});
