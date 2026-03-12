import { SoundManager } from '../audio/SoundManager';
import { line } from '../localization/Localization';
import { playWarble } from './WarbleEffect';
import { GameRules } from '../core/GameRules';
import { Base } from '../core/Base';
import type { BuildMode } from '../building/BuildSystem';

const AMBER = '#dfa200';
const GREEN = '#a5d318';
const RED = '#ff3d00';

const HEX_CLIP_PATH = 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)';

interface SidebarCallbacks {
  setBuildMode: (mode: BuildMode) => void;
  getBuildMode: () => BuildMode;
  onCancelBuild: () => void;
  onConfirmBuild: () => boolean;
  toggleResearchPanel: () => void;
  toggleGoalsPanel: () => void;
  toggleJobRoster: () => void;
  toggleO2Overlay: () => void;
  toggleWalls: () => void;
  toggleCutaway: () => void;
}

interface SidebarButton {
  id: string;
  label: string;
  hotkey: string;
  iconSrc: string;
  action: () => void;
  checkActive?: () => boolean;
  hidden?: boolean;
}

export class HexSidebar {
  private container: HTMLDivElement;
  private expanded = false;
  private buttons: Map<string, { el: HTMLElement; btn: SidebarButton }> = new Map();
  private callbacks: SidebarCallbacks;
  private currentSubmenu: 'none' | 'construct' | 'mine' | 'beacon' | 'disaster' = 'none';
  
  private sidebarEl!: HTMLDivElement;
  private buttonsContainer!: HTMLDivElement;
  private submenuContainer!: HTMLDivElement;

  constructor(parent: HTMLElement, callbacks: SidebarCallbacks) {
    this.container = document.createElement('div');
    this.callbacks = callbacks;
    this.createSidebar();
    parent.appendChild(this.container);
  }

