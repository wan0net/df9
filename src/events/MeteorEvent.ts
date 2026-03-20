/**
 * MeteorEvent.ts — Duration-based meteor shower with intensity curve.
 * Mirrors GameEvents/MeteorEvent.lua: pre-generates all meteors on first tick,
 * then ticks each through approach -> impact/pass-through lifecycle.
 */

import { Event } from './Event';
import { Base } from '../core/Base';
import { SoundManager } from '../audio/SoundManager';
import { line } from '../localization/Localization';
import { GRID_W, GRID_H, TILE_STARTING_HIT_POINTS } from '../config';

// Lua MeteorEvent.lua:22 — METEOR_STRIKE_RADIUS = 256*3 = 768 world units.
// In our tile coords: 768 / 128 = 6 tiles radius.
const METEOR_STRIKE_RADIUS_TILES = 6;

/** Meteor approach duration in seconds (Lua: randomFloat(2.9, 3.1)). */
const METEOR_APPROACH_MIN = 2.9;
const METEOR_APPROACH_MAX = 3.1;

/** Per-meteor state matching Lua tMeteor table. */
interface Meteor {
  tx: number;
  ty: number;
  nSize: number;
  /** Absolute start time (relative to event elapsedTime). */
  nStartTime: number;
  /** Approach duration in seconds. */
  nDuration: number;
  bStarted: boolean;
  bGoingAway: boolean;
  bDone: boolean;
}

/**
 * Callback for meteor impact on a non-SPACE tile.
 * @param tx - tile x
 * @param ty - tile y
 * @param nSize - meteor size (0-1), controls damage/fire/shake thresholds
 * @param nDamage - pre-computed damage = TILE_STARTING_HIT_POINTS * nSize * 0.3
 */
export type MeteorImpactFn = (tx: number, ty: number, nSize: number, nDamage: number) => void;

export class MeteorEvent extends Event {
  readonly name = 'Meteor';
  readonly description = 'Incoming meteor shower!';

  /** Difficulty factor (0-1) passed from EventController. */
  private difficulty: number;
  /** Duration of the shower in seconds (Lua: 12 + (rand(0,2)+6)*difficulty). */
  private nDuration: number;
  /** Center tile of the shower. */
  private centerTX: number;
  private centerTY: number;

  /** All pre-generated meteors. */
  private meteors: Meteor[] = [];
  private bStarted = false;

  /** Callback fired for each meteor impact on a solid tile. */
  onMeteorImpact: MeteorImpactFn | null = null;

  /**
   * @param difficulty - Event difficulty (0-1), affects duration and intensity.
   * @param centerTX - Center tile X for the shower (defaults to random indoor target).
   * @param centerTY - Center tile Y for the shower.
   * @param getTileType - Callback to read tile type at (tx,ty). Returns TileType value.
   *   SPACE=1 means meteor passes through. Anything else = impact.
   */
  constructor(
    difficulty = 0.5,
    centerTX?: number,
    centerTY?: number,
    private getTileType?: (tx: number, ty: number) => number,
  ) {
    super();
    this.difficulty = difficulty;

    // Lua MeteorEvent.onQueue: nDuration = 12 + (randomFloat(0,2) + 6) * difficulty
    this.nDuration = 12 + (Math.random() * 2 + 6) * this.difficulty;

    // Default center: random point in the middle of the grid
    this.centerTX = centerTX ?? 64 + Math.floor(Math.random() * 128);
    this.centerTY = centerTY ?? 64 + Math.floor(Math.random() * 128);

    // Clamp center so strike radius stays in bounds (Lua lines 76-81)
    const buffer = METEOR_STRIKE_RADIUS_TILES + 1;
    this.centerTX = Math.max(buffer, Math.min(GRID_W - 1 - buffer, this.centerTX));
    this.centerTY = Math.max(buffer, Math.min(GRID_H - 1 - buffer, this.centerTY));
  }

  /**
   * Random point within radius of center (Lua _randomPointInRadius).
   * Uses polar distribution with 0.66 Y compression matching Lua's isometric squash.
   */
  private randomPointInRadius(cx: number, cy: number, radius: number): { tx: number; ty: number } {
    const r = Math.random() * radius;
    const angle = Math.random() * 2 * Math.PI;
    const dx = r * Math.sin(angle);
    const dy = r * Math.cos(angle) * 0.66;
    let tx = Math.round(cx + dx);
    let ty = Math.round(cy + dy);
    // Clamp to grid bounds
    tx = Math.max(0, Math.min(GRID_W - 1, tx));
    ty = Math.max(0, Math.min(GRID_H - 1, ty));
    return { tx, ty };
  }

