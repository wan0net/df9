/**
 * EventController.ts — Event forecast queue and dispatch.
 * Mirrors EventController.lua: single-event execution, forecast, weighting, difficulty scaling.
 */

import { GameRules, type TickableSystem } from '../core/GameRules';
import { Base } from '../core/Base';
import { Event, EVENT_STATUS } from './Event';
import { ImmigrationEvent } from './ImmigrationEvent';
import { MeteorEvent, type MeteorImpactFn } from './MeteorEvent';
import { HostileImmigrationEvent } from './HostileImmigrationEvent';
import { BreachingEvent } from './BreachingEvent';
import { DerelictEvent } from './DerelictEvent';
import { HostileDockingEvent } from './HostileDockingEvent';
import { CompoundEvent } from './CompoundEvent';
import { TraderEvent } from './TraderEvent';
import type { DialogSystem, DialogResult } from '../ui/DialogSystem';
import { DerelictSystem, type DerelictEvent as DerelictExploreEvent, type DerelictShip } from './DerelictSystem';
import { line } from '../localization/Localization';
import {
  EVENT_DEFS, type EventDef,
  FORECAST_SIZE, FORECAST_ALERT_TIME,
  FIRST_EVENT_TIME_MIN, FIRST_EVENT_TIME_MAX,
  COMPOUND_EVENT_TIME, MEGA_EVENT_WEIGHT,
  MAX_CONSECUTIVE_SAME, PREV_EVENTS_COUNT,
  POPULATION_CAP,
  getDifficulty, getChallengeLevel, getExpMod,
  getNextEventTimeDelta, computeTimeBetweenEvents,
  rollRandomRaiders,
} from './EventData';

/** Time between event checks. */
// E-2: Lua checks every frame. Use 1s for reasonable performance without 5s delay.
const EVENT_CHECK_INTERVAL = 1;
/** Default max setup failures before skipping event (Lua: 30). */
const DEFAULT_ALLOWED_FAILURES = 30;

export type SpawnCharacterFn = (count: number) => void;
export type SpawnHostileFn = (count: number, hp: number, difficulty?: number) => void;
export type MeteorLandFn = MeteorImpactFn;
/** Callback to read tile type at coords (needed by MeteorEvent for SPACE detection). */
export type GetTileTypeFn = (tx: number, ty: number) => number;
export type BreachWallFn = () => void;
export type DockingFn = (count: number) => void;
export type DerelictExploreFn = (payload: {
  ship: DerelictShip;
  event: DerelictExploreEvent;
  choiceId: string;
  hostile: boolean;
}) => void;

/** A scheduled event in the forecast. */
interface ForecastEntry {
  def: EventDef;
  scheduledTime: number;
  alertTime: number;
  alerted: boolean;
  nFailures: number;
  bFailed: boolean;
}

export class EventController implements TickableSystem {
  /** Currently executing event (Lua: single event at a time). */
  private currentEvent: Event | null = null;
  private currentEventEntry: ForecastEntry | null = null;
  private tickAccum = 0;
  private population = 0;

  /** Pre-generated forecast of upcoming events. */
  private forecast: ForecastEntry[] = [];
  private forecastGenerated = false;
  private compoundEventFired = false;
  /** Mega event has been run (persisted in save). */
  private bRanMegaEvent = false;
  /** Game time when mega event completed (Lua: nMegaEventStartTime). */
  nMegaEventStartTime = 0;
  /** Previous events for history. */
  private prevEvents: { sEventType: string; nCompletionTime: number }[] = [];

  /** Room count callbacks for event eligibility gates. */
  getHiddenRoomCount: (() => number) | null = null;
  getExteriorRoomCount: (() => number) | null = null;

  /** Galaxy values from landing zone (0-1 per key). */
  private galaxyValues: Record<string, number> = {
    population: 0.5,
    asteroids: 0.5,
    hostility: 0.5,
  };
  /** Average time between events (computed from galaxy position). */
  private nTimeBetween = 300;

