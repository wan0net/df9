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
  },
};
