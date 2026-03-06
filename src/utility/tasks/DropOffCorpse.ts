/**
 * DropOffCorpse.ts — Janitor carries a corpse to the recycler for matter.
 * Mirrors Activities/DropOffCorpse.lua.
 */

import { Task, type NeedAdvertisement } from '../Task';
import { GameRules, MAT_CORPSE_MIN, MAT_CORPSE_MAX } from '../../core/GameRules';
import { Base } from '../../core/Base';
import { MORALE_MINE_ASTEROID, JANITOR } from '../../characters/CharacterConstants';
import { addLog } from '../../characters/Log';
import { CORPSE_TYPE_RAIDER, CORPSE_TYPE_MONSTER } from '../../pickups/Corpse';

export class DropOffCorpse extends Task {
  readonly name = 'DropOffCorpse';
  nJobExperience = 15;
  /** The corpse type for log distinction. */
  private corpseType = 1; // CORPSE_TYPE_FRIENDLY default
  /** Name of the deceased (for log). */
  private deceasedName = '';

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [{ need: 'duty', amount: 8 }];
  }

  /** Set corpse metadata before task starts. */
  setCorpseData(deceasedName: string, corpseType: number): void {
    this.deceasedName = deceasedName;
    this.corpseType = corpseType;
  }

  protected onStart() {
    this.duration = 2; // Lua: nDuration = 2
  }

  protected onUpdate(dt: number) {
    if (this.elapsedTime >= this.duration) {
      // Convert corpse to matter (Lua: math.random(MAT_CORPSE_MIN, MAT_CORPSE_MAX))
      const matter = MAT_CORPSE_MIN + Math.floor(Math.random() * (MAT_CORPSE_MAX - MAT_CORPSE_MIN + 1));
      GameRules.nMatter += matter;
      Base.incrementStat('nCorpsesRecycled');

      // Morale reward (Lua: MORALE_MINE_ASTEROID)
      this.character?.addMorale(MORALE_MINE_ASTEROID);

      // Log by corpse type (Lua DropOffCorpse.lua:35-46)
      const logData = { sDeceased: this.deceasedName };
      if (this.corpseType === CORPSE_TYPE_RAIDER) {
        addLog('DUTY_JANITOR_REFINE_CORPSE_RAIDER', this.character!, logData);
      } else if (this.corpseType === CORPSE_TYPE_MONSTER) {
        addLog('DUTY_JANITOR_REFINE_CORPSE_MONSTER', this.character!, logData);
      } else {
        addLog('DUTY_JANITOR_REFINE_CORPSE_FRIENDLY', this.character!, logData);
      }

      Base.addAlert('recycle', `Corpse recycled for ${matter} matter`);
      this.complete();
    }
  }
}
