/**
 * AutoSave.ts — Periodic auto-save.
 * Mirrors AutoSave.lua.
 */

import type { SaveLoadSystem } from './SaveLoad';

/** Auto-save interval in game seconds. */
const AUTO_SAVE_INTERVAL = 300; // 5 minutes

export class AutoSave {
  private saveSystem: SaveLoadSystem;
  private tickAccum = 0;
  private enabled = true;

  constructor(saveSystem: SaveLoadSystem) {
    this.saveSystem = saveSystem;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  onTick(dt: number) {
    if (!this.enabled) return;

    this.tickAccum += dt;
    if (this.tickAccum >= AUTO_SAVE_INTERVAL) {
      this.tickAccum = 0;
      this.saveSystem.saveToStorage('SpacebaseDF9AutoSave');
    }
  }
}
