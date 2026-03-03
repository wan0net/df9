/**
 * MeteorEvent.ts — Meteor shower damages tiles.
 * Mirrors GameEvents/MeteorEvent.lua.
 */

import { Event } from './Event';
import { Base } from '../core/Base';

export class MeteorEvent extends Event {
  readonly name = 'Meteor';
  readonly description = 'Incoming meteor shower!';

  private meteorCount: number;
  private meteorsLanded = 0;
  private nextMeteorTime = 0;

  /** Callback fired each time a meteor lands. */
  onMeteorLandCallback: (() => void) | null = null;

  constructor() {
    super();
    this.meteorCount = 2 + Math.floor(Math.random() * 4); // 2-5 meteors
  }

  protected onUpdate(dt: number) {
    if (this.meteorsLanded >= this.meteorCount) {
      this.complete();
      return;
    }

    if (this.elapsedTime >= this.nextMeteorTime) {
      this.meteorsLanded++;
      this.nextMeteorTime = this.elapsedTime + 2 + Math.random() * 3;

      // Fire meteor land callback
      this.onMeteorLandCallback?.();
      Base.addAlert('meteor', `Meteor impact! (${this.meteorsLanded}/${this.meteorCount})`);
    }
  }
}
