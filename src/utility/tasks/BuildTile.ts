/**
 * BuildTile.ts — Build a pending floor or wall tile.
 * Character walks to a FLOOR_PENDING or WALL_PENDING tile and constructs it.
 */

import { Task, type NeedAdvertisement } from '../Task';
import { CommandQueue } from '../../core/CommandQueue';
import { Base } from '../../core/Base';
import { TileType } from '../../world/TileTypes';
import type { TileGrid } from '../../world/TileGrid';

export class BuildTile extends Task {
  readonly name = 'BuildTile';
  private commandId: number;
  private grid: TileGrid;

  constructor(commandId: number, grid: TileGrid) {
    super();
    this.commandId = commandId;
    this.grid = grid;
  }

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [{ need: 'duty', amount: 20 }];
  }

  protected onStart() {
    this.duration = 5; // 5 seconds to build a tile

    const cmd = CommandQueue.get(this.commandId);
    if (!cmd) {
      this.fail();
      return;
    }

    // Verify tile is still pending
    const tileType = this.grid.get(cmd.tileX, cmd.tileY);
    if (tileType !== TileType.FLOOR_PENDING && tileType !== TileType.WALL_PENDING) {
      CommandQueue.complete(this.commandId);
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
    super.onComplete();

    const cmd = CommandQueue.get(this.commandId);
    if (!cmd) return;

    // Convert pending tile to real tile
    const tileType = this.grid.get(cmd.tileX, cmd.tileY);
    if (tileType === TileType.FLOOR_PENDING) {
      this.grid.set(cmd.tileX, cmd.tileY, TileType.FLOOR);
    } else if (tileType === TileType.WALL_PENDING) {
      this.grid.set(cmd.tileX, cmd.tileY, TileType.WALL);
    }

    CommandQueue.complete(this.commandId);
    Base.addAlert('build', `${this.character?.getName() ?? 'Builder'} built tile at (${cmd.tileX}, ${cmd.tileY})`);
  }
}
