/**
 * CompoundEvent.ts — Event composed of multiple sub-events.
 * Mirrors GameEvents/CompoundEvent.lua.
 */

import { Event, EVENT_STATUS } from './Event';

export class CompoundEvent extends Event {
  readonly name = 'Compound';
  readonly description = 'Multiple events occurring';

  private subEvents: Event[] = [];

  addSubEvent(event: Event) {
    this.subEvents.push(event);
  }

  start(simTime: number) {
    super.start(simTime);
    for (const event of this.subEvents) {
      event.start(simTime);
    }
  }

  protected onUpdate(dt: number) {
    let allComplete = true;
    for (const event of this.subEvents) {
      event.update(dt);
      if (event.isActive()) allComplete = false;
    }
    if (allComplete) {
      this.complete();
    }
  }
}
