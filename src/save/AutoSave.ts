/**
 * AutoSave.ts — Periodic auto-save.
 * Mirrors AutoSave.lua — uses wall-clock time (not game-scaled dt).
 */

import type { SaveLoadSystem } from './SaveLoad';

/** Auto-save interval in wall-clock seconds. */
const AUTO_SAVE_INTERVAL = 300; // 5 minutes

export class AutoSave {
  private saveSystem: SaveLoadSystem;
  private lastSaveTime = 0;
  private enabled = true;

  constructor(saveSystem: SaveLoadSystem) {
    this.saveSystem = saveSystem;
    this.lastSaveTime = performance.now() / 1000;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  /** Call every frame. Uses wall-clock time regardless of game speed. */
  onTick(_dt: number) {
    if (!this.enabled) return;

    const now = performance.now() / 1000;
    if (now - this.lastSaveTime >= AUTO_SAVE_INTERVAL) {
      this.lastSaveTime = now;
      this.saveSystem.saveToStorage('SpacebaseDF9AutoSave');
    }
  }
}
