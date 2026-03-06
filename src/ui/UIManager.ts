/**
 * UIManager.ts — Game overlay UI.
 * Milestone 3: Full HUD (status bar), sidebar, alert log, zone/object pickers.
 * Integrates InspectorPanel and JobRoster.
 */

import { GameRules } from '../core/GameRules';
import { Base } from '../core/Base';
import { ZoneType, ZONE_LIST, ZONE_SPRITES } from '../world/ZoneType';
import { tObjects, getMenuForZone } from '../envobjects/EnvObjectData';
import { STATUS_DEAD } from '../characters/CharacterConstants';
import { InspectorPanel, type SelectedEntity } from './InspectorPanel';
import { JobRoster } from './JobRoster';
import { ResearchPanel } from './ResearchPanel';
import { GoalsPanel } from './GoalsPanel';
import type { BuildMode } from '../building/BuildSystem';
import type { Character } from '../characters/Character';
import type { EnvObject } from '../envobjects/EnvObject';
import type { Room } from '../rooms/Room';
import type { GoalSystem } from '../goals/GoalSystem';
import { EnvObjectManager } from '../envobjects/EnvObjectManager';

const AMBER = '#dfa200';
const SIDEBAR_W = 286;
const SIDEBAR_COLLAPSED_W = 56;
const BUTTON_H = 56;

/** Alert color mapping by category (covers all BASE_EVENT types) */
const ALERT_COLORS: Record<string, string> = {
  system: '#ccc',
  mining: AMBER,
  build: '#4f4',
  // BASE_EVENT values:
  CitizenAttacked: '#f44',
  breach: '#f44',
  CitizenSuffocating: '#f44',
  Default: '#ccc',
  death: '#f44',
  CitizenSkillUp: '#4f4',
  immigration: '#48f',
  event: AMBER,
  EventFailure: '#f84',
  fire: '#f44',
  MaladyEncountered: '#f84',
  hostile: '#f44',
  research: '#4f4',
  MaladyResearchCompleted: '#4f4',
  derelict: AMBER,
  CitizensBrawling: '#f84',
  CitizenTantrum: '#f84',
  rampage: '#f84',
  goal: '#4f4',
  BrigEscaped: '#f44',
  // Other UI categories:
  hint: '#aaa',
  siege: '#f44',
  recycle: '#888',
  docking: '#48f',
  meteor: '#f84',
};

export class UIManager {
  private container: HTMLElement;
  private uiRoot!: HTMLDivElement;

  // Callbacks to game
  private getBuildMode: () => BuildMode;
  private setBuildMode: (mode: BuildMode) => void;
  private getPopulation: () => number;
  private getSelectedZone: () => ZoneType;
  private setSelectedZone: (zone: ZoneType) => void;
  private getHoveredRoomZone: () => ZoneType | null;
  private getHoveredInfo: () => string;
  private onSave: () => void;
  private onLoad: () => void;
  private onExport: () => void;
  private onImport: () => Promise<boolean>;
  private onSpawn: () => void;
  private onObjectSelected: (name: string) => void;
  private getCharacters: () => Character[];
  private getEnvObjects: () => EnvObject[];
  private toggleO2Overlay: () => void;
  private getRooms: () => Room[];
  private getPendingBuildCost: (() => { cost: number; tileCount: number; mode: BuildMode } | null) | null = null;
  private getCorpseCount: (() => number) | null = null;

  // HUD elements
  private matterText!: HTMLSpanElement;
  private popText!: HTMLSpanElement;
  private capacityText!: HTMLSpanElement;
  private starDateText!: HTMLSpanElement;
  // Speed button sprite pairs (inactive/active imgs), one per speed level 0-3
  private speedImgs: { inactive: HTMLImageElement; active: HTMLImageElement }[] = [];
  private moraleText!: HTMLSpanElement;
  private machineHealthText!: HTMLSpanElement;
  private corpseText!: HTMLSpanElement;
  private prevMatter = -1;
  private displayedMatter = -1;
  private matterFlashTimer = 0;

  // Zone picker
  private zonePicker!: HTMLDivElement;
  private zoneButtons: { el: HTMLDivElement; zone: ZoneType }[] = [];

  // Object picker
  private objectPicker!: HTMLDivElement;
  selectedObjectName = '';
  private currentObjectZone: ZoneType | null = null;
  /** Explicit zone override chosen by clicking a tab (null = follow hovered room). */
  private objectZoneOverride: ZoneType | null = null;
  /** Set true when a UI click should suppress game input for this frame. */
  uiClickConsumed = false;

  // Tile tip text (Lua: StatusBar.tileTipText — shows last-clicked tile info)
  private tileTipEl!: HTMLDivElement;
  private tileTipClearTimer = 0;
  private readonly TILE_TIP_DURATION = 5; // seconds before auto-clear

  // Tooltip
  private tooltipEl!: HTMLDivElement;

  // Alert log
  private alertContainer!: HTMLDivElement;
  private alertList!: HTMLDivElement;
  private alertMinimized = false;

  // Sidebar buttons for active tracking
  private sidebarBtns: { el: HTMLDivElement; label: HTMLDivElement; hotkey: HTMLDivElement; icon: HTMLDivElement; mode: BuildMode; btnLabel: string }[] = [];
  /** Sidebar element for collapse/expand. */
  private sidebarEl!: HTMLDivElement;
  /** Whether sidebar is currently expanded (Lua: starts collapsed, expands on hover). */
  private sidebarExpanded = false;

  // Build cost overlay
  private costOverlay!: HTMLDivElement;

  // Construct sub-menu
  private constructSub!: HTMLDivElement;

  // Inspector panel
  private inspectorPanel!: InspectorPanel;

  // Job roster
  private jobRoster!: JobRoster;

  // Research panel
  private researchPanel!: ResearchPanel;