  private createSidebar() {
    this.sidebarEl = document.createElement('div');
    this.sidebarEl.id = 'hex-sidebar';
    this.sidebarEl.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 104px;
      height: 100%;
      z-index: 100;
      pointer-events: auto;
      transition: width 0.2s ease-out;
      overflow: hidden;
    `;

    const bg = document.createElement('div');
    bg.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 286px;
      height: 100%;
      background: linear-gradient(90deg, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.85) 100%);
      border-right: 2px solid ${AMBER};
    `;
    this.sidebarEl.appendChild(bg);

    this.buttonsContainer = document.createElement('div');
    this.buttonsContainer.style.cssText = `
      position: relative;
      width: 286px;
      padding-top: 20px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    `;
    this.sidebarEl.appendChild(this.buttonsContainer);

    this.createMainButtons();

    this.submenuContainer = document.createElement('div');
    this.submenuContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 286px;
      height: 100%;
      background: rgba(0,0,0,0.95);
      display: none;
      flex-direction: column;
      padding-top: 20px;
    `;
    this.sidebarEl.appendChild(this.submenuContainer);

    const endCap = document.createElement('div');
    endCap.style.cssText = `
      position: absolute;
      bottom: 0;
      left: 0;
      width: 286px;
      height: 60px;
      background: linear-gradient(90deg, rgba(223,162,0,0.3) 0%, transparent 100%);
      border-top: 1px solid ${AMBER};
      display: flex;
      align-items: center;
      justify-content: center;
      color: ${AMBER};
      font-size: 14px;
      font-family: 'Dosis', sans-serif;
    `;
    endCap.textContent = 'DF-9';
    this.sidebarEl.appendChild(endCap);

    this.sidebarEl.addEventListener('mouseenter', () => this.expand());
    this.sidebarEl.addEventListener('mouseleave', () => this.collapse());

    this.container.appendChild(this.sidebarEl);
  }

  private createMainButtons() {
    const buttons: SidebarButton[] = [
      {
        id: 'inspect',
        label: line('HUDHUD005TEXT'),
        hotkey: 'I',
        iconSrc: 'assets/ui/icons/ui_iconIso_inspect.png',
        action: () => this.onInspect(),
      },
      {
        id: 'assign',
        label: line('HUDHUD006TEXT'),
        hotkey: 'R',
        iconSrc: 'assets/ui/icons/ui_iconIso_assign.png',
        action: () => this.callbacks.toggleJobRoster(),
      },
      {
        id: 'research',
        label: line('HUDHUD046TEXT'),
        hotkey: 'E',
        iconSrc: 'assets/ui/icons/ui_iconIso_research.png',
        action: () => this.callbacks.toggleResearchPanel(),
      },
      {
        id: 'goals',
        label: line('HUDHUD052TEXT'),
        hotkey: 'G',
        iconSrc: 'assets/ui/icons/ui_iconIso_confirm.png',
        action: () => this.callbacks.toggleGoalsPanel(),
      },
      {
        id: 'construct',
        label: line('HUDHUD007TEXT'),
        hotkey: 'C',
        iconSrc: 'assets/ui/icons/ui_iconIso_construct.png',
        action: () => this.onConstruct(),
        checkActive: () => this.currentSubmenu === 'construct',
      },
      {
        id: 'mine',
        label: line('HUDHUD008TEXT'),
        hotkey: 'M',
        iconSrc: 'assets/ui/icons/ui_iconIso_mine.png',
        action: () => this.onMine(),
        checkActive: () => this.currentSubmenu === 'mine',
      },
      {
        id: 'beacon',
        label: line('HUDHUD025TEXT'),
        hotkey: 'B',
        iconSrc: 'assets/ui/icons/ui_iconIso_beacon.png',
        action: () => this.onBeacon(),
      },
      {
        id: 'disaster',
        label: line('HUDHUD062TEXT'),
        hotkey: 'Z',
        iconSrc: 'assets/ui/icons/ui_iconIso_cancel.png',
        action: () => this.onDisaster(),
        hidden: !GameRules.bDisasterMode,
      },
    ];

    for (const btn of buttons) {
      this.createHexButton(btn);
    }
  }

  private createHexButton(btn: SidebarButton) {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
      position: relative;
      width: 286px;
      height: 81px;
      display: flex;
      align-items: center;
      cursor: pointer;
      transition: all 0.15s ease;
    `;

    const hexBg = document.createElement('div');
    hexBg.style.cssText = `
      position: absolute;
      left: 10px;
      width: 80px;
      height: 70px;
      background: rgba(223,162,0,0.1);
      border: 2px solid ${AMBER};
      clip-path: ${HEX_CLIP_PATH};
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
    `;

    const icon = document.createElement('img');
    icon.src = btn.iconSrc;
    icon.style.cssText = `
      width: 40px;
      height: 40px;
      object-fit: contain;
      filter: sepia(1) saturate(5) hue-rotate(5deg);
      transition: all 0.15s ease;
    `;
    hexBg.appendChild(icon);
    wrapper.appendChild(hexBg);

    const label = document.createElement('div');
    label.textContent = btn.label;
    label.style.cssText = `
      position: absolute;
      left: 100px;
      color: ${AMBER};
      font-size: 40px;
      font-family: 'Dosis', sans-serif;
      font-weight: 400;
      white-space: nowrap;
      opacity: 0;
      transition: opacity 0.15s ease;
      pointer-events: none;
    `;
    wrapper.appendChild(label);

    const hotkey = document.createElement('div');
    hotkey.textContent = btn.hotkey;
    hotkey.style.cssText = `
      position: absolute;
      right: 20px;
      color: ${AMBER};
      font-size: 20px;
      font-family: 'Dosis', sans-serif;
      font-weight: 600;
      opacity: 0;
      transition: opacity 0.15s ease;
      pointer-events: none;
    `;
    wrapper.appendChild(hotkey);

    wrapper.addEventListener('mouseenter', () => {
      SoundManager.playUI('UI_Hilight');
      hexBg.style.background = AMBER;
      hexBg.style.transform = 'scale(1.05)';
      icon.style.filter = 'brightness(0)';
      label.style.color = '#fff';
      hotkey.style.color = '#fff';
    });

    wrapper.addEventListener('mouseleave', () => {
      const isActive = btn.checkActive?.() ?? false;
      hexBg.style.background = isActive ? AMBER : 'rgba(223,162,0,0.1)';
      hexBg.style.transform = 'scale(1)';
      icon.style.filter = isActive ? 'brightness(0)' : 'sepia(1) saturate(5) hue-rotate(5deg)';
      label.style.color = AMBER;
      hotkey.style.color = AMBER;
    });

    wrapper.addEventListener('click', () => {
      SoundManager.playUI('UI_Select');
      playWarble(this.sidebarEl, 0.3, 0.3);
      btn.action();
    });

    this.buttonsContainer.appendChild(wrapper);
    this.buttons.set(btn.id, { el: wrapper, btn });

    if (btn.hidden) {
      wrapper.style.display = 'none';
    }
  }

