/**
 * BuildTile.ts — Build a pending floor or wall tile.
 * Character walks to a FLOOR_PENDING or WALL_PENDING tile and constructs it.
 * Lua: Duty=20, nJobExperience=2, Job=BUILDER.
 * Lua BuildBase.lua: MIN_BUILD_TILE_DURATION=2, MAX_BUILD_TILE_DURATION=5.
 * Lua World._buildTile: clears tileHealth on build.
 */

import { Task, type NeedAdvertisement } from '../Task';
import { CommandQueue } from '../../core/CommandQueue';
import { Base } from '../../core/Base';
import { TileType } from '../../world/TileTypes';
import { BUILDER } from '../../characters/CharacterConstants';
import type { TileGrid } from '../../world/TileGrid';
import type { WallAutoGen } from '../../world/WallAutoGen';

/** Lua BuildBase.lua constants */
const MIN_BUILD_TILE_DURATION = 2;
const MAX_BUILD_TILE_DURATION = 5;

export class BuildTile extends Task {
  readonly name = 'BuildTile';
  nJobExperience = 2; // Lua OptionData.lua: BuildInside/BuildSpace nJobExperience=2
  private commandId: number;
  private grid: TileGrid;
  private wallAutoGen: WallAutoGen | null;

  constructor(commandId: number, grid: TileGrid, wallAutoGen?: WallAutoGen) {
    super();
    this.commandId = commandId;
    this.grid = grid;
    this.wallAutoGen = wallAutoGen ?? null;
  }

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [{ need: 'duty', amount: 20 }];
  }

  protected onStart() {
    // Lua BuildBase:init — getDuration(MIN, MAX, BUILDER): lerp(max, min, competency)
    const comp = this.character?.tStats.tCompetency[BUILDER] ?? 0;
    this.duration = MAX_BUILD_TILE_DURATION - comp * (MAX_BUILD_TILE_DURATION - MIN_BUILD_TILE_DURATION);

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

  protected onUpdate(_dt: number) {
    if (!this.character) return;
    const cmd = CommandQueue.get(this.commandId);
    if (!cmd) { this.fail(); return; }
    // Don't count build time while character is still walking to the tile
    if (this.character.moving || this.character.path.length > 0) {
      this.elapsedTime = 0;
      return;
    }
    if (this.elapsedTime >= this.duration) {
      this.complete();
    }
  }

  protected onComplete() {
    super.onComplete();

    const cmd = CommandQueue.get(this.commandId);
    if (!cmd) return;

    // Lua World._buildTile: clear tile damage before setting tile value
    // "World.tileHealth[tileAddr] = nil"
    this.grid.clearTileHP(cmd.tileX, cmd.tileY);

    // Convert pending tile to real tile
    const tileType = this.grid.get(cmd.tileX, cmd.tileY);
    if (tileType === TileType.FLOOR_PENDING) {
      this.grid.set(cmd.tileX, cmd.tileY, TileType.FLOOR);
    } else if (tileType === TileType.WALL_PENDING) {
      this.grid.set(cmd.tileX, cmd.tileY, TileType.WALL);
    }

    // Trigger wall auto-gen around the newly completed tile
    // Lua: World._setTile triggers wall blob updates on adjacent tiles
    if (this.wallAutoGen) {
      this.wallAutoGen.update([{ x: cmd.tileX, y: cmd.tileY }]);
    }

    CommandQueue.complete(this.commandId);
  }

  /** Release command claim on failure so other builders can pick it up. */
  protected onFail() {
    CommandQueue.release(this.commandId);
  }
}
