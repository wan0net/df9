/**
 * EventController.ts — Event forecast queue and dispatch.
 * Mirrors EventController.lua: forecast, tick, weighting, difficulty scaling.
 */

import { GameRules, type TickableSystem } from '../core/GameRules';
import { Base } from '../core/Base';
import { Event, EVENT_STATUS } from './Event';
import { ImmigrationEvent } from './ImmigrationEvent';
import { MeteorEvent } from './MeteorEvent';
import { HostileImmigrationEvent } from './HostileImmigrationEvent';
import { BreachingEvent } from './BreachingEvent';
import { DerelictEvent } from './DerelictEvent';
import { HostileDockingEvent } from './HostileDockingEvent';
import { CompoundEvent } from './CompoundEvent';
import {
  EVENT_DEFS, type EventDef,
  FORECAST_SIZE, FORECAST_ALERT_TIME,
  MIN_EVENT_GAP, MAX_EVENT_GAP,
  DIFFICULTY_MAX_TIME, BASE_RAIDER_COUNT, MAX_EXTRA_RAIDERS,
  BASE_RAIDER_HP, MAX_EXTRA_HP,
  COMPOUND_EVENT_TIME,
} from './EventData';

/** Time between event checks. */
const EVENT_CHECK_INTERVAL = 5;
/** Time before first event. */
const FIRST_EVENT_DELAY = 400;

export type SpawnCharacterFn = (count: number) => void;
export type SpawnHostileFn = (count: number, hp: number) => void;
export type MeteorLandFn = () => void;
export type BreachWallFn = () => void;
export type DockingFn = (count: number) => void;

/** A scheduled event in the forecast. */
interface ForecastEntry {
  def: EventDef;
  scheduledTime: number;
  alerted: boolean;
}

export class EventController implements TickableSystem {
  private activeEvents: Event[] = [];
  private tickAccum = 0;
  private population = 0;

  /** Pre-generated forecast of upcoming events. */
  private forecast: ForecastEntry[] = [];
  private forecastGenerated = false;
  private compoundEventFired = false;
  /** simTime when the compound (mega) event was triggered; -1 if not yet fired. */
  private compoundEventStartTime = -1;

  // ── Callbacks ──────────────────────────────────────────────────
  /** Callback to spawn immigrant characters. Set from main.ts. */
  onImmigration: SpawnCharacterFn | null = null;
  /** Callback when a meteor lands. Set from main.ts. */
  onMeteorLand: MeteorLandFn | null = null;
  /** Callback to spawn hostile raiders. Set from main.ts. */
  onHostileSpawn: SpawnHostileFn | null = null;
  /** Callback when raiders breach a wall. Set from main.ts. */
  onBreachWall: BreachWallFn | null = null;
  /** Callback for friendly docking. */
  onDocking: DockingFn | null = null;

  init() {
    GameRules.registerSystem(1, this);
  }

  setPopulation(pop: number) {
    this.population = pop;
  }

  /** Current difficulty factor (0-1) based on elapsed time. */
  getDifficulty(): number {
    return Math.min(1, GameRules.simTime / DIFFICULTY_MAX_TIME);
  }

  /** Get raider count scaled by difficulty. */
  getScaledRaiderCount(): number {
    const diff = this.getDifficulty();
    return BASE_RAIDER_COUNT + Math.floor(diff * MAX_EXTRA_RAIDERS);
  }

  /** Get raider HP scaled by difficulty. */
  getScaledRaiderHP(): number {
    const diff = this.getDifficulty();
    return BASE_RAIDER_HP + Math.floor(diff * MAX_EXTRA_HP);
  }

