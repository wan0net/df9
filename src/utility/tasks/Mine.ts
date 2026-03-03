/**
 * Mine.ts — Mining task for extracting matter from asteroids.
 * Character walks to a queued asteroid command, spends time mining,
 * then converts the asteroid to space and adds matter.
 */

import { Task, type NeedAdvertisement } from '../Task';
import { CommandQueue } from '../../core/CommandQueue';
import { GameRules } from '../../core/GameRules';
import { Base } from '../../core/Base';
import { TileType } from '../../world/TileTypes';
import { isAsteroid, getMiningYield } from '../../world/Asteroid';
import type { TileGrid } from '../../world/TileGrid';

export class Mine extends Task {
  readonly name = 'Mine';
  private commandId: number;
  private grid: TileGrid;

  constructor(commandId: number, grid: TileGrid) {
    super();
    this.commandId = commandId;
    this.grid = grid;
  }

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [{ need: 'duty', amount: 35 }];
  }

  protected onStart() {
    this.duration = 20;

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

    // Mine it: yield matter, convert to space
    const yield_ = getMiningYield();
    GameRules.nMatter += yield_;
    this.grid.set(cmd.tileX, cmd.tileY, TileType.SPACE);
    CommandQueue.complete(this.commandId);

    Base.addAlert('mining', `${this.character?.getName() ?? 'Miner'} mined asteroid: +${yield_} matter`);
  }
}
