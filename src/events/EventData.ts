/**
 * EventData.ts — Event definitions and weights.
 * Mirrors EventController.lua + Event.lua: per-class weights,
 * population/time gates, galaxy-position modifiers, difficulty formula.
 */

// ── Event class definition ────────────────────────────────────────

export interface EventDef {
  name: string;
  /** Lua event type key. */
  sEventType: string;
  /** Default weight for random selection. */
  nDefaultWeight: number;
  /** Runtime weight (adjusted by galaxy position). */
  weight: number;
  /** Minimum population to trigger (-1 = always). */
  minPopulation: number;
  /** Maximum population (-1 = no limit). */
  maxPopulation: number;
  /** Minimum elapsed time before this event can fire (-1 = always). */
  minTime: number;
  /** Whether this is a hostile event. */
  bHostile: boolean;
  /** Galaxy map key for exponential modifier. */
  sExpMod: string;
  /** Chance characters obey refusal (0-1). */
  nChanceObey: number;
  /** Chance event spawns hostiles (0-1). */
  nChanceHostile: number;
  /** Skip alert before event. */
  bSkipAlert?: boolean;
  /** Max allowed preExecuteSetup failures before skipping (Lua default 30, Immigration 0). */
  nAllowedSetupFailures?: number;
  /** Max undiscovered rooms for this event to be eligible (-1 = no limit). */
  nMaxUndiscoveredRooms?: number;
  /** Max exterior rooms for this event to be eligible (-1 = no limit). */
  nMaxExteriorRooms?: number;
  /** Min exterior rooms for this event to be eligible (-1 = no limit). */
  nMinExteriorRooms?: number;
  /** Min undiscovered rooms for this event to be eligible (-1 = no limit). */
  nMinUndiscoveredRooms?: number;
  /** Estimated population change when this event fires (for forecast accumulation). */
  nPopulationDelta?: number;
  /** Linecode key for forecast alert (Lua: sAlertLC). */
  sAlertLC?: string;
}

// ── Population cap (from Lua BootConfig.lua) ──────────────────────

export const POPULATION_CAP = 50;

// ── Event definitions matching Lua exactly ────────────────────────