  onTick(dt: number) {
    // Generate forecast on first tick after delay
    if (!this.forecastGenerated && GameRules.simTime >= FIRST_EVENT_DELAY) {
      this.generateForecast();
      this.forecastGenerated = true;
    }

    // Update active events
    for (let i = this.activeEvents.length - 1; i >= 0; i--) {
      const event = this.activeEvents[i];
      event.update(dt);
      if (!event.isActive()) {
        this.activeEvents.splice(i, 1);
      }
    }

    // Process forecast queue
    this.tickAccum += dt;
    if (this.tickAccum >= EVENT_CHECK_INTERVAL) {
      this.tickAccum -= EVENT_CHECK_INTERVAL;
      this.processForecast();
    }

    // Check for compound event (final siege at 6 hours)
    if (!this.compoundEventFired && GameRules.simTime >= COMPOUND_EVENT_TIME && this.population >= 8) {
      this.fireCompoundEvent();
      this.compoundEventFired = true;
      this.compoundEventStartTime = GameRules.simTime;
    }
  }

  /** Pre-generate a forecast of future events. */
  private generateForecast() {
    this.forecast = [];
    let nextTime = GameRules.simTime + MIN_EVENT_GAP + Math.random() * (MAX_EVENT_GAP - MIN_EVENT_GAP);

    for (let i = 0; i < FORECAST_SIZE; i++) {
      const def = this.pickWeightedEvent(nextTime);
      if (def) {
        this.forecast.push({
          def,
          scheduledTime: nextTime,
          alerted: false,
        });
      }
      // Gap oscillates between min and max
      nextTime += MIN_EVENT_GAP + Math.random() * (MAX_EVENT_GAP - MIN_EVENT_GAP);
    }
  }

  /** Pick a weighted random event eligible at the given time. */
  private pickWeightedEvent(atTime: number): EventDef | null {
    const eligible: EventDef[] = [];
    let totalWeight = 0;

    for (const key of Object.keys(EVENT_DEFS)) {
      const def = EVENT_DEFS[key];
      // Use a projected population (current + some growth)
      if (this.population < def.minPopulation) continue;
      if (atTime < def.minTime) continue;
      eligible.push(def);
      totalWeight += def.weight;
    }

    if (eligible.length === 0 || totalWeight === 0) return null;

    let pick = Math.random() * totalWeight;
    for (const def of eligible) {
      pick -= def.weight;
      if (pick <= 0) return def;
    }
    return eligible[eligible.length - 1];
  }

  /** Process the forecast queue — fire events at scheduled times. */
  private processForecast() {
    if (this.forecast.length === 0) {
      // Refill if exhausted
      if (this.forecastGenerated) {
        this.generateForecast();
      }
      return;
    }

    const now = GameRules.simTime;

    // Alert for upcoming events
    for (const entry of this.forecast) {
      if (!entry.alerted && now >= entry.scheduledTime - FORECAST_ALERT_TIME) {
        entry.alerted = true;
        Base.addAlert('event', `Incoming: ${entry.def.name} in ${Math.ceil(entry.scheduledTime - now)}s`);
      }
    }

    // Fire events that are due
    while (this.forecast.length > 0 && this.forecast[0].scheduledTime <= now) {
      const entry = this.forecast.shift()!;
      this.spawnEvent(entry.def);
    }
  }

