/**
 * Pub.ts — Pub zone subclass.
 * Mirrors Zones/Pub.lua: capacity tracking, bartender management.
 */

import { Zone } from './Zone';
import { ZoneType } from '../world/ZoneType';

/** Lua CharacterConstants.PUB_CAPACITY = 3 (tiles per base capacity slot) */
const PUB_CAPACITY = 3;
/** Lua CharacterConstants.PUB_CITIZENS_PER_BARTENDER = 5 */
const PUB_CITIZENS_PER_BARTENDER = 5;

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

  /** Get capacity based on room size + bartenders (Lua Pub:getCapacity). */
  getCapacity(): number {
    if (!this.room) return 0;
    if (!this.hasBartender()) return 0;
    return Math.floor(this.room.size / PUB_CAPACITY) + this.bartenders.size * PUB_CITIZENS_PER_BARTENDER;
  }

  /** Check if pub is at capacity (Lua: occupants - bartenders >= capacity). */
  atCapacity(): boolean {
    if (!this.room) return false;
    const nOccupants = this.room.nCharacters;
    return (nOccupants - this.bartenders.size) >= this.getCapacity();
  }
}