export const EVENT_DEFS: Record<string, EventDef> = {
  Immigration: {
    name: 'Immigration',
    sEventType: 'immigrationEvents',
    nDefaultWeight: 60,
    weight: 60,
    minPopulation: -1,
    maxPopulation: POPULATION_CAP,
    minTime: -1,
    bHostile: false,
    sExpMod: 'population',
    nChanceObey: 0.66,
    nChanceHostile: 0,
    nAllowedSetupFailures: 0,
    nPopulationDelta: 3,
    sAlertLC: 'ALERTS028TEXT',  // Lua ImmigrationEvent.lua:27
  },
  HostileImmigration: {
    name: 'Hostile Immigration',
    sEventType: 'hostileImmigrationEvents',
    nDefaultWeight: 15,
    weight: 15,
    minPopulation: 6,
    maxPopulation: -1,
    minTime: 720,  // 12 minutes
    bHostile: true,
    sExpMod: 'population',
    nChanceObey: 0.33,
    nChanceHostile: 1,
    nPopulationDelta: -1,
    sAlertLC: 'ALERTS028TEXT',  // Lua HostileImmigrationEvent.lua:16
  },
  Meteor: {
    name: 'Meteor Shower',
    sEventType: 'meteorEvents',
    nDefaultWeight: 10,
    weight: 10,
    minPopulation: 4,
    maxPopulation: -1,
    minTime: 600,  // 10 minutes
    bHostile: false,
    sExpMod: 'asteroids',
    nChanceObey: 0,
    nChanceHostile: 0,
    sAlertLC: 'ALERTS026TEXT',  // Lua MeteorEvent.lua:20
  },
  Breaching: {
    name: 'Breaching',
    sEventType: 'breachingEvents',
    nDefaultWeight: 10, // E-13: Lua uses 10 (forecast) or 16 (no exterior rooms)
    weight: 10,
    minPopulation: 9,
    maxPopulation: -1,
    minTime: 600,  // 10 minutes
    bHostile: true,
    sExpMod: 'population',
    nChanceObey: 0,
    nChanceHostile: 1,
    bSkipAlert: true,
    sAlertLC: 'ALERTS031TEXT',  // Lua: breaching event alert
  },
  Derelict: {
    name: 'Derelict Ship',
    sEventType: 'friendlyDerelictEvents',
    nDefaultWeight: 5,
    weight: 5,
    minPopulation: 4,
    maxPopulation: POPULATION_CAP,
    minTime: 600,  // 10 minutes
    bHostile: false,
    sExpMod: 'population',
    nChanceObey: 1,
    nChanceHostile: 0,
    nPopulationDelta: 1,
    bSkipAlert: true,  // Lua DerelictEvent.lua:22
    sAlertLC: 'ALERTS023TEXT',  // Lua DerelictEvent.lua:19
  },
  HostileDerelict: {
    name: 'Hostile Derelict',
    sEventType: 'hostileDerelictEvents',
    nDefaultWeight: 10,
    weight: 10,
    minPopulation: 12,
    maxPopulation: -1,
    minTime: 900,  // 15 minutes
    bHostile: true,
    sExpMod: 'population',
    nChanceObey: 0,
    nChanceHostile: 1,
    nPopulationDelta: -1,
    nMaxUndiscoveredRooms: 15,  // Lua HostileDerelictEvent.lua:22
    bSkipAlert: true,  // inherits from DerelictEvent
    sAlertLC: 'ALERTS023TEXT',  // inherits from DerelictEvent
  },
  Docking: {
    name: 'Docking',
    sEventType: 'friendlyDockingEvents',
    nDefaultWeight: 5,
    weight: 5,
    minPopulation: 9,
    maxPopulation: POPULATION_CAP,
    minTime: 900,  // 15 minutes
    bHostile: false,
    sExpMod: 'population',
    nChanceObey: 1,
    nChanceHostile: 0,
    nPopulationDelta: 2,
    nMinUndiscoveredRooms: 2,  // Lua DockingEvent.lua:26
    sAlertLC: 'ALERTS028TEXT',  // Lua DockingEvent.lua:18
  },
  HostileDocking: {
    name: 'Hostile Docking',
    sEventType: 'hostileDockingEvents',
    nDefaultWeight: 5,
    weight: 5,
    minPopulation: 21,
    maxPopulation: -1,
    minTime: 1200,  // 20 minutes
    bHostile: true,
    sExpMod: 'population',
    nChanceObey: 0.33,
    nChanceHostile: 0.66,
    nPopulationDelta: -1,
    sAlertLC: 'ALERTS028TEXT',  // inherits from DockingEvent
  },
  Trader: {
    name: 'Trader',
    sEventType: 'traderEvents',
    nDefaultWeight: 25,
    weight: 25,
    minPopulation: 6,
    maxPopulation: 6,
    minTime: 720, // 60*12
    bHostile: false,
    sExpMod: 'population',
    nChanceObey: 0.66,
    nChanceHostile: 0,
    nPopulationDelta: 1,
    sAlertLC: 'ALERTS028TEXT',  // Lua TraderEvent.lua:11
  },
  CompoundEvent: {
    name: 'Compound Event',
    sEventType: 'CompoundEvent',
    nDefaultWeight: 1,
    weight: 1,
    minPopulation: 25,
    maxPopulation: -1,
    minTime: 1800,  // 30 minutes
    bHostile: true,
    sExpMod: 'population',
    nChanceObey: 0.33,
    nChanceHostile: 1,
    bSkipAlert: true,
    nPopulationDelta: -3,
    sAlertLC: 'ALERTS040TEXT',  // Lua CompoundEvent.lua:27
  },
};

