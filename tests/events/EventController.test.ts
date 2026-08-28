import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Base } from '../../src/core/Base';
import { GameRules } from '../../src/core/GameRules';
import { Event } from '../../src/events/Event';
import { EventController } from '../../src/events/EventController';
import { EVENT_DEFS, FORECAST_SIZE, POPULATION_CAP } from '../../src/events/EventData';

type ControllerInternals = EventController & {
  pickWeightedEvent(
    atTime: number,
    lastType: string,
    consecutiveCount: number,
    populationEstimate: number,
  ): typeof EVENT_DEFS[string] | null;
  processForecast(): void;
  createEvent(def: typeof EVENT_DEFS[string]): Event | null;
  forecast: unknown[];
  forecastGenerated: boolean;
  prevEvents: { sEventType: string; nCompletionTime: number }[];
  currentEventEntry: unknown;
};

class CompletingEvent extends Event {
  readonly name = 'probe';
  readonly description = 'probe';
  updates = 0;
  protected onUpdate() {
    this.updates++;
    this.complete();
  }
}

let now = 0;
let originals: Record<string, typeof EVENT_DEFS[string]>;

function controller(random = () => 0) {
  return new EventController({
    random,
    elapsedTime: () => now,
    simTime: () => now + 100,
  });
}

function isolate(key: string) {
  for (const def of Object.values(EVENT_DEFS)) {
    def.weight = 0;
    def.maxPopulation = 0;
  }
  EVENT_DEFS[key].weight = 1;
  EVENT_DEFS[key].maxPopulation = -1;
  return EVENT_DEFS[key];
}

beforeEach(() => {
  now = 0;
  GameRules.bSandboxMode = false;
  GameRules.bRunning = true;
  Base.init();
  originals = Object.fromEntries(
    Object.entries(EVENT_DEFS).map(([key, def]) => [key, { ...def }]),
  );
});

afterEach(() => {
  for (const [key, def] of Object.entries(originals)) Object.assign(EVENT_DEFS[key], def);
  GameRules.bSandboxMode = false;
});

describe('event eligibility', () => {
  it('uses Lua strict population/time boundaries with an OR gate', () => {
    const def = isolate('Meteor');
    def.minPopulation = 4;
    def.minTime = 600;
    const c = controller() as ControllerInternals;

    expect(c.pickWeightedEvent(600, '', 0, 4)).toBe(EVENT_DEFS.Immigration);
    expect(c.pickWeightedEvent(601, '', 0, 4)).toBe(def);
    expect(c.pickWeightedEvent(600, '', 0, 5)).toBe(def);
  });

  it('enforces maximum population at the exact boundary', () => {
    const def = isolate('Immigration');
    def.maxPopulation = POPULATION_CAP;
    const c = controller() as ControllerInternals;

    expect(c.pickWeightedEvent(0, '', 0, POPULATION_CAP - 1)).toBe(def);
    expect(c.pickWeightedEvent(0, '', 0, POPULATION_CAP)).toBe(EVENT_DEFS.Immigration);
  });

  it('filters hostile events in sandbox below 100 population', () => {
    const def = isolate('HostileImmigration');
    def.minPopulation = -1;
    def.minTime = -1;
    GameRules.bSandboxMode = true;
    const c = controller() as ControllerInternals;

    expect(c.pickWeightedEvent(0, '', 0, 99)).toBe(EVENT_DEFS.Immigration);
    expect(c.pickWeightedEvent(0, '', 0, 100)).toBe(def);
  });

  it('enforces hidden/exterior room minimum and maximum gates', () => {
    const docking = isolate('Docking');
    docking.minPopulation = -1;
    docking.minTime = -1;
    docking.nMinUndiscoveredRooms = 2;
    const c = controller() as ControllerInternals;
    c.getHiddenRoomCount = () => 1;
    expect(c.pickWeightedEvent(0, '', 0, 10)).toBe(EVENT_DEFS.Immigration);
    c.getHiddenRoomCount = () => 2;
    expect(c.pickWeightedEvent(0, '', 0, 10)).toBe(docking);

    const hostile = isolate('HostileDerelict');
    hostile.minPopulation = -1;
    hostile.minTime = -1;
    hostile.nMaxUndiscoveredRooms = 15;
    c.getHiddenRoomCount = () => 15;
    expect(c.pickWeightedEvent(0, '', 0, 20)).toBe(EVENT_DEFS.Immigration);
    c.getHiddenRoomCount = () => 14;
    expect(c.pickWeightedEvent(0, '', 0, 20)).toBe(hostile);
  });

  it('blocks a third consecutive event and falls back when all weights are zero', () => {
    const meteor = isolate('Meteor');
    meteor.minPopulation = -1;
    meteor.minTime = -1;
    const c = controller() as ControllerInternals;

    expect(c.pickWeightedEvent(0, meteor.name, 2, 10)).toBe(EVENT_DEFS.Immigration);
    meteor.weight = 0;
    expect(c.pickWeightedEvent(0, '', 0, 10)).toBe(EVENT_DEFS.Immigration);
  });
});