  // Goals panel
  private goalsPanel!: GoalsPanel;

  // Active side panel (mutually exclusive)
  private activePanel: 'none' | 'research' | 'goals' = 'none';

  constructor(container: HTMLElement, callbacks: {
    getBuildMode: () => BuildMode;
    setBuildMode: (mode: BuildMode) => void;
    getPopulation: () => number;
    getSelectedZone: () => ZoneType;
    setSelectedZone: (zone: ZoneType) => void;
    getHoveredRoomZone: () => ZoneType | null;
    getHoveredInfo: () => string;
    onSave: () => void;
    onLoad: () => void;
    onExport: () => void;
    onImport: () => Promise<boolean>;
    onSpawn: () => void;
    onObjectSelected: (name: string) => void;
    getCharacters: () => Character[];
    getEnvObjects: () => EnvObject[];
    toggleO2Overlay: () => void;
    getRooms: () => Room[];
    onSetJob: (character: Character, jobId: number) => void;
    goalSystem: GoalSystem;
    onCuffCharacter?: (character: Character) => void;
    onExecuteCharacter?: (character: Character) => void;
    onDemolishObject?: (obj: EnvObject) => void;
    onCenterCamera?: (char: Character) => void;
    onSelectRoom?: (room: Room) => void;
    getPendingBuildCost?: () => { cost: number; tileCount: number; mode: BuildMode } | null;
    getCorpseCount?: () => number;
  }) {
    this.container = container;
    this.getBuildMode = callbacks.getBuildMode;
    this.setBuildMode = callbacks.setBuildMode;
    this.getPopulation = callbacks.getPopulation;
    this.getSelectedZone = callbacks.getSelectedZone;
    this.setSelectedZone = callbacks.setSelectedZone;
    this.getHoveredRoomZone = callbacks.getHoveredRoomZone;
    this.getHoveredInfo = callbacks.getHoveredInfo;
    this.onSave = callbacks.onSave;
    this.onLoad = callbacks.onLoad;
    this.onExport = callbacks.onExport;
    this.onImport = callbacks.onImport;
    this.onSpawn = callbacks.onSpawn;
    this.onObjectSelected = callbacks.onObjectSelected;
    this.getCharacters = callbacks.getCharacters;
    this.getEnvObjects = callbacks.getEnvObjects;
    this.toggleO2Overlay = callbacks.toggleO2Overlay;
    this.getRooms = callbacks.getRooms;
    this.getPendingBuildCost = callbacks.getPendingBuildCost ?? null;
    this.getCorpseCount = callbacks.getCorpseCount ?? null;

    this.createUI(callbacks.onSetJob, callbacks);
  }

  private createUI(onSetJob: (character: Character, jobId: number) => void, callbacks: {
    goalSystem: GoalSystem;
    onCuffCharacter?: (character: Character) => void;
    onExecuteCharacter?: (character: Character) => void;
    onDemolishObject?: (obj: EnvObject) => void;
    onCenterCamera?: (char: Character) => void;
    onSelectRoom?: (room: Room) => void;
    getRooms: () => Room[];
  }) {
    this.uiRoot = document.createElement('div');
    this.uiRoot.id = 'game-ui';
    this.uiRoot.style.cssText = `
      position:absolute;top:0;left:0;width:100%;height:100%;
      pointer-events:none;z-index:10;font-family:monospace;
    `;

    this.createSidebar();
    this.createHUD();
    this.createZonePicker();
    this.createObjectPicker();
    this.createTooltip();
    this.createAlertLog();
    this.createCostOverlay();

    this.container.appendChild(this.uiRoot);

    // Inspector panel
    this.inspectorPanel = new InspectorPanel(this.uiRoot, {
      onSetJob,
      getObjectsInRoom: (room: Room) => EnvObjectManager.getObjectsInRoom(room),
      onCuffCharacter: callbacks.onCuffCharacter,
      onExecuteCharacter: callbacks.onExecuteCharacter,
      onDemolishObject: callbacks.onDemolishObject,
      getBrigRooms: () => {
        const rooms = callbacks.getRooms();
        return rooms.filter(r => r.zone === 'BRIG');
      },
      getRoomForChar: (char: Character) => {
        const rooms = callbacks.getRooms();
        return rooms.find(r => r.tCharacters.has(char.id)) ?? null;
      },
      onCenterCamera: callbacks.onCenterCamera,
      onSelectRoom: callbacks.onSelectRoom,
    });

    // Research panel
    this.researchPanel = new ResearchPanel(this.uiRoot);

    // Goals panel
    this.goalsPanel = new GoalsPanel(this.uiRoot, callbacks.goalSystem);

    // Job roster
    this.jobRoster = new JobRoster(this.container, {
      getCharacters: this.getCharacters,
      onSetJob,
      onOpen: () => { GameRules.bRunning = false; },
      onClose: () => { GameRules.bRunning = true; },
    });
  }

  // ── HUD (Status Bar) ───────────────────────────────────────────
  // Mirrors StatusBarLayout.lua: sprite icons, Orbitron-style layout, AMBER color.

