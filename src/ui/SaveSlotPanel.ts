/**
 * SaveSlotPanel.ts — Multi-slot save/load directory.
 * Matches Lua SaveBase.lua / LoadBase.lua: scrollable list of save files,
 * click to select, save/load/delete actions.
 *
 * Web adaptation: uses localStorage keys with `df9_save_` prefix.
 * Each slot stores JSON save data + metadata (date, population, matter).
 */

import { SoundManager } from '../audio/SoundManager';
import { playWarbleFullscreen } from './WarbleEffect';

const AMBER = '#dfa200';
const BRIGHT_AMBER = '#ffcc44';
const SAVE_PREFIX = 'df9_save_';
const META_PREFIX = 'df9_meta_';

interface SlotMeta {
  name: string;
  date: string;
  population: number;
  matter: number;
}

export class SaveSlotPanel {
  private overlay: HTMLDivElement | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private selectedSlot: string | null = null;

  /** Show the panel in LOAD mode. */
  showLoad(container: HTMLElement, onLoad: (slotName: string) => void, onClose: () => void) {
    this.show(container, 'load', onLoad, undefined, onClose);
  }

  /** Show the panel in SAVE mode. */
  showSave(container: HTMLElement, onSave: (slotName: string) => void, onClose: () => void) {
    this.show(container, 'save', undefined, onSave, onClose);
  }

