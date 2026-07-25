import { describe, expect, it } from 'vitest';
import { ResearchSystem } from '../../src/research/ResearchSystem';
import { ResearchZone } from '../../src/zones/ResearchZone';
import { ResearchInLab } from '../../src/utility/tasks/ResearchInLab';

function scientist(competency = 0.5) {
  return {
    id: 1,
    getEffectiveCompetency: () => competency,
    needs: { satisfy: () => undefined },
    addJobExperience: () => undefined,
  };
}

function completeWork(zone: ResearchZone, system: ResearchSystem) {
  const task = new ResearchInLab(zone, system);
  task.start(scientist() as never);
  task.update(30);
}

describe('per-lab research', () => {
  it('tracks two lab projects globally by key while an unassigned desk adds nothing', () => {
    const system = new ResearchSystem();
    const suitsLab = new ResearchZone();
    const plantsLab = new ResearchZone();
    const unassignedLab = new ResearchZone();
    suitsLab.setActiveResearch('SpaceSuit2');
    plantsLab.setActiveResearch('PlantLevel2');

    completeWork(suitsLab, system);
    completeWork(plantsLab, system);
    completeWork(unassignedLab, system);

    expect(system.getProgress('SpaceSuit2')).toBe(50);
    expect(system.getProgress('PlantLevel2')).toBe(50);
    expect(system.getProgressData()).toEqual({
      SpaceSuit2: 50,
      PlantLevel2: 50,
    });
  });

  it('preserves progress when work switches projects and completes only that key', () => {
    const system = new ResearchSystem();
    system.addProgress('SpaceSuit2', 500);
    system.addProgress('PlantLevel2', 300);
    system.addProgress('SpaceSuit2', 700);

    expect(system.isCompleted('SpaceSuit2')).toBe(true);
    expect(system.isCompleted('PlantLevel2')).toBe(false);
    expect(system.getProgress('SpaceSuit2')).toBe(1200);
    expect(system.getProgress('PlantLevel2')).toBe(300);
  });

  it('rejects unknown, discovery-only, and prerequisite-locked projects', () => {
    const system = new ResearchSystem();
    expect(system.addProgress('unknown', 100)).toBe(false);
    expect(system.addProgress('MaintenanceLevel2Discovered', 100)).toBe(false);
    expect(system.addProgress('MaintenanceLevel2', 100)).toBe(false);
    expect(system.getProgressData()).toEqual({});
  });

  it('loads legacy active progress and the new per-key save representation', () => {
    const legacy = new ResearchSystem();
    legacy.loadSaveData({ active: 'SpaceSuit2', progress: 75, completed: [] });
    expect(legacy.getProgress('SpaceSuit2')).toBe(75);

    const keyed = new ResearchSystem();
    keyed.loadSaveData({
      active: null,
      progress: 0,
      completed: [],
      progressByKey: { SpaceSuit2: 80, PlantLevel2: 90 },
    });
    expect(keyed.getProgressData()).toEqual({ SpaceSuit2: 80, PlantLevel2: 90 });
  });
});
