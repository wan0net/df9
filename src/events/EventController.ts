/**
 * EventController.ts — Event forecast queue and dispatch.
 * Mirrors EventController.lua: forecast, tick, weighting.
 */

import { GameRules, type TickableSystem } from '../core/GameRules';
import { Base } from '../core/Base';
import { Event, EVENT_STATUS } from './Event';
import { ImmigrationEvent } from './ImmigrationEvent';
import { MeteorEvent } from './MeteorEvent';
import { EVENT_DEFS, type EventDef } from './EventData';

/** Time between event checks. */
const EVENT_CHECK_INTERVAL = 60;
/** Time before first event. */
const FIRST_EVENT_DELAY = 400;

export class EventController implements TickableSystem {
  private activeEvents: Event[] = [];
  private tickAccum = 0;
  private lastEventTime = 0;
  private population = 0;

  init() {
    // Register at slot 1 (EventController.onTick in Lua tick order)
    GameRules.registerSystem(1, this);
  }

  setPopulation(pop: number) {
    this.population = pop;
  }

  onTick(dt: number) {
    // Update active events
    for (let i = this.activeEvents.length - 1; i >= 0; i--) {
      const event = this.activeEvents[i];
      event.update(dt);
      if (!event.isActive()) {
        this.activeEvents.splice(i, 1);
      }
    }

    // Check for new events periodically
    this.tickAccum += dt;
    if (this.tickAccum >= EVENT_CHECK_INTERVAL) {
      this.tickAccum -= EVENT_CHECK_INTERVAL;
      this.checkForEvents();
    }
  }

  private checkForEvents() {
    if (GameRules.simTime < FIRST_EVENT_DELAY) return;

    // Weighted random event selection
    const eligible: EventDef[] = [];
    let totalWeight = 0;

    for (const key of Object.keys(EVENT_DEFS)) {
      const def = EVENT_DEFS[key];
      if (this.population < def.minPopulation) continue;
      if (GameRules.simTime < def.minTime) continue;
      if (GameRules.simTime - this.lastEventTime < def.cooldown) continue;

      eligible.push(def);
      totalWeight += def.weight;
    }

    if (eligible.length === 0 || totalWeight === 0) return;

    // Random chance to spawn an event (not guaranteed each check)
    if (Math.random() > 0.3) return;

    // Weighted pick
    let pick = Math.random() * totalWeight;
    for (const def of eligible) {
      pick -= def.weight;
      if (pick <= 0) {
        this.spawnEvent(def);
        break;
      }
    }
  }

  private spawnEvent(def: EventDef) {
    let event: Event | null = null;

    switch (def.name) {
      case 'Immigration':
        event = new ImmigrationEvent();
        break;
      case 'Meteor Shower':
        event = new MeteorEvent();
        break;
      default:
        return; // Not yet implemented
    }

    if (event) {
      event.start(GameRules.simTime);
      this.activeEvents.push(event);
      this.lastEventTime = GameRules.simTime;
      Base.addAlert('event', `Event: ${def.name}`);
    }
  }

  getActiveEvents(): Event[] {
    return this.activeEvents;
  }
}
