/**
 * SpatialAudio.ts — 3D positional audio manager for in-game objects.
 * Manages looping sounds for machines, fires, and one-shot spatial effects.
 */

import { SoundManager } from './SoundManager';
import { tileToScreen } from '../world/IsometricUtils';
import { TILE_HALF_W, TILE_HALF_H } from '../config';

/** Active spatial loop. */
interface SpatialLoop {
  cue: string;
  tileX: number;
  tileY: number;
  worldX: number;
  worldY: number;
  sourceKey: string;
}

/** Pending position update for a loop (applied next startLoop or updateLoopPosition). */
interface LoopPositionUpdate {
  tileX: number;
  tileY: number;
}

class SpatialAudioClass {
  private activeLoops: Map<string, SpatialLoop> = new Map();

  /** Play a one-shot 3D positioned sound at a tile. */
  playAtTile(cue: string, tileX: number, tileY: number) {
    const pos = tileToScreen(tileX, tileY);
    SoundManager.playSfx3D(cue, pos.x + TILE_HALF_W, pos.y + TILE_HALF_H);
  }

  /** Start a looping sound at a tile (e.g., machine hum, fire).
   *  If the loop already exists at the same position, does nothing.
   *  If the loop already exists at a different position, restarts it at the new position. */
  startLoop(key: string, cue: string, tileX: number, tileY: number) {
    const existing = this.activeLoops.get(key);
    if (existing) {
      // Already running — update position if it moved
      if (existing.tileX !== tileX || existing.tileY !== tileY) {
        this.updateLoopPosition(key, tileX, tileY);
      }
      return;
    }
    const pos = tileToScreen(tileX, tileY);
    const worldX = pos.x + TILE_HALF_W;
    const worldY = pos.y + TILE_HALF_H;
    const sourceKey = `spatial_${key}`;

    // Actually create the looping audio source
    SoundManager.playLoop3D(cue, worldX, worldY, sourceKey);

    this.activeLoops.set(key, {
      cue, tileX, tileY, worldX, worldY, sourceKey,
    });
  }

  /** Update the position of an existing loop (stops + restarts at new position). */
  updateLoopPosition(key: string, tileX: number, tileY: number) {
    const loop = this.activeLoops.get(key);
    if (!loop) return;
    // Stop old source
    SoundManager.stopLoopByKey(loop.sourceKey);
    // Update position
    const pos = tileToScreen(tileX, tileY);
    loop.tileX = tileX;
    loop.tileY = tileY;
    loop.worldX = pos.x + TILE_HALF_W;
    loop.worldY = pos.y + TILE_HALF_H;
    // Restart at new position
    SoundManager.playLoop3D(loop.cue, loop.worldX, loop.worldY, loop.sourceKey);
  }

  /** Stop a looping sound. */
  stopLoop(key: string) {
    const loop = this.activeLoops.get(key);
    if (loop) {
      SoundManager.stopLoopByKey(loop.sourceKey);
      this.activeLoops.delete(key);
    }
  }

  /** Check if a loop is active. */
  isLooping(key: string): boolean {
    return this.activeLoops.has(key);
  }

  /** Get all active spatial loops. */
  getActiveLoops(): { key: string; cue: string; tileX: number; tileY: number }[] {
    return Array.from(this.activeLoops.entries()).map(([key, loop]) => ({
      key, cue: loop.cue, tileX: loop.tileX, tileY: loop.tileY,
    }));
  }

  // ── Convenience methods for common game sounds ────────────────

  /** Door opened at tile. */
  doorOpen(tileX: number, tileY: number) {
    this.playAtTile('DoorOpen', tileX, tileY);
  }

  /** Door closed at tile. */
  doorClose(tileX: number, tileY: number) {
    this.playAtTile('DoorClose', tileX, tileY);
  }

  /** Play one-shot fire-start SFX at tile (does NOT create per-tile loop). */
  fireStartSfx(tileX: number, tileY: number) {
    this.playAtTile('FireStartExtra', tileX, tileY);
  }

  /** Update the single global fire loop: compute average position of all burning tiles.
   *  Call once per fire tick from Fire.onTick.
   *  If fires is empty, stops the loop. */
  updateFireLoop(fires: { x: number; y: number }[]) {
    const FIRE_LOOP_KEY = 'fire_global';
    if (fires.length === 0) {
      this.stopLoop(FIRE_LOOP_KEY);
      return;
    }
    let sx = 0, sy = 0;
    for (const f of fires) { sx += f.x; sy += f.y; }
    const avgX = Math.round(sx / fires.length);
    const avgY = Math.round(sy / fires.length);
    // Start or reposition the single global fire loop
    this.startLoop(FIRE_LOOP_KEY, 'FireLoop', avgX, avgY);
  }

  /** Melee hit at position. */
  meleeHit(tileX: number, tileY: number) {
    this.playAtTile('Brawl_Impact', tileX, tileY);
  }

  /** Laser hit at position. */
  laserHit(tileX: number, tileY: number) {
    this.playAtTile('Laser_Impact', tileX, tileY);
  }

  /** Meteor impact at position. */
  meteorImpact(tileX: number, tileY: number) {
    this.playAtTile('MeteorImpact', tileX, tileY);
  }

  /** Wall destroyed at position. */
  wallExplode(tileX: number, tileY: number) {
    this.playAtTile('WallExplode', tileX, tileY);
  }

  /** Reactor loop at object position. */
  reactorStart(objectId: string, tileX: number, tileY: number) {
    this.startLoop(`reactor_${objectId}`, 'ReactorLoop', tileX, tileY);
  }

  reactorStop(objectId: string) {
    this.stopLoop(`reactor_${objectId}`);
  }

  /** Jukebox toggle. */
  jukeboxStart(objectId: string, tileX: number, tileY: number) {
    this.startLoop(`jukebox_${objectId}`, 'Jukebox_Music', tileX, tileY);
  }

  jukeboxStop(objectId: string) {
    this.stopLoop(`jukebox_${objectId}`);
  }
}

export const SpatialAudio = new SpatialAudioClass();