  /** Callback: auto-save before event execution (Lua: 45s threshold). */
  onPreEventSave: (() => void) | null = null;

  // ── Callbacks ──────────────────────────────────────────────────
  onImmigration: SpawnCharacterFn | null = null;
  /** E-31: Spawn a trader character (Lua FACTION_BEHAVIOR.Trader). */
  onTraderSpawn: ((count: number) => void) | null = null;
  onMeteorLand: MeteorLandFn | null = null;
  /** Callback to read tile type at coords (MeteorEvent needs this for SPACE detection). */
  getTileType: GetTileTypeFn | null = null;
  onHostileSpawn: SpawnHostileFn | null = null;
  onBreachWall: BreachWallFn | null = null;
  onDocking: DockingFn | null = null;
  onDerelictExplore: DerelictExploreFn | null = null;
  /** Dialog system for event accept/reject choices. */
  dialogSystem: DialogSystem | null = null;
  private derelictSystem: DerelictSystem | null = null;

  init(derelictSystem?: DerelictSystem) {
    if (derelictSystem) {
      this.derelictSystem = derelictSystem;
    }
    GameRules.registerSystem(1, this);
  }

  setDerelictSystem(derelictSystem: DerelictSystem) {
    this.derelictSystem = derelictSystem;
  }

  /** Set galaxy position values from landing zone. */
  setGalaxyValues(values: Record<string, number>) {
    this.galaxyValues = { ...this.galaxyValues, ...values };
    this.nTimeBetween = computeTimeBetweenEvents(this.galaxyValues);
    this.applySpawnModifiers();
  }

  /** Apply galaxy-position spawn modifiers to event weights. */
  private applySpawnModifiers() {
    for (const def of Object.values(EVENT_DEFS)) {
      const expMod = getExpMod(this.galaxyValues[def.sExpMod] ?? 0.5);
      let hostileMultiplier = 1;
      if (def.nChanceObey + def.nChanceHostile > 0) {
        if (def.bHostile) {
          hostileMultiplier = 1 / getExpMod(this.galaxyValues['hostility'] ?? 0.5);
        } else {
          hostileMultiplier = getExpMod(this.galaxyValues['hostility'] ?? 0.5);
        }
      }
      def.weight = def.nDefaultWeight * expMod * hostileMultiplier;
    }
  }

  setPopulation(pop: number) {
    this.population = pop;
  }

  /** Current difficulty factor (0-1) using Lua-exact formula. */
  getDifficulty(): number {
    return getDifficulty(GameRules.elapsedTime, this.population);
  }

  /** Get raider count scaled by difficulty (Lua: math.random(1,3) tiered by difficulty). */
  getScaledRaiderCount(): number {
    const diff = this.getDifficulty();
    if (diff > 0.4) return 1 + Math.floor(Math.random() * 3); // 1-3
    if (diff > 0.2) return 1 + Math.floor(Math.random() * 2); // 1-2
    return 1;
  }

  /** Get raider HP scaled by difficulty.
   *  Lua uses point-buy system; approximate with STARTING_HIT_POINTS scaling. */
  getScaledRaiderHP(): number {
    const diff = this.getDifficulty();
    return Math.min(200, 100 + Math.floor(diff * 100));
  }

  onTick(dt: number) {
    // EV-8: No events when all citizens are dead (Lua EventController.onTick:495)
    if (this.population <= 0) return;

    // Generate forecast on first tick after delay
    if (!this.forecastGenerated && GameRules.elapsedTime >= FIRST_EVENT_TIME_MIN) {
      this.generateForecast();
      this.forecastGenerated = true;
    }

    // Tick current event (Lua: single event at a time)
    if (this.currentEvent) {
      this.currentEvent.update(dt);
      if (!this.currentEvent.isActive()) {
        this._eventCompleted();
      }
    } else {
      // No active event — process forecast queue
      this.tickAccum += dt;
      if (this.tickAccum >= EVENT_CHECK_INTERVAL) {
        this.tickAccum -= EVENT_CHECK_INTERVAL;
        this.processForecast();
      }
    }

    // Check for compound event (final siege at 6 hours)
    if (!this.compoundEventFired && GameRules.elapsedTime >= COMPOUND_EVENT_TIME && this.population >= 25) { // Lua CompoundEvent.lua:31 nMinPopulation=25
      this.fireCompoundEvent();
      this.compoundEventFired = true;
    }
  }

