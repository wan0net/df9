/**
 * DropOffRocks.ts — Miner drops off rocks at refinery for matter.
 * Mirrors Lua DropOffRocks.lua: Duty=7, Miner job, requires HeldItem='Rock'.
 * Duration: 8–12 seconds scaled by miner competency (Lua: DROP_MIN_DURATION=8, DROP_MAX_DURATION=12).
 * Yield: DFMath.lerp(MIN, MAX, minerCompetency) × rockCount × SuperBuilder(2x).
 */

import { Task, type NeedAdvertisement } from '../Task';
import {
  GameRules,
  MAT_MINE_ROCK_MIN, MAT_MINE_ROCK_MAX,
  MAT_MINE_ROCK_MIN_LVL2, MAT_MINE_ROCK_MAX_LVL2,
} from '../../core/GameRules';
import { Base } from '../../core/Base';
import { MINER, MORALE_MINE_ASTEROID, ANGER_JOB_FAIL_MAJOR } from '../../characters/CharacterConstants';

/** Lua DropOffRocks.DROP_MIN_DURATION / DROP_MAX_DURATION */
const DROP_MIN_DURATION = 8;
const DROP_MAX_DURATION = 12;

export class DropOffRocks extends Task {
  readonly name = 'DropOffRocks';
  /** Lua OptionData: DropOffRocks has no explicit nJobExperience → inherits Task default (0).
   *  But the option entry in OptionData.lua lacks nJobExperience, so it uses the task class default. */
  nJobExperience = 0;

  /** Name of the target refinery object (Lua: RefineryDropoff vs level-2 refinery). */
  private targetName: string;
  /** Number of rocks in held item stack (Lua: tItemData.nCount). */
  private rockCount: number;

  constructor(targetName = 'RefineryDropoff', rockCount = 1) {
    super();
    this.targetName = targetName;
    this.rockCount = rockCount;
  }

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [
      { need: 'duty', amount: 7 },
    ];
  }

  protected onStart() {
    // Lua: self.nDuration = self:getDuration(DROP_MIN_DURATION, DROP_MAX_DURATION, Character.MINER)
    // getDuration lerps between max and min based on competency (higher competency = shorter).
    const comp = this.character?.tStats.tCompetency[MINER] ?? 0;
    // Lua getDuration: lerp(maxDuration, minDuration, competency)
    // Higher competency → closer to minDuration (faster)
    this.duration = DROP_MAX_DURATION - comp * (DROP_MAX_DURATION - DROP_MIN_DURATION);
  }

  protected onUpdate(dt: number) {
    if (!this.character) { this.fail(); return; }

    if (this.elapsedTime >= this.duration) {
      // Drop held rock item and convert to matter
      if (this.character.heldItem === 'Rock') {
        this.character.heldItem = null;

        // Lua: yield depends on refinery type (level 1 vs level 2)
        const minerComp = this.character.tStats.tCompetency[MINER] ?? 0;
        let min: number, max: number;
        if (this.targetName === 'RefineryDropoff') {
          min = MAT_MINE_ROCK_MIN;
          max = MAT_MINE_ROCK_MAX;
        } else {
          // Level 2 refinery (Lua: RefineryDropoffLvl2)
          min = MAT_MINE_ROCK_MIN_LVL2;
          max = MAT_MINE_ROCK_MAX_LVL2;
        }

        // Lua: DFMath.lerp(min, max, competency) — NOT random
        let nMatterYield = min + minerComp * (max - min);

        // Lua: SuperBuilder doubles yield
        if (this.character.inventory.hasItem('SuperBuilder')) {
          nMatterYield *= 2;
        }

        // Lua: GameRules.addMatter(tItemData.nCount * nMatterYield)
        const totalYield = Math.floor(this.rockCount * nMatterYield);
        GameRules.addMatter(totalYield);
        Base.incrementStat('nRocksRecycled');

        // Lua: morale reward on job success
        this.character.addMorale(MORALE_MINE_ASTEROID);

        Base.addAlert('recycle', `Rock refined for ${totalYield} matter`);
      }
      this.complete();
    }
  }
}
