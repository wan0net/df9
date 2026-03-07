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
import { SoundManager } from '../audio/SoundManager';
import { line } from '../localization/Localization';
import { playWarble } from './WarbleEffect';

const AMBER = '#dfa200';
const SIDEBAR_W = 286;
const SIDEBAR_COLLAPSED_W = 104;
const BUTTON_H = 81;

// CSS filter to tint white/gray icons to amber (#dfa200)
// brightness(0) → black, then invert+sepia+saturate+hue-rotate to amber
const ICON_FILTER_AMBER = 'filter:brightness(0) invert(62%) sepia(98%) saturate(600%) hue-rotate(18deg);';
const ICON_FILTER_BLACK = 'filter:brightness(0);';

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
  private tileInfoEl!: HTMLDivElement;
  private tileTipClearTimer = 0;
  private readonly TILE_TIP_DURATION = 5; // seconds before auto-clear

  // Tooltip
  private tooltipEl!: HTMLDivElement;

  // Alert log
  private alertContainer!: HTMLDivElement;
  private alertList!: HTMLDivElement;
  private alertMinimized = false;

  // Sidebar buttons for active tracking
  private sidebarBtns: { el: HTMLDivElement; label: HTMLDivElement; hotkey: HTMLDivElement; icon: HTMLDivElement; iconImg: HTMLImageElement | null; mode: BuildMode; btnLabel: string }[] = [];
  /** Sidebar element for collapse/expand. */
  private sidebarEl!: HTMLDivElement;
  /** Whether sidebar is currently expanded (Lua: starts collapsed, expands on hover). */
  private sidebarExpanded = false;

  // Build cost overlay
  private costOverlay!: HTMLDivElement;

  // Construct sub-menu
  private constructSub!: HTMLDivElement;
  private constructSubModes: BuildMode[] = [];

  // Mine sub-menu
  private mineSub!: HTMLDivElement;

  // Beacon sub-menu
  private beaconSub!: HTMLDivElement;
  selectedViolenceLevel = 'default';

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
    onRezoneRoom?: (room: Room, zone: ZoneType) => void;
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
    onRezoneRoom?: (room: Room, zone: ZoneType) => void;
    getRooms: () => Room[];
  }) {
    this.uiRoot = document.createElement('div');
    this.uiRoot.id = 'game-ui';
    this.uiRoot.style.cssText = `
      position:absolute;top:0;left:0;width:100%;height:100%;
      pointer-events:none;z-index:10;font-family:'Dosis',sans-serif;
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
      onRezoneRoom: callbacks.onRezoneRoom,
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
    // Top-right panel — Lua StatusBarLayout.lua: two rows
    // Row 1: MatterIcon + "Matter" label + value | PeopleIcon + "O2 Capacity" label + value
    // Row 2: divider | Stardate text | speed buttons | ? button
    const hudTop = document.createElement('div');
    hudTop.style.cssText = `
      position:absolute;top:8px;right:10px;pointer-events:auto;
      color:${AMBER};font-size:13px;display:flex;flex-direction:column;align-items:flex-end;
    `;

    // ── Row 1: Matter + O2 Capacity ──
    const row1 = document.createElement('div');
    row1.style.cssText = 'display:flex;align-items:center;gap:10px;';

    // Matter icon + label + value
    const matterIcon = document.createElement('img');
    matterIcon.src = 'assets/ui/hud/ui_hud_iconMatter.png';
    matterIcon.style.cssText = 'height:48px;width:auto;filter:sepia(1) saturate(5) hue-rotate(5deg);vertical-align:middle;';
    row1.appendChild(matterIcon);

    const matterGroup = document.createElement('div');
    matterGroup.style.cssText = 'display:flex;flex-direction:column;';
    const matterLabel = document.createElement('span');
    matterLabel.textContent = line('HUDHUD002TEXT'); // "Matter"
    matterLabel.style.cssText = `font-size:12px;color:#888;font-family:'Dosis',sans-serif;font-weight:600;line-height:1;`;
    this.matterText = document.createElement('span');
    this.matterText.id = 'hud-matter';
    this.matterText.style.cssText = `font-size:36px;font-weight:400;color:${AMBER};font-family:'Dosis',sans-serif;line-height:1;`;
    this.matterText.textContent = '0';
    matterGroup.appendChild(matterLabel);
    matterGroup.appendChild(this.matterText);
    row1.appendChild(matterGroup);

    // People icon + label + value
    const peopleIcon = document.createElement('img');
    peopleIcon.src = 'assets/ui/hud/ui_hud_iconPeople.png';
    peopleIcon.style.cssText = 'height:48px;width:auto;filter:sepia(1) saturate(5) hue-rotate(5deg);vertical-align:middle;margin-left:12px;';
    row1.appendChild(peopleIcon);

    const capGroup = document.createElement('div');
    capGroup.style.cssText = 'display:flex;flex-direction:column;';
    const capLabel = document.createElement('span');
    capLabel.textContent = line('HUDHUD003TEXT'); // "O2 Capacity"
    capLabel.style.cssText = `font-size:12px;color:#888;font-family:'Dosis',sans-serif;font-weight:600;line-height:1;`;
    const capValues = document.createElement('div');
    capValues.style.cssText = 'display:flex;align-items:baseline;gap:0;';
    this.popText = document.createElement('span');
    this.popText.id = 'hud-pop';
    this.popText.style.cssText = `font-size:36px;font-weight:400;color:${AMBER};font-family:'Dosis',sans-serif;line-height:1;`;
    this.popText.textContent = '0';
    this.capacityText = document.createElement('span');
    this.capacityText.style.cssText = 'font-size:16px;color:#888;';
    capValues.appendChild(this.popText);
    capValues.appendChild(this.capacityText);
    capGroup.appendChild(capLabel);
    capGroup.appendChild(capValues);
    row1.appendChild(capGroup);
    hudTop.appendChild(row1);

    // ── Divider line (Lua: DividerLine) ──
    const divider = document.createElement('div');
    divider.style.cssText = `width:100%;height:2px;background:${AMBER};opacity:0.5;margin:6px 0 4px;`;
    hudTop.appendChild(divider);

    // ── Row 2: Stardate + Speed buttons + ? ──
    const row2 = document.createElement('div');
    row2.style.cssText = 'display:flex;align-items:center;gap:8px;';

    // Stardate (Lua: dosissemibold30 style, own row below divider)
    this.starDateText = document.createElement('span');
    this.starDateText.id = 'hud-stardate';
    this.starDateText.style.cssText = `font-size:15px;font-weight:600;color:${AMBER};font-family:'Dosis',sans-serif;`;
    row2.appendChild(this.starDateText);

    // Speed buttons (Lua: PauseButton at x=900, Speed1 at 956, Speed2 at 1012, Speed3 at 1068)
    const speedRow = document.createElement('div');
    speedRow.style.cssText = 'display:flex;gap:2px;align-items:center;margin-left:8px;';
    const speeds = [0, 1, 2, 4];
    const speedKeys = ['speed0', 'speed1', 'speed2', 'speed3'];
    for (let i = 0; i < 4; i++) {
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'position:relative;width:32px;height:32px;cursor:pointer;';

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
    row2.appendChild(speedRow);

    // Help "?" button (Lua: HelpButton)
    const helpBtn = document.createElement('div');
    helpBtn.style.cssText = `
      width:28px;height:28px;border-radius:50%;border:2px solid ${AMBER};
      display:flex;align-items:center;justify-content:center;cursor:pointer;
      font-size:16px;font-weight:bold;color:${AMBER};margin-left:6px;
    `;
    helpBtn.textContent = '?';
    helpBtn.addEventListener('click', () => {
      Base.addAlert('hint', 'Keyboard shortcuts: C=Room, B=Floor, D=Door, X=Demolish, Z=Zone, P=Object, M=Mine, R=Roster, E=Research, G=Goals, O=O2 Overlay, 1/2/3=Speed');
    });
    helpBtn.addEventListener('mouseenter', () => { helpBtn.style.background = AMBER; helpBtn.style.color = '#000'; });
    helpBtn.addEventListener('mouseleave', () => { helpBtn.style.background = 'transparent'; helpBtn.style.color = AMBER; });
    row2.appendChild(helpBtn);

    hudTop.appendChild(row2);
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
      color:${AMBER};font-size:12px;font-family:'Dosis',sans-serif;font-weight:600;
      pointer-events:none;display:none;
    `;
    this.uiRoot.appendChild(this.tileTipEl);

    // Persistent coordinate display — below the top HUD bar
    this.tileInfoEl = document.createElement('div');
    this.tileInfoEl.style.cssText = `
      position:absolute;top:52px;right:10px;
      color:${AMBER};font-size:11px;font-family:'Dosis',sans-serif;font-weight:600;
      pointer-events:none;opacity:0.7;
    `;
    this.tileInfoEl.textContent = '';
    this.uiRoot.appendChild(this.tileInfoEl);
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
    sidebar.id = 'sidebar';
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
      const util = sidebar.querySelector('.sidebar-util') as HTMLElement;
      if (util) util.style.display = 'flex';
      SoundManager.playUI('UI_Expand');
      playWarble(sidebar, 0.3, 0.3);
    });
    sidebar.addEventListener('mouseleave', () => {
      this.sidebarExpanded = false;
      sidebar.style.width = `${SIDEBAR_COLLAPSED_W}px`;
      for (const sb of this.sidebarBtns) {
        sb.label.style.display = 'none';
        sb.hotkey.style.display = 'none';
      }
      const util = sidebar.querySelector('.sidebar-util') as HTMLElement;
      if (util) util.style.display = 'none';
      SoundManager.playSfx('degauss');
    });

    // Lua SideBarLayout.lua: 8 buttons (Inspect, Assign, Research, Goals, Construct, Mine, Beacon, [Disaster])
    const btnDefs: { label: string; hotkey: string; mode: BuildMode; action?: string; iconImg?: string }[] = [
      { label: line('HUDHUD005TEXT'), hotkey: 'I', mode: 'none', action: 'inspect', iconImg: 'ui_iconIso_inspect.png' },
      { label: line('HUDHUD006TEXT'), hotkey: 'R', mode: 'none', action: 'roster', iconImg: 'ui_iconIso_assign.png' },
      { label: line('HUDHUD046TEXT'), hotkey: 'E', mode: 'none', action: 'research', iconImg: 'ui_iconIso_research.png' },
      { label: line('HUDHUD052TEXT'), hotkey: 'G', mode: 'none', action: 'goals', iconImg: 'ui_iconIso_confirm.png' },
      { label: line('HUDHUD007TEXT'), hotkey: 'C', mode: 'room', action: 'construct', iconImg: 'ui_iconIso_construct.png' },
      { label: line('HUDHUD008TEXT'), hotkey: 'M', mode: 'mine', iconImg: 'ui_iconIso_mine.png' },
      { label: line('HUDHUD025TEXT'), hotkey: 'B', mode: 'beacon', action: 'beacon', iconImg: 'ui_iconIso_beacon.png' },
    ];

    for (const def of btnDefs) {
      const btn = document.createElement('div');
      btn.style.cssText = `
        height:${BUTTON_H}px;display:flex;align-items:center;
        padding:0 8px;cursor:pointer;position:relative;
      `;
      // Icon: use <img> with CSS filter for tinting, or text fallback
      const icon = document.createElement('div');
      icon.style.cssText = `width:54px;height:54px;flex-shrink:0;display:flex;align-items:center;justify-content:center;`;
      let iconImg: HTMLImageElement | null = null;
      if (def.iconImg) {
        iconImg = document.createElement('img');
        iconImg.src = `assets/ui/icons/${def.iconImg}`;
        iconImg.style.cssText = `width:48px;height:48px;object-fit:contain;${ICON_FILTER_AMBER}`;
        icon.appendChild(iconImg);
      } else {
        icon.style.cssText = `font-size:24px;font-weight:bold;color:${AMBER};width:54px;text-align:center;flex-shrink:0;`;
        icon.textContent = def.hotkey;
      }
      const label = document.createElement('div');
      label.textContent = def.label;
      label.style.cssText = `font-size:18px;color:${AMBER};flex:1;display:none;font-family:'Dosis',sans-serif;font-weight:400;`;
      const hotkey = document.createElement('div');
      hotkey.textContent = def.hotkey;
      hotkey.style.cssText = `font-size:12px;color:${AMBER};display:none;font-family:'Dosis',sans-serif;font-weight:600;`;

      btn.appendChild(icon);
      btn.appendChild(label);
      btn.appendChild(hotkey);

      btn.addEventListener('click', () => {
        SoundManager.playUI('UI_Select');
        playWarble(sidebar, 0.3, 0.3);
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
          SoundManager.playUI('UI_ShortStatic');
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
        SoundManager.playUI('UI_Hilight');
        btn.style.background = AMBER;
        if (iconImg) {
          iconImg.style.filter = 'brightness(0)';
        } else {
          icon.style.color = '#000';
        }
        label.style.color = '#000';
        hotkey.style.color = '#000';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = 'transparent';
        if (iconImg) {
          iconImg.style.cssText = `width:48px;height:48px;object-fit:contain;${ICON_FILTER_AMBER}`;
        } else {
          icon.style.color = AMBER;
        }
        label.style.color = AMBER;
        hotkey.style.color = AMBER;
      });

      sidebar.appendChild(btn);
      this.sidebarBtns.push({ el: btn, label, hotkey, icon, iconImg, mode: def.mode, btnLabel: def.label });
    }

    // Construct sub-menu — Lua ConstructMenu.lua: replaces sidebar buttons entirely
    this.constructSub = document.createElement('div');
    this.constructSub.style.cssText = `display:none;`;

    // ── Cancel button (red) — Lua CancelButton ──
    const cancelEl = document.createElement('div');
    cancelEl.style.cssText = `height:${BUTTON_H}px;display:flex;align-items:center;padding:0 12px;cursor:pointer;gap:8px;`;
    const cancelIcon = document.createElement('span');
    cancelIcon.textContent = '\u{1F6AB}';
    cancelIcon.style.cssText = `font-size:18px;`;
    const cancelLbl = document.createElement('span');
    cancelLbl.textContent = 'Cancel';
    cancelLbl.style.cssText = `font-size:18px;color:#ff4444;font-family:'Dosis',sans-serif;font-weight:600;`;
    const cancelHk = document.createElement('span');
    cancelHk.textContent = 'ESC';
    cancelHk.style.cssText = `font-size:11px;color:${AMBER};font-family:'Dosis',sans-serif;margin-left:auto;opacity:0.6;`;
    cancelEl.appendChild(cancelIcon);
    cancelEl.appendChild(cancelLbl);
    cancelEl.appendChild(cancelHk);
    cancelEl.addEventListener('click', () => {
      SoundManager.playSfx('degauss');
      this.setBuildMode('none');
    });
    cancelEl.addEventListener('mouseenter', () => { cancelEl.style.background = 'rgba(255,68,68,0.3)'; });
    cancelEl.addEventListener('mouseleave', () => { cancelEl.style.background = 'transparent'; });
    this.constructSub.appendChild(cancelEl);

    // ── ">> Construct" label — Lua HUDHUD012TEXT ──
    const constructLabel = document.createElement('div');
    constructLabel.textContent = line('HUDHUD012TEXT');
    constructLabel.style.cssText = `
      font-size:13px;color:${AMBER};font-family:'Dosis',sans-serif;font-weight:600;
      padding:4px 12px;opacity:0.7;
    `;
    this.constructSub.appendChild(constructLabel);

    // ── Build mode buttons — matching Lua ConstructMenu order ──
    // Lua order: Cancel, Erase, Area(Room), Wall, Floor, [Airlock], Demolish, Vaporize, Confirm, Object
    const subBtns: { label: string; hotkey: string; mode: BuildMode }[] = [
      { label: line('HUDHUD011TEXT'), hotkey: 'E', mode: 'erase' },     // Erase (cancel pending builds)
      { label: line('HUDHUD013TEXT'), hotkey: 'C', mode: 'room' },      // Room (Area)
      { label: line('HUDHUD014TEXT'), hotkey: 'W', mode: 'wall' },      // Wall
      { label: line('HUDHUD027TEXT'), hotkey: 'B', mode: 'floor' },     // Floor
      { label: line('HUDHUD017TEXT'), hotkey: 'X', mode: 'demolish' },  // Tear Down (walls→floor, objects removed)
      { label: line('BUILDM009TEXT'), hotkey: 'V', mode: 'vaporize' },  // Vaporize (everything→space)
      { label: line('ZONEUI014TEXT'), hotkey: 'P', mode: 'object' },    // Object
    ];
    this.constructSubModes = [];
    for (const sb of subBtns) {
      const el = document.createElement('div');
      el.style.cssText = `
        height:${BUTTON_H}px;display:flex;align-items:center;padding:0 12px;cursor:pointer;
        gap:8px;position:relative;
      `;
      const hk = document.createElement('span');
      hk.textContent = `[${sb.hotkey}]`;
      hk.style.cssText = `font-size:13px;color:${AMBER};font-family:'Dosis',sans-serif;font-weight:600;width:32px;`;
      const lbl = document.createElement('span');
      lbl.textContent = sb.label;
      lbl.style.cssText = `font-size:18px;color:${AMBER};font-family:'Dosis',sans-serif;font-weight:400;`;
      el.appendChild(hk);
      el.appendChild(lbl);
      this.constructSubModes.push(sb.mode);
      el.addEventListener('click', () => {
        SoundManager.playUI('UI_Select');
        this.setBuildMode(this.getBuildMode() === sb.mode ? 'none' : sb.mode);
        this.refreshObjectPicker();
      });
      el.addEventListener('mouseenter', () => {
        SoundManager.playUI('UI_Hilight');
        el.style.background = AMBER;
        hk.style.color = '#000';
        lbl.style.color = '#000';
      });
      el.addEventListener('mouseleave', () => {
        el.style.background = 'transparent';
        hk.style.color = AMBER;
        lbl.style.color = AMBER;
      });
      this.constructSub.appendChild(el);
    }

    // ── Confirm button (green) — Lua ConfirmButton — appears after all mode buttons ──
    const confirmEl = document.createElement('div');
    confirmEl.style.cssText = `height:${BUTTON_H}px;display:flex;align-items:center;padding:0 12px;cursor:pointer;gap:8px;`;
    const confirmIcon = document.createElement('span');
    confirmIcon.textContent = '\u2714';
    confirmIcon.style.cssText = `font-size:18px;color:#44ff44;`;
    const confirmLbl = document.createElement('span');
    confirmLbl.textContent = line('HUDHUD019TEXT');
    confirmLbl.style.cssText = `font-size:18px;color:#44ff44;font-family:'Dosis',sans-serif;font-weight:600;`;
    confirmEl.appendChild(confirmIcon);
    confirmEl.appendChild(confirmLbl);
    confirmEl.addEventListener('click', () => {
      SoundManager.playSfx('confirm');
      this.setBuildMode('none');
    });
    confirmEl.addEventListener('mouseenter', () => { confirmEl.style.background = 'rgba(68,255,68,0.2)'; });
    confirmEl.addEventListener('mouseleave', () => { confirmEl.style.background = 'transparent'; });
    this.constructSub.appendChild(confirmEl);

    sidebar.appendChild(this.constructSub);

    // Mine sub-menu — Lua MineMenu: replaces sidebar with Confirm/>>Mine/Mine/Erase
    this.mineSub = document.createElement('div');
    this.mineSub.style.cssText = `display:none;`;

    // Confirm button
    const mineConfirmEl = document.createElement('div');
    mineConfirmEl.style.cssText = `height:${BUTTON_H}px;display:flex;align-items:center;padding:0 12px;cursor:pointer;gap:8px;`;
    const mineConfirmIcon = document.createElement('span');
    mineConfirmIcon.textContent = '\u2714';
    mineConfirmIcon.style.cssText = `font-size:18px;color:#44ff44;`;
    const mineConfirmLbl = document.createElement('span');
    mineConfirmLbl.textContent = line('HUDHUD019TEXT');
    mineConfirmLbl.style.cssText = `font-size:18px;color:#44ff44;font-family:'Dosis',sans-serif;font-weight:600;`;
    const mineConfirmHk = document.createElement('span');
    mineConfirmHk.textContent = 'ESC';
    mineConfirmHk.style.cssText = `font-size:11px;color:${AMBER};font-family:'Dosis',sans-serif;margin-left:auto;opacity:0.6;`;
    mineConfirmEl.append(mineConfirmIcon, mineConfirmLbl, mineConfirmHk);
    mineConfirmEl.addEventListener('click', () => {
      SoundManager.playSfx('confirm');
      this.setBuildMode('none');
    });
    mineConfirmEl.addEventListener('mouseenter', () => { mineConfirmEl.style.background = 'rgba(68,255,68,0.2)'; });
    mineConfirmEl.addEventListener('mouseleave', () => { mineConfirmEl.style.background = 'transparent'; });
    this.mineSub.appendChild(mineConfirmEl);

    // ">> Mine" label
    const mineLabel = document.createElement('div');
    mineLabel.textContent = line('HUDHUD008TEXT');
    mineLabel.style.cssText = `font-size:13px;color:${AMBER};font-family:'Dosis',sans-serif;font-weight:600;padding:4px 12px;opacity:0.7;`;
    this.mineSub.appendChild(mineLabel);

    // Mine button [M]
    const mineBtnEl = document.createElement('div');
    mineBtnEl.style.cssText = `height:${BUTTON_H}px;display:flex;align-items:center;padding:0 12px;cursor:pointer;gap:8px;background:${AMBER};`;
    const mineBtnHk = document.createElement('span');
    mineBtnHk.textContent = '[M]';
    mineBtnHk.style.cssText = `font-size:13px;color:#000;font-family:'Dosis',sans-serif;font-weight:600;width:32px;`;
    const mineBtnLbl = document.createElement('span');
    mineBtnLbl.textContent = line('HUDHUD008TEXT');
    mineBtnLbl.style.cssText = `font-size:18px;color:#000;font-family:'Dosis',sans-serif;font-weight:400;`;
    mineBtnEl.append(mineBtnHk, mineBtnLbl);
    mineBtnEl.addEventListener('click', () => {
      SoundManager.playUI('UI_Select');
      // Already in mine mode, no-op
    });
    this.mineSub.appendChild(mineBtnEl);

    // Erase button [E]
    const mineEraseEl = document.createElement('div');
    mineEraseEl.style.cssText = `height:${BUTTON_H}px;display:flex;align-items:center;padding:0 12px;cursor:pointer;gap:8px;`;
    const mineEraseIcon = document.createElement('span');
    mineEraseIcon.textContent = '\u2716';
    mineEraseIcon.style.cssText = `font-size:16px;color:${AMBER};`;
    const mineEraseHk = document.createElement('span');
    mineEraseHk.textContent = '[E]';
    mineEraseHk.style.cssText = `font-size:13px;color:${AMBER};font-family:'Dosis',sans-serif;font-weight:600;width:32px;`;
    const mineEraseLbl = document.createElement('span');
    mineEraseLbl.textContent = line('HUDHUD011TEXT');
    mineEraseLbl.style.cssText = `font-size:18px;color:${AMBER};font-family:'Dosis',sans-serif;font-weight:400;`;
    mineEraseEl.append(mineEraseIcon, mineEraseHk, mineEraseLbl);
    mineEraseEl.addEventListener('click', () => {
      SoundManager.playUI('UI_Select');
      // Erase pending mine commands
      this.setBuildMode('erase');
    });
    mineEraseEl.addEventListener('mouseenter', () => {
      SoundManager.playUI('UI_Hilight');
      mineEraseEl.style.background = AMBER;
      mineEraseIcon.style.color = '#000';
      mineEraseHk.style.color = '#000';
      mineEraseLbl.style.color = '#000';
    });
    mineEraseEl.addEventListener('mouseleave', () => {
      mineEraseEl.style.background = 'transparent';
      mineEraseIcon.style.color = AMBER;
      mineEraseHk.style.color = AMBER;
      mineEraseLbl.style.color = AMBER;
    });
    this.mineSub.appendChild(mineEraseEl);
    sidebar.appendChild(this.mineSub);

    // Beacon sub-menu — Lua BeaconMenu.lua: replaces sidebar when beacon/security mode is active
    this.beaconSub = document.createElement('div');
    this.beaconSub.style.cssText = `display:none;`;

    // Done button
    const beaconDoneEl = document.createElement('div');
    beaconDoneEl.style.cssText = `height:${BUTTON_H}px;display:flex;align-items:center;padding:0 12px;cursor:pointer;gap:8px;`;
    const beaconDoneLbl = document.createElement('span');
    beaconDoneLbl.textContent = 'Done';
    beaconDoneLbl.style.cssText = `font-size:18px;color:${AMBER};font-family:'Dosis',sans-serif;font-weight:600;`;
    const beaconDoneHk = document.createElement('span');
    beaconDoneHk.textContent = 'ESC';
    beaconDoneHk.style.cssText = `font-size:11px;color:${AMBER};font-family:'Dosis',sans-serif;margin-left:auto;opacity:0.6;`;
    beaconDoneEl.appendChild(beaconDoneLbl);
    beaconDoneEl.appendChild(beaconDoneHk);
    beaconDoneEl.addEventListener('click', () => {
      SoundManager.playSfx('degauss');
      this.setBuildMode('none');
    });
    beaconDoneEl.addEventListener('mouseenter', () => { beaconDoneEl.style.background = `rgba(223,162,0,0.2)`; });
    beaconDoneEl.addEventListener('mouseleave', () => { beaconDoneEl.style.background = 'transparent'; });
    this.beaconSub.appendChild(beaconDoneEl);

    // ">> Security" label
    const secLabel = document.createElement('div');
    secLabel.textContent = line('HUDHUD036TEXT');
    secLabel.style.cssText = `font-size:13px;color:${AMBER};font-family:'Dosis',sans-serif;font-weight:600;padding:4px 12px;opacity:0.7;`;
    this.beaconSub.appendChild(secLabel);

    // Clear Beacon button
    const clearBeaconEl = this._createBeaconButton('\u2716 Clear Beacon', () => {
      // Placeholder: clear all beacons
      SoundManager.playUI('UI_Select');
    });
    this.beaconSub.appendChild(clearBeaconEl);

    // Violence level buttons (Lua: Non-lethal, Necessary, Lethal)
    const violenceBtns = [
      { label: line('HUDHUD051TEXT'), level: 'nonlethal' },  // Force: Non-lethal
      { label: line('HUDHUD049TEXT'), level: 'default' },    // Force: Necessary
      { label: line('HUDHUD050TEXT'), level: 'lethal' },     // Force: Lethal
    ];
    for (const vb of violenceBtns) {
      const el = this._createBeaconButton(vb.label, () => {
        SoundManager.playUI('UI_Select');
        this.selectedViolenceLevel = vb.level;
      });
      (el as any)._violenceLevel = vb.level;
      this.beaconSub.appendChild(el);
    }
    sidebar.appendChild(this.beaconSub);

    // Utility buttons — Lua puts Save/Load in StartMenu, but we keep small links at sidebar bottom for convenience
    const utilContainer = document.createElement('div');
    utilContainer.className = 'sidebar-util';
    utilContainer.style.cssText = `padding:6px 10px;display:none;flex-direction:column;gap:2px;margin-top:auto;`;
    const utilBtns = [
      { label: line('UIMISC046TEXT'), action: () => { this.onSave(); Base.addAlert('system', line('UIMISC050TEXT')); } },
      { label: line('UIMISC047TEXT'), action: () => { this.onLoad(); Base.addAlert('system', line('UIMISC051TEXT')); } },
      { label: line('UIMISC048TEXT'), action: () => { this.onExport(); Base.addAlert('system', line('UIMISC052TEXT')); } },
      { label: line('UIMISC049TEXT'), action: () => { this.onImport().then(ok => { Base.addAlert('system', ok ? line('UIMISC053TEXT') : line('UIMISC054TEXT')); }); } },
    ];
    for (const ub of utilBtns) {
      const el = document.createElement('div');
      el.textContent = ub.label;
      el.style.cssText = `
        font-size:11px;color:${AMBER};opacity:0.6;
        padding:2px 4px;cursor:pointer;
      `;
      el.addEventListener('click', ub.action);
      el.addEventListener('mouseenter', () => { el.style.opacity = '1'; });
      el.addEventListener('mouseleave', () => { el.style.opacity = '0.6'; });
      utilContainer.appendChild(el);
    }
    sidebar.appendChild(utilContainer);

    this.uiRoot.appendChild(sidebar);
  }

  // ── Zone Picker ─────────────────────────────────────────────────

  private _createBeaconButton(label: string, onClick: () => void): HTMLDivElement {
    const el = document.createElement('div');
    el.style.cssText = `height:${BUTTON_H}px;display:flex;align-items:center;padding:0 12px;cursor:pointer;gap:8px;`;
    const lbl = document.createElement('span');
    lbl.textContent = label;
    lbl.style.cssText = `font-size:18px;color:${AMBER};font-family:'Dosis',sans-serif;font-weight:400;`;
    el.appendChild(lbl);
    el.addEventListener('click', onClick);
    el.addEventListener('mouseenter', () => {
      SoundManager.playUI('UI_Hilight');
      el.style.background = AMBER;
      lbl.style.color = '#000';
    });
    el.addEventListener('mouseleave', () => {
      el.style.background = 'transparent';
      lbl.style.color = AMBER;
    });
    return el;
  }

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
    // Lua AlertLayout.lua: right-aligned amber notification panel, newest alert on top
    // Shows "!" icon, message text, and "Spacedate XXXX.XX" below
    this.alertContainer = document.createElement('div');
    this.alertContainer.id = 'alert-panel';
    this.alertContainer.style.cssText = `
      position:absolute;top:140px;right:10px;width:380px;
      pointer-events:auto;font-size:12px;
    `;

    // Alert list (shows newest alert as a notification card)
    this.alertList = document.createElement('div');
    this.alertList.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
    this.alertContainer.appendChild(this.alertList);

    // Minimize toggle at bottom
    const minRow = document.createElement('div');
    minRow.style.cssText = `text-align:right;padding:2px 4px;`;
    const minBtn = document.createElement('span');
    minBtn.textContent = 'ALERTS';
    minBtn.style.cssText = `color:${AMBER};cursor:pointer;font-size:11px;font-weight:bold;font-family:'Dosis',sans-serif;`;
    minBtn.addEventListener('click', () => {
      this.alertMinimized = !this.alertMinimized;
      this.alertList.style.display = this.alertMinimized ? 'none' : 'flex';
      minBtn.textContent = this.alertMinimized ? 'ALERTS [+]' : 'ALERTS';
    });
    minRow.appendChild(minBtn);
    this.alertContainer.appendChild(minRow);

    this.uiRoot.appendChild(this.alertContainer);
  }

  // ── Build Cost Overlay ─────────────────────────────────────

  private createCostOverlay() {
    this.costOverlay = document.createElement('div');
    this.costOverlay.id = 'build-cost-overlay';
    this.costOverlay.style.cssText = `
      position:absolute;bottom:10px;left:${SIDEBAR_W + 10}px;
      background:rgba(0,0,0,0.85);border:1px solid ${AMBER};
      color:${AMBER};font-family:'Dosis',sans-serif;font-weight:600;font-size:13px;
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
    this.tileTipEl.textContent = `${line('HUDHUD001TEXT')} ${text}`;
    this.tileTipEl.style.display = 'block';
    this.tileTipClearTimer = this.TILE_TIP_DURATION;
  }

  /** Update persistent coordinate display with hovered tile info. */
  updateTileInfo(tileX: number, tileY: number, typeName: string) {
    this.tileInfoEl.textContent = `(${tileX}, ${tileY}) ${typeName}`;
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
    this.starDateText.textContent = `${line('HUDHUD004TEXT')} ${GameRules.sStarDate} ${GameRules.sStarTime}`;

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

    // ── Corpses (Lua: ":( XX" format, count Corpse pickups) ──
    const corpseCount = this.getCorpseCount?.() ?? 0;
    if (corpseCount > 0) {
      this.corpseText.textContent = `:( ${corpseCount}`;
    } else {
      this.corpseText.textContent = '';
    }

    // ── Inspector replaces sidebar (Lua: inspector takes over left panel) ──
    const inspectorActive = this.inspectorPanel.hasEntity();
    this.sidebarEl.style.display = inspectorActive ? 'none' : '';

    // ── Sidebar active states ─────────────────────────────
    const buildMode = this.getBuildMode();
    const constructModes: BuildMode[] = ['room', 'floor', 'wall', 'door', 'zone', 'object', 'demolish'];
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
      if (sb.iconImg) {
        sb.iconImg.style.filter = active ? 'brightness(0)' : '';
        if (!active) sb.iconImg.style.cssText = `width:48px;height:48px;object-fit:contain;${ICON_FILTER_AMBER}`;
      } else {
        sb.icon.style.color = active ? '#000' : AMBER;
      }
      sb.label.style.color = active ? '#000' : AMBER;
      sb.hotkey.style.color = active ? '#000' : AMBER;
    }

    // ── Construct sub-menu: replaces sidebar buttons (Lua behavior) ──
    if (isConstructActive) {
      this.constructSub.style.display = 'block';
      // Hide main sidebar buttons when construct menu is active
      for (const sb of this.sidebarBtns) {
        sb.el.style.display = 'none';
      }
      // Highlight active sub-button (skip first 3 children: Cancel, Confirm, label)
      const SUB_OFFSET = 3;
      const subBtns = this.constructSub.children;
      for (let i = 0; i < this.constructSubModes.length; i++) {
        const el = subBtns[i + SUB_OFFSET] as HTMLElement;
        if (!el) continue;
        const hk = el.children[0] as HTMLElement;
        const lbl = el.children[1] as HTMLElement;
        const isSubActive = buildMode === this.constructSubModes[i] && buildMode !== 'none';
        el.style.background = isSubActive ? AMBER : 'transparent';
        if (hk) hk.style.color = isSubActive ? '#000' : AMBER;
        if (lbl) lbl.style.color = isSubActive ? '#000' : AMBER;
      }
    } else {
      this.constructSub.style.display = 'none';
    }

    // ── Mine sub-menu: replaces sidebar buttons (Lua MineMenu) ──
    const isMineActive = buildMode === 'mine';
    if (isMineActive) {
      this.mineSub.style.display = 'block';
      for (const sb of this.sidebarBtns) {
        sb.el.style.display = 'none';
      }
    } else {
      this.mineSub.style.display = 'none';
    }

    // ── Beacon sub-menu: replaces sidebar buttons (Lua BeaconMenu) ──
    const isBeaconActive = buildMode === 'beacon';
    if (isBeaconActive) {
      this.beaconSub.style.display = 'block';
      for (const sb of this.sidebarBtns) {
        sb.el.style.display = 'none';
      }
      // Highlight active violence level
      const children = this.beaconSub.children;
      for (let i = 0; i < children.length; i++) {
        const el = children[i] as HTMLElement;
        const vLevel = (el as any)._violenceLevel;
        if (vLevel) {
          const active = vLevel === this.selectedViolenceLevel;
          el.style.background = active ? AMBER : 'transparent';
          const lbl = el.children[0] as HTMLElement;
          if (lbl) lbl.style.color = active ? '#000' : AMBER;
        }
      }
    } else {
      this.beaconSub.style.display = 'none';
    }

    // Restore sidebar buttons when no submenu is active
    if (!isConstructActive && !isMineActive && !isBeaconActive) {
      for (const sb of this.sidebarBtns) {
        sb.el.style.display = 'flex';
      }
    }

    // ── Zone picker (disabled — zone assignment moved to room inspector Rezone tab) ───
    this.zonePicker.style.display = 'none';
    if (false) {
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

    // ── Alert log (Lua AlertLayout: amber notification cards) ──
    if (!this.alertMinimized) {
      const alerts = Base.getRecentAlerts(3);
      this.alertList.textContent = '';
      for (const alert of alerts) {
        const el = document.createElement('div');
        el.style.cssText = `
          background:rgba(223,162,0,0.9);padding:8px 10px;display:flex;gap:8px;align-items:flex-start;
        `;
        // "!" icon
        const icon = document.createElement('div');
        icon.textContent = '!';
        icon.style.cssText = `
          font-size:18px;font-weight:bold;color:#000;background:#dfa200;border:2px solid #000;
          width:24px;height:24px;display:flex;align-items:center;justify-content:center;flex-shrink:0;
        `;
        // Content
        const content = document.createElement('div');
        content.style.cssText = 'flex:1;';
        const msg = document.createElement('div');
        msg.textContent = alert.message;
        msg.style.cssText = `font-size:13px;color:#000;font-family:'Dosis',sans-serif;font-weight:500;`;
        // Lua: show relative time for recent alerts, absolute for older ones
        const elapsed = GameRules.simTime - alert.time;
        let timeLabel: string;
        if (elapsed < 2) timeLabel = '1 second ago';
        else if (elapsed < 60) timeLabel = `${Math.floor(elapsed)} seconds ago`;
        else if (elapsed < 120) timeLabel = '1 minute ago';
        else if (elapsed < 3600) timeLabel = `${Math.floor(elapsed / 60)} minutes ago`;
        else timeLabel = `${line('HUDHUD004TEXT')} ${GameRules.getFullStarDateString(alert.time)}`;
        const time = document.createElement('div');
        time.textContent = timeLabel;
        time.style.cssText = `font-size:11px;color:#333;font-family:'Dosis',sans-serif;margin-top:2px;`;
        content.appendChild(msg);
        content.appendChild(time);
        el.appendChild(icon);
        el.appendChild(content);
        this.alertList.appendChild(el);
      }
    }

    // ── Build cost overlay (Lua ConstructMenu:getMatterCostText) ─────
    if (this.getPendingBuildCost) {
      const costInfo = this.getPendingBuildCost() as any;
      if (costInfo && costInfo.tileCount > 0) {
        const canAfford = GameRules.nMatter >= costInfo.cost;
        const costColor = costInfo.mode === 'demolish' ? '#4f4' : (canAfford ? AMBER : '#f44');
        // Lua format: "Floor Area: W x H\nCost: N (W wall H floor)"
        let html = '';
        if (costInfo.w && costInfo.h && costInfo.mode === 'room') {
          html += `<div style="color:${AMBER};">Floor Area: ${costInfo.w} x ${costInfo.h}</div>`;
          html += `<div style="color:${costColor};">Cost: ${costInfo.cost} (${costInfo.wallCount} wall ${costInfo.floorCount} floor)</div>`;
        } else if (costInfo.mode === 'demolish') {
          html += `<div style="color:${costColor};">+${Math.abs(costInfo.cost)} matter (${costInfo.tileCount} tiles)</div>`;
        } else {
          html += `<div style="color:${costColor};">Cost: ${costInfo.cost} (${costInfo.tileCount} tiles)</div>`;
        }
        if (!canAfford && costInfo.mode !== 'demolish') {
          html += `<div style="color:#f44;font-size:11px;">${line('BUILDM016TEXT')}</div>`;
        }
        this.costOverlay.innerHTML = html;
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