  /** Inject an event directly (used by disaster menu). Replaces current event. */
  injectEvent(event: Event) {
    this.currentEvent = event;
    this.currentEventEntry = null;
  }

  /** Called when the current event finishes. Regenerates forecast and pops next. */
  private _eventCompleted() {
    const entry = this.currentEventEntry;

    // Track in previous events
    if (entry) {
      this.prevEvents.push({
        sEventType: entry.def.sEventType,
        nCompletionTime: GameRules.elapsedTime,
      });
      while (this.prevEvents.length > PREV_EVENTS_COUNT) {
        this.prevEvents.shift();
      }
    }

    this.currentEvent = null;
    this.currentEventEntry = null;

    // Regenerate forecast after event completes (Lua: EventController._eventCompleted)
    this.generateForecast();

    // Pop next event from forecast
    if (this.forecast.length > 0) {
      // Already generated — next event will be processed in processForecast()
    }
  }

  /** Pre-generate a forecast of future events with population delta accumulation. */
  private generateForecast() {
    this.forecast = [];
    // First event uses the specific Lua range
    const firstDelay = FIRST_EVENT_TIME_MIN + Math.random() * (FIRST_EVENT_TIME_MAX - FIRST_EVENT_TIME_MIN);
    let nextTime = Math.max(GameRules.elapsedTime + 10, firstDelay);
    if (this.forecastGenerated) {
      nextTime = GameRules.elapsedTime + getNextEventTimeDelta(GameRules.elapsedTime, this.nTimeBetween);
    }

    let lastEventType = '';
    let consecutiveCount = 0;
    let populationEstimate = this.population;

    for (let i = 0; i < FORECAST_SIZE; i++) {
      const def = this.pickWeightedEvent(nextTime, lastEventType, consecutiveCount, populationEstimate);
      if (def) {
        const alertTime = nextTime - (FORECAST_ALERT_TIME + Math.random() * 10);
        this.forecast.push({
          def,
          scheduledTime: nextTime,
          alertTime,
          alerted: false,
          nFailures: 0,
          bFailed: false,
        });
        if (def.name === lastEventType) {
          consecutiveCount++;
        } else {
          lastEventType = def.name;
          consecutiveCount = 1;
        }
        // Accumulate population delta estimate (Lua: nPopulationDeltaEstimate)
        populationEstimate += def.nPopulationDelta ?? 0;
      }
      nextTime += getNextEventTimeDelta(nextTime, this.nTimeBetween);
    }
  }