  private createHUD() {
    // Top-right panel: matter icon + value, people icon + value, divider, stardate, speed buttons
    const hudTop = document.createElement('div');
    hudTop.style.cssText = `
      position:absolute;top:8px;right:10px;pointer-events:auto;
      color:${AMBER};display:flex;align-items:center;gap:10px;font-size:13px;
    `;

    // Matter icon (ui_hud_iconMatter) + value
    const matterIcon = document.createElement('img');
    matterIcon.src = 'assets/ui/hud/ui_hud_iconMatter.png';
    matterIcon.style.cssText = 'height:40px;width:auto;filter:sepia(1) saturate(5) hue-rotate(5deg);vertical-align:middle;';
    hudTop.appendChild(matterIcon);

    this.matterText = document.createElement('span');
    this.matterText.id = 'hud-matter';
    this.matterText.style.cssText = `font-size:30px;font-weight:bold;color:${AMBER};`;
    this.matterText.textContent = '0';
    hudTop.appendChild(this.matterText);

    // People icon (ui_hud_iconPeople) + population / capacity
    const peopleIcon = document.createElement('img');
    peopleIcon.src = 'assets/ui/hud/ui_hud_iconPeople.png';
    peopleIcon.style.cssText = 'height:40px;width:auto;filter:sepia(1) saturate(5) hue-rotate(5deg);vertical-align:middle;margin-left:8px;';
    hudTop.appendChild(peopleIcon);

    const capGroup = document.createElement('div');
    capGroup.style.cssText = 'display:flex;align-items:baseline;gap:0;';
    this.popText = document.createElement('span');
    this.popText.id = 'hud-pop';
    this.popText.style.cssText = `font-size:30px;font-weight:bold;color:${AMBER};`;
    this.popText.textContent = '0';
    this.capacityText = document.createElement('span');
    this.capacityText.style.cssText = 'font-size:16px;color:#888;';
    capGroup.appendChild(this.popText);
    capGroup.appendChild(this.capacityText);
    hudTop.appendChild(capGroup);

    // Divider (DividerLine from Lua)
    const divider = document.createElement('div');
    divider.style.cssText = `width:2px;height:40px;background:${AMBER};opacity:0.6;margin:0 4px;`;
    hudTop.appendChild(divider);

    // Stardate
    this.starDateText = document.createElement('span');
    this.starDateText.id = 'hud-stardate';
    this.starDateText.style.cssText = `font-size:12px;color:${AMBER};`;
    hudTop.appendChild(this.starDateText);

    // Speed buttons (sprite images: speed0-3 + active variants)
    const speedRow = document.createElement('div');
    speedRow.style.cssText = 'display:flex;gap:2px;align-items:center;margin-left:4px;';
    const speeds = [0, 1, 2, 4];
    const speedKeys = ['speed0', 'speed1', 'speed2', 'speed3'];
    for (let i = 0; i < 4; i++) {
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'position:relative;width:30px;height:30px;cursor:pointer;';

      const inactiveImg = document.createElement('img');
      inactiveImg.src = `assets/ui/hud/ui_hud_${speedKeys[i]}.png`;
      inactiveImg.style.cssText = `
        position:absolute;top:0;left:0;width:100%;height:100%;
        filter:sepia(1) saturate(5) hue-rotate(5deg);
        object-fit:contain;
      `;

      const activeImg = document.createElement('img');
      activeImg.src = `assets/ui/hud/ui_hud_${speedKeys[i]}_active.png`;
      activeImg.style.cssText = `
        position:absolute;top:0;left:0;width:100%;height:100%;
        filter:sepia(1) saturate(5) hue-rotate(5deg);
        object-fit:contain;display:none;
      `;

      wrapper.appendChild(inactiveImg);
      wrapper.appendChild(activeImg);

      const idx = i;
      wrapper.addEventListener('click', () => {
        if (speeds[idx] === 0) { GameRules.bRunning = !GameRules.bRunning; }
        else { GameRules.bRunning = true; GameRules.setTimeScale(speeds[idx]); }
      });
      wrapper.addEventListener('mouseenter', () => { wrapper.style.opacity = '0.7'; });
      wrapper.addEventListener('mouseleave', () => { wrapper.style.opacity = '1'; });

      speedRow.appendChild(wrapper);
      this.speedImgs.push({ inactive: inactiveImg, active: activeImg });
    }
    hudTop.appendChild(speedRow);

    this.uiRoot.appendChild(hudTop);

    // Bottom-right panel: morale, machine health, corpses, divider, O2 button, walls button, zoom buttons
    const hudBottom = document.createElement('div');
    hudBottom.style.cssText = `
      position:absolute;bottom:10px;right:10px;pointer-events:auto;
      color:${AMBER};display:flex;align-items:center;gap:8px;font-size:13px;
    `;

    // Corpse count
    this.corpseText = document.createElement('span');
    this.corpseText.style.cssText = `font-size:13px;color:${AMBER};`;
    hudBottom.appendChild(this.corpseText);

    // Machine health
    this.machineHealthText = document.createElement('span');
    this.machineHealthText.style.cssText = 'font-size:13px;color:#888;';
    hudBottom.appendChild(this.machineHealthText);

    // Morale text/icon
    this.moraleText = document.createElement('span');
    this.moraleText.style.cssText = `font-size:13px;color:${AMBER};`;
    hudBottom.appendChild(this.moraleText);

    // Divider
    const divider2 = document.createElement('div');
    divider2.style.cssText = `width:2px;height:36px;background:${AMBER};opacity:0.6;`;
    hudBottom.appendChild(divider2);

    // O2 toggle button (sprite image with active state swap)
    const o2Btn = this._makeBottomButton(
      'assets/ui/hud/ui_hud_buttonvis_o2.png',
      'assets/ui/hud/ui_hud_buttonvis_o2_active.png',
      () => this.toggleO2Overlay(),
    );
    hudBottom.appendChild(o2Btn.el);

    // Walls toggle button
    const wallsBtn = this._makeBottomButton(
      'assets/ui/hud/ui_hud_buttonvis_walls.png',
      'assets/ui/hud/ui_hud_buttonvis_walls_active.png',
      () => {}, // walls toggle wired in main.ts
    );
    hudBottom.appendChild(wallsBtn.el);

    // Divider
    const divider3 = document.createElement('div');
    divider3.style.cssText = `width:2px;height:36px;background:${AMBER};opacity:0.6;`;
    hudBottom.appendChild(divider3);

    // Zoom out button
    const zoomOutBtn = this._makeBottomButton(
      'assets/ui/hud/ui_hud_button_zoomout.png',
      'assets/ui/hud/ui_hud_button_zoomout_active.png',
      () => {},
    );
    hudBottom.appendChild(zoomOutBtn.el);

    // Zoom in button
    const zoomInBtn = this._makeBottomButton(
      'assets/ui/hud/ui_hud_button_zoomin.png',
      'assets/ui/hud/ui_hud_button_zoomin_active.png',
      () => {},
    );
    hudBottom.appendChild(zoomInBtn.el);

    this.uiRoot.appendChild(hudBottom);

    // Tile tip text — shows last-clicked tile info (Lua: StatusBar.tileTipText)
    this.tileTipEl = document.createElement('div');
    this.tileTipEl.style.cssText = `
      position:absolute;bottom:50px;right:10px;
      color:${AMBER};font-size:12px;font-family:monospace;
      pointer-events:none;display:none;
    `;
    this.uiRoot.appendChild(this.tileTipEl);
  }

