/**
 * BuildEnvObject.ts — Build ghost/queued environment objects.
 * Character walks to an unbuilt object and constructs it.
 */

import { Task, type NeedAdvertisement } from '../Task';
import { CommandQueue } from '../../core/CommandQueue';
import { Base } from '../../core/Base';
import { TileType } from '../../world/TileTypes';
import { MORALE_BUILD_BASE } from '../../characters/CharacterConstants';
import { Door } from '../../envobjects/Door';
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

    // Door-type objects: convert wall tile(s) to DOOR when construction completes
    if (this.targetObj.tData.door && this.grid) {
      const convertToDoor = (tx: number, ty: number) => {
        const current = this.grid!.get(tx, ty);
        if (current === TileType.WALL || current === TileType.WALL_PENDING) {
          if (current === TileType.WALL_PENDING) {
            for (const cmd of CommandQueue.getAllActive()) {
              if (cmd.type === 'build_tile' && cmd.tileX === tx && cmd.tileY === ty) {
                CommandQueue.complete(cmd.id);
                break;
              }
            }
          }
          this.grid!.set(tx, ty, TileType.DOOR);
        }
      };
      convertToDoor(this.targetObj.tileX, this.targetObj.tileY);
      // Also convert second tile for 2-wide doors (e.g. Airlock)
      if (this.targetObj instanceof Door && this.targetObj.secondTileX >= 0) {
        convertToDoor(this.targetObj.secondTileX, this.targetObj.secondTileY);
      }
    }

    CommandQueue.complete(this.commandId);

    // mirrors Character.lua:2795 — builder gets morale on completing construction
    this.character?.addMorale(MORALE_BUILD_BASE);

    Base.addAlert('build', `${this.character?.getName() ?? 'Builder'} built ${this.targetObj.tData.friendlyName}`);
  }
}
