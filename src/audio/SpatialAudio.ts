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
}

class SpatialAudioClass {
  private activeLoops: Map<string, SpatialLoop> = new Map();

  /** Play a one-shot 3D positioned sound at a tile. */
  playAtTile(cue: string, tileX: number, tileY: number) {
    const pos = tileToScreen(tileX, tileY);
    SoundManager.playSfx3D(cue, pos.x + TILE_HALF_W, pos.y + TILE_HALF_H);
  }

  /** Start a looping sound at a tile (e.g., machine hum). */
  startLoop(key: string, cue: string, tileX: number, tileY: number) {
    if (this.activeLoops.has(key)) return;
    const pos = tileToScreen(tileX, tileY);
    this.activeLoops.set(key, {
      cue,
      tileX, tileY,
      worldX: pos.x + TILE_HALF_W,
      worldY: pos.y + TILE_HALF_H,
    });
    // Note: actual looping audio requires AudioBufferSourceNode management
    // For now, just track the loop state
  }

  /** Stop a looping sound. */
  stopLoop(key: string) {
    this.activeLoops.delete(key);
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

  /** Fire started at tile. */
  fireStart(tileX: number, tileY: number) {
    this.playAtTile('FireStartExtra', tileX, tileY);
    this.startLoop(`fire_${tileX}_${tileY}`, 'FireLoop', tileX, tileY);
  }

  /** Fire extinguished at tile. */
  fireEnd(tileX: number, tileY: number) {
    this.stopLoop(`fire_${tileX}_${tileY}`);
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
