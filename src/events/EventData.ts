/**
 * EventData.ts — Event definitions and weights.
 * Mirrors GameEvents/EventData.lua.
 */

export interface EventDef {
  name: string;
  weight: number;
  /** Minimum population to trigger. */
  minPopulation: number;
  /** Minimum sim time before this event can fire. */
  minTime: number;
  /** Cooldown between instances. */
  cooldown: number;
  /** Whether this is a hostile event (for difficulty scaling). */
  hostile?: boolean;
}

export const EVENT_DEFS: Record<string, EventDef> = {
  Immigration: {
    name: 'Immigration',
    weight: 30,
    minPopulation: 0,
    minTime: 400,
    cooldown: 300,
  },
  Derelict: {
    name: 'Derelict Ship',
    weight: 15,
    minPopulation: 3,
    minTime: 600,
    cooldown: 600,
  },
  Meteor: {
    name: 'Meteor Shower',
    weight: 10,
    minPopulation: 3,
    minTime: 800,
    cooldown: 500,
  },
  HostileImmigration: {
    name: 'Hostile Immigration',
    weight: 8,
    minPopulation: 6,
    minTime: 1200,
    cooldown: 600,
    hostile: true,
  },
  Breaching: {
    name: 'Breaching',
    weight: 5,
    minPopulation: 5,
    minTime: 1500,
    cooldown: 800,
    hostile: true,
  },
  HostileDocking: {
    name: 'Hostile Docking',
    weight: 4,
    minPopulation: 8,
    minTime: 2000,
    cooldown: 900,
    hostile: true,
  },
  Docking: {
    name: 'Docking',
    weight: 20,
    minPopulation: 2,
    minTime: 500,
    cooldown: 400,
  },
};

// ── Difficulty scaling constants ────────────────────────────────────

/** Max elapsed time for difficulty scaling (16 hours = 57600s). */
export const DIFFICULTY_MAX_TIME = 57600;

/** Base raider count at difficulty 0. */
export const BASE_RAIDER_COUNT = 1;
/** Max additional raiders from difficulty. */
export const MAX_EXTRA_RAIDERS = 4;

/** Base raider HP at difficulty 0. */
export const BASE_RAIDER_HP = 100;
/** Max additional HP from difficulty. */
export const MAX_EXTRA_HP = 50;

/** Compound event (final siege) trigger time (6 hours = 21600s). */
export const COMPOUND_EVENT_TIME = 21600;

// ── Forecast constants ──────────────────────────────────────────────

/** Number of events in the forecast queue. */
export const FORECAST_SIZE = 15;
/** Alert time before event fires. */
export const FORECAST_ALERT_TIME = 45;
/** Min seconds between events. */
export const MIN_EVENT_GAP = 135;
/** Max seconds between events. */
export const MAX_EVENT_GAP = 600;