  private expand() {
    if (this.expanded) return;
    this.expanded = true;
    this.sidebarEl.style.width = '286px';
    
    for (const [id, { el }] of this.buttons) {
      const label = el.querySelector('div:nth-child(2)') as HTMLElement;
      const hotkey = el.querySelector('div:nth-child(3)') as HTMLElement;
      if (label) label.style.opacity = '1';
      if (hotkey) hotkey.style.opacity = '0.8';
    }

    SoundManager.playUI('UI_Expand');
  }

  private collapse() {
    if (!this.expanded) return;
    this.expanded = false;
    this.sidebarEl.style.width = '104px';

    for (const [id, { el }] of this.buttons) {
      const label = el.querySelector('div:nth-child(2)') as HTMLElement;
      const hotkey = el.querySelector('div:nth-child(3)') as HTMLElement;
      if (label) label.style.opacity = '0';
      if (hotkey) hotkey.style.opacity = '0';
    }

    SoundManager.playSfx('degauss');
  }

  private onInspect() {
    this.callbacks.setBuildMode('none');
    this.closeAllSubmenus();
  }

  private onConstruct() {
    if (this.currentSubmenu === 'construct') {
      this.closeAllSubmenus();
      this.callbacks.onCancelBuild();
      return;
    }
    this.showConstructSubmenu();
  }

  private onMine() {
    if (this.currentSubmenu === 'mine') {
      this.closeAllSubmenus();
      return;
    }
    this.showMineSubmenu();
  }

  private onBeacon() {
    this.closeAllSubmenus();
    Base.addAlert('system', 'Emergency Beacon: Coming Soon');
  }

  private onDisaster() {
    if (this.currentSubmenu === 'disaster') {
      this.closeAllSubmenus();
      return;
    }
    this.showDisasterSubmenu();
  }

  private showConstructSubmenu() {
    this.currentSubmenu = 'construct';
    this.submenuContainer.innerHTML = '';
    this.submenuContainer.style.display = 'flex';

    this.createSubmenuButton({
      label: line('BUILDM014TEXT'),
      hotkey: 'X',
      color: RED,
      icon: '×',
      action: () => {
        this.callbacks.onCancelBuild();
        this.closeAllSubmenus();
      },
    });

    this.createSubmenuButton({
      label: line('HUDHUD019TEXT'),
      hotkey: 'C',
      color: GREEN,
      icon: '✓',
      action: () => {
        this.callbacks.onConfirmBuild();
        this.closeAllSubmenus();
      },
    });

    const header = document.createElement('div');
    header.textContent = '>> ' + line('HUDHUD012TEXT');
    header.style.cssText = `
      color: ${AMBER};
      font-size: 22px;
      font-family: 'Dosis', sans-serif;
      padding: 10px 20px;
      opacity: 0.7;
    `;
    this.submenuContainer.appendChild(header);

    const modes: { label: string; hotkey: string; mode: BuildMode }[] = [
      { label: line('HUDHUD013TEXT'), hotkey: 'C', mode: 'room' },
      { label: line('HUDHUD014TEXT'), hotkey: 'W', mode: 'wall' },
      { label: line('HUDHUD027TEXT'), hotkey: 'B', mode: 'floor' },
      { label: line('ZONEUI014TEXT'), hotkey: 'P', mode: 'object' },
      { label: line('HUDHUD017TEXT'), hotkey: 'D', mode: 'demolish' },
      { label: line('BUILDM009TEXT'), hotkey: 'V', mode: 'vaporize' },
      { label: line('HUDHUD011TEXT'), hotkey: 'E', mode: 'erase' },
    ];

    for (const m of modes) {
      this.createSubmenuButton({
        label: m.label,
        hotkey: m.hotkey,
        color: AMBER,
        icon: this.getModeIcon(m.mode),
        action: () => this.callbacks.setBuildMode(m.mode),
      });
    }
  }