  /** Pick a weighted random event eligible at the given time. */
  private pickWeightedEvent(
    atTime: number,
    lastType: string,
    consecutiveCount: number,
    populationEstimate: number,
  ): EventDef | null {
    const eligible: EventDef[] = [];
    let totalWeight = 0;
    const nHiddenRooms = this.getHiddenRoomCount?.() ?? 0;
    const nExteriorRooms = this.getExteriorRoomCount?.() ?? 0;

    for (const key of Object.keys(EVENT_DEFS)) {
      const def = EVENT_DEFS[key];

      // Max population gate
      if (def.maxPopulation >= 0 && populationEstimate >= def.maxPopulation) continue;

      // Lua EventController.lua:596 — OR gate: eligible if pop > minPop OR time > minTime
      const popOk = def.minPopulation < 0 || populationEstimate > def.minPopulation;
      const timeOk = def.minTime < 0 || atTime > def.minTime;
      if (!popOk && !timeOk) continue;

      // Max consecutive same-event
      if (def.name === lastType && consecutiveCount >= MAX_CONSECUTIVE_SAME) continue;

      // Sandbox mode: skip hostile events when population < 100 (Lua NewBase.lua onButtonSandboxActive)
      if (GameRules.bSandboxMode && def.bHostile && populationEstimate < 100) continue;

      // Room gates (Lua EventController.lua:602-607 — zero weight when room counts exceed limits)
      if (def.nMaxUndiscoveredRooms !== undefined && def.nMaxUndiscoveredRooms >= 0 && nHiddenRooms >= def.nMaxUndiscoveredRooms) continue;
      if (def.nMaxExteriorRooms !== undefined && def.nMaxExteriorRooms >= 0 && nExteriorRooms >= def.nMaxExteriorRooms) continue;
      if (def.nMinExteriorRooms !== undefined && def.nMinExteriorRooms >= 0 && nExteriorRooms < def.nMinExteriorRooms) continue;
      // E-25: Min undiscovered rooms gate (Lua DockingEvent.nMinUndiscoveredRooms = 2)
      if (def.nMinUndiscoveredRooms !== undefined && def.nMinUndiscoveredRooms >= 0 && nHiddenRooms < def.nMinUndiscoveredRooms) continue;

      let weight = def.weight;

      // Immigration early-game boost (Lua: 1.5x when < 25 min and pop < 12)
      if (def.sEventType === 'immigrationEvents' && atTime < 1500 && populationEstimate < 12) {
        weight *= 1.5;
      }

      // Mega event boost (CompoundEvent weight → 60 after siege time, 1 normally)
      if (def.sEventType === 'CompoundEvent') {
        weight = (atTime > COMPOUND_EVENT_TIME && !this.bRanMegaEvent) ? MEGA_EVENT_WEIGHT : 1;
      }

      // Breaching dynamic weight (Lua: 16 if no exterior rooms, 10 if there are)
      if (def.sEventType === 'breachingEvents') {
        weight = nExteriorRooms > 0 ? 10 : 16;
      }

      eligible.push(def);
      totalWeight += weight;
    }

    // Fallback to immigration if nothing eligible (Lua: line 619)
    if (eligible.length === 0 || totalWeight === 0) {
      return EVENT_DEFS['Immigration'] ?? null;
    }

    const getWeight = (def: EventDef) => {
      let w = def.weight;
      if (def.sEventType === 'immigrationEvents' && atTime < 1500 && populationEstimate < 12) w *= 1.5;
      if (def.sEventType === 'CompoundEvent') w = (atTime > COMPOUND_EVENT_TIME && !this.bRanMegaEvent) ? MEGA_EVENT_WEIGHT : 1;
      if (def.sEventType === 'breachingEvents') w = nExteriorRooms > 0 ? 10 : 16;
      return w;
    };
    let pick = Math.random() * totalWeight;
    for (const def of eligible) {
      pick -= getWeight(def);
      if (pick <= 0) return def;
    }
    return eligible[eligible.length - 1];
  }

  /** Process the forecast queue — fire events at scheduled times. */
  private processForecast() {
    if (this.forecast.length === 0) {
      if (this.forecastGenerated) {
        this.generateForecast();
      }
      return;
    }

    const now = GameRules.elapsedTime;

    // Alert for upcoming events
    for (const entry of this.forecast) {
      if (!entry.alerted && !entry.def.bSkipAlert && now >= entry.alertTime) {
        entry.alerted = true;
        Base.addAlert('event', line(entry.def.sAlertLC ?? 'ALERTS023TEXT'));
      }
    }

    // Attempt to execute the next event when due (single event at a time)
    if (this.currentEvent) return; // Already running an event

    const next = this.forecast[0];
    if (next && next.scheduledTime <= now) {
      this.forecast.shift();
      if (next.bFailed) {
        // Skip failed events — move to next
        return;
      }
      this.attemptExecuteEvent(next);
    }
  }

