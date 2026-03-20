/**
 * ImmigrationEvent.ts — New crew arrives at the station.
 * Mirrors GameEvents/ImmigrationEvent.lua.
 */

import { Event } from './Event';
import { SoundManager } from '../audio/SoundManager';

export class ImmigrationEvent extends Event {
  readonly name: string = 'Immigration';
  readonly description: string = 'New crew members arriving';

  /** Number of immigrants for this event. */
  protected immigrantCount: number;

  constructor() {
    super();
    this.immigrantCount = 1 + Math.floor(Math.random() * 2); // 1-2 immigrants (Lua: tNumSpawnsRange={1,2})
  }

  getImmigrantCount(): number {
    return this.immigrantCount;
  }

  /** Override immigrant count (used by TraderEvent). */
  setImmigrantCount(count: number) {
    this.immigrantCount = count;
  }

  private soundPlayed = false;
  private overlay: HTMLDivElement | null = null;

  /** Create the spacebus fly-in overlay. */
  private createOverlay(): void {
    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9000;overflow:hidden;';

    // "Ship Approaching..." label
    const label = document.createElement('div');
    label.textContent = 'Ship Approaching...';
    label.style.cssText =
      'position:absolute;top:12%;left:50%;transform:translateX(-50%);' +
      'font-family:"Dosis",sans-serif;font-size:22px;color:#8cf;' +
      'text-shadow:0 0 8px rgba(100,180,255,0.7);opacity:0;' +
      'transition:opacity 0.6s ease;';

    // Ship indicator div
    const ship = document.createElement('div');
    ship.textContent = '\u25C0\u2501\u2501\u2501';
    ship.style.cssText =
      'position:absolute;top:16%;font-size:28px;color:#8cf;' +
      'text-shadow:0 0 12px rgba(100,180,255,0.8);' +
      'right:-80px;transition:right 1.5s ease-out;';

    overlay.appendChild(label);
    overlay.appendChild(ship);
    document.body.appendChild(overlay);
    this.overlay = overlay;

    // Fade in label, fly ship to center
    requestAnimationFrame(() => {
      label.style.opacity = '1';
      ship.style.right = 'calc(50% - 40px)';
    });

    // After 2s pause at center, fly off left over 6s then remove
    setTimeout(() => {
      ship.style.transition = 'right 6s linear';
      ship.style.right = '110%';
      label.style.opacity = '0';
    }, 3500);
  }

  /** Remove the overlay from the DOM. */
  private removeOverlay(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  protected onUpdate(_dt: number) {
    if (!this.soundPlayed) {
      SoundManager.playSfx('SpaceTaxi');
      this.createOverlay();
      this.soundPlayed = true;
    }
    // Event completes after docking period (simplified: immediate)
    if (this.elapsedTime >= 10) {
      this.removeOverlay();
      this.complete();
    }
  }
}
