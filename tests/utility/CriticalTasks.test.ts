import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Base } from '../../src/core/Base';
import { AttackEnemy } from '../../src/utility/tasks/AttackEnemy';
import { Eat } from '../../src/utility/tasks/Eat';
import { ExtinguishFireBareHanded } from '../../src/utility/tasks/ExtinguishFireBareHanded';
import { ExtinguishFireWithTool } from '../../src/utility/tasks/ExtinguishFireWithTool';
import { FieldScanAndHeal } from '../../src/utility/tasks/FieldScanAndHeal';
import { FleeThreat } from '../../src/utility/tasks/FleeThreat';
import { GetFieldScanned } from '../../src/utility/tasks/GetFieldScanned';
import { OxygenFleeArea } from '../../src/utility/tasks/OxygenFleeArea';
import { PutOnSuit } from '../../src/utility/tasks/PutOnSuit';
import { VacuumPull } from '../../src/utility/tasks/VacuumPull';

function character(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    tileX: 0,
    tileY: 0,
    screenX: 0,
    screenY: 0,
    moving: false,
    path: [],
    maladies: [],
    needs: { satisfy: vi.fn() },
    tStats: { nHP: 20, nMaxHP: 100 },
    weapon: null,
    addMorale: vi.fn(),
    addJobExperience: vi.fn(),
    takeDamage: vi.fn(),
    spacesuitOn: vi.fn(),
    getEffectiveCompetency: () => 0,
    getMeleeDamage: () => 5,
    isAlive: () => true,
    ...overrides,
  };
}

beforeEach(() => Base.init());
afterEach(() => {
  AttackEnemy.getCharById = null;
  vi.restoreAllMocks();
});

describe('representative survival and duty task lifecycles', () => {
  it('Eat waits for movement, interacts for the Lua duration, and serves one meal', () => {
    const eater = character({ moving: true });
    const source = {
      tileX: 0,
      tileY: 0,
      onInteract: vi.fn(),
      unreserve: vi.fn(),
    };
    const task = new Eat();
    task.rTargetObject = source as never;
    task.start(eater as never);
    task.update(10);
    expect(task.isActive()).toBe(true);

    eater.moving = false;
    task.update(10);

    expect(task.isComplete()).toBe(true);
    expect(eater.addMorale).toHaveBeenCalledOnce();
    expect(Base.tStats.nMealsServed).toBe(1);
    expect(source.onInteract).toHaveBeenCalledTimes(2);
  });

  it('PutOnSuit equips only after four seconds', () => {
    const wearer = character();
    const task = new PutOnSuit();
    task.start(wearer as never);
    task.update(3.99);
    expect(wearer.spacesuitOn).not.toHaveBeenCalled();
    task.update(0.01);
    expect(wearer.spacesuitOn).toHaveBeenCalledOnce();
    expect(task.isComplete()).toBe(true);
  });

  it('OxygenFleeArea and FleeThreat complete at their exact durations', () => {
    const oxygen = new OxygenFleeArea();
    oxygen.start(character() as never);
    oxygen.update(4.99);
    expect(oxygen.isActive()).toBe(true);
    oxygen.update(0.01);
    expect(oxygen.isComplete()).toBe(true);

    const threat = new FleeThreat();
    threat.start(character() as never);
    threat.update(7.99);
    expect(threat.isActive()).toBe(true);
    threat.update(0.01);
    expect(threat.isComplete()).toBe(true);
  });

  it('VacuumPull clears movement and exits immediately below minimum velocity', () => {
    const pulled = character({ moving: true, path: [{ x: 1, y: 1 }] });
    const task = new VacuumPull();
    task.vacuumMagnitude = 5;
    task.start(pulled as never);
    expect(pulled.moving).toBe(false);
    expect(pulled.path).toEqual([]);
    task.update(0.1);
    expect(task.isComplete()).toBe(true);
  });

  it('tool firefighting douses faster while bare-handed firefighting damages the citizen', () => {
    const fire = {
      isOnFire: () => true,
      getNearbyFire: () => null,
      douseTile: vi.fn(),
    };
    const firefighter = character();
    const tool = new ExtinguishFireWithTool(fire as never);
    tool.targetX = 2;
    tool.targetY = 3;
    tool.start(firefighter as never);
    tool.update(4);
    expect(fire.douseTile).toHaveBeenLastCalledWith(2, 3, 20);
    expect(tool.isComplete()).toBe(true);

    fire.douseTile.mockClear();
    const bare = new ExtinguishFireBareHanded(fire as never);
    bare.targetX = 2;
    bare.targetY = 3;
    bare.start(firefighter as never);
    bare.update(6);
    expect(fire.douseTile).toHaveBeenLastCalledWith(2, 3, 12);
    expect(firefighter.takeDamage).toHaveBeenCalledOnce();
    expect(bare.isComplete()).toBe(true);
  });

  it('hospital patient wait and doctor heal complete at their exact durations', () => {
    const patient = character();
    const waiting = new GetFieldScanned();
    waiting.start(patient as never);
    waiting.update(60);
    expect(waiting.isComplete()).toBe(true);

    const doctor = character();
    const healing = new FieldScanAndHeal(patient as never);
    healing.start(doctor as never);
    healing.update(20);
    expect(patient.tStats.nHP).toBeGreaterThan(20);
    expect(patient.tStats.nHP).toBeLessThanOrEqual(100);
    expect(healing.isComplete()).toBe(true);
  });

  it('AttackEnemy completes cleanly when its target is gone', () => {
    AttackEnemy.getCharById = () => undefined;
    const task = new AttackEnemy(99);
    task.start(character() as never);
    task.update(0.1);
    expect(task.isComplete()).toBe(true);
  });
});
