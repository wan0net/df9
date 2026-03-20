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
    // E-28: Lua staggers sub-events 0-60s apart (CompoundEvent.lua:68-70)
    let offset = 0;
    for (let i = 0; i < this.subEvents.length; i++) {
      this.subEvents[i].start(simTime + offset);
      if (i > 0) offset += Math.random() * 60;
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
