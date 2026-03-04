/**
 * BuildEnvObject.ts — Build ghost/queued environment objects.
 * Character walks to an unbuilt object and constructs it.
 */

import { Task, type NeedAdvertisement } from '../Task';
import { CommandQueue } from '../../core/CommandQueue';
import { Base } from '../../core/Base';
import { TileType } from '../../world/TileTypes';
import type { EnvObject } from '../../envobjects/EnvObject';
import type { TileGrid } from '../../world/TileGrid';

export class BuildEnvObject extends Task {
  readonly name = 'BuildEnvObject';
  private targetObj: EnvObject;
  private commandId: number;
  private grid: TileGrid | null = null;

  constructor(targetObj: EnvObject, commandId: number, grid?: TileGrid) {
    super();
    this.targetObj = targetObj;
    this.commandId = commandId;
    this.grid = grid ?? null;
  }

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [{ need: 'duty', amount: 25 }];
  }

  protected onStart() {
    this.duration = 10;

    // Verify object is still unbuilt
    if (this.targetObj.bBuilt) {
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
    super.onComplete(); // Satisfy needs

    // Build the object
    this.targetObj.markBuilt();
    if (this.character) {
      this.targetObj.sBuilderName = this.character.getName();
    }

    // Door-type objects: convert the wall tile to DOOR when construction completes
    if (this.targetObj.tData.door && this.grid) {
      const { tileX, tileY } = this.targetObj;
      const current = this.grid.get(tileX, tileY);
      if (current === TileType.WALL || current === TileType.WALL_PENDING) {
        // Complete any pending wall build command
        if (current === TileType.WALL_PENDING) {
          for (const cmd of CommandQueue.getAllActive()) {
            if (cmd.type === 'build_tile' && cmd.tileX === tileX && cmd.tileY === tileY) {
              CommandQueue.complete(cmd.id);
              break;
            }
          }
        }
        this.grid.set(tileX, tileY, TileType.DOOR);
      }
    }

    CommandQueue.complete(this.commandId);

    Base.addAlert('build', `${this.character?.getName() ?? 'Builder'} built ${this.targetObj.tData.friendlyName}`);
  }
}