  /** Create a bottom-bar icon button with inactive/active sprite swap on hover. */
  private _makeBottomButton(inactiveSrc: string, activeSrc: string, onClick: () => void): { el: HTMLDivElement } {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:relative;width:44px;height:46px;cursor:pointer;';

    const inactiveImg = document.createElement('img');
    inactiveImg.src = inactiveSrc;
    inactiveImg.style.cssText = `
      position:absolute;top:0;left:0;width:100%;height:100%;
      filter:sepia(1) saturate(5) hue-rotate(5deg);object-fit:contain;
    `;

    const activeImg = document.createElement('img');
    activeImg.src = activeSrc;
    activeImg.style.cssText = `
      position:absolute;top:0;left:0;width:100%;height:100%;
      filter:sepia(1) saturate(5) hue-rotate(5deg);object-fit:contain;display:none;
    `;

    wrapper.appendChild(inactiveImg);
    wrapper.appendChild(activeImg);
    wrapper.addEventListener('mouseenter', () => {
      inactiveImg.style.display = 'none';
      activeImg.style.display = 'block';
    });
    wrapper.addEventListener('mouseleave', () => {
      inactiveImg.style.display = 'block';
      activeImg.style.display = 'none';
    });
    wrapper.addEventListener('click', onClick);

    return { el: wrapper };
  }

  private hudCell(): HTMLDivElement {
    const el = document.createElement('div');
    el.style.cssText = 'display:flex;align-items:center;gap:4px;';
    return el;
  }

  // ── Sidebar ─────────────────────────────────────────────────────

