/**
 * TraderEvent.ts — A single trader arrives at the station.
 * Mirrors GameEvents/TraderEvent.lua: extends ImmigrationEvent, forces nNumSpawns=1.
 */

import { ImmigrationEvent } from './ImmigrationEvent';

export class TraderEvent extends ImmigrationEvent {
  override readonly name = 'Trader';
  override readonly description = 'A trader has arrived';

  constructor() {
    super();
    // Lua TraderEvent._prerollTrader: nNumSpawns = 1
    this.setImmigrantCount(1);
  }
}
