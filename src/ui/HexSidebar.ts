import { SoundManager } from '../audio/SoundManager';
import { line } from '../localization/Localization';
import { playWarble } from './WarbleEffect';
import { GameRules } from '../core/GameRules';
import type { BuildMode } from '../building/BuildSystem';
import { EmergencyBeacon, VIOLENCE_DEFAULT, VIOLENCE_LETHAL, VIOLENCE_NONLETHAL } from '../combat/EmergencyBeacon';
import { SquadList } from '../combat/SquadList';

const AMBER = '#dfa200';
const GREEN = '#a5d318';
const RED = '#ff3d00';
const BEACON_RED = '#e60000';
const BEACON_PURPLE = '#8a2be2';

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
  onBeaconPlace?: (squadName: string, tx: number, ty: number) => void;
  onBeaconRemove?: (squadName: string) => void;
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
  private beaconPlacementSquad: string | null = null;
  private beaconPlacementViolence = VIOLENCE_DEFAULT;
  private beaconPreviousBuildMode: BuildMode | null = null;
  private onWindowKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && this.beaconPlacementSquad) {
      this.closeAllSubmenus();
    }
  };
  private onWindowContextMenu = (event: MouseEvent) => {
    if (!this.beaconPlacementSquad) return;
    event.preventDefault();
    this.closeAllSubmenus();
  };
  
  private sidebarEl!: HTMLDivElement;
  private buttonsContainer!: HTMLDivElement;
  private submenuContainer!: HTMLDivElement;

  constructor(parent: HTMLElement, callbacks: SidebarCallbacks) {
    this.container = document.createElement('div');
    this.callbacks = callbacks;
    this.createSidebar();
    window.addEventListener('keydown', this.onWindowKeyDown);
    window.addEventListener('contextmenu', this.onWindowContextMenu);
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
        checkActive: () => this.currentSubmenu === 'beacon',
      },
      {
        id: 'disaster',
        label: line('HUDHUD062TEXT'),
        hotkey: 'Z',
        iconSrc: 'assets/ui/icons/ui_iconIso_beacon.png',
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
    if (this.currentSubmenu === 'beacon') {
      this.closeAllSubmenus();
      return;
    }
    this.showBeaconSubmenu();
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
      const modeIcon = this.getModeIcon(m.mode);
      this.createSubmenuButton({
        label: m.label,
        hotkey: m.hotkey,
        color: AMBER,
        icon: modeIcon.icon,
        iconSrc: modeIcon.iconSrc,
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

  private showBeaconSubmenu() {
    this.currentSubmenu = 'beacon';
    this.submenuContainer.innerHTML = '';
    this.submenuContainer.style.display = 'flex';

    this.createSubmenuButton({
      label: line('HUDHUD035TEXT'),
      hotkey: 'ESC',
      color: GREEN,
      icon: '✓',
      action: () => this.closeAllSubmenus(),
    });

    const header = document.createElement('div');
    header.textContent = '>> ' + line('HUDHUD025TEXT');
    header.style.cssText = `
      color: ${AMBER};
      font-size: 22px;
      font-family: 'Dosis', sans-serif;
      padding: 10px 20px;
      opacity: 0.7;
    `;
    this.submenuContainer.appendChild(header);

    const squads = SquadList.getAllSquads();
    const selectedSquadName = this.beaconPlacementSquad ?? squads[0]?.name ?? null;
    const selectedLevel = selectedSquadName ? this.getSquadViolence(selectedSquadName) : VIOLENCE_DEFAULT;

    this.createSubmenuButton({
      label: `Violence: ${this.getViolenceLabel(selectedLevel)}`,
      hotkey: 'V',
      color: this.getViolenceColor(selectedLevel),
      icon: '●',
      action: () => {
        if (!selectedSquadName) return;
        const nextLevel = this.cycleViolence(selectedLevel);
        this.beaconPlacementViolence = nextLevel;
        if (EmergencyBeacon.hasBeacon(selectedSquadName)) {
          EmergencyBeacon.setViolence(selectedSquadName, nextLevel);
        }
        this.showBeaconSubmenu();
      },
    });

    if (squads.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = 'No squads available';
      empty.style.cssText = `
        color: ${AMBER};
        font-size: 20px;
        font-family: 'Dosis', sans-serif;
        padding: 20px;
        opacity: 0.6;
      `;
      this.submenuContainer.appendChild(empty);
      return;
    }

    for (const squad of squads) {
      const isSelected = this.beaconPlacementSquad === squad.name;
      const hasBeacon = EmergencyBeacon.hasBeacon(squad.name);
      const level = this.getSquadViolence(squad.name);

      this.createSubmenuButton({
        label: `${squad.name} (${squad.getSize()})${isSelected ? ' [PLACE]' : ''}`,
        hotkey: '',
        color: this.getViolenceColor(level),
        icon: '◆',
        action: () => {
          if (hasBeacon) {
            this.removeBeacon(squad.name);
            if (isSelected) {
              this.exitBeaconPlacement(true);
            }
            this.showBeaconSubmenu();
            return;
          }

          if (isSelected) {
            this.exitBeaconPlacement(true);
            this.showBeaconSubmenu();
            return;
          }

          this.beaconPlacementSquad = squad.name;
          this.beaconPlacementViolence = EmergencyBeacon.getViolence(squad.name);
          this.enterBeaconPlacement();
          this.showBeaconSubmenu();
        },
      });
    }
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
    iconSrc?: string;
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

    let iconNode: HTMLElement;
    if (opts.iconSrc) {
      const img = document.createElement('img');
      img.src = opts.iconSrc;
      img.style.cssText = `
        width: 32px; height: 32px; object-fit: contain;
        filter: sepia(1) saturate(3) hue-rotate(15deg) brightness(0.9);
      `;
      const iconWrap = document.createElement('div');
      iconWrap.style.cssText = 'width:48px;text-align:center;display:flex;align-items:center;justify-content:center;';
      iconWrap.appendChild(img);
      iconNode = iconWrap;
    } else {
      const span = document.createElement('span');
      span.textContent = opts.icon;
      span.style.cssText = `width:48px;text-align:center;font-size:24px;color:${opts.color};`;
      iconNode = span;
    }
    wrapper.appendChild(iconNode);

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
      if (opts.iconSrc) {
        const img = iconNode.querySelector('img');
        if (img) img.style.filter = 'brightness(0)';
      } else {
        (iconNode as HTMLSpanElement).style.color = '#000';
      }
      label.style.color = '#000';
      hotkey.style.color = '#000';
    });

    wrapper.addEventListener('mouseleave', () => {
      wrapper.style.background = 'transparent';
      if (opts.iconSrc) {
        const img = iconNode.querySelector('img');
        if (img) img.style.filter = 'sepia(1) saturate(3) hue-rotate(15deg) brightness(0.9)';
      } else {
        (iconNode as HTMLSpanElement).style.color = opts.color;
      }
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
    this.exitBeaconPlacement(true);
  }

  private enterBeaconPlacement() {
    if (!this.beaconPlacementSquad) return;
    const currentMode = this.callbacks.getBuildMode();
    if (currentMode !== 'beacon') {
      this.beaconPreviousBuildMode = currentMode;
    }
    this.callbacks.setBuildMode('beacon');
  }

  private exitBeaconPlacement(restoreMode: boolean) {
    if (!this.beaconPlacementSquad) return;
    if (restoreMode) {
      this.callbacks.setBuildMode(this.beaconPreviousBuildMode ?? 'none');
    }
    this.beaconPlacementSquad = null;
    this.beaconPlacementViolence = VIOLENCE_DEFAULT;
    this.beaconPreviousBuildMode = null;
  }

  private removeBeacon(squadName: string) {
    if (this.callbacks.onBeaconRemove) {
      this.callbacks.onBeaconRemove(squadName);
      return;
    }
    EmergencyBeacon.removeBeacon(squadName);
  }

  placeBeaconAt(tx: number, ty: number): boolean {
    if (!this.beaconPlacementSquad) return false;
    const squad = SquadList.getAllSquads().find((s) => s.name === this.beaconPlacementSquad);
    if (!squad) return false;

    if (this.callbacks.onBeaconPlace) {
      this.callbacks.onBeaconPlace(this.beaconPlacementSquad, tx, ty);
    } else {
      EmergencyBeacon.placeAt(this.beaconPlacementSquad, tx, ty, squad.getSize());
    }
    EmergencyBeacon.setViolence(this.beaconPlacementSquad, this.beaconPlacementViolence);
    return true;
  }

  private getSquadViolence(squadName: string): number {
    if (this.beaconPlacementSquad === squadName) {
      return this.beaconPlacementViolence;
    }
    return EmergencyBeacon.getViolence(squadName);
  }

  private getViolenceColor(level: number): string {
    switch (level) {
      case VIOLENCE_LETHAL:
        return BEACON_RED;
      case VIOLENCE_NONLETHAL:
        return BEACON_PURPLE;
      case VIOLENCE_DEFAULT:
      default:
        return AMBER;
    }
  }

  private cycleViolence(level: number): number {
    if (level === VIOLENCE_DEFAULT) return VIOLENCE_LETHAL;
    if (level === VIOLENCE_LETHAL) return VIOLENCE_NONLETHAL;
    return VIOLENCE_DEFAULT;
  }

  private getViolenceLabel(level: number): string {
    if (level === VIOLENCE_LETHAL) return 'Lethal';
    if (level === VIOLENCE_NONLETHAL) return 'Nonlethal';
    return 'Default';
  }

  private getModeIcon(mode: BuildMode): { icon: string; iconSrc?: string } {
    // Lua Shared.lua icon names for each construct submenu mode
    const map: Record<string, { icon: string; iconSrc?: string }> = {
      room: { icon: '□', iconSrc: 'assets/ui/icons/ui_iconIso_room.png' },
      wall: { icon: '▓', iconSrc: 'assets/ui/icons/ui_iconIso_Wall.png' },
      floor: { icon: '▢', iconSrc: 'assets/ui/icons/ui_iconIso_floor.png' },
      object: { icon: '○', iconSrc: 'assets/ui/icons/ui_iconIso_object.png' },
      demolish: { icon: '⚒', iconSrc: 'assets/ui/icons/ui_iconIso_demolish.png' },
      vaporize: { icon: '⚡', iconSrc: 'assets/ui/icons/ui_iconIso_demolish.png' },
      erase: { icon: '✕', iconSrc: 'assets/ui/icons/ui_iconIso_erase.png' },
      mine: { icon: '⛏', iconSrc: 'assets/ui/icons/ui_iconIso_mine.png' },
      door: { icon: '▯', iconSrc: 'assets/ui/icons/ui_iconIso_door.png' },
    };
    return map[mode] || { icon: '•' };
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
    window.removeEventListener('keydown', this.onWindowKeyDown);
    window.removeEventListener('contextmenu', this.onWindowContextMenu);
    this.container.remove();
  }
}