  /**
   * Pre-generate all meteors for the full duration (Lua lines 117-143).
   * Intensity builds to peak at 65% then falls. Each "second" spawns 2-5 meteors.
   */
  private generateMeteors() {
    const nDuration = Math.floor(this.nDuration);
    const nPeakIntensity = this.nDuration * 0.65;

    for (let i = 1; i <= nDuration; i++) {
      // Lua intensity curve: quadratic ramp up, quadratic fall off
      let nIntensity: number;
      if (i <= nPeakIntensity) {
        nIntensity = i / nPeakIntensity;
      } else {
        nIntensity = (nDuration - i + 1) / (nDuration - nPeakIntensity + 1);
      }
      nIntensity = nIntensity * nIntensity;

      // Lua: 2 + floor(intensity * 3) meteors per second
      const nNumMeteors = 2 + Math.floor(nIntensity * 3);

      for (let j = 0; j < nNumMeteors; j++) {
        // Lua: first meteor of each second gets full intensity size, rest get random * 0.5
        const nMeteorSize = (j === 0) ? nIntensity : Math.random() * nIntensity * 0.5;

        const pos = this.randomPointInRadius(
          this.centerTX,
          this.centerTY,
          METEOR_STRIKE_RADIUS_TILES,
        );

        this.meteors.push({
          tx: pos.tx,
          ty: pos.ty,
          nSize: nMeteorSize,
          // Lua: startTime = elapsedTime + (i-1) + random() — staggered 1s apart with jitter
          nStartTime: (i - 1) + Math.random(),
          // Lua: randomFloat(2.9, 3.1)
          nDuration: METEOR_APPROACH_MIN + Math.random() * (METEOR_APPROACH_MAX - METEOR_APPROACH_MIN),
          bStarted: false,
          bGoingAway: false,
          bDone: false,
        });
      }
    }
  }

  protected onUpdate(dt: number) {
    // First tick: generate all meteors and play appear sound (Lua lines 90-147)
    if (!this.bStarted) {
      this.generateMeteors();
      SoundManager.playSfx('MeteorAppear');
      Base.addAlert('meteor', line('ALERTS033TEXT'));
      this.bStarted = true;
      return;
    }

    // Tick each meteor through its lifecycle (Lua lines 148-215)
    let allDone = true;

    for (const m of this.meteors) {
      if (m.bDone) continue;
      allDone = false;

      if (!m.bStarted) {
        // Not yet started — wait for start time
        if (this.elapsedTime >= m.nStartTime) {
          m.bStarted = true;
        }
        continue;
      }

      if (m.bGoingAway) {
        // Meteor passed through SPACE tile — animate away (Lua lines 161-170)
        const nFraction = Math.min(1, 2 * (this.elapsedTime - m.nStartTime - m.nDuration) / m.nDuration);
        if (nFraction >= 1) {
          m.bDone = true;
        }
        continue;
      }

      // Approaching target (Lua lines 171-213)
      const nFraction = Math.min(1, Math.max(this.elapsedTime - m.nStartTime, 0) / m.nDuration);

      if (nFraction >= 1) {
        // Reached target tile — check if SPACE or solid
        const tileVal = this.getTileType?.(m.tx, m.ty) ?? 1; // default SPACE=1
        const SPACE = 1; // TileType.SPACE

        if (tileVal === SPACE) {
          // Pass through space — animate away (Lua line 179-181)
          m.bGoingAway = true;
        } else {
          // Impact on solid tile (Lua lines 183-210)
          m.bDone = true;

          // Compute damage: Lua nDamage = TILE_STARTING_HIT_POINTS * nSize * 0.3
          const nDamage = TILE_STARTING_HIT_POINTS * m.nSize * 0.3;

          // Fire impact callback (main.ts handles damage, fire, shake, effects, audio)
          this.onMeteorImpact?.(m.tx, m.ty, m.nSize, nDamage);
        }
      }
    }

    if (allDone && this.meteors.length > 0) {
      this.complete();
    }
  }

  /** Get the center tile of the shower (for indicator display). */
  getCenter(): { tx: number; ty: number } {
    return { tx: this.centerTX, ty: this.centerTY };
  }

  /** Get the shower duration in seconds. */
  getDuration(): number {
    return this.nDuration;
  }

  /** Get total meteor count (for debug). */
  getMeteorCount(): number {
    return this.meteors.length;
  }
}
