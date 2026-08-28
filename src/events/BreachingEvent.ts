/**
 * BreachingEvent.ts — Raiders cut through hull, creating a breach.
 * Mirrors GameEvents/BreachingEvent.lua.
 */

import { Event } from './Event';
import { SoundManager } from '../audio/SoundManager';

export class BreachingEvent extends Event {
  readonly name = 'Breach';
  readonly description = 'Raiders are cutting through the hull!';

  /** Time for raiders to cut through. */
  private static readonly BREACH_TIME = 10;

  private soundPlayed = false;
  private overlay: HTMLDivElement | null = null;
  private progressBar: HTMLDivElement | null = null;

  /** Create the breach warning overlay with progress bar. */
  private createOverlay(): void {
    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9000;';

    // Warning container
    const container = document.createElement('div');
    container.style.cssText =
      'position:absolute;top:10%;left:50%;transform:translateX(-50%);text-align:center;';

    // Pulsing breach text
    const text = document.createElement('div');
    text.textContent = 'BREACH IN PROGRESS';
    text.style.cssText =
      'font-family:"Orbitron",sans-serif;font-size:26px;font-weight:bold;' +
      'color:#ff4444;text-shadow:0 0 12px rgba(255,60,0,0.8);' +
      'animation:breachPulse 0.8s ease-in-out infinite alternate;';

    // Inject keyframes
    if (!document.getElementById('df9-breach-style')) {
      const style = document.createElement('style');
      style.id = 'df9-breach-style';
      style.textContent =
        '@keyframes breachPulse{from{opacity:0.5;color:#ff4444;}to{opacity:1;color:#ffaa22;}}';
      document.head.appendChild(style);
    }

    // Progress bar track
    const track = document.createElement('div');
    track.style.cssText =
      'margin-top:10px;width:260px;height:10px;background:rgba(80,20,0,0.6);' +
      'border:1px solid #ff6622;border-radius:3px;overflow:hidden;';

    // Progress bar fill
    const fill = document.createElement('div');
    fill.style.cssText =
      'width:0%;height:100%;background:linear-gradient(90deg,#ff4444,#ffaa22);' +
      'transition:width 0.3s linear;';
    this.progressBar = fill;

    track.appendChild(fill);
    container.appendChild(text);
    container.appendChild(track);
    overlay.appendChild(container);
    document.body.appendChild(overlay);
    this.overlay = overlay;
  }

  /** Remove the overlay from the DOM. */
  private removeOverlay(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
      this.progressBar = null;
    }
  }

  protected onUpdate(_dt: number) {
    if (!this.soundPlayed) {
      SoundManager.playSfx('Raider_Docking');
      SoundManager.playSfx('Raider_Drill');
      this.createOverlay();
      this.soundPlayed = true;
    }

    // Update progress bar
    if (this.progressBar) {
      const pct = Math.min(100, (this.elapsedTime / BreachingEvent.BREACH_TIME) * 100);
      this.progressBar.style.width = pct + '%';
    }

    // Breach occurs after cutting time
    if (this.elapsedTime >= BreachingEvent.BREACH_TIME) {
      this.removeOverlay();
      this.complete();
    }
  }
}
