import { describe, expect, it } from 'vitest';
import { SAVEGAME_VERSION } from '../../src/core/GameRules';
import { EnvObject } from '../../src/envobjects/EnvObject';
import { validateSaveData, type SaveData } from '../../src/save/SaveLoad';

const WIDTH = 256;
const HEIGHT = 256;

function validSave(): SaveData {
  return {
    version: SAVEGAME_VERSION,
    nMatter: 1_000,
    simTime: 10,
    elapsedTime: 10,
    SPACEDATE_BASE: 0,
    playerTimeScale: 1,
    gridWidth: WIDTH,
    gridHeight: HEIGHT,
    gridData: new Array(WIDTH * HEIGHT).fill(1),
    characters: [],
    objects: [],
    research: { active: null, progress: 0, completed: [] },
    roomZones: [],
  };
}

describe('save validation', () => {
  it.each([0, 0.25, 0.5, 1, 2, 4])('accepts supported time scale %s', scale => {
    const save = validSave();
    save.playerTimeScale = scale;
    expect(validateSaveData(save, WIDTH, HEIGHT)).toBe(true);
  });

  it('validates every nested callback payload and identifier', () => {
    const save = validSave();
    save.objects = [{
      schemaVersion: 1,
      kind: 'object',
      sName: 'ResearchDesk',
      tileX: 10,
      tileY: 10,
      wallTileX: 10,
      wallTileY: 9,
    }];
    save.commands = [{ type: 'build_object', tileX: 10, tileY: 10, objectName: 'ResearchDesk' }];
    save.pickups = [{ sName: 'Rock', tileX: 11, tileY: 10 }];
    save.characters = [{
      id: 1,
      tileX: 10,
      tileY: 10,
      name: 'Citizen',
      job: 1,
      team: 1,
      hp: 100,
      maxHP: 100,
      status: 1,
      xp: 0,
      competency: {},
      morale: 0,
      anger: 0,
      nRemainingDutyTime: 0,
      weapon: null,
      bSpacesuit: false,
      nSuitOxygen: 0,
      maladies: [],
      inventory: [{ sTemplate: 'Rock', sName: 'Rock', nCount: 1 }],
    }];
    save.events = {
      forecastGenerated: true,
      compoundEventFired: false,
      bRanMegaEvent: false,
      nMegaEventStartTime: 0,
      galaxyValues: { population: 0.5 },
      forecast: [{
        defName: 'Immigration',
        scheduledTime: 100,
        alertTime: 90,
        alerted: false,
        nFailures: 0,
        bFailed: false,
      }],
      currentEvent: null,
      prevEvents: [],
    };
    save.topics = { tTopics: { topic1: { name: 'Safe', category: 'Bands' } }, counter: 1 };
    save.fires = { tTiles: { '10,10': 2 }, tFlames: { '10,10': 1 } };
    save.factionData = { teamFactions: [[1, 1]], nNextTeamID: 100 };
    save.tutorialState = {
      active: true,
      currentStage: 1,
      stageTimer: 0,
      completedConditions: ['ZoomedView'],
    };
    save.tutorialFlags = { zoomed: true };

    expect(validateSaveData(save, WIDTH, HEIGHT)).toBe(true);

    const invalidMutations: ((candidate: SaveData) => void)[] = [
      candidate => { candidate.objects[0].sName = 'NotAnObject'; },
      candidate => { candidate.characters[0].inventory![0].sTemplate = 'NotAnItem'; },
      candidate => { candidate.commands = [null as never]; },
      candidate => { candidate.pickups![0].sName = 'NotAPickup'; },
      candidate => { (candidate.events as any).forecast[0].defName = 'NotAnEvent'; },
      candidate => { (candidate.fires as any).tFlames = null; },
      candidate => { (candidate.topics as any).tTopics.topic1.category = 5; },
      candidate => { (candidate.factionData as any).teamFactions = [[1]]; },
      candidate => { (candidate.tutorialState as any).completedConditions = [5]; },
      candidate => { (candidate.tutorialFlags as any).zoomed = 'yes'; },
    ];
    for (const mutate of invalidMutations) {
      const candidate = structuredClone(save);
      mutate(candidate);
      expect(validateSaveData(candidate, WIDTH, HEIGHT)).toBe(false);
    }
  });
});

describe('environment object save data', () => {
  it('round-trips the wall tile used by wall demolition', () => {
    const object = new EnvObject('ResearchDesk', 20, 20, true, false);
    object.wallTileX = 19;
    object.wallTileY = 19;

    const restored = EnvObject.fromSaveData(object.getSaveData());

    expect(restored.wallTileX).toBe(19);
    expect(restored.wallTileY).toBe(19);
    expect(restored.bFlipX).toBe(true);
  });
});
