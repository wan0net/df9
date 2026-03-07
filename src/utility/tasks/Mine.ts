/**
 * Mine.ts — Mining task for extracting matter from asteroids.
 * Mirrors Lua MineInside/MineSpace: character walks to asteroid, mines it
 * (partial decay via Asteroid.vaporizeTile), yields matter.
 * Lua: Duty=20, nJobExperience=24, Job=MINER.
 */

import { Task, type NeedAdvertisement } from '../Task';
import { CommandQueue } from '../../core/CommandQueue';
import { GameRules } from '../../core/GameRules';
import { Base } from '../../core/Base';
import { isAsteroid, getMiningYield, vaporizeTile } from '../../world/Asteroid';
import { MINER } from '../../characters/CharacterConstants';
import type { TileGrid } from '../../world/TileGrid';

// Lua getDuration(max, min, competency): lerp from max→min as skill increases
const MIN_MINE_DURATION = 8;  // fast (high competency)
const MAX_MINE_DURATION = 20; // slow (low competency)

export class Mine extends Task {
  readonly name = 'Mine';
  nJobExperience = 24; // Lua OptionData.lua: MineInside/MineSpace nJobExperience=24
  private commandId: number;
  private grid: TileGrid;

  constructor(commandId: number, grid: TileGrid) {
    super();
    this.commandId = commandId;
    this.grid = grid;
  }

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [{ need: 'duty', amount: 20 }]; // Lua: Duty=20
  }

  protected onStart() {
    // Lua getDuration(max, min, MINER): lerp from max→min based on competency
    const comp = this.character?.tStats.tCompetency[MINER] ?? 0;
    this.duration = MAX_MINE_DURATION - comp * (MAX_MINE_DURATION - MIN_MINE_DURATION);

    // Verify target tile is still asteroid
    const cmd = CommandQueue.get(this.commandId);
    if (!cmd) {
      this.fail();
      return;
    }

    const tileVal = this.grid.get(cmd.tileX, cmd.tileY);
    if (!isAsteroid(tileVal)) {
      CommandQueue.cancel(this.commandId);
      this.fail();
      return;
    }

    // Claim the command
    if (this.character) {
      if (!CommandQueue.claim(this.commandId, this.character.id)) {
        this.fail();
        return;
      }
    }
  }

  protected onUpdate(dt: number) {
    if (this.elapsedTime >= this.duration) {
      this.complete();
    }
  }

  protected onComplete() {
    super.onComplete(); // Satisfy needs

    const cmd = CommandQueue.get(this.commandId);
    if (!cmd) return;

    // Verify tile is still asteroid
    const tileVal = this.grid.get(cmd.tileX, cmd.tileY);
    if (!isAsteroid(tileVal)) {
      CommandQueue.complete(this.commandId);
      return;
    }

    // Get miner skill level from character (Lua: competency >= 0.16 = level 2)
    const minerComp = this.character?.tStats.tCompetency[MINER] ?? 0;
    const minerLevel = minerComp >= 0.16 ? 2 : 1;

    // Mine it: yield matter, decay asteroid (Lua: Asteroid.vaporizeTile with bCompletely=false)
    const yield_ = getMiningYield(minerLevel);
    GameRules.addMatter(yield_);

    const { removed } = vaporizeTile(this.grid, cmd.tileX, cmd.tileY, false);

    // Only complete the command if the asteroid is fully mined
    if (removed) {
      CommandQueue.complete(this.commandId);
    } else {
      // Release claim so another miner (or same miner) can continue
      CommandQueue.release(this.commandId);
    }

    Base.addAlert('mining', `${this.character?.getName() ?? 'Miner'} mined asteroid: +${yield_} matter`);
  }
}
