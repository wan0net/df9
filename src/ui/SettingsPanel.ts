import { SoundManager } from '../audio/SoundManager';
import { line } from '../localization/Localization';
import { playWarbleFullscreen } from './WarbleEffect';

const AMBER = '#dfa200';

export interface SettingsCallbacks {
  getAutosaveEnabled?: () => boolean;
  setAutosaveEnabled?: (v: boolean) => void;
  getUIScale?: () => number;
  setUIScale?: (v: number) => void;
}

/**
 * Lua AudioVideoSettingsLayout rendered in its native 1920×1152 UI space.
 * StartMenu applies the viewport scale, so these source offsets remain stable
 * at the reference resolution and at the original 1280-wide minimum scale.
 */
export class SettingsPanel {
  private overlay: HTMLDivElement | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private callbacks: SettingsCallbacks = {};

  setCallbacks(cb: SettingsCallbacks) {
    this.callbacks = cb;
  }

  show(container: HTMLElement, onClose: () => void) {
    this.hide();
    this.overlay = document.createElement('div');
    this.overlay.id = 'settings-panel';
    this.overlay.style.cssText = `
      position:absolute;inset:0;z-index:140;overflow:hidden;
      background:rgba(0,0,0,0.83);font-family:'Dosis',sans-serif;
    `;

    // AudioVideoSettingsLayout.Logo is the same StartMenu sprite and source
    // placement as the main menu, including its 1.5 scale.
    const logo = document.createElement('img');
    logo.src = 'assets/ui/startmenu_logo.png';
    logo.dataset.testid = 'settings-logo';
    logo.style.cssText = `
      position:absolute;top:calc(50% - 626px);left:calc(50% - 960px);
      width:1920px;height:auto;pointer-events:none;
      filter:drop-shadow(0 0 18px rgba(223,162,0,0.28));
    `;
    this.overlay.appendChild(logo);

    const title = document.createElement('div');
    title.textContent = line('SETMENU01');
    title.dataset.testid = 'settings-title';
    title.style.cssText = `
      position:absolute;left:calc(50% - 405px);top:calc(50% - 235px);
      width:800px;height:70px;display:flex;align-items:center;justify-content:center;
      color:#fff;font-family:'Orbitron',monospace;font-size:65px;letter-spacing:2px;
    `;
    this.overlay.appendChild(title);

    this.overlay.appendChild(this.createSlider(
      line('SETMENU02'),
      -110,
      SoundManager.getMusicVolume(),
      value => SoundManager.setMusicVolume(value),
    ));
    this.overlay.appendChild(this.createSlider(
      line('SETMENU03'),
      -40,
      SoundManager.getSfxVolume(),
      value => SoundManager.setSfxVolume(value),
    ));

    this.overlay.appendChild(this.createCheckbox(
      line('SETMENU04'),
      108,
      this.callbacks.getAutosaveEnabled?.() ?? true,
      value => this.callbacks.setAutosaveEnabled?.(value),
    ));

    // The browser always uses the operating-system pointer. Keep the source
    // row visible and checked, but immutable because there is no alternate
    // MOAI cursor mode on the web.
    this.overlay.appendChild(this.createCheckbox(
      line('SETMENU05'),
      180,
      true,
      () => {},
      true,
    ));

    this.overlay.appendChild(this.createCheckbox(
      line('SETMENU06'),
      252,
      !!document.fullscreenElement,
      value => {
        if (value) document.documentElement.requestFullscreen?.();
        else document.exitFullscreen?.();
      },
    ));

    const colorblind = localStorage.getItem('df9_colorblind') === 'true';
    this.overlay.appendChild(this.createCheckbox(
      line('SETMENU07'),
      324,
      colorblind,
      value => localStorage.setItem('df9_colorblind', value ? 'true' : 'false'),
    ));

    container.appendChild(this.overlay);
    playWarbleFullscreen(this.overlay, 0.3, 0.3);

    // Lua captures the whole settings screen and returns to StartMenu on ESC.
    this.keyHandler = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      SoundManager.playUI('Intro_CancelButton');
      this.hide();
      onClose();
    };
    window.addEventListener('keydown', this.keyHandler, true);
  }

  private createSlider(
    label: string,
    yOffset: number,
    initialValue: number,
    onChange: (value: number) => void,
  ): HTMLDivElement {
    const row = document.createElement('div');
    row.dataset.testid = 'settings-row';
    row.dataset.label = label;
    row.style.cssText = `position:absolute;left:0;right:0;top:calc(50% + ${yOffset}px);height:70px;`;

    const labelEl = document.createElement('div');
    labelEl.textContent = label;
    labelEl.dataset.testid = 'settings-label';
    labelEl.style.cssText = `
      position:absolute;left:calc(50% - 825px);top:0;width:800px;height:70px;
      display:flex;align-items:center;justify-content:flex-end;
      color:#fff;font-size:35px;font-weight:600;
    `;
    row.appendChild(labelEl);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.value = String(Math.round(initialValue * 100));
    slider.ariaLabel = label;
    slider.dataset.testid = 'settings-slider';
    slider.style.cssText = `
      position:absolute;left:calc(50% + 25px);top:21px;width:500px;height:28px;
      margin:0;cursor:pointer;accent-color:${AMBER};
    `;
    slider.addEventListener('input', () => onChange(Number.parseInt(slider.value, 10) / 100));
    slider.addEventListener('pointerenter', () => SoundManager.playUI('UI_Hilight'));
    row.appendChild(slider);
    return row;
  }

  private createCheckbox(
    label: string,
    yOffset: number,
    initialValue: boolean,
    onChange: (value: boolean) => void,
    locked = false,
  ): HTMLDivElement {
    const row = document.createElement('div');
    row.dataset.testid = 'settings-row';
    row.dataset.label = label;
    row.style.cssText = `position:absolute;left:0;right:0;top:calc(50% + ${yOffset}px);height:70px;`;

    const labelEl = document.createElement('div');
    labelEl.textContent = label;
    labelEl.dataset.testid = 'settings-label';
    labelEl.style.cssText = `
      position:absolute;left:calc(50% - 825px);top:0;width:800px;height:70px;
      display:flex;align-items:center;justify-content:flex-end;
      color:#fff;font-size:35px;font-weight:600;
    `;
    row.appendChild(labelEl);

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = initialValue;
    checkbox.disabled = locked;
    checkbox.ariaLabel = label;
    checkbox.dataset.testid = 'settings-checkbox';
    checkbox.style.cssText = `
      position:absolute;left:calc(50% + 15px);top:15px;width:40px;height:40px;
      margin:0;cursor:${locked ? 'default' : 'pointer'};accent-color:${AMBER};
      opacity:${locked ? '0.82' : '1'};
    `;
    checkbox.addEventListener('change', () => onChange(checkbox.checked));
    checkbox.addEventListener('pointerenter', () => SoundManager.playUI('UI_Hilight'));
    row.appendChild(checkbox);

    if (!locked) {
      labelEl.style.cursor = 'pointer';
      labelEl.addEventListener('click', () => checkbox.click());
    }
    return row;
  }

  hide() {
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler, true);
      this.keyHandler = null;
    }
    this.overlay?.remove();
    this.overlay = null;
  }

  isVisible() {
    return this.overlay !== null;
  }
}