  /** Attempt to execute an event. Handles failure/retry (Lua: attemptExecuteEvent). */
  private attemptExecuteEvent(entry: ForecastEntry) {
    const event = this.createEvent(entry.def);
    if (!event) {
      this._eventFailed(entry);
      return;
    }

    // Auto-save before event execution (Lua EventController:attemptExecuteEvent)
    this.onPreEventSave?.();

    // Event created successfully — start execution
    event.start(GameRules.simTime);
    this.currentEvent = event;
    this.currentEventEntry = entry;
    Base.addAlert('event', line('ALERTS023TEXT'));
  }

  /** Handle event setup failure (Lua: EventController._failed). */
  private _eventFailed(entry: ForecastEntry) {
    entry.nFailures++;
    const maxFailures = entry.def.nAllowedSetupFailures ?? DEFAULT_ALLOWED_FAILURES;
    if (entry.nFailures > maxFailures) {
      entry.bFailed = true;
      // Treat as completed to move on
      this.prevEvents.push({
        sEventType: entry.def.sEventType,
        nCompletionTime: GameRules.elapsedTime,
      });
      while (this.prevEvents.length > PREV_EVENTS_COUNT) {
        this.prevEvents.shift();
      }
    } else {
      // Re-queue for retry next tick
      this.forecast.unshift(entry);
    }
  }

  /**
   * Helper: resolve a dialog result into whether to spawn.
   * Lua dialogTick: accepted or ignored (screwYou) → spawn; rejected → don't spawn.
   */
  private shouldSpawn(result: DialogResult): boolean {
    return result === 'accepted' || result === 'ignored';
  }

  private createDerelictEvent(hostile: boolean): Event | null {
    const derelictSystem = this.derelictSystem;
    if (!derelictSystem) return null;

    const derelictEvent = new DerelictEvent(() => {
      const ship = derelictSystem.spawnDerelict(hostile);
      const exploration = derelictSystem.exploreDerelict(ship.id, undefined, hostile);
      const resolveChoice = (choiceId: string) => {
        derelictSystem.resolveEvent(choiceId);
        this.onDerelictExplore?.({
          ship,
          event: exploration,
          choiceId,
          hostile,
        });
        Base.addAlert(hostile ? 'hostile' : 'derelict', line(hostile ? 'ALERTS010TEXT' : 'ALERTS032TEXT'));
        derelictEvent.resolve();
      };

      if (this.dialogSystem) {
        this.dialogSystem.showDerelictChoiceDialog(
          exploration.description,
          exploration.choices.map(choice => ({ id: choice.id, label: choice.label })),
          resolveChoice,
        );
      } else {
        const fallbackChoice = exploration.choices[0];
        if (fallbackChoice) {
          resolveChoice(fallbackChoice.id);
        } else {
          derelictEvent.resolve();
        }
      }
    });

    return derelictEvent;
  }

