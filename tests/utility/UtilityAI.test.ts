import { describe, expect, it, vi } from 'vitest';
import { ActivityOption, PRIORITY } from '../../src/utility/ActivityOption';
import { Task, TASK_STATUS } from '../../src/utility/Task';
import { UtilityAI } from '../../src/utility/UtilityAI';

class ProbeTask extends Task {
  readonly name: string;
  completed = 0;
  failed = 0;

  constructor(name: string) {
    super();
    this.name = name;
  }

  getAdvertisedNeeds() { return []; }
  protected onUpdate() {}
  protected onComplete() { this.completed++; }
  protected onFail() { this.failed++; }
}

const character = { id: 7, tileX: 0, tileY: 0 } as never;

function option(name: string, score: number, priorityLevel = PRIORITY.NORMAL) {
  const result = new ActivityOption(new ProbeTask(name), 3, 4, 0, { priorityLevel });
  vi.spyOn(result, 'evaluate').mockReturnValue(score);
  return result;
}

describe('UtilityAI selection', () => {
  it('requires a strictly higher priority to interrupt and retains equal priority', () => {
    const equal = option('equal', 100, PRIORITY.NORMAL);
    const higher = option('higher', 1, PRIORITY.SURVIVAL_LOW);

    expect(UtilityAI.selectTask(character, [equal], PRIORITY.NORMAL)).toBeNull();
    expect(equal.evaluate).not.toHaveBeenCalled();
    expect(UtilityAI.selectTask(character, [equal, higher], PRIORITY.NORMAL)).toBe(higher.task);
  });

  it('selects the highest score and deterministically retains the first score tie', () => {
    const low = option('low', 2);
    const firstTie = option('first', 9);
    const secondTie = option('second', 9);

    expect(UtilityAI.selectTask(character, [low, firstTie, secondTie])).toBe(firstTie.task);
  });

  it('transfers coordinates, tags, and the target reservation object to the task', () => {
    const selected = option('selected', 10);
    const target = { isFullyReserved: () => false } as never;
    selected.targetX = 12;
    selected.targetY = 14;
    selected.tags = { WorkShift: true, DestOwned: true };
    selected.targetObject = target;

    const task = UtilityAI.selectTask(character, [selected])!;

    expect(task).toMatchObject({
      targetX: 12,
      targetY: 14,
      tags: { WorkShift: true, DestOwned: true },
      rTargetObject: target,
    });
    expect(task.tags).not.toBe(selected.tags);
  });
});

describe('Task reservation and interaction lifecycle', () => {
  it.each([
    ['complete', TASK_STATUS.COMPLETE],
    ['fail', TASK_STATUS.FAILED],
  ] as const)('releases reservations and interactions on %s', (ending, status) => {
    const task = new ProbeTask(ending);
    const target = {
      tileX: 0,
      tileY: 0,
      unreserve: vi.fn(),
      onInteract: vi.fn(),
    };
    task.rTargetObject = target as never;
    task.start(character);
    expect(task.attemptInteractWithObject(target as never, 10)).toBe(true);

    task[ending]();

    expect(task.status).toBe(status);
    expect(target.onInteract).toHaveBeenNthCalledWith(1, true, character);
    expect(target.onInteract).toHaveBeenNthCalledWith(2, false, character);
    expect(target.unreserve).toHaveBeenCalledOnce();
    expect(target.unreserve).toHaveBeenCalledWith(7);
  });

  it('ends an interaction exactly once when its timer expires', () => {
    const task = new ProbeTask('interaction');
    const target = { tileX: 0, tileY: 0, onInteract: vi.fn() };
    task.start(character);
    task.attemptInteractWithObject(target as never, 2);

    expect(task.tickInteraction(1)).toBe(false);
    expect(task.tickInteraction(1)).toBe(true);
    expect(task.tickInteraction(1)).toBe(true);
    expect(target.onInteract).toHaveBeenCalledTimes(2);
  });
});
