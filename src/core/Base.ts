/**
 * Base.ts — Colony-wide state tracking.
 * Mirrors Base.lua: events, bed assignments, alert log.
 */

import { GameRules, type TickableSystem } from './GameRules';

/** Base event types matching Lua */
export const BASE_EVENT = {
  BREACH: 'breach',
  FIRE: 'fire',
  METEOR: 'meteor',
  IMMIGRATION: 'immigration',
  HOSTILE: 'hostile',
  DEATH: 'death',
} as const;

export interface BaseAlert {
  type: string;
  message: string;
  time: number;
}

class BaseClass implements TickableSystem {
  /** Bed assignments: bed object ID → character ID */
  tBedToChar: Map<number, number> = new Map();
  /** Character → bed: character ID → bed object ID */
  tCharToBed: Map<number, number> = new Map();

  /** Alert/event log */
  alerts: BaseAlert[] = [];

  /** Max alerts to keep */
  private maxAlerts = 50;

  init() {
    this.tBedToChar.clear();
    this.tCharToBed.clear();
    this.alerts = [];

    // Register at slot 13 (Base.onTick in Lua tick order)
    GameRules.registerSystem(13, this);
  }

  /** Assign a character to a bed. */
  assignBed(bedId: number, charId: number) {
    // Unassign old bed if character had one
    const oldBed = this.tCharToBed.get(charId);
    if (oldBed !== undefined) {
      this.tBedToChar.delete(oldBed);
    }

    // Unassign old character from this bed
    const oldChar = this.tBedToChar.get(bedId);
    if (oldChar !== undefined) {
      this.tCharToBed.delete(oldChar);
    }

    this.tBedToChar.set(bedId, charId);
    this.tCharToBed.set(charId, bedId);
  }

  /** Unassign a bed. */
  unassignBed(bedId: number) {
    const charId = this.tBedToChar.get(bedId);
    if (charId !== undefined) {
      this.tCharToBed.delete(charId);
    }
    this.tBedToChar.delete(bedId);
  }

  /** Get the bed assigned to a character, or undefined. */
  getBedForChar(charId: number): number | undefined {
    return this.tCharToBed.get(charId);
  }

  /** Get the character assigned to a bed, or undefined. */
  getCharForBed(bedId: number): number | undefined {
    return this.tBedToChar.get(bedId);
  }

  /** Log an alert. */
  addAlert(type: string, message: string) {
    this.alerts.unshift({
      type,
      message,
      time: GameRules.simTime,
    });
    if (this.alerts.length > this.maxAlerts) {
      this.alerts.pop();
    }
  }

  /** Get recent alerts. */
  getRecentAlerts(count = 5): BaseAlert[] {
    return this.alerts.slice(0, count);
  }

  onTick(_dt: number) {
    // Periodic checks will be added as systems are implemented
  }
}

/** Global singleton */
export const Base = new BaseClass();