// ── Difficulty scaling constants ────────────────────────────────────

/** Max elapsed time for difficulty scaling (16 hours). */
export const DIFFICULTY_MAX_TIME = 57600;

/** Population cap for difficulty formula. */
export const DIFFICULTY_POP_CAP = POPULATION_CAP;

/** Time weight in difficulty formula (Lua: 0.75). */
export const DIFFICULTY_TIME_WEIGHT = 0.75;

/** Population weight in difficulty formula (Lua: 0.25). */
export const DIFFICULTY_POP_WEIGHT = 0.25;

/** Base raider count at difficulty 0. */
export const BASE_RAIDER_COUNT = 1;
/** Max additional raiders from difficulty. */
export const MAX_EXTRA_RAIDERS = 4;
/** Base raider HP at difficulty 0. */
export const BASE_RAIDER_HP = 100;
/** Max additional HP from difficulty. */
export const MAX_EXTRA_HP = 50;

// ── Final siege ─────────────────────────────────────────────────────

/** Compound event (final siege) trigger time (6 hours — Lua: 60*60*6). */
export const COMPOUND_EVENT_TIME = 21600;

/** Mega event weight when eligible (overrides nDefaultWeight=1). */
export const MEGA_EVENT_WEIGHT = 60;

// ── Forecast constants ──────────────────────────────────────────────

/** Number of events in the forecast queue. */
export const FORECAST_SIZE = 15;
/** Alert time before event fires (Lua: tAlertTimeRange = {45, 45}). */
export const FORECAST_ALERT_TIME = 45;

/** First event time range (Lua: tFirstEventTimeRange = {400, 440}). */
export const FIRST_EVENT_TIME_MIN = 400;
export const FIRST_EVENT_TIME_MAX = 440;

/** Previous events retained. */
export const PREV_EVENTS_COUNT = 10;

/** Max consecutive same-event allowed in forecast (Lua: nConsecutiveEvents < 3 → max 2). */
export const MAX_CONSECUTIVE_SAME = 2;

/** Chance of malady on incoming characters (Lua: Event.nChanceOfMalady = 15). */
export const CHANCE_OF_MALADY = 15;

// ── Galaxy position modifier ────────────────────────────────────────

/**
 * Compute exponential modifier from galaxy map value.
 * Mirrors Lua Event._getExpMod():
 *   modifier = 0.5 * 2^(2 * galaxyValue)
 * galaxyValue 0.0 → 0.5x,  0.5 → 1.0x,  1.0 → 2.0x
 */
export function getExpMod(galaxyValue: number): number {
  return 0.5 * Math.pow(2, 2 * galaxyValue);
}

/**
 * Compute difficulty factor (0-1).
 * Mirrors Lua Event.getDifficulty():
 *   x = (min(time, maxTime)/maxTime * 0.75) + (min(pop, popCap)/popCap * 0.25)
 */
export function getDifficulty(elapsedTime: number, population: number): number {
  const timeComponent = Math.min(elapsedTime, DIFFICULTY_MAX_TIME) / DIFFICULTY_MAX_TIME * DIFFICULTY_TIME_WEIGHT;
  const popComponent = Math.min(population, DIFFICULTY_POP_CAP) / DIFFICULTY_POP_CAP * DIFFICULTY_POP_WEIGHT;
  return timeComponent + popComponent;
}

/**
 * Compute challenge level from difficulty.
 * Mirrors Lua getChallengeLevel():
 *   nChallenge = clamp(0, 1, nDifficulty - 0.15 + random(0,30)/100)
 */
export function getChallengeLevel(difficulty: number, random: () => number = Math.random): number {
  const challenge = difficulty - 0.15 + (random() * 0.3);
  return Math.max(0, Math.min(1, challenge));
}