  private createSidebar() {
    const sidebar = document.createElement('div');
    this.sidebarEl = sidebar;
    sidebar.style.cssText = `
      position:absolute;top:0;left:0;width:${SIDEBAR_COLLAPSED_W}px;height:100%;
      background:rgba(0,0,0,0.8);pointer-events:auto;overflow-y:auto;
      transition:width 0.15s ease;
    `;

    // Collapse/expand on hover (Lua: starts collapsed, expands on hover)
    sidebar.addEventListener('mouseenter', () => {
      this.sidebarExpanded = true;
      sidebar.style.width = `${SIDEBAR_W}px`;
      for (const sb of this.sidebarBtns) {
        sb.label.style.display = '';
        sb.hotkey.style.display = '';
      }
    });
    sidebar.addEventListener('mouseleave', () => {
      this.sidebarExpanded = false;
      sidebar.style.width = `${SIDEBAR_COLLAPSED_W}px`;
      for (const sb of this.sidebarBtns) {
        sb.label.style.display = 'none';
        sb.hotkey.style.display = 'none';
      }
    });

    const btnDefs: { label: string; hotkey: string; mode: BuildMode; action?: string }[] = [
      { label: 'Inspect',   hotkey: 'I', mode: 'none', action: 'inspect' },
      { label: 'Assign',    hotkey: 'R', mode: 'none', action: 'roster' },
      { label: 'Research',  hotkey: 'E', mode: 'none', action: 'research' },
      { label: 'Goals',     hotkey: 'G', mode: 'none', action: 'goals' },
      { label: 'Construct', hotkey: 'C', mode: 'room', action: 'construct' },
      { label: 'Mine',      hotkey: 'M', mode: 'mine' },
      { label: 'Beacon',    hotkey: 'N', mode: 'none', action: 'stub' },
      { label: 'Demolish',  hotkey: 'X', mode: 'demolish' },
    ];

    for (const def of btnDefs) {
      const btn = document.createElement('div');
      btn.style.cssText = `
        height:${BUTTON_H}px;display:flex;align-items:center;
        padding:0 16px;cursor:pointer;position:relative;
      `;
      const icon = document.createElement('div');
      icon.textContent = def.hotkey;
      icon.style.cssText = `font-size:24px;font-weight:bold;color:${AMBER};width:48px;text-align:center;`;
      const label = document.createElement('div');
      label.textContent = def.label;
      label.style.cssText = `font-size:18px;color:${AMBER};flex:1;display:none;`;
      const hotkey = document.createElement('div');
      hotkey.textContent = def.hotkey;
      hotkey.style.cssText = `font-size:12px;color:${AMBER};display:none;`;

      btn.appendChild(icon);
      btn.appendChild(label);
      btn.appendChild(hotkey);

      btn.addEventListener('click', () => {
        if (def.action === 'roster') {
          this.jobRoster.toggle();
          return;
        }
        if (def.action === 'research') {
          this.toggleResearchPanel();
          return;
        }
        if (def.action === 'goals') {
          this.toggleGoalsPanel();
          return;
        }
        if (def.action === 'stub') {
          Base.addAlert('system', `${def.label}: Coming Soon`);
          return;
        }
        if (def.action === 'construct') {
          // Toggle construct mode — show/hide sub-menu
          // Lua: pause game + enable cutaway on open, restore on close
          if (this.getBuildMode() === 'room' || this.getBuildMode() === 'floor' ||
              this.getBuildMode() === 'door' || this.getBuildMode() === 'zone' ||
              this.getBuildMode() === 'object') {
            this.setBuildMode('none');
            GameRules.bRunning = true;
          } else {
            this.setBuildMode('room');
            GameRules.bRunning = false;
          }
          this.refreshObjectPicker();
          return;
        }
        if (def.action === 'inspect') {
          this.setBuildMode('none');
          return;
        }
        // Standard toggle
        if (this.getBuildMode() === def.mode) {
          this.setBuildMode('none');
        } else {
          this.setBuildMode(def.mode);
        }
        this.refreshObjectPicker();
      });

      btn.addEventListener('mouseenter', () => {
        btn.style.background = AMBER;
        icon.style.color = '#000';
        label.style.color = '#000';
        hotkey.style.color = '#000';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = 'transparent';
        icon.style.color = AMBER;
        label.style.color = AMBER;
        hotkey.style.color = AMBER;
      });

      sidebar.appendChild(btn);
      this.sidebarBtns.push({ el: btn, label, hotkey, icon, mode: def.mode, btnLabel: def.label });
    }

    // Construct sub-menu (hidden by default)
    this.constructSub = document.createElement('div');
    this.constructSub.style.cssText = `padding:4px 10px;display:none;`;
    const subBtns: { label: string; hotkey: string; mode: BuildMode }[] = [
      { label: 'Room',    hotkey: 'C', mode: 'room' },
      { label: 'Floor',   hotkey: 'B', mode: 'floor' },
      { label: 'Door',    hotkey: 'D', mode: 'door' },
      { label: 'Zone',    hotkey: 'Z', mode: 'zone' },
      { label: 'Objects', hotkey: 'P', mode: 'object' },
    ];
    for (const sb of subBtns) {
      const el = document.createElement('div');
      el.textContent = `[${sb.hotkey}] ${sb.label}`;
      el.style.cssText = `
        font-size:13px;color:${AMBER};background:rgba(0,0,0,0.6);
        padding:5px 10px;margin-bottom:2px;cursor:pointer;
      `;
      el.addEventListener('click', () => {
        this.setBuildMode(this.getBuildMode() === sb.mode ? 'none' : sb.mode);
        this.refreshObjectPicker();
      });
      el.addEventListener('mouseenter', () => { el.style.background = 'rgba(223,162,0,0.2)'; });
      el.addEventListener('mouseleave', () => { el.style.background = 'rgba(0,0,0,0.6)'; });
      this.constructSub.appendChild(el);
    }
    sidebar.appendChild(this.constructSub);

    // Utility buttons
    const utilContainer = document.createElement('div');
    utilContainer.style.cssText = 'padding:10px;display:flex;gap:6px;flex-wrap:wrap;';
    const utilBtns = [
      { label: 'Save', action: () => { this.onSave(); Base.addAlert('system', 'Game saved.'); } },
      { label: 'Load', action: () => { this.onLoad(); Base.addAlert('system', 'Game loaded.'); } },
      { label: 'Export', action: () => { this.onExport(); Base.addAlert('system', 'Save exported to file.'); } },
      { label: 'Import', action: () => { this.onImport().then(ok => { Base.addAlert('system', ok ? 'Save imported.' : 'Import failed.'); }); } },
    ];
    for (const ub of utilBtns) {
      const el = document.createElement('div');
      el.textContent = ub.label;
      el.style.cssText = `
        font-size:12px;color:${AMBER};background:rgba(0,0,0,0.6);
        padding:5px 10px;cursor:pointer;
      `;
      el.addEventListener('click', ub.action);
      utilContainer.appendChild(el);
    }
    sidebar.appendChild(utilContainer);

    this.uiRoot.appendChild(sidebar);
  }

  // ── Zone Picker ─────────────────────────────────────────────────

  private createZonePicker() {
    this.zonePicker = document.createElement('div');
    this.zonePicker.style.cssText = `
      position:absolute;top:10px;left:${SIDEBAR_W + 10}px;
      display:none;pointer-events:auto;
    `;

    const cols = 3;
    const btnW = 120;
    const btnH = 32;

    for (let i = 0; i < ZONE_LIST.length; i++) {
      const zone = ZONE_LIST[i];
      const config = ZONE_SPRITES[zone];
      const x = (i % cols) * (btnW + 4);
      const y = Math.floor(i / cols) * (btnH + 2);

      const el = document.createElement('div');
      el.textContent = config.name;
      el.style.cssText = `
        position:absolute;left:${x}px;top:${y}px;
        width:${btnW}px;height:${btnH}px;line-height:${btnH}px;
        font-size:13px;color:${AMBER};background:rgba(0,0,0,0.85);
        padding-left:6px;cursor:pointer;box-sizing:border-box;
      `;
      el.addEventListener('click', () => this.setSelectedZone(zone));
      el.addEventListener('mouseenter', () => { el.style.background = 'rgba(223,162,0,0.3)'; });
      el.addEventListener('mouseleave', () => { el.style.background = 'rgba(0,0,0,0.85)'; });
      this.zonePicker.appendChild(el);
      this.zoneButtons.push({ el, zone });
    }

    this.uiRoot.appendChild(this.zonePicker);
  }

  // ── Object Picker ───────────────────────────────────────────────

  private createObjectPicker() {
    this.objectPicker = document.createElement('div');
    this.objectPicker.style.cssText = `
      position:absolute;top:10px;left:${SIDEBAR_W + 10}px;
      display:none;pointer-events:auto;
    `;
    this.uiRoot.appendChild(this.objectPicker);
  }

  /** Resolve which zone to show objects for: explicit override > hovered room > fallback */
  private getEffectiveObjectZone(): ZoneType {
    if (this.objectZoneOverride) return this.objectZoneOverride;
    const hoveredZone = this.getHoveredRoomZone();
    if (hoveredZone) return hoveredZone;
    return ZoneType.PLAIN;
  }