  private createEvent(def: EventDef): Event | null {
    switch (def.name) {
      case 'Immigration': {
        // Lua: population cap check before immigration (non-hostile)
        if (this.population >= POPULATION_CAP) return null;

        const immEvent = new ImmigrationEvent();
        immEvent.onCompleteCallback = () => {
          const count = immEvent.getImmigrantCount();
          if (this.dialogSystem) {
            // Lua ImmigrationEvent.lua:170-173: pause game during dialog
            const wasPaused = !GameRules.bRunning;
            GameRules.bRunning = false;
            this.dialogSystem.showImmigrationDialog(def.nChanceObey, (result) => {
              if (!wasPaused) GameRules.bRunning = true; // restore
              if (this.shouldSpawn(result)) {
                this.onImmigration?.(count);
                const alertLC = result === 'ignored' ? 'ALERTS025TEXT' : 'ALERTS030TEXT';
                Base.addAlert('immigration', line(alertLC));
              } else {
                Base.addAlert('immigration', line('ALERTS024TEXT'));
              }
            });
          } else {
            // No dialog system — auto-accept (Lua: skipDialog path)
            this.onImmigration?.(count);
            Base.addAlert('immigration', line('ALERTS041TEXT'));
          }
        };
        return immEvent;
      }
      case 'Meteor Shower': {
        const meteorEvent = new MeteorEvent(
          this.getDifficulty(),
          undefined,
          undefined,
          this.getTileType ?? undefined,
        );
        meteorEvent.onMeteorImpact = (tx, ty, nSize, nDamage) => {
          this.onMeteorLand?.(tx, ty, nSize, nDamage);
        };
        return meteorEvent;
      }
      case 'Hostile Immigration': {
        const hostileEvent = new HostileImmigrationEvent(this.getScaledRaiderCount());
        hostileEvent.onCompleteCallback = () => {
          const count = hostileEvent.getRaiderCount();
          const hp = this.getScaledRaiderHP();
          const hiDiff = this.getDifficulty();
          if (this.dialogSystem) {
            this.dialogSystem.showHostileImmigrationDialog(def.nChanceObey, (result) => {
              if (this.shouldSpawn(result)) {
                // Hostile immigrants always spawn on accept or ignored refusal
                this.onHostileSpawn?.(count, hp, hiDiff);
                const alertLC = result === 'ignored' ? 'ALERTS025TEXT' : 'ALERTS030TEXT';
                Base.addAlert('hostile', line(alertLC));
              } else {
                // Rarely obeys — raiders leave
                Base.addAlert('hostile', line('ALERTS024TEXT'));
              }
            });
          } else {
            this.onHostileSpawn?.(count, hp, hiDiff);
            Base.addAlert('hostile', line('ALERTS041TEXT'));
          }
        };
        return hostileEvent;
      }
      case 'Breaching': {
        const breachEvent = new BreachingEvent();
        // EV-4/CC-10: Pass difficulty for point-buy equipment
        const breachDiff = this.getDifficulty();
        const breachCount = this.getScaledRaiderCount();
        breachEvent.onCompleteCallback = () => {
          this.onBreachWall?.();
          const hp = this.getScaledRaiderHP();
          this.onHostileSpawn?.(breachCount, hp, breachDiff);
          Base.incrementStat('nBreachShipsDestroyed');
          Base.addAlert('breach', line('ALERTS009TEXT'));
        };
        return breachEvent;
      }
      case 'Derelict Ship': {
        return this.createDerelictEvent(false);
      }
      case 'Hostile Derelict': {
        return this.createDerelictEvent(true);
      }
      case 'Docking': {
        // Lua: population cap check for friendly docking
        if (this.population >= POPULATION_CAP) return null;

        const count = 1 + Math.floor(Math.random() * 2);
        const dockEvent = new ImmigrationEvent();
        dockEvent.onCompleteCallback = () => {
          if (this.dialogSystem) {
            this.dialogSystem.showDockingDialog(false, def.nChanceObey, (result) => {
              if (this.shouldSpawn(result)) {
                this.onDocking?.(count);
                const alertLC = result === 'ignored' ? 'ALERTS025TEXT' : 'ALERTS029TEXT'; // E-26: Lua uses ALERTS029TEXT
                Base.addAlert('docking', line(alertLC));
              } else {
                Base.addAlert('docking', line('ALERTS024TEXT'));
              }
            });
          } else {
            this.onDocking?.(count);
            Base.addAlert('docking', line('ALERTS041TEXT'));
          }
        };
        return dockEvent;
      }
      case 'Hostile Docking': {
        const hostileDockEvent = new HostileDockingEvent(this.getScaledRaiderCount());
        hostileDockEvent.onCompleteCallback = () => {
          const count = hostileDockEvent.getRaiderCount();
          const hp = this.getScaledRaiderHP();
          const hdDiff = this.getDifficulty();
          if (this.dialogSystem) {
            this.dialogSystem.showDockingDialog(true, def.nChanceObey, (result) => {
              if (this.shouldSpawn(result)) {
                this.onHostileSpawn?.(count, hp, hdDiff);
                const alertLC = result === 'ignored' ? 'ALERTS025TEXT' : 'ALERTS030TEXT';
                Base.addAlert('hostile', line(alertLC));
              } else {
                Base.addAlert('hostile', line('ALERTS024TEXT'));
              }
            });
          } else {
            this.onHostileSpawn?.(count, hp, hdDiff);
            Base.addAlert('hostile', line('ALERTS041TEXT'));
          }
        };
        return hostileDockEvent;
      }
      case 'Trader': {
        const traderEvent = new TraderEvent();
        traderEvent.onCompleteCallback = () => {
          if (this.dialogSystem) {
            this.dialogSystem.showTraderDialog(def.nChanceObey, (result) => {
              if (this.shouldSpawn(result)) {
                // E-31: Spawn trader character (Lua FACTION_BEHAVIOR.Trader)
                (this.onTraderSpawn ?? this.onImmigration)?.(1);
                const alertLC = result === 'ignored' ? 'ALERTS025TEXT' : 'ALERTS030TEXT';
                Base.addAlert('trader', line(alertLC));
              } else {
                Base.addAlert('trader', line('ALERTS024TEXT'));
              }
            });
          } else {
            (this.onTraderSpawn ?? this.onImmigration)?.(1);
            Base.addAlert('trader', line('ALERTS041TEXT'));
          }
        };
        return traderEvent;
      }
      case 'Compound Event': {
        this.fireCompoundEvent();
        return null;
      }
      default:
        return null;
    }
  }