describe('forecast, lifecycle, and persistence', () => {
  it('uses injected clock/RNG to generate a deterministic full forecast', () => {
    now = 400;
    const c = controller(() => 0.5);
    c.setPopulation(0);
    c.setPopulation(10);
    (c as ControllerInternals).forecastGenerated = false;

    c.onTick(0);

    const forecast = c.getForecast();
    expect(forecast).toHaveLength(FORECAST_SIZE);
    expect(forecast[0].scheduledTime).toBe(420);
    expect(forecast.every((entry, i) => i === 0 || entry.scheduledTime > forecast[i - 1].scheduledTime)).toBe(true);
  });

  it('ticks only one active event and completes it before forecast processing resumes', () => {
    const c = controller();
    c.setPopulation(1);
    const event = new CompletingEvent();
    event.start(0);
    c.injectEvent(event);

    c.onTick(1);

    expect(event.updates).toBe(1);
    expect(c.getActiveEvents()).toEqual([]);
  });

  it('honors setup failure limits and records the failed event in history', () => {
    now = 500;
    const c = controller() as ControllerInternals;
    c.setPopulation(POPULATION_CAP);
    c.forecastGenerated = true;
    c.forecast = [{
      def: EVENT_DEFS.Immigration,
      scheduledTime: now,
      alertTime: now - 1,
      alerted: false,
      nFailures: 0,
      bFailed: false,
    }];

    c.processForecast();

    expect(c.getActiveEvents()).toHaveLength(0);
    expect(c.forecast).toHaveLength(0);
    expect(c.prevEvents).toEqual([
      { sEventType: EVENT_DEFS.Immigration.sEventType, nCompletionTime: now },
    ]);
  });

  it('round-trips forecast timing/failure state, history, galaxy state, and an active event', () => {
    const source = controller() as ControllerInternals;
    source.forecastGenerated = true;
    source.forecast = [{
      def: EVENT_DEFS.Meteor,
      scheduledTime: 900,
      alertTime: 850,
      alerted: true,
      nFailures: 2,
      bFailed: true,
    }];
    source.prevEvents = [{ sEventType: 'immigrationEvents', nCompletionTime: 321 }];
    const active = source.createEvent(EVENT_DEFS.Immigration)!;
    active.status = 1;
    active.startTime = 700;
    active.elapsedTime = 4;
    source.injectEvent(active);
    source.currentEventEntry = {
      def: EVENT_DEFS.Immigration,
      scheduledTime: 700,
      alertTime: 655,
      alerted: true,
      nFailures: 0,
      bFailed: false,
    };
    source.setGalaxyValues({ population: 0.2, hostility: 0.8 });

    const saved = source.getSaveData();
    const restored = controller() as ControllerInternals;
    restored.loadSaveData(saved);

    expect(restored.getSaveData()).toEqual(saved);
    expect(restored.getActiveEvents()[0]).toMatchObject({
      name: 'Immigration',
      status: 1,
      startTime: 700,
      elapsedTime: 4,
    });
  });
});