  private showMineSubmenu() {
    this.currentSubmenu = 'mine';
    this.submenuContainer.innerHTML = '';
    this.submenuContainer.style.display = 'flex';

    this.createSubmenuButton({
      label: line('HUDHUD019TEXT'),
      hotkey: 'ESC',
      color: GREEN,
      icon: '✓',
      action: () => {
        this.callbacks.onConfirmBuild();
        this.closeAllSubmenus();
      },
    });

    const header = document.createElement('div');
    header.textContent = '>> ' + line('HUDHUD008TEXT');
    header.style.cssText = `
      color: ${AMBER};
      font-size: 22px;
      font-family: 'Dosis', sans-serif;
      padding: 10px 20px;
      opacity: 0.7;
    `;
    this.submenuContainer.appendChild(header);

    this.createSubmenuButton({
      label: line('HUDHUD008TEXT'),
      hotkey: 'M',
      color: AMBER,
      icon: '⛏',
      action: () => this.callbacks.setBuildMode('mine'),
    });

    this.createSubmenuButton({
      label: line('HUDHUD011TEXT'),
      hotkey: 'E',
      color: AMBER,
      icon: '✖',
      action: () => this.callbacks.setBuildMode('erase'),
    });
  }

  private showDisasterSubmenu() {
    this.currentSubmenu = 'disaster';
    this.submenuContainer.innerHTML = '';
    this.submenuContainer.style.display = 'flex';

    const header = document.createElement('div');
    header.textContent = '>> ' + line('HUDHUD062TEXT');
    header.style.cssText = `
      color: ${AMBER};
      font-size: 22px;
      font-family: 'Dosis', sans-serif;
      padding: 10px 20px;
      opacity: 0.7;
    `;
    this.submenuContainer.appendChild(header);

    const wip = document.createElement('div');
    wip.textContent = 'Disaster options coming soon...';
    wip.style.cssText = `
      color: ${AMBER};
      font-size: 20px;
      font-family: 'Dosis', sans-serif;
      padding: 20px;
      opacity: 0.5;
      text-align: center;
    `;
    this.submenuContainer.appendChild(wip);
  }

  private createSubmenuButton(opts: {
    label: string;
    hotkey: string;
    color: string;
    icon: string;
    action: () => void;
  }) {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
      width: 286px;
      height: 81px;
      display: flex;
      align-items: center;
      cursor: pointer;
      padding: 0 20px;
      gap: 12px;
      transition: background 0.15s ease;
    `;

    const iconEl = document.createElement('span');
    iconEl.textContent = opts.icon;
    iconEl.style.cssText = `
      width: 48px;
      text-align: center;
      font-size: 24px;
      color: ${opts.color};
    `;
    wrapper.appendChild(iconEl);

    const label = document.createElement('div');
    label.textContent = opts.label;
    label.style.cssText = `
      flex: 1;
      color: ${opts.color};
      font-size: 40px;
      font-family: 'Dosis', sans-serif;
      font-weight: 400;
    `;
    wrapper.appendChild(label);

    const hotkey = document.createElement('div');
    hotkey.textContent = opts.hotkey;
    hotkey.style.cssText = `
      color: ${AMBER};
      font-size: 20px;
      font-family: 'Dosis', sans-serif;
      font-weight: 600;
      opacity: 0.6;
    `;
    wrapper.appendChild(hotkey);

    wrapper.addEventListener('mouseenter', () => {
      SoundManager.playUI('UI_Hilight');
      wrapper.style.background = opts.color;
      iconEl.style.color = '#000';
      label.style.color = '#000';
      hotkey.style.color = '#000';
    });

    wrapper.addEventListener('mouseleave', () => {
      wrapper.style.background = 'transparent';
      iconEl.style.color = opts.color;
      label.style.color = opts.color;
      hotkey.style.color = AMBER;
    });

    wrapper.addEventListener('click', () => {
      SoundManager.playUI('UI_Select');
      opts.action();
    });

    this.submenuContainer.appendChild(wrapper);
  }

  private closeAllSubmenus() {
    this.currentSubmenu = 'none';
    this.submenuContainer.style.display = 'none';
  }

  private getModeIcon(mode: BuildMode): string {
    const icons: Record<string, string> = {
      room: '□',
      wall: '▓',
      floor: '▢',
      object: '○',
      demolish: '⚒',
      vaporize: '⚡',
      erase: '✕',
      mine: '⛏',
    };
    return icons[mode] || '•';
  }

  enableDisasterMode() {
    GameRules.bDisasterMode = true;
    const btn = this.buttons.get('disaster');
    if (btn) {
      btn.el.style.display = 'flex';
    }
  }

  isExpanded(): boolean {
    return this.expanded;
  }

  closeSubmenu() {
    this.closeAllSubmenus();
  }

  destroy() {
    this.container.remove();
  }
}
