/**
 * ExtinguishFireBareHanded.ts — Extinguish fire without tools.
 * Mirrors Lua OptionData: SURVIVAL_NORMAL, BaseScore=6, nBravery={0.15,1},
 * Less effective than with tool. Character takes fire damage while fighting.
 */

import { Task, type NeedAdvertisement } from '../Task';
import type { Fire } from '../../hazards/Fire';
import { FIRE_DAMAGE_PER_SECOND } from '../../hazards/Fire';
import { SpatialAudio } from '../../audio/SpatialAudio';

/** Douse amount per second bare-handed (slower than tool). */
const DOUSE_RATE_BARE = 2;
/** Duration of firefighting interaction at tile. */
const INTERACT_DURATION = 6;

export class ExtinguishFireBareHanded extends Task {
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
      const nearby = this.fire.getNearbyFire(this.character.tileX, this.character.tileY);
      if (nearby) {
        this.targetX = nearby.x;
        this.targetY = nearby.y;
      } else {
        this.complete();
        return;
      }
    }

    // Take damage while fighting fire bare-handed
    this.character.takeDamage(FIRE_DAMAGE_PER_SECOND * dt * 0.5);

    // Douse the fire (slower than with tool)
    this.interactTime += dt;
    this.fire.douseTile(this.targetX, this.targetY, DOUSE_RATE_BARE * dt);

    if (this.interactTime >= this.duration) {
      SpatialAudio.playAtTile('Firefight_Stomp', this.character.tileX, this.character.tileY);
      this.complete();
    }
  }
}