  private spawnEvent(def: EventDef) {
    let event: Event | null = null;

    switch (def.name) {
      case 'Immigration': {
        const immEvent = new ImmigrationEvent();
        immEvent.onCompleteCallback = () => {
          const count = immEvent.getImmigrantCount();
          this.onImmigration?.(count);
          Base.addAlert('immigration', `${count} new crew member${count > 1 ? 's' : ''} arrived!`);
        };
        event = immEvent;
        break;
      }
      case 'Meteor Shower': {
        const meteorEvent = new MeteorEvent();
        meteorEvent.onMeteorLandCallback = () => {
          this.onMeteorLand?.();
        };
        event = meteorEvent;
        break;
      }
      case 'Hostile Immigration': {
        const hostileEvent = new HostileImmigrationEvent(this.getScaledRaiderCount());
        hostileEvent.onCompleteCallback = () => {
          const count = hostileEvent.getRaiderCount();
          const hp = this.getScaledRaiderHP();
          this.onHostileSpawn?.(count, hp);
          Base.addAlert('hostile', `${count} raider${count > 1 ? 's' : ''} have arrived!`);
        };
        event = hostileEvent;
        break;
      }
      case 'Breaching': {
        const breachEvent = new BreachingEvent();
        breachEvent.onCompleteCallback = () => {
          this.onBreachWall?.();
          // Also spawn a raider through the breach
          this.onHostileSpawn?.(1, this.getScaledRaiderHP());
          Base.incrementStat('nBreachShipsDestroyed');
          Base.addAlert('breach', 'Raiders have breached the hull!');
        };
        event = breachEvent;
        break;
      }
      case 'Derelict Ship': {
        const derelictEvent = new DerelictEvent();
        derelictEvent.onCompleteCallback = () => {
          // Derelict provides matter reward when explored (auto-complete for now)
          Base.addAlert('derelict', 'Derelict ship detected — salvage opportunities available');
        };
        event = derelictEvent;
        break;
      }
      case 'Docking': {
        const count = 1 + Math.floor(Math.random() * 2);
        const dockEvent = new ImmigrationEvent();
        dockEvent.onCompleteCallback = () => {
          this.onDocking?.(count);
          Base.addAlert('docking', `Friendly ship docked — ${count} immigrant${count > 1 ? 's' : ''} arriving`);
        };
        event = dockEvent;
        break;
      }
      case 'Hostile Docking': {
        const hostileDockEvent = new HostileDockingEvent(this.getScaledRaiderCount());
        hostileDockEvent.onCompleteCallback = () => {
          const count = hostileDockEvent.getRaiderCount();
          const hp = this.getScaledRaiderHP();
          this.onHostileSpawn?.(count, hp);
          Base.addAlert('hostile', `Hostile ship has docked — ${count} raider${count > 1 ? 's' : ''} boarding!`);
        };
        event = hostileDockEvent;
        break;
      }
      default:
        return;
    }

    if (event) {
      event.start(GameRules.simTime);
      this.activeEvents.push(event);
      Base.addAlert('event', `Event: ${def.name}`);
    }
  }

  /** Fire the compound event (final siege). */
  private fireCompoundEvent() {
    const compound = new CompoundEvent();

    // Multiple hostile events at once
    const raiderEvent = new HostileImmigrationEvent(this.getScaledRaiderCount() + 2);
    raiderEvent.onCompleteCallback = () => {
      this.onHostileSpawn?.(raiderEvent.getRaiderCount(), this.getScaledRaiderHP());
    };

    const breachEvent = new BreachingEvent();
    breachEvent.onCompleteCallback = () => {
      this.onBreachWall?.();
    };

    const meteorEvent = new MeteorEvent();
    meteorEvent.onMeteorLandCallback = () => {
      this.onMeteorLand?.();
    };

    compound.addSubEvent(raiderEvent);
    compound.addSubEvent(breachEvent);
    compound.addSubEvent(meteorEvent);

    compound.start(GameRules.simTime);
    this.activeEvents.push(compound);
    Base.addAlert('siege', 'COMPOUND EVENT: Multiple threats detected!');
  }

  getActiveEvents(): Event[] {
    return this.activeEvents;
  }

  getForecast(): { name: string; scheduledTime: number; alerted: boolean }[] {
    return this.forecast.map(f => ({
      name: f.def.name,
      scheduledTime: f.scheduledTime,
      alerted: f.alerted,
    }));
  }

  /** Returns whether the compound (mega) event has fired, and when. */
  getCompoundEventState(): { fired: boolean; startTime: number } {
    return { fired: this.compoundEventFired, startTime: this.compoundEventStartTime };
  }

  /** Get save data for persistence. */
  getSaveData() {
    return {
      forecastGenerated: this.forecastGenerated,
      compoundEventFired: this.compoundEventFired,
      compoundEventStartTime: this.compoundEventStartTime,
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
    this.compoundEventStartTime = (data as any).compoundEventStartTime ?? -1;
    this.forecast = data.forecast.map(f => ({
      def: EVENT_DEFS[f.defName] ?? EVENT_DEFS['Immigration'],
      scheduledTime: f.scheduledTime,
      alerted: f.alerted,
    }));
  }
}
