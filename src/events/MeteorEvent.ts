/**
 * MeteorEvent.ts — Meteor shower damages tiles.
 * Mirrors GameEvents/MeteorEvent.lua.
 */

import { Event } from './Event';
import { Base } from '../core/Base';
import { SoundManager } from '../audio/SoundManager';

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

      // Audio: meteor appear warning + impact
      if (this.meteorsLanded === 1) SoundManager.playSfx('MeteorAppear');
      SoundManager.playSfx('MeteorImpact');

      // Fire meteor land callback
      this.onMeteorLandCallback?.();
      Base.addAlert('meteor', `Meteor impact! (${this.meteorsLanded}/${this.meteorCount})`);
    }
  }
}