  /** Fire the compound event (final siege).
   *  Lua CompoundEvent.selectEvents: point budget = difficulty * 40 * (.7 + .3 * random).
   *  Raiders cost 1-4 points (by challenge level), breach costs 1, meteor costs 4.
   *  Events selected until points exhausted. Mega events get 100 points. */
  private fireCompoundEvent() {
    const doFireCompound = () => {
      const compound = new CompoundEvent();
      const diff = this.getDifficulty();
      const bMega = !this.bRanMegaEvent;
      let nPoints = bMega ? 100 : diff * 40 * (0.7 + 0.3 * Math.random());
      let bMeteorStrike = false;

      // Weighted choices: meteor=1, breach=4, hostileImmigration=5
      const choices: Record<string, number> = {
        meteorEvents: 1,
        breachingEvents: 4,
        hostileImmigrationEvents: 5,
      };

      while (nPoints > 0 || (!bMeteorStrike && bMega)) {
        // Pick event type (weighted random, or force meteor if mega and low points)
        let sChoice: string;
        if (!bMeteorStrike && bMega && nPoints <= 4) {
          sChoice = 'meteorEvents';
        } else {
          // Weighted random from choices
          let totalW = 0;
          for (const w of Object.values(choices)) totalW += w;
          let roll = Math.random() * totalW;
          sChoice = 'hostileImmigrationEvents'; // fallback
          for (const [key, w] of Object.entries(choices)) {
            roll -= w;
            if (roll <= 0) { sChoice = key; break; }
          }
        }

        if (sChoice === 'meteorEvents') {
          bMeteorStrike = true;
          nPoints -= 4;
          delete choices['meteorEvents']; // only one meteor per compound

          const meteorEvent = new MeteorEvent(
            diff, undefined, undefined,
            this.getTileType ?? undefined,
          );
          meteorEvent.onMeteorImpact = (tx, ty, nSize, nDamage) => {
            this.onMeteorLand?.(tx, ty, nSize, nDamage);
          };
          compound.addSubEvent(meteorEvent);
        } else if (sChoice === 'breachingEvents') {
          nPoints -= 1;

          const breachEvent = new BreachingEvent();
          breachEvent.onCompleteCallback = () => {
            this.onBreachWall?.();
          };
          compound.addSubEvent(breachEvent);
        } else {
          // EV-5: hostileImmigrationEvents — deduct per-raider (Lua CompoundEvent.selectEvents:102-124)
          // Roll raiders using rollRandomRaiders (includes killbot chance)
          const raiders = rollRandomRaiders(diff, true);

          // Deduct points per individual raider based on challenge level / killbot
          for (const raider of raiders) {
            if (raider.bKillbot) {
              nPoints -= 4;
            } else if (raider.nChallengeLevel > 0.6) {
              nPoints -= 3;
            } else if (raider.nChallengeLevel > 0.2) {
              nPoints -= 2;
            } else {
              nPoints -= 1;
            }
          }

          const raiderEvent = new HostileImmigrationEvent(raiders.length);
          raiderEvent.onCompleteCallback = () => {
            // EV-4: Pass difficulty so spawnHostiles rolls killbots internally
            this.onHostileSpawn?.(raiderEvent.getRaiderCount(), this.getScaledRaiderHP(), diff);
          };
          compound.addSubEvent(raiderEvent);
        }
      }

      // E-29: Lua sets bRanMegaEvent AFTER all sub-events complete, not before
      compound.onCompleteCallback = () => { this.bRanMegaEvent = true; };
      compound.start(GameRules.simTime);
      this.currentEvent = compound;
      this.currentEventEntry = null;
      Base.addAlert('siege', line('ALERTS040TEXT'));
    };

    // Show compound event dialog if dialog system available
    // Lua: compound events always proceed regardless of player choice
    const compoundDef = EVENT_DEFS['CompoundEvent'];
    if (this.dialogSystem) {
      this.dialogSystem.showCompoundEventDialog(compoundDef?.nChanceObey ?? 0.33, (_result) => {
        // Compound event fires regardless of dialog choice (Lua: can't avoid final siege)
        doFireCompound();
      });
    } else {
      doFireCompound();
    }
  }

