import { SoundManager } from '../audio/SoundManager';
import { line } from '../localization/Localization';
import { playWarbleFullscreen } from './WarbleEffect';

const AMBER = '#dfa200';
const BRIGHT_AMBER = '#FFE696'; // Lua Gui.BRIGHT_AMBER = rgba(255,230,150,1)

export interface SettingsCallbacks {
  getAutosaveEnabled?: () => boolean;
  setAutosaveEnabled?: (v: boolean) => void;
  getUIScale?: () => number;
  setUIScale?: (v: number) => void;
}

/**
 * Settings panel matching Lua AudioVideoSettings.lua + AudioVideoSettingsLayout.lua.
 * Layout order (from Lua): Header (SETMENU01), Music slider (SETMENU02),
 * SFX slider (SETMENU03), Autosave checkbox (SETMENU04),
 * Fullscreen checkbox (SETMENU06), Colorblind checkbox (SETMENU07).
 * Hardware Mouse (SETMENU05) is N/A for web — always uses OS cursor.
 */
export class SettingsPanel {
  private overlay: HTMLDivElement | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private callbacks: SettingsCallbacks = {};

  setCallbacks(cb: SettingsCallbacks) {
    this.callbacks = cb;
  }

  show(container: HTMLElement, onClose: () => void) {
    this.overlay = document.createElement('div');
    this.overlay.id = 'settings-panel';
    this.overlay.style.cssText = `
      position:absolute;top:0;left:0;width:100%;height:100%;
      background:rgba(0,0,0,0.7);z-index:140;
      display:flex;align-items:center;justify-content:center;
    `;

    const panel = document.createElement('div');
    panel.style.cssText = `
      background:rgba(20,16,8,0.95);border:2px solid ${AMBER};
      padding:40px 50px;min-width:400px;
      font-family:'Dosis',sans-serif;
    `;

    // Header (Lua: SETMENU01 = "SETTINGS", orbitronWhite style)
    const title = document.createElement('div');
    title.textContent = line('SETMENU01TEXT');
    title.style.cssText = `
      color:${AMBER};font-family:'Orbitron',monospace;font-size:65px; /* Lua orbitronWhite */
      text-align:center;margin-bottom:30px;letter-spacing:2px;
    `;
    panel.appendChild(title);

    // Music Volume slider (Lua: SETMENU02 = "MUSIC VOLUME")
    panel.appendChild(this.createSlider(line('SETMENU02TEXT'), SoundManager.getMusicVolume(), (v) => {
      SoundManager.setMusicVolume(v);
    }));

    // SFX Volume slider (Lua: SETMENU03 = "SFX VOLUME")
    panel.appendChild(this.createSlider(line('SETMENU03TEXT'), SoundManager.getSfxVolume(), (v) => {
      SoundManager.setSfxVolume(v);
    }));

    // Master Volume slider (not in original Lua but useful for web)
    panel.appendChild(this.createSlider('Master Volume', SoundManager.getMasterVolume(), (v) => {
      SoundManager.setMasterVolume(v);
    }));

    // UI Scale slider
    if (this.callbacks.getUIScale && this.callbacks.setUIScale) {
      const currentScale = this.callbacks.getUIScale();
      panel.appendChild(this.createSlider('UI Scale', currentScale, (v) => {
        this.callbacks.setUIScale?.(v);
      }, 0.3, 1.5));
    }

    // Autosave checkbox (Lua: SETMENU04 = "AUTOSAVE", configKey = "autosave")
    if (this.callbacks.getAutosaveEnabled) {
      panel.appendChild(this.createCheckbox(
        line('SETMENU04TEXT'),
        this.callbacks.getAutosaveEnabled(),
        (v) => { this.callbacks.setAutosaveEnabled?.(v); },
      ));
    }

    // Fullscreen checkbox (Lua: SETMENU06 = "FULLSCREEN")
    panel.appendChild(this.createCheckbox(
      line('SETMENU06TEXT'),
      !!document.fullscreenElement,
      (v) => {
        if (v) {
          document.documentElement.requestFullscreen?.();
        } else {
          document.exitFullscreen?.();
        }
      },
    ));

    // Colorblind Mode checkbox (Lua: SETMENU07, configKey = "colorblind")
    // Stub — stored in localStorage, no visual effect yet
    const cbStored = localStorage.getItem('df9_colorblind') === 'true';
    panel.appendChild(this.createCheckbox(
      line('SETMENU07TEXT'),
      cbStored,
      (v) => { localStorage.setItem('df9_colorblind', v ? 'true' : 'false'); },
    ));

    // Done button
    const doneBtn = document.createElement('div');
    doneBtn.textContent = 'Done';
    doneBtn.style.cssText = `
      color:${AMBER};font-family:'Orbitron',monospace;font-size:35px; /* Lua dosissemibold35 */
      text-align:center;padding:12px;margin-top:20px;
      cursor:pointer;border:1px solid ${AMBER};
    `;
    doneBtn.addEventListener('mouseenter', () => {
      doneBtn.style.background = 'rgba(223,162,0,0.15)';
      doneBtn.style.color = BRIGHT_AMBER;
      SoundManager.playUI('UI_Hilight');
    });
    doneBtn.addEventListener('mouseleave', () => {
      doneBtn.style.background = 'transparent';
      doneBtn.style.color = AMBER;
    });
    doneBtn.addEventListener('click', () => {
      SoundManager.playUI('UI_Select');
      this.hide();
      onClose();
    });
    panel.appendChild(doneBtn);

    this.overlay.appendChild(panel);
    container.appendChild(this.overlay);
    playWarbleFullscreen(this.overlay, 0.3, 0.3);

    // Click outside panel to close
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.hide();
        onClose();
      }
    });

    // ESC to close
    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.hide();
        onClose();
      }
    };
    window.addEventListener('keydown', this.keyHandler);
  }

  private createSlider(label: string, initialValue: number, onChange: (v: number) => void, minVal = 0, maxVal = 1): HTMLDivElement {
    const row = document.createElement('div');
    row.style.cssText = 'margin:16px 0;';

    const range = maxVal - minVal;
    const toSlider = (v: number) => Math.round(((v - minVal) / range) * 100);
    const fromSlider = (s: number) => minVal + (s / 100) * range;

    const labelEl = document.createElement('div');
    labelEl.style.cssText = `
      color:${AMBER};font-size:35px;margin-bottom:6px; /* Lua dosissemibold35 */
      display:flex;justify-content:space-between;
    `;
    const nameSpan = document.createElement('span');
    nameSpan.textContent = label;
    labelEl.appendChild(nameSpan);
    const valSpan = document.createElement('span');
    valSpan.textContent = Math.round(initialValue * 100) + '%';
    labelEl.appendChild(valSpan);
    row.appendChild(labelEl);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.value = String(toSlider(initialValue));
    slider.style.cssText = `
      width:100%;accent-color:${AMBER};cursor:pointer;
      height:6px;
    `;
    slider.addEventListener('input', () => {
      const v = fromSlider(parseInt(slider.value));
      valSpan.textContent = Math.round(v * 100) + '%';
      onChange(v);
    });
    row.appendChild(slider);
    return row;
  }

  private createCheckbox(label: string, initialValue: boolean, onChange: (v: boolean) => void): HTMLDivElement {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;margin:14px 0;gap:12px;';

    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = initialValue;
    check.style.cssText = `width:20px;height:20px;accent-color:${AMBER};cursor:pointer;`;
    check.addEventListener('change', () => { onChange(check.checked); });
    row.appendChild(check);

    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    labelEl.style.cssText = `color:${AMBER};font-size:35px;cursor:pointer;`; // Lua dosissemibold35
    labelEl.addEventListener('click', () => { check.click(); });
    row.appendChild(labelEl);

    return row;
  }

  hide() {
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    this.overlay?.remove();
    this.overlay = null;
  }

  isVisible() {
    return this.overlay !== null;
  }
}
