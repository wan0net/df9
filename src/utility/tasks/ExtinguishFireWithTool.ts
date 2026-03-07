/**
 * ExtinguishFireWithTool.ts — Extinguish fire using fire extinguisher.
 * Mirrors Lua OptionData: SURVIVAL_NORMAL, BaseScore=8, nBravery={0.05,1},
 * Job=EMERGENCY gets XP. Character walks to fire tile and douses it.
 */

import { Task, type NeedAdvertisement } from '../Task';
import type { Fire } from '../../hazards/Fire';

/** Douse amount per second with tool (much faster than bare-handed). */
const DOUSE_RATE_WITH_TOOL = 5;
/** Duration of firefighting interaction at tile. */
const INTERACT_DURATION = 4;

export class ExtinguishFireWithTool extends Task {
  readonly name = 'ExtinguishFire';
  nJobExperience = 20;

  private fire: Fire;
  private interactTime = 0;

  constructor(fire: Fire) {
    super();
    this.fire = fire;
  }

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [];
  }

  protected onStart() {
    this.duration = INTERACT_DURATION;
    this.interactTime = 0;
  }

  protected onUpdate(dt: number) {
    if (!this.character) { this.fail(); return; }

    // Check if fire still exists at target
    if (!this.fire.isOnFire(this.targetX, this.targetY)) {
      // Fire already out — check nearby fires
      const nearby = this.fire.getNearbyFire(this.character.tileX, this.character.tileY);
      if (nearby) {
        this.targetX = nearby.x;
        this.targetY = nearby.y;
      } else {
        this.complete();
        return;
      }
    }

    // Douse the fire
    this.interactTime += dt;
    this.fire.douseTile(this.targetX, this.targetY, DOUSE_RATE_WITH_TOOL * dt);

    if (this.interactTime >= this.duration) {
      this.complete();
    }
  }
}
