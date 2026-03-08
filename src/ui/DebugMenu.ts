import { SoundManager } from '../audio/SoundManager';
import { line } from '../localization/Localization';

const AMBER = '#dfa200';
const BRIGHT_AMBER = '#FFE696'; // Lua Gui.BRIGHT_AMBER = rgba(255,230,150,1)

interface DebugCallbacks {
  onResearchOne: () => void;
  onResearchAll: () => void;
  onResearchAllMalady: () => void;
  onMakeAllHappy: () => void;
  onMakeAllSad: () => void;
  onAddMatter: () => void;
}

/**
 * Debug menu matching Lua DebugMenu.lua.
 * 6 buttons: Research One, Research All, Research All Malady,
 * Make All Happy, Make All Sad, Add 1000 Matter.
 * Layout: top-left panel, 330px wide, 81px button height (DebugMenuLayout.lua).
 */
export class DebugMenu {
  private overlay: HTMLDivElement | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  show(container: HTMLElement, callbacks: DebugCallbacks, onClose: () => void) {
    // Panel container (top-left, matching Lua layout: alignX=left, alignY=top)
    this.overlay = document.createElement('div');
    this.overlay.id = 'debug-menu';
    this.overlay.style.cssText = `
      position:absolute;top:0;left:0;z-index:140;
      font-family:'Dosis',sans-serif;
    `;

    // Background panel (Lua: nButtonWidth=330, nButtonStartY=-100, numButtons=6)
    const bg = document.createElement('div');
    bg.style.cssText = `
      width:330px;
      background:rgba(30,25,15,0.95);
      padding-top:100px;
    `;

    const buttons: { label: string; hotkey: string; action: () => void }[] = [
      { label: line('DEBUG002TEXT'), hotkey: '1', action: callbacks.onResearchOne },
      { label: line('DEBUG003TEXT'), hotkey: '2', action: callbacks.onResearchAll },
      { label: line('DEBUG004TEXT'), hotkey: '3', action: callbacks.onResearchAllMalady },
      { label: line('DEBUG005TEXT'), hotkey: '4', action: callbacks.onMakeAllHappy },
      { label: line('DEBUG006TEXT'), hotkey: '5', action: callbacks.onMakeAllSad },
      { label: line('DEBUG009TEXT'), hotkey: '6', action: callbacks.onAddMatter },
    ];

    for (const btn of buttons) {
      const row = document.createElement('div');
      row.style.cssText = `
        height:81px;display:flex;align-items:center;
        padding:0 30px;cursor:pointer;
        background:#000;position:relative;
      `;

      const hotkeyEl = document.createElement('span');
      hotkeyEl.textContent = btn.hotkey + '.';
      hotkeyEl.style.cssText = `
        color:${AMBER};opacity:0.6;font-size:16px;
        margin-right:12px;min-width:20px;
      `;
      row.appendChild(hotkeyEl);

      const labelEl = document.createElement('span');
      labelEl.textContent = btn.label;
      labelEl.style.cssText = `
        color:${AMBER};opacity:0.6;font-size:22px;
      `;
      row.appendChild(labelEl);

      row.addEventListener('mouseenter', () => {
        row.style.background = `rgba(223,162,0,0.08)`;
        labelEl.style.color = '#000';
        hotkeyEl.style.color = '#000';
        SoundManager.playUI('UI_Hilight');
      });
      row.addEventListener('mouseleave', () => {
        row.style.background = '#000';
        labelEl.style.color = AMBER;
        hotkeyEl.style.color = AMBER;
      });
      row.addEventListener('click', () => {
        SoundManager.playUI('UI_Select');
        btn.action();
      });

      bg.appendChild(row);
    }

    this.overlay.appendChild(bg);
    container.appendChild(this.overlay);

    // Keyboard hotkeys (Lua: addHotkey for each button)
    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.hide();
        onClose();
        return;
      }
      const idx = parseInt(e.key) - 1;
      if (idx >= 0 && idx < buttons.length) {
        SoundManager.playUI('UI_Select');
        buttons[idx].action();
      }
    };
    window.addEventListener('keydown', this.keyHandler);
  }

  hide() {
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    this.overlay?.remove();
    this.overlay = null;
    SoundManager.playSfx('degauss');
  }

  isVisible() {
    return this.overlay !== null;
  }
}