  /** Get active events (compat — returns current event in array or empty). */
  getActiveEvents(): Event[] {
    return this.currentEvent ? [this.currentEvent] : [];
  }

  getForecast(): { name: string; scheduledTime: number; alerted: boolean }[] {
    return this.forecast.map(f => ({
      name: f.def.name,
      scheduledTime: f.scheduledTime,
      alerted: f.alerted,
    }));
  }

  /** Get galaxy values (for test/debug). */
  getGalaxyValues(): Record<string, number> {
    return { ...this.galaxyValues };
  }

  /** Get computed time between events (for test/debug). */
  getTimeBetweenEvents(): number {
    return this.nTimeBetween;
  }

  /** Get save data for persistence. */
  getSaveData() {
    return {
      forecastGenerated: this.forecastGenerated,
      compoundEventFired: this.compoundEventFired,
      bRanMegaEvent: this.bRanMegaEvent,
      nMegaEventStartTime: this.nMegaEventStartTime,
      galaxyValues: { ...this.galaxyValues },
      forecast: this.forecast.map(f => ({
        defName: Object.keys(EVENT_DEFS).find(k => EVENT_DEFS[k].name === f.def.name) ?? '',
        scheduledTime: f.scheduledTime,
        alerted: f.alerted,
      })),
    };
  }

  /** Load save data. */
  loadSaveData(data: ReturnType<typeof this.getSaveData>) {
    this.forecastGenerated = data.forecastGenerated;
    this.compoundEventFired = data.compoundEventFired;
    this.bRanMegaEvent = data.bRanMegaEvent ?? false;
    this.nMegaEventStartTime = (data as any).nMegaEventStartTime ?? 0;
    if (data.galaxyValues) {
      this.galaxyValues = { ...this.galaxyValues, ...data.galaxyValues };
      this.nTimeBetween = computeTimeBetweenEvents(this.galaxyValues);
      this.applySpawnModifiers();
    }
    this.forecast = data.forecast.map(f => ({
      def: EVENT_DEFS[f.defName] ?? EVENT_DEFS['Immigration'],
      scheduledTime: f.scheduledTime,
      alertTime: f.scheduledTime - FORECAST_ALERT_TIME,
      alerted: f.alerted,
      nFailures: 0,
      bFailed: false,
    }));
  }
}