  private refreshObjectPicker() {
    this.objectPicker.innerHTML = '';
    if (this.getBuildMode() !== 'object') {
      this.objectPicker.style.display = 'none';
      return;
    }

    const zone = this.getEffectiveObjectZone();
    this.currentObjectZone = zone;
    const items = getMenuForZone(zone);
    const btnW = 280;
    const btnH = 44;

    // ── Zone selector tabs ──
    const tabRow = document.createElement('div');
    tabRow.style.cssText = `display:flex;flex-wrap:wrap;gap:2px;margin-bottom:4px;width:${btnW}px;`;
    for (const z of ZONE_LIST) {
      const config = ZONE_SPRITES[z];
      const isActive = z === zone;
      const tab = document.createElement('div');
      tab.textContent = config.name;
      tab.style.cssText = `
        font-size:11px;padding:3px 6px;cursor:pointer;
        color:${isActive ? '#000' : AMBER};
        background:${isActive ? AMBER : 'rgba(0,0,0,0.85)'};
      `;
      tab.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.uiClickConsumed = true; });
      tab.addEventListener('click', () => {
        this.objectZoneOverride = z;
        this.refreshObjectPicker();
      });
      tab.addEventListener('mouseenter', () => { if (!isActive) tab.style.background = 'rgba(223,162,0,0.3)'; });
      tab.addEventListener('mouseleave', () => { if (!isActive) tab.style.background = 'rgba(0,0,0,0.85)'; });
      tabRow.appendChild(tab);
    }
    this.objectPicker.appendChild(tabRow);

    // ── Object list ──
    for (let i = 0; i < items.length; i++) {
      const objName = items[i];
      const objData = tObjects[objName];
      if (!objData || !objData.showInObjectMenu) continue;

      const isSelected = objName === this.selectedObjectName;
      const el = document.createElement('div');
      el.style.cssText = `
        width:${btnW}px;height:${btnH}px;
        background:${isSelected ? 'rgba(223,162,0,0.3)' : 'rgba(0,0,0,0.85)'};
        margin-bottom:2px;padding:6px 8px;cursor:pointer;box-sizing:border-box;
      `;
      el.innerHTML = `
        <div style="font-size:14px;color:${AMBER};">${objData.friendlyName}</div>
        <div style="font-size:11px;color:#888;">Cost: ${objData.matterCost}${objData.nPowerDraw ? ` | Power: ${objData.nPowerDraw}` : ''}${objData.nPowerOutput ? ` | +Power: ${objData.nPowerOutput}` : ''}</div>
      `;
      el.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.uiClickConsumed = true; });
      el.addEventListener('click', () => {
        this.selectedObjectName = objName;
        this.onObjectSelected(objName);
        this.refreshObjectPicker(); // Re-render to show selection
      });
      el.addEventListener('mouseenter', () => { if (!isSelected) el.style.background = 'rgba(223,162,0,0.15)'; });
      el.addEventListener('mouseleave', () => { if (!isSelected) el.style.background = 'rgba(0,0,0,0.85)'; });
      this.objectPicker.appendChild(el);
    }

    this.objectPicker.style.display = 'block';
  }

  // ── Tooltip ─────────────────────────────────────────────────────

  private createTooltip() {
    this.tooltipEl = document.createElement('div');
    this.tooltipEl.style.cssText = `
      position:absolute;top:50px;right:10px;width:280px;
      background:rgba(0,0,0,0.8);color:#ccc;font-size:12px;
      padding:8px;line-height:1.6;white-space:pre-wrap;
      display:none;pointer-events:none;
    `;
    this.uiRoot.appendChild(this.tooltipEl);
  }

  // ── Alert Log ───────────────────────────────────────────────────

  private createAlertLog() {
    this.alertContainer = document.createElement('div');
    this.alertContainer.style.cssText = `
      position:absolute;bottom:10px;right:10px;width:360px;
      background:rgba(0,0,0,0.8);border:1px solid #333;
      pointer-events:auto;font-size:12px;
    `;

    // Header
    const headerRow = document.createElement('div');
    headerRow.style.cssText = `
      display:flex;justify-content:space-between;align-items:center;
      padding:4px 8px;border-bottom:1px solid #333;
    `;
    headerRow.innerHTML = `<span style="color:${AMBER};font-size:11px;font-weight:bold;">ALERTS</span>`;
    const minBtn = document.createElement('span');
    minBtn.textContent = '[_]';
    minBtn.style.cssText = `color:${AMBER};cursor:pointer;font-size:11px;`;
    minBtn.addEventListener('click', () => {
      this.alertMinimized = !this.alertMinimized;
      this.alertList.style.display = this.alertMinimized ? 'none' : 'block';
      minBtn.textContent = this.alertMinimized ? '[+]' : '[_]';
    });
    headerRow.appendChild(minBtn);
    this.alertContainer.appendChild(headerRow);

    // Alert list
    this.alertList = document.createElement('div');
    this.alertList.style.cssText = 'max-height:200px;overflow-y:auto;';
    this.alertContainer.appendChild(this.alertList);

    this.uiRoot.appendChild(this.alertContainer);
  }

  // ── Build Cost Overlay ─────────────────────────────────────

  private createCostOverlay() {
    this.costOverlay = document.createElement('div');
    this.costOverlay.id = 'build-cost-overlay';
    this.costOverlay.style.cssText = `
      position:absolute;bottom:10px;left:${SIDEBAR_W + 10}px;
      background:rgba(0,0,0,0.85);border:1px solid ${AMBER};
      color:${AMBER};font-family:monospace;font-size:13px;
      padding:6px 12px;display:none;pointer-events:none;z-index:15;
    `;
    this.uiRoot.appendChild(this.costOverlay);
  }

  // ── Public API ──────────────────────────────────────────────────

  /** Set the selected entity to show in the inspector panel. */
  setSelectedEntity(entity: SelectedEntity) {
    if (entity) this.hideActivePanel();
    this.inspectorPanel.setEntity(entity);
  }

  /** Alias for setSelectedEntity — used by room/camera shortcuts. */
  setInspected(entity: SelectedEntity) {
    this.setSelectedEntity(entity);
  }

  /** Set tile tip text (Lua: StatusBar:setTileTipText). Auto-clears after timeout. */
  setTileTip(text: string) {
    this.tileTipEl.textContent = `Last clicked: ${text}`;
    this.tileTipEl.style.display = 'block';
    this.tileTipClearTimer = this.TILE_TIP_DURATION;
  }

  /** Toggle job roster visibility. Hides alert/hint pane when opening (Lua). */
  toggleJobRoster() {
    const wasVisible = this.jobRoster.isVisible();
    this.jobRoster.toggle();
    if (!wasVisible) {
      // Hide alert pane when opening roster (Lua: hide alert/hint on open)
      this.alertContainer.style.display = 'none';
    } else {
      // Restore alert pane when closing roster
      this.alertContainer.style.display = '';
    }
  }

  /** Check if job roster is open. */
  isJobRosterOpen(): boolean {
    return this.jobRoster.isVisible();
  }

  /** Toggle research panel. Hides goals panel if open. */
  toggleResearchPanel() {
    if (this.activePanel === 'research') {
      this.hideActivePanel();
    } else {
      this.showPanel('research');
    }
  }

  /** Toggle goals panel. Hides research panel if open. */
  toggleGoalsPanel() {
    if (this.activePanel === 'goals') {
      this.hideActivePanel();
    } else {
      this.showPanel('goals');
    }
  }

  /** Check if research panel is visible. */
  isResearchPanelVisible(): boolean {
    return this.researchPanel.isVisible();
  }

  /** Check if goals panel is visible. */
  isGoalsPanelVisible(): boolean {
    return this.goalsPanel.isVisible();
  }

  private showPanel(panel: 'research' | 'goals') {
    this.hideActivePanel();
    this.setBuildMode('none');
    this.activePanel = panel;
    if (panel === 'research') {
      this.researchPanel.show();
    } else {
      this.goalsPanel.show();
    }
  }

  private hideActivePanel() {
    this.researchPanel.hide();
    this.goalsPanel.hide();
    this.activePanel = 'none';
  }

  // ── Update Loop ─────────────────────────────────────────────────

  update() {
    const chars = this.getCharacters();
    const envObjects = this.getEnvObjects();

    // ── HUD Matter (animated counter ticking toward real value) ──
    const currentMatter = GameRules.nMatter;
    if (this.displayedMatter < 0) this.displayedMatter = currentMatter;
    if (this.prevMatter >= 0 && currentMatter !== this.prevMatter) {
      this.matterFlashTimer = 30;
      this.matterText.style.color = currentMatter > this.prevMatter ? '#4f4' : '#f44';
    }
    // Tick displayed value toward real value (Lua: animated counter with sound)
    if (this.displayedMatter !== currentMatter) {
      const diff = currentMatter - this.displayedMatter;
      const step = Math.max(1, Math.abs(Math.floor(diff / 10)));
      if (diff > 0) this.displayedMatter = Math.min(currentMatter, this.displayedMatter + step);
      else this.displayedMatter = Math.max(currentMatter, this.displayedMatter - step);
    }
    if (this.matterFlashTimer > 0) {
      this.matterFlashTimer--;
      if (this.matterFlashTimer === 0 && this.displayedMatter === currentMatter) {
        this.matterText.style.color = AMBER;
      }
    }
    this.prevMatter = currentMatter;
    this.matterText.textContent = String(this.displayedMatter);

    // ── Stardate ──────────────────────────────────────────
    this.starDateText.textContent = `${GameRules.sStarDate} ${GameRules.sStarTime}`;

    // ── Speed buttons ─────────────────────────────────────
    const currentSpeed = !GameRules.bRunning ? 0 : GameRules.playerTimeScale;
    const speedMap = [0, 1, 2, 4];
    for (let i = 0; i < this.speedImgs.length; i++) {
      const active = speedMap[i] === currentSpeed;
      this.speedImgs[i].inactive.style.display = active ? 'none' : 'block';
      this.speedImgs[i].active.style.display = active ? 'block' : 'none';
    }

    // ── Capacity (pop / bed count) ────────────────────────
    const pop = this.getPopulation();
    const bedCount = envObjects.filter(o => o.sName === 'Bed' && o.bBuilt).length;
    const maxCap = bedCount > 0 ? bedCount : Math.max(pop * 3, 1);
    this.popText.textContent = String(pop);
    this.capacityText.textContent = `/${maxCap}`;
    if (pop > maxCap) {
      this.popText.style.color = '#f44';
    } else {
      this.popText.style.color = AMBER;
    }

    // ── Morale (emoticon) ─────────────────────────────────
    const aliveChars = chars.filter(c => c.isAlive());
    if (aliveChars.length > 0) {
      const avgMorale = aliveChars.reduce((sum, c) => sum + c.nMorale, 0) / aliveChars.length;
      // Lua StatusBar: raw morale -100..+100, thresholds at 10/50/70/90
      let emoticon: string;
      if (avgMorale <= 10) emoticon = '>:(';       // bigfrown
      else if (avgMorale <= 50) emoticon = ':(';    // frown
      else if (avgMorale <= 70) emoticon = ':|';    // meh
      else if (avgMorale <= 90) emoticon = ':)';    // smile
      else emoticon = ':D';                         // bigsmile
      this.moraleText.textContent = `${emoticon} ${Math.round(avgMorale)}`;
    } else {
      this.moraleText.textContent = '';
    }

    // ── Machine health ────────────────────────────────────
    const builtObjects = envObjects.filter(o => o.bBuilt);
    if (builtObjects.length > 0) {
      const avgCondition = builtObjects.reduce((sum, o) => sum + o.nCondition, 0) / builtObjects.length;
      this.machineHealthText.textContent = `${Math.round(avgCondition)}%`;
      this.machineHealthText.style.color = avgCondition < 50 ? '#f44' : avgCondition < 80 ? '#ff0' : '#888';
    } else {
      this.machineHealthText.textContent = '';
    }

    // ── Corpses (Lua: count Corpse pickups, not dead characters) ──
    const corpseCount = this.getCorpseCount?.() ?? 0;
    if (corpseCount > 0) {
      this.corpseText.textContent = `${corpseCount}`;
    } else {
      this.corpseText.textContent = '';
    }

    // ── Sidebar active states ─────────────────────────────
    const buildMode = this.getBuildMode();
    const constructModes: BuildMode[] = ['room', 'floor', 'door', 'zone', 'object'];
    const isConstructActive = constructModes.includes(buildMode);

    for (const sb of this.sidebarBtns) {
      let active = false;
      if (sb.btnLabel === 'Construct') {
        active = isConstructActive;
      } else if (sb.btnLabel === 'Inspect') {
        active = buildMode === 'none';
      } else {
        active = buildMode === sb.mode && sb.mode !== 'none';
      }

      sb.el.style.background = active ? AMBER : 'transparent';
      sb.icon.style.color = active ? '#000' : AMBER;
      sb.label.style.color = active ? '#000' : AMBER;
      sb.hotkey.style.color = active ? '#000' : AMBER;
    }

    // ── Construct sub-menu visibility ─────────────────────
    this.constructSub.style.display = isConstructActive || buildMode === 'none' ? 'none' : 'none';
    // Show construct sub-menu when any construct mode is active
    if (isConstructActive) {
      this.constructSub.style.display = 'block';
      // Highlight active sub-button
      const subBtns = this.constructSub.children;
      const subModes: BuildMode[] = ['room', 'floor', 'door', 'zone', 'object'];
      for (let i = 0; i < subBtns.length; i++) {
        const el = subBtns[i] as HTMLElement;
        const isSubActive = buildMode === subModes[i];
        el.style.background = isSubActive ? 'rgba(223,162,0,0.3)' : 'rgba(0,0,0,0.6)';
      }
    } else {
      this.constructSub.style.display = 'none';
    }

    // ── Zone picker ───────────────────────────────────────
    this.zonePicker.style.display = buildMode === 'zone' ? 'block' : 'none';
    if (buildMode === 'zone') {
      const selZone = this.getSelectedZone();
      for (const zb of this.zoneButtons) {
        const sel = zb.zone === selZone;
        zb.el.style.background = sel ? 'rgba(223,162,0,0.4)' : 'rgba(0,0,0,0.85)';
      }
    }

    // ── Object picker ─────────────────────────────────────
    if (buildMode !== 'object') {
      this.objectPicker.style.display = 'none';
      this.objectZoneOverride = null;
    }

    // ── Tooltip ───────────────────────────────────────────
    const info = this.getHoveredInfo();
    if (info) {
      this.tooltipEl.textContent = info;
      this.tooltipEl.style.display = 'block';
    } else {
      this.tooltipEl.style.display = 'none';
    }

    // ── Alert log ─────────────────────────────────────────
    if (!this.alertMinimized) {
      const alerts = Base.getRecentAlerts(10);
      this.alertList.innerHTML = '';
      for (const alert of alerts) {
        const el = document.createElement('div');
        el.style.cssText = `padding:2px 8px;`;
        const color = ALERT_COLORS[alert.type] ?? '#ccc';
        const timeStr = GameRules.getFullStarDateString(alert.time);
        el.innerHTML = `<span style="color:#555;font-size:10px;">${timeStr}</span> <span style="color:${color};">${alert.message}</span>`;
        this.alertList.appendChild(el);
      }
    }

    // ── Build cost overlay ──────────────────────────────────
    if (this.getPendingBuildCost) {
      const costInfo = this.getPendingBuildCost();
      if (costInfo && costInfo.tileCount > 0) {
        const canAfford = GameRules.nMatter >= costInfo.cost;
        const sign = costInfo.mode === 'demolish' ? '+' : '-';
        const costColor = costInfo.mode === 'demolish' ? '#4f4' : (canAfford ? AMBER : '#f44');
        this.costOverlay.innerHTML = `
          <span style="color:${costColor};">${sign}${Math.abs(costInfo.cost)} matter</span>
          <span style="color:#888;font-size:11px;"> (${costInfo.tileCount} tiles)</span>
          ${!canAfford && costInfo.mode !== 'demolish' ? '<div style="color:#f44;font-size:11px;">Insufficient matter!</div>' : ''}
        `;
        this.costOverlay.style.display = 'block';
      } else {
        this.costOverlay.style.display = 'none';
      }
    }

    // ── Tile tip text auto-clear (Lua: checkTileTipTime) ──
    if (this.tileTipClearTimer > 0) {
      this.tileTipClearTimer -= 1 / 60; // approximate dt at 60fps
      if (this.tileTipClearTimer <= 0) {
        this.tileTipEl.style.display = 'none';
      }
    }

    // ── Inspector panel ───────────────────────────────────
    this.inspectorPanel.update();

    // ── Research panel ────────────────────────────────────
    this.researchPanel.update();

    // ── Goals panel ───────────────────────────────────────
    this.goalsPanel.update();

    // ── Job roster ────────────────────────────────────────
    this.jobRoster.update();
  }

  dispose() {
    this.inspectorPanel.dispose();
    this.researchPanel.dispose();
    this.goalsPanel.dispose();
    this.jobRoster.dispose();
    this.uiRoot.remove();
  }
}
