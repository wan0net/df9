/**
 * Pub.ts — Pub zone subclass.
 * Mirrors Zones/Pub.lua: capacity tracking, bartender management.
 */

import { Zone } from './Zone';
import { ZoneType } from '../world/ZoneType';

/** Tiles per capacity slot (from Lua: capacity = tiles / PUB_CAPACITY) */
const PUB_CAPACITY_DIVISOR = 4;

export class Pub extends Zone {
  private bartenders: Set<number> = new Set();
  private hasBarObject = false;

  constructor() {
    super(ZoneType.PUB);
  }

  protected generateUniqueName(): string {
    const adjectives = ['Rusty', 'Golden', 'Starlit', 'Crimson', 'Cosmic', 'Neon', 'Dusty', 'Jolly'];
    const nouns = ['Nebula', 'Comet', 'Asteroid', 'Pulsar', 'Quasar', 'Nova', 'Void', 'Meteor'];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    return `The ${adj} ${noun}`;
  }

  /** Register a bar object in this pub. */
  setHasBar(has: boolean) {
    this.hasBarObject = has;
  }

  hasBar(): boolean {
    return this.hasBarObject;
  }

  /** Add a bartender. */
  addBartender(charId: number) {
    this.bartenders.add(charId);
  }

  /** Remove a bartender. */
  removeBartender(charId: number) {
    this.bartenders.delete(charId);
  }

  hasBartender(): boolean {
    return this.bartenders.size > 0;
  }

  /** Get capacity based on room size. */
  getCapacity(): number {
    if (!this.room) return 0;
    return Math.max(1, Math.floor(this.room.size / PUB_CAPACITY_DIVISOR));
  }

  /** Check if pub is at capacity (for AI decisions). */
  atCapacity(): boolean {
    // Will check against current visitor count once characters track location
    return false;
  }
}