  private show(
    container: HTMLElement,
    mode: 'load' | 'save',
    onLoad?: (slotName: string) => void,
    onSave?: (slotName: string) => void,
    onClose?: () => void,
  ) {
    this.selectedSlot = null;
    this.overlay = document.createElement('div');
    this.overlay.id = 'save-slot-panel';
    this.overlay.style.cssText = `
      position:absolute;top:0;left:0;width:100%;height:100%;
      background:rgba(0,0,0,0.8);z-index:130;
      display:flex;align-items:center;justify-content:center;
    `;

    const panel = document.createElement('div');
    panel.style.cssText = `
      background:rgba(20,16,8,0.95);border:2px solid ${AMBER};
      padding:30px 40px;min-width:500px;max-width:700px;width:50%;
      max-height:80vh;display:flex;flex-direction:column;
      font-family:'Dosis',sans-serif;
    `;

    // Title
    const title = document.createElement('div');
    title.textContent = mode === 'load' ? 'LOAD BASE' : 'SAVE BASE';
    title.style.cssText = `
      color:${AMBER};font-family:'Orbitron',monospace;font-size:24px;
      text-align:center;margin-bottom:20px;letter-spacing:2px;
    `;
    panel.appendChild(title);

    // Slot list (scrollable)
    const listContainer = document.createElement('div');
    listContainer.style.cssText = `
      flex:1;overflow-y:auto;min-height:200px;max-height:50vh;
      border:1px solid rgba(223,162,0,0.3);margin-bottom:16px;
    `;

    const slots = this.getSlots();
    let selectedEl: HTMLDivElement | null = null;

    for (const slot of slots) {
      const row = document.createElement('div');
      row.style.cssText = `
        padding:12px 16px;cursor:pointer;border-bottom:1px solid rgba(223,162,0,0.15);
        display:flex;justify-content:space-between;align-items:center;
      `;

      const nameEl = document.createElement('div');
      nameEl.textContent = slot.name;
      nameEl.style.cssText = `color:${AMBER};font-size:18px;font-weight:600;`;
      row.appendChild(nameEl);

      const metaEl = document.createElement('div');
      metaEl.style.cssText = 'color:rgba(223,162,0,0.6);font-size:14px;text-align:right;';
      if (slot.meta) {
        metaEl.textContent = `${slot.meta.date}  Pop:${slot.meta.population}  Matter:${slot.meta.matter}`;
      } else {
        metaEl.textContent = 'No metadata';
      }
      row.appendChild(metaEl);

      row.addEventListener('mouseenter', () => {
        if (this.selectedSlot !== slot.key) {
          row.style.background = 'rgba(223,162,0,0.1)';
        }
        SoundManager.playUI('UI_Hilight');
      });
      row.addEventListener('mouseleave', () => {
        if (this.selectedSlot !== slot.key) {
          row.style.background = 'transparent';
        }
      });
      row.addEventListener('click', () => {
        SoundManager.playUI('UI_Select');
        if (selectedEl) {
          selectedEl.style.background = 'transparent';
          const prevName = selectedEl.querySelector('div');
          if (prevName) prevName.style.color = AMBER;
        }
        this.selectedSlot = slot.key;
        selectedEl = row;
        row.style.background = 'rgba(223,162,0,0.25)';
        nameEl.style.color = '#fff';
      });

      listContainer.appendChild(row);
    }

    if (slots.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = mode === 'load' ? 'No saved games found.' : 'No existing saves.';
      empty.style.cssText = `color:rgba(223,162,0,0.5);font-size:16px;padding:40px;text-align:center;`;
      listContainer.appendChild(empty);
    }

    panel.appendChild(listContainer);

    // New save slot input (save mode only)
    if (mode === 'save') {
      const inputRow = document.createElement('div');
      inputRow.style.cssText = 'display:flex;gap:8px;margin-bottom:16px;';

      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'New save name...';
      input.value = 'Save ' + (slots.length + 1);
      input.style.cssText = `
        flex:1;background:rgba(0,0,0,0.6);border:1px solid ${AMBER};
        color:${AMBER};font-family:'Dosis',sans-serif;font-size:16px;
        padding:8px 12px;outline:none;
      `;
      input.addEventListener('focus', () => {
        input.style.borderColor = BRIGHT_AMBER;
      });
      input.addEventListener('blur', () => {
        input.style.borderColor = AMBER;
      });
      inputRow.appendChild(input);

      const saveNewBtn = this.createButton('SAVE NEW', () => {
        const name = input.value.trim();
        if (!name) return;
        const key = SAVE_PREFIX + name;
        SoundManager.playUI('Intro_AcceptButton');
        this.hide();
        onSave?.(key);
        onClose?.();
      });
      inputRow.appendChild(saveNewBtn);

      panel.appendChild(inputRow);
    }

    // Action buttons
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:12px;justify-content:center;';

    if (mode === 'load') {
      btnRow.appendChild(this.createButton('LOAD (L)', () => {
        if (!this.selectedSlot) return;
        SoundManager.playUI('Intro_AcceptButton');
        this.hide();
        onLoad?.(this.selectedSlot);
        onClose?.();
      }));
    } else {
      btnRow.appendChild(this.createButton('OVERWRITE (S)', () => {
        if (!this.selectedSlot) return;
        SoundManager.playUI('Intro_AcceptButton');
        this.hide();
        onSave?.(this.selectedSlot);
        onClose?.();
      }));
    }

    // Delete button
    btnRow.appendChild(this.createButton('DELETE', () => {
      if (!this.selectedSlot) return;
      localStorage.removeItem(this.selectedSlot);
      localStorage.removeItem(this.selectedSlot.replace(SAVE_PREFIX, META_PREFIX));
      SoundManager.playUI('UI_Disallow');
      // Refresh
      this.hide();
      this.show(container, mode, onLoad, onSave, onClose);
    }));

    // Cancel button
    btnRow.appendChild(this.createButton('CANCEL (ESC)', () => {
      SoundManager.playUI('Intro_CancelButton');
      this.hide();
      onClose?.();
    }));

    panel.appendChild(btnRow);
    this.overlay.appendChild(panel);
    container.appendChild(this.overlay);
    playWarbleFullscreen(this.overlay, 0.3, 0.3);

    // Click outside to close
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.hide();
        onClose?.();
      }
    });

    // Keyboard shortcuts (Lua: L=load, S=save, C/ESC=cancel)
    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        this.hide();
        onClose?.();
      } else if (mode === 'load' && (e.key === 'l' || e.key === 'L') && this.selectedSlot) {
        e.preventDefault();
        this.hide();
        onLoad?.(this.selectedSlot);
        onClose?.();
      } else if (mode === 'save' && (e.key === 's' || e.key === 'S') && this.selectedSlot) {
        e.preventDefault();
        this.hide();
        onSave?.(this.selectedSlot);
        onClose?.();
      }
    };
    window.addEventListener('keydown', this.keyHandler);
  }

  private createButton(label: string, action: () => void): HTMLDivElement {
    const btn = document.createElement('div');
    btn.textContent = label;
    btn.style.cssText = `
      color:${AMBER};font-family:'Orbitron',monospace;font-size:14px;
      padding:10px 20px;cursor:pointer;border:1px solid ${AMBER};
      text-align:center;min-width:100px;
    `;
    btn.addEventListener('mouseenter', () => {
      btn.style.background = 'rgba(223,162,0,0.15)';
      btn.style.color = BRIGHT_AMBER;
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'transparent';
      btn.style.color = AMBER;
    });
    btn.addEventListener('click', action);
    return btn;
  }

  private getSlots(): { key: string; name: string; meta: SlotMeta | null }[] {
    const slots: { key: string; name: string; meta: SlotMeta | null }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(SAVE_PREFIX)) continue;
      const name = key.slice(SAVE_PREFIX.length);
      let meta: SlotMeta | null = null;
      try {
        const metaJson = localStorage.getItem(META_PREFIX + name);
        if (metaJson) meta = JSON.parse(metaJson);
      } catch { /* ignore */ }
      slots.push({ key, name, meta });
    }
    // Also check legacy 'SpacebaseDF9AutoSave' key
    if (localStorage.getItem('SpacebaseDF9AutoSave')) {
      const exists = slots.some(s => s.key === 'SpacebaseDF9AutoSave');
      if (!exists) {
        let meta: SlotMeta | null = null;
        try {
          const metaJson = localStorage.getItem(META_PREFIX + 'AutoSave');
          if (metaJson) meta = JSON.parse(metaJson);
        } catch { /* ignore */ }
        slots.unshift({ key: 'SpacebaseDF9AutoSave', name: 'AutoSave', meta });
      }
    }
    slots.sort((a, b) => a.name.localeCompare(b.name));
    return slots;
  }

  /** Save metadata alongside a save slot. */
  static saveMeta(slotName: string, population: number, matter: number) {
    const name = slotName.startsWith(SAVE_PREFIX)
      ? slotName.slice(SAVE_PREFIX.length)
      : slotName;
    const meta: SlotMeta = {
      name,
      date: new Date().toLocaleString(),
      population,
      matter: Math.round(matter),
    };
    try {
      localStorage.setItem(META_PREFIX + name, JSON.stringify(meta));
    } catch { /* ignore */ }
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