/**
 * Compute time between events.
 * Mirrors Lua EventController._getNextEventTimeDelta():
 *   Uses oscillating alpha curve based on game time progression.
 */
export function getNextEventTimeDelta(
  elapsedTime: number,
  nTimeBetween: number,
  random: () => number = Math.random,
): number {
  const x = Math.min(elapsedTime, DIFFICULTY_MAX_TIME) / DIFFICULTY_MAX_TIME;

  // Oscillating alpha curve (Lua formula)
  let alpha = 1.0 - (0.5 + 0.54 * x * Math.sin(6 * Math.PI * x));
  alpha = Math.max(0, Math.min(1, alpha));

  const nMin = 0.6 * nTimeBetween;
  const nMax = 1.4 * nTimeBetween;
  // Lua: math.random(-20, 20) returns integers in [-20, 20]
  return nMin * alpha + nMax * (1 - alpha) + Math.floor(random() * 41) - 20;
}

/**
 * Compute average time between events from galaxy modifiers.
 * Mirrors Lua EventController.setBaseSeeds() → nAvg calculation.
 */
export function computeTimeBetweenEvents(galaxyValues: Record<string, number>): number {
  // Compute weighted average modifier across all event classes
  let totalWeight = 0;
  let weightedModSum = 0;

  for (const def of Object.values(EVENT_DEFS)) {
    const expMod = getExpMod(galaxyValues[def.sExpMod] ?? 0.5);
    let hostileMultiplier = 1;
    if (def.nChanceObey + def.nChanceHostile > 0) {
      if (def.bHostile) {
        hostileMultiplier = 1 / getExpMod(galaxyValues['hostility'] ?? 0.5);
      } else {
        hostileMultiplier = getExpMod(galaxyValues['hostility'] ?? 0.5);
      }
    }
    const mod = expMod * hostileMultiplier;
    weightedModSum += mod * def.nDefaultWeight;
    totalWeight += def.nDefaultWeight;
  }

  let nAvg = totalWeight > 0 ? weightedModSum / totalWeight : 1;

  // Remap to time between events (Lua formula)
  const nMinAvg = 78 / 130;    // ≈ 0.600
  const nMaxAvg = 244 / 130;   // ≈ 1.877
  const nRange = nMaxAvg - nMinAvg;

  nAvg = Math.max(nMinAvg, Math.min(nMaxAvg, nAvg));
  nAvg = (nAvg - nMinAvg) / nRange;  // remap to 0..1
  nAvg = 1 - nAvg;                    // flip: high hostility → shorter time
  nAvg = Math.pow(nAvg, 4);           // curve

  return 135 + nAvg * 465;            // 135-600 seconds
}

// ── Raider rolling ──────────────────────────────────────────────────

export interface RaiderSpec {
  nChallengeLevel: number;
  bKillbot: boolean;
}

/**
 * Roll random raiders based on difficulty.
 * Mirrors Lua EventController.rollRandomRaiders().
 */
export function rollRandomRaiders(
  difficulty: number,
  bAllowKillbots: boolean,
  random: () => number = Math.random,
): RaiderSpec[] {
  let nRaiders = 1;
  if (difficulty > 0.4) {
    nRaiders = 1 + Math.floor(random() * 3); // 1-3
  } else if (difficulty > 0.2) {
    nRaiders = 1 + Math.floor(random() * 2); // 1-2
  }

  // Nerf difficulty for multiple spawns
  let adjDifficulty = difficulty;
  if (nRaiders > 2) adjDifficulty *= 0.75;
  else if (nRaiders > 1) adjDifficulty *= 0.85;

  const raiders: RaiderSpec[] = [];
  for (let i = 0; i < nRaiders; i++) {
    const nChallengeLevel = getChallengeLevel(adjDifficulty, random);
    const bKillbot = bAllowKillbots && nChallengeLevel > 0.75 && random() > 0.5;
    raiders.push({ nChallengeLevel, bKillbot });
  }
  return raiders;
}
