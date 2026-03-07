/**
 * ImmigrationEvent.ts — New crew arrives at the station.
 * Mirrors GameEvents/ImmigrationEvent.lua.
 */

import { Event } from './Event';
import { SoundManager } from '../audio/SoundManager';

export class ImmigrationEvent extends Event {
  readonly name: string = 'Immigration';
  readonly description: string = 'New crew members arriving';

  /** Number of immigrants for this event. */
  protected immigrantCount: number;

  constructor() {
    super();
    this.immigrantCount = 1 + Math.floor(Math.random() * 2); // 1-2 immigrants (Lua: tNumSpawnsRange={1,2})
  }

  getImmigrantCount(): number {
    return this.immigrantCount;
  }

  /** Override immigrant count (used by TraderEvent). */
  setImmigrantCount(count: number) {
    this.immigrantCount = count;
  }

  private soundPlayed = false;

  protected onUpdate(dt: number) {
    if (!this.soundPlayed) {
      SoundManager.playSfx('SpaceTaxi');
      this.soundPlayed = true;
    }
    // Event completes after docking period (simplified: immediate)
    if (this.elapsedTime >= 10) {
      this.complete();
    }
  }
}
