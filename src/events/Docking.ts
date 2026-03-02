/**
 * Docking.ts — Ship approach and docking at airlock.
 * Mirrors Docking.lua.
 */

export const DOCKING_STATE = {
  IDLE: 0,
  APPROACHING: 1,
  DOCKED: 2,
  DEPARTING: 3,
} as const;

export class DockingShip {
  state: number = DOCKING_STATE.IDLE;
  progress = 0;
  /** Number of passengers/cargo. */
  payload = 0;

  approach(payload: number) {
    this.state = DOCKING_STATE.APPROACHING;
    this.progress = 0;
    this.payload = payload;
  }

  update(dt: number) {
    if (this.state === DOCKING_STATE.APPROACHING) {
      this.progress += dt * 0.1;
      if (this.progress >= 1) {
        this.state = DOCKING_STATE.DOCKED;
        this.progress = 1;
      }
    } else if (this.state === DOCKING_STATE.DEPARTING) {
      this.progress -= dt * 0.1;
      if (this.progress <= 0) {
        this.state = DOCKING_STATE.IDLE;
        this.progress = 0;
      }
    }
  }

  depart() {
    this.state = DOCKING_STATE.DEPARTING;
  }

  isDocked(): boolean {
    return this.state === DOCKING_STATE.DOCKED;
  }
}
