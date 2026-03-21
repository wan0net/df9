/**
 * UIManager.ts — Game overlay UI.
 * Milestone 3: Full HUD (status bar), sidebar, alert log, zone/object pickers.
 * Integrates InspectorPanel and JobRoster.
 */

import { GameRules, RECYCLERS_PER_CITIZEN } from '../core/GameRules';
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
const BRIGHT_AMBER = '#FFE696';
const SIDEBAR_W = 286;
const SIDEBAR_COLLAPSED_W = 104;
const BUTTON_H = 81;
const CONSTRUCT_MENU_W = 430; // Lua SelectObjectSubmenuLayout.lua: nButtonWidth=430
const OBJECT_PICKER_W = 330;  // Lua ObjectMenuLayout.lua: nButtonWidth=330
const OBJECT_BTN_H = 72;     // Lua ObjectMenuLayout.lua: nButtonHeight=72
const OBJECT_SUB_BTN_H = 81; // Lua SelectObjectSubmenuLayout.lua: nButtonHeight=81

// Lua Gui.lua hint/alert log colors
const HINTLOG_BG = '#5D807A';     // Lua Gui.HINTLOG_BG = {93/255,128/255,122/255}
const HINTLOG_BG_ALT = '#709B93'; // Lua Gui.HINTLOG_BG_ALT = {112/255,155/255,147/255}
const HINTLOG_HIGHLIGHT = '#BCFFFF'; // Lua Gui.HINTLOG_HIGHLIGHT = {188/255,255/255,255/255}

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
  private onZoomIn: (() => void) | null = null;
  private onZoomOut: (() => void) | null = null;
  private toggleWalls: (() => void) | null = null;
  private onFlipObject: (() => void) | null = null;
  private getFlipState: (() => boolean) | null = null;
  /** Whether O2 overlay is currently active — set from main.ts for button selected state. */
  o2OverlayActive = false;
  private getRooms: () => Room[];
  private getPendingBuildCost: (() => { cost: number; tileCount: number; mode: BuildMode; buildCost?: number; vaporizeCost?: number; cancelCost?: number } | null) | null = null;
  private getCorpseCount: (() => number) | null = null;
  private onConfirmBuild: (() => boolean) | null = null;
  private onCancelBuild: (() => void) | null = null;
  private hasPendingBuild: (() => boolean) | null = null;
  private onAlertClick: ((alertType: string) => void) | null = null;

  // Disaster callbacks
  private onSpawnRaiders: (() => void) | null = null;
  private onStartFire: (() => void) | null = null;
  private onMeteorShower: (() => void) | null = null;
  private onSpawnMonster: (() => void) | null = null;

  // HUD elements
  private matterText!: HTMLSpanElement;
  private matterLabel!: HTMLSpanElement;
  private popText!: HTMLSpanElement;
  private capacityText!: HTMLSpanElement;
  private starDateText!: HTMLSpanElement;
  // Speed button sprite pairs (inactive/active imgs), one per speed level 0-3
  private speedImgs: { inactive: HTMLImageElement; active: HTMLImageElement }[] = [];
  private moraleText!: HTMLSpanElement;
  private moraleIcon!: HTMLImageElement;
  private machineHealthText!: HTMLSpanElement;
  // O2 and Wall toggle button refs for selected state (Lua: setSelected per tick)
  private o2BtnInactive!: HTMLImageElement;
  private o2BtnActive!: HTMLImageElement;
  private wallsBtnInactive!: HTMLImageElement;
  private wallsBtnActive!: HTMLImageElement;
  private corpseText!: HTMLSpanElement;
  private prevMatter = -1;
  private displayedMatter = -1;
  private matterFlashTimer = 0;

  // Zone picker
  private zonePicker!: HTMLDivElement;
  private zoneButtons: { el: HTMLDivElement; zone: ZoneType }[] = [];

  // Object picker (Lua ObjectMenu → SelectObjectForZoneMenu, sidebar-integrated)
  private objectPicker!: HTMLDivElement;
  selectedObjectName = '';
  private currentObjectZone: ZoneType | null = null;
  /** Explicit zone override chosen by clicking a tab (null = follow hovered room). */
  private objectZoneOverride: ZoneType | null = null;
  /** Set true when a UI click should suppress game input for this frame. */
  uiClickConsumed = false;

  // Object menu — Lua ObjectMenu (zone list) + SelectObjectForZoneMenu (object list)
  private objectMenuEl!: HTMLDivElement;
  private objectSubMenuEl!: HTMLDivElement;
  /** Which level of object menu is showing: 'zones' = zone list, 'objects' = object list */
  private objectMenuState: 'zones' | 'objects' = 'zones';
  /** Selected zone in the object menu */
  private objectMenuZone: ZoneType = ZoneType.PLAIN;

  // Tile tip text (Lua: StatusBar.tileTipText — shows last-clicked tile info)
  private tileTipEl!: HTMLDivElement;
  private tileInfoEl!: HTMLDivElement;
  private tileTipClearTimer = 0;
  private readonly TILE_TIP_DURATION = 5; // seconds before auto-clear

  // Flip button (Lua StatusBar.rFlipButton — shown in object placement mode)
  private flipBtnEl!: HTMLDivElement;

  // Tooltip
  private tooltipEl!: HTMLDivElement;

  // Alert log
  private alertContainer!: HTMLDivElement;
  private alertList!: HTMLDivElement;
  private alertMinimized = false;
  private baseNameHeader!: HTMLDivElement;
  private crewEmoticons!: HTMLSpanElement;

  // Sidebar buttons for active tracking
  private sidebarBtns: { el: HTMLDivElement; label: HTMLDivElement; hotkey: HTMLDivElement; icon: HTMLDivElement; iconImg: HTMLImageElement | null; mode: BuildMode; btnLabel: string; action?: string }[] = [];
  /** Sidebar element for collapse/expand. */
  private sidebarEl!: HTMLDivElement;
  /** Sidebar endcap image — hidden when submenus are shown. */
  private sidebarEndcap!: HTMLImageElement;
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

  // Disaster sub-menu
  private disasterSub!: HTMLDivElement;
  private disasterSubActive = false;

  // Object placement cursor label (U-43)
  private objectCursorLabel!: HTMLDivElement;
  private _lastMouseX = 0;
  private _lastMouseY = 0;

  // Inspect sub-menu (screenshot: "Back" + ">> Inspect" replaces sidebar)
  private inspectSub!: HTMLDivElement;
  private inspectSubActive = false;
  /** Lua NewSideBar.lua: bWasPaused — track pause state before construct menu opens. */
  private wasPausedBeforeConstruct = false;
  /** Lua NewSideBar.lua: bCutawayModeWasEnabled — save cutaway state before construct menu. */
  private bCutawayModeWasEnabled = false;

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
    onZoomIn?: () => void;
    onZoomOut?: () => void;
    toggleWalls?: () => void;
    onFlipObject?: () => void;
    getFlipState?: () => boolean;
    getRooms: () => Room[];
    onSetJob: (character: Character, jobId: number) => void;
    goalSystem: GoalSystem;
    onCuffCharacter?: (character: Character) => void;
    onExecuteCharacter?: (character: Character) => void;
    onDemolishObject?: (obj: EnvObject) => void;
    onCenterCamera?: (char: Character) => void;
    onSelectRoom?: (room: Room) => void;
    onRezoneRoom?: (room: Room, zone: ZoneType) => void;
    getPendingBuildCost?: () => { cost: number; tileCount: number; mode: BuildMode; buildCost?: number; vaporizeCost?: number; cancelCost?: number } | null;
    getCorpseCount?: () => number;
    onConfirmBuild?: () => boolean;
    onCancelBuild?: () => void;
    hasPendingBuild?: () => boolean;
    onAlertClick?: (alertType: string) => void;
    onSpawnRaiders?: () => void;
    onStartFire?: () => void;
    onMeteorShower?: () => void;
    onSpawnMonster?: () => void;
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
    this.onZoomIn = callbacks.onZoomIn ?? null;
    this.onZoomOut = callbacks.onZoomOut ?? null;
    this.toggleWalls = callbacks.toggleWalls ?? null;
    this.onFlipObject = callbacks.onFlipObject ?? null;
    this.getFlipState = callbacks.getFlipState ?? null;
    this.getRooms = callbacks.getRooms;
    this.getPendingBuildCost = callbacks.getPendingBuildCost ?? null;
    this.getCorpseCount = callbacks.getCorpseCount ?? null;
    this.onConfirmBuild = callbacks.onConfirmBuild ?? null;
    this.onCancelBuild = callbacks.onCancelBuild ?? null;
    this.hasPendingBuild = callbacks.hasPendingBuild ?? null;
    this.onAlertClick = callbacks.onAlertClick ?? null;
    this.onSpawnRaiders = callbacks.onSpawnRaiders ?? null;
    this.onStartFire = callbacks.onStartFire ?? null;
    this.onMeteorShower = callbacks.onMeteorShower ?? null;
    this.onSpawnMonster = callbacks.onSpawnMonster ?? null;

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
    this.applyUIScale();

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
    this.researchPanel = new ResearchPanel(this.uiRoot, this.getRooms);

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
      color:${AMBER};font-size:22px;display:flex;flex-direction:column;align-items:flex-end; /* Lua dosissemibold22 base */
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
    this.matterLabel = document.createElement('span');
    this.matterLabel.textContent = line('HUDHUD002TEXT'); // "Matter"
    this.matterLabel.style.cssText = `font-size:26px;color:#AF7F00;font-family:'Dosis',sans-serif;font-weight:600;line-height:1;`; // Lua dosissemibold26
    this.matterText = document.createElement('span');
    this.matterText.id = 'hud-matter';
    this.matterText.style.cssText = `font-size:70px;font-weight:400;color:${AMBER};font-family:'Dosis',sans-serif;line-height:1;`; // Lua dosisregular70
    this.matterText.textContent = '0';
    matterGroup.appendChild(this.matterLabel);
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
    capLabel.style.cssText = `font-size:26px;color:#AF7F00;font-family:'Dosis',sans-serif;font-weight:600;line-height:1;`; // Lua dosissemibold26
    const capValues = document.createElement('div');
    capValues.style.cssText = 'display:flex;align-items:baseline;gap:0;';
    this.popText = document.createElement('span');
    this.popText.id = 'hud-pop';
    this.popText.style.cssText = `font-size:70px;font-weight:400;color:${AMBER};font-family:'Dosis',sans-serif;line-height:1;`; // Lua dosisregular70
    this.popText.textContent = '0';
    this.capacityText = document.createElement('span');
    this.capacityText.style.cssText = 'font-size:30px;color:#AF7F00;'; // Lua dosissemibold30
    capValues.appendChild(this.popText);
    capValues.appendChild(this.capacityText);
    capGroup.appendChild(capLabel);
    capGroup.appendChild(capValues);
    row1.appendChild(capGroup);
    hudTop.appendChild(row1);

    // ── Divider line (Lua: DividerLine) ──
    const divider = document.createElement('div');
    divider.style.cssText = `width:100%;height:4px;background:${AMBER};margin:6px 0 4px;`; // Lua DividerLine: scale=(490,4)
    hudTop.appendChild(divider);

    // ── Row 2: Stardate + Speed buttons + ? ──
    const row2 = document.createElement('div');
    row2.style.cssText = 'display:flex;align-items:center;gap:8px;';

    // Stardate (Lua: dosissemibold30 style, own row below divider)
    this.starDateText = document.createElement('span');
    this.starDateText.id = 'hud-stardate';
    this.starDateText.style.cssText = `font-size:30px;font-weight:600;color:${AMBER};font-family:'Dosis',sans-serif;`; // Lua dosissemibold30
    row2.appendChild(this.starDateText);

    // Speed buttons (Lua: PauseButton at x=900, Speed1 at 956, Speed2 at 1012, Speed3 at 1068)
    const speedRow = document.createElement('div');
    speedRow.style.cssText = 'display:flex;gap:2px;align-items:center;margin-left:8px;';
    const speeds = [0, 1, 2, 4];
    const speedKeys = ['speed0', 'speed1', 'speed2', 'speed3'];
    for (let i = 0; i < 4; i++) {
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'position:relative;width:40px;height:40px;cursor:pointer;'; // Lua: 40x40 at scale 1.4

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
        // Lua: speed buttons gated by bTimeLocked (locked during construct menu)
        if (GameRules.bTimeLocked) return;
        if (speeds[idx] === 0) { GameRules.togglePause(); }
        else { GameRules.setTimeScale(speeds[idx]); }
        SoundManager.playUI('UI_Select'); // Lua StatusBar.lua:349
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
      font-size:22px;font-weight:bold;color:${AMBER};margin-left:6px; /* Lua dosissemibold22 */
    `;
    helpBtn.textContent = '?';
    helpBtn.addEventListener('click', () => {
      Base.addAlert('hint', 'Keyboard shortcuts: C=Room, B=Floor, D=Door, X=Demolish, Z=Zone, P=Object, M=Mine, R=Roster, E=Research, G=Goals, O=O2 Overlay, 1/2/3=Speed');
    });
    helpBtn.addEventListener('mouseenter', () => { helpBtn.style.background = AMBER; helpBtn.style.color = '#000'; });
    helpBtn.addEventListener('mouseleave', () => { helpBtn.style.background = 'transparent'; helpBtn.style.color = AMBER; });
    row2.appendChild(helpBtn);

    // U-17: Quit button — reloads page to return to start menu
    const quitBtn = document.createElement('div');
    quitBtn.style.cssText = `
      padding:4px 10px;border:2px solid ${AMBER};border-radius:4px;
      cursor:pointer;font-size:16px;font-weight:bold;color:${AMBER};
      margin-left:6px;font-family:'Dosis',sans-serif;
    `;
    quitBtn.textContent = 'QUIT';
    quitBtn.addEventListener('click', () => { window.location.reload(); });
    quitBtn.addEventListener('mouseenter', () => { quitBtn.style.background = AMBER; quitBtn.style.color = '#000'; });
    quitBtn.addEventListener('mouseleave', () => { quitBtn.style.background = 'transparent'; quitBtn.style.color = AMBER; });
    row2.appendChild(quitBtn);

    hudTop.appendChild(row2);
    this.uiRoot.appendChild(hudTop);

    // Bottom-right panel (Lua StatusBarLayout order: DeadBodies, MachineDisrepair, Happiness, divider, O2, Walls, divider, ZoomIn, ZoomOut)
    const hudBottom = document.createElement('div');
    hudBottom.style.cssText = `
      position:absolute;bottom:10px;right:10px;pointer-events:auto;
      color:${AMBER};display:flex;align-items:center;gap:8px;font-size:22px; /* Lua dosissemibold22 */
    `;

    // Dead Bodies icon + count (Lua: CoffinIcon + DeadBodiesAmt)
    const corpseIcon = document.createElement('img');
    corpseIcon.src = 'assets/ui/hud/ui_hud_coffin.png';
    corpseIcon.style.cssText = `width:26px;height:26px;filter:sepia(1) saturate(5) hue-rotate(5deg);opacity:0.8;`;
    hudBottom.appendChild(corpseIcon);
    this.corpseText = document.createElement('span');
    this.corpseText.style.cssText = `font-size:22px;color:${AMBER};min-width:20px;`; // Lua dosissemibold22
    hudBottom.appendChild(this.corpseText);

    // Machine Disrepair icon + % (Lua: iconJobTechnician + MachineDisrepairPercent)
    const machineIcon = document.createElement('img');
    machineIcon.src = 'assets/ui/hud/ui_jobs_iconJobTechnician.png';
    machineIcon.style.cssText = `width:22px;height:22px;filter:sepia(1) saturate(5) hue-rotate(5deg);opacity:0.8;`;
    hudBottom.appendChild(machineIcon);
    this.machineHealthText = document.createElement('span');
    this.machineHealthText.style.cssText = `font-size:22px;color:${AMBER};min-width:30px;`; // Lua dosissemibold22
    hudBottom.appendChild(this.machineHealthText);

    // Happiness icon + % (Lua: HappyStatIcon + HappyStatPercent)
    this.moraleIcon = document.createElement('img');
    this.moraleIcon.src = 'assets/ui/hud/ui_dialogicon_meh.png';
    this.moraleIcon.style.cssText = `width:26px;height:26px;filter:sepia(1) saturate(5) hue-rotate(5deg);`;
    hudBottom.appendChild(this.moraleIcon);
    this.moraleText = document.createElement('span');
    this.moraleText.style.cssText = `font-size:22px;color:${AMBER};min-width:30px;`; // Lua dosissemibold22
    hudBottom.appendChild(this.moraleText);

    // Divider (Lua: DividerLine2, scale={4, 54})
    const divider2 = document.createElement('div');
    divider2.style.cssText = `width:4px;height:54px;background:${AMBER};opacity:0.6;`;
    hudBottom.appendChild(divider2);

    // O2 toggle button (sprite image with active state swap)
    const o2Btn = this._makeBottomButton(
      'assets/ui/hud/ui_hud_buttonvis_o2.png',
      'assets/ui/hud/ui_hud_buttonvis_o2_active.png',
      () => this.toggleO2Overlay(),
    );
    this.o2BtnInactive = o2Btn.inactiveImg;
    this.o2BtnActive = o2Btn.activeImg;
    hudBottom.appendChild(o2Btn.el);

    // Walls toggle button (Lua: StatusBar.onWallsButtonPressed)
    const wallsBtn = this._makeBottomButton(
      'assets/ui/hud/ui_hud_buttonvis_walls.png',
      'assets/ui/hud/ui_hud_buttonvis_walls_active.png',
      () => { this.toggleWalls?.(); },
    );
    this.wallsBtnInactive = wallsBtn.inactiveImg;
    this.wallsBtnActive = wallsBtn.activeImg;
    hudBottom.appendChild(wallsBtn.el);

    // Divider (Lua: BottomButtonDividerLine, scale={4, 54})
    const divider3 = document.createElement('div');
    divider3.style.cssText = `width:4px;height:54px;background:${AMBER};opacity:0.6;`;
    hudBottom.appendChild(divider3);

    // Zoom in button (Lua: ZoominButton — note: zoomin is to the LEFT of zoomout in Lua layout)
    const zoomInBtn = this._makeBottomButton(
      'assets/ui/hud/ui_hud_button_zoomin.png',
      'assets/ui/hud/ui_hud_button_zoomin_active.png',
      () => { this.onZoomIn?.(); },
    );
    hudBottom.appendChild(zoomInBtn.el);

    // Zoom out button (Lua: ZoomoutButton — rightmost)
    const zoomOutBtn = this._makeBottomButton(
      'assets/ui/hud/ui_hud_button_zoomout.png',
      'assets/ui/hud/ui_hud_button_zoomout_active.png',
      () => { this.onZoomOut?.(); },
    );
    hudBottom.appendChild(zoomOutBtn.el);

    this.uiRoot.appendChild(hudBottom);

    // Tile tip text — shows last-clicked tile info (Lua: StatusBar.tileTipText)
    this.tileTipEl = document.createElement('div');
    this.tileTipEl.style.cssText = `
      position:absolute;bottom:50px;right:10px;
      color:${AMBER};font-size:22px;font-family:'Dosis',sans-serif;font-weight:600; /* Lua dosissemibold22 */
      pointer-events:none;display:none;
    `;
    this.uiRoot.appendChild(this.tileTipEl);

    // Persistent coordinate display — below the top HUD bar
    this.tileInfoEl = document.createElement('div');
    this.tileInfoEl.style.cssText = `
      position:absolute;bottom:70px;left:120px;
      color:${AMBER};font-size:18px;font-family:'Dosis',sans-serif;font-weight:600; /* Lua dosissemibold18 */
      pointer-events:none;opacity:0.7;
    `;
    this.tileInfoEl.textContent = '';
    this.uiRoot.appendChild(this.tileInfoEl);

    // Flip button — Lua StatusBar.rFlipButton, bottom-left, visible in object placement mode
    this.flipBtnEl = document.createElement('div');
    this.flipBtnEl.textContent = '\u21C4 FLIP (F)';
    this.flipBtnEl.style.cssText = `
      position:absolute;bottom:152px;left:10px;
      background:rgba(0,0,0,0.8);border:1px solid ${AMBER};
      color:${AMBER};font-size:22px;font-family:'Dosis',sans-serif;font-weight:600;
      padding:8px 16px;cursor:pointer;display:none;z-index:20;
    `;
    this.flipBtnEl.addEventListener('click', () => {
      this.onFlipObject?.();
      this.uiClickConsumed = true;
    });
    this.flipBtnEl.addEventListener('mouseenter', () => {
      this.flipBtnEl.style.color = BRIGHT_AMBER;
      this.flipBtnEl.style.borderColor = BRIGHT_AMBER;
    });
    this.flipBtnEl.addEventListener('mouseleave', () => {
      this.flipBtnEl.style.color = AMBER;
      this.flipBtnEl.style.borderColor = AMBER;
    });
    this.uiRoot.appendChild(this.flipBtnEl);
  }

  /** Create a bottom-bar icon button with inactive/active sprite swap on hover.
   *  Returns image refs so caller can set persistent selected state (Lua: setSelected). */
  private _makeBottomButton(inactiveSrc: string, activeSrc: string, onClick: () => void): { el: HTMLDivElement; inactiveImg: HTMLImageElement; activeImg: HTMLImageElement } {
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
    // Hover feedback — only show active on hover if not already selected
    wrapper.addEventListener('mouseenter', () => {
      inactiveImg.style.display = 'none';
      activeImg.style.display = 'block';
    });
    wrapper.addEventListener('mouseleave', () => {
      // On leave, respect the selected state: if selected, keep active shown
      if (!(wrapper as HTMLDivElement & { _selected?: boolean })._selected) {
        inactiveImg.style.display = 'block';
        activeImg.style.display = 'none';
      }
    });
    wrapper.addEventListener('click', onClick);

    return { el: wrapper, inactiveImg, activeImg };
  }

  /** Set persistent selected state on a toggle button (Lua: setSelected). */
  private _setButtonSelected(wrapper: HTMLDivElement, inactive: HTMLImageElement, active: HTMLImageElement, selected: boolean) {
    (wrapper as HTMLDivElement & { _selected?: boolean })._selected = selected;
    if (selected) {
      inactive.style.display = 'none';
      active.style.display = 'block';
    } else {
      inactive.style.display = 'block';
      active.style.display = 'none';
    }
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
      background:rgba(0,0,0,0.8);pointer-events:auto;overflow:hidden;
      transition:width 0.15s ease;z-index:1;
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
      // Lua: Disaster button (button 9), hidden until bDisasterMode=true, hotkey Z
      { label: line('HUDHUD062TEXT'), hotkey: 'Z', mode: 'none', action: 'disaster' },
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
      label.style.cssText = `font-size:40px;color:${AMBER};flex:1;display:none;font-family:'Dosis',sans-serif;font-weight:400;`; // Lua dosisregular40
      const hotkey = document.createElement('div');
      hotkey.textContent = def.hotkey;
      hotkey.style.cssText = `font-size:20px;color:${AMBER};display:none;font-family:'Dosis',sans-serif;font-weight:600;`; // Lua dosissemibold20

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
          // Lua NewSideBar.lua: openConstructMenu/closeConstructMenu
          SoundManager.playUI('UI_ShortStatic');
          const cm = this.getBuildMode();
          if (cm === 'room' || cm === 'floor' || cm === 'wall' ||
              cm === 'door' || cm === 'zone' || cm === 'object' ||
              cm === 'demolish' || cm === 'vaporize' || cm === 'erase') {
            // Close construct menu (Lua: closeConstructMenu)
            if (this.onCancelBuild) this.onCancelBuild();
            this.setBuildMode('none');
            // Lua: restore pause state + unlock time scale
            if (!this.wasPausedBeforeConstruct) GameRules.bRunning = true;
            GameRules.bTimeLocked = false;
            // Lua: restore cutaway mode
            GameRules.enableCutawayMode(this.bCutawayModeWasEnabled);
          } else {
            // Open construct menu (Lua: openConstructMenu)
            this.wasPausedBeforeConstruct = !GameRules.bRunning;
            this.bCutawayModeWasEnabled = GameRules.isCutawayModeEnabled();
            this.setBuildMode('room');
            GameRules.bRunning = false;
            GameRules.bTimeLocked = true; // Lua: lockTimeScale(true)
            // Lua: enable cutaway while building
            GameRules.enableCutawayMode(true);
          }
          this.refreshObjectPicker();
          return;
        }
        if (def.action === 'inspect') {
          this.setBuildMode('none');
          this.inspectSubActive = true; // Show inspect submenu (screenshot 20.32.12)
          return;
        }
        if (def.action === 'disaster') {
          this.disasterSubActive = !this.disasterSubActive;
          if (this.disasterSubActive) {
            this.setBuildMode('none');
          }
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

      // Lua: Disaster button hidden until bDisasterMode=true
      if (def.action === 'disaster') {
        btn.style.display = 'none';
      }
      sidebar.appendChild(btn);
      this.sidebarBtns.push({ el: btn, label, hotkey, icon, iconImg, mode: def.mode, btnLabel: def.label, action: def.action });
    }

    // ── Inspect sub-menu (screenshot 20.32.12: "Back" + ">> Inspect") ──
    this.inspectSub = document.createElement('div');
    this.inspectSub.style.cssText = `display:none;position:absolute;top:0;left:0;width:${CONSTRUCT_MENU_W}px;z-index:5;background:rgba(0,0,0,0.95);pointer-events:auto;`;

    // Back button (ESC)
    const inspBackEl = document.createElement('div');
    inspBackEl.style.cssText = `height:${BUTTON_H}px;display:flex;align-items:center;padding:0 12px;cursor:pointer;gap:8px;`;
    const inspBackLbl = document.createElement('span');
    inspBackLbl.textContent = line('HUDHUD018TEXT'); // "Back"
    inspBackLbl.style.cssText = `font-size:40px;color:${AMBER};font-family:'Dosis',sans-serif;font-weight:600;flex:1;`; // Lua dosisregular40
    const inspBackHk = document.createElement('span');
    inspBackHk.textContent = 'ESC';
    inspBackHk.style.cssText = `font-size:22px;color:${AMBER};font-family:'Dosis',sans-serif;opacity:0.6;`; // Lua dosissemibold22
    inspBackEl.appendChild(inspBackLbl);
    inspBackEl.appendChild(inspBackHk);
    inspBackEl.addEventListener('click', () => {
      SoundManager.playSfx('degauss');
      this.inspectSubActive = false;
    });
    inspBackEl.addEventListener('mouseenter', () => { inspBackEl.style.background = `rgba(223,162,0,0.2)`; });
    inspBackEl.addEventListener('mouseleave', () => { inspBackEl.style.background = 'transparent'; });
    this.inspectSub.appendChild(inspBackEl);

    this.uiRoot.appendChild(this.inspectSub);

    // Construct sub-menu — Lua ConstructMenu.lua: replaces sidebar buttons entirely
    this.constructSub = document.createElement('div');
    this.constructSub.style.cssText = `display:none;position:absolute;top:0;left:0;width:${CONSTRUCT_MENU_W}px;z-index:5;background:rgba(0,0,0,0.95);pointer-events:auto;`;

    // ── Cancel button — Lua CancelButton (screenshot: amber text + decline icon) ──
    const cancelEl = document.createElement('div');
    cancelEl.style.cssText = `height:${BUTTON_H}px;display:flex;align-items:center;padding:0 12px;cursor:pointer;gap:8px;`;
    const cancelIcon = document.createElement('img');
    cancelIcon.src = 'assets/ui/icons/ui_iconIso_decline.png';
    cancelIcon.style.cssText = `width:32px;height:32px;object-fit:contain;${ICON_FILTER_AMBER}`;
    const cancelLbl = document.createElement('span');
    cancelLbl.textContent = line('BUILDM014TEXT');
    cancelLbl.style.cssText = `font-size:40px;color:${AMBER};font-family:'Dosis',sans-serif;font-weight:400;`; // Lua dosisregular40, Gui.AMBER
    const cancelHk = document.createElement('span');
    cancelHk.textContent = 'x';
    cancelHk.style.cssText = `font-size:22px;color:${AMBER};font-family:'Dosis',sans-serif;margin-left:auto;opacity:0.6;`;
    cancelEl.appendChild(cancelIcon);
    cancelEl.appendChild(cancelLbl);
    cancelEl.appendChild(cancelHk);
    cancelEl.addEventListener('click', () => {
      if (this.onCancelBuild) this.onCancelBuild();
      this.setBuildMode('none');
      if (!this.wasPausedBeforeConstruct) GameRules.bRunning = true;
      GameRules.bTimeLocked = false;
      GameRules.enableCutawayMode(this.bCutawayModeWasEnabled);
    });
    cancelEl.addEventListener('mouseenter', () => { cancelEl.style.background = AMBER; cancelLbl.style.color = '#000'; cancelIcon.style.filter = 'brightness(0)'; });
    cancelEl.addEventListener('mouseleave', () => { cancelEl.style.background = 'transparent'; cancelLbl.style.color = AMBER; cancelIcon.style.cssText = `width:32px;height:32px;object-fit:contain;${ICON_FILTER_AMBER}`; });
    this.constructSub.appendChild(cancelEl);

    // ── Confirm button — Lua ConfirmButton (screenshot: amber text + confirm icon) ──
    const confirmEl = document.createElement('div');
    confirmEl.style.cssText = `height:${BUTTON_H}px;display:flex;align-items:center;padding:0 12px;cursor:pointer;gap:8px;`;
    const confirmIcon = document.createElement('img');
    confirmIcon.src = 'assets/ui/icons/ui_iconIso_confirm.png';
    confirmIcon.style.cssText = `width:32px;height:32px;object-fit:contain;${ICON_FILTER_AMBER}`;
    const confirmLbl = document.createElement('span');
    confirmLbl.textContent = line('HUDHUD019TEXT');
    confirmLbl.style.cssText = `font-size:40px;color:${AMBER};font-family:'Dosis',sans-serif;font-weight:400;`; // Lua dosisregular40, Gui.AMBER
    confirmEl.appendChild(confirmIcon);
    confirmEl.appendChild(confirmLbl);
    confirmEl.addEventListener('click', () => {
      if (this.onConfirmBuild) {
        this.onConfirmBuild();
      }
      this.setBuildMode('none');
      // Lua: closeConstructMenu — restore pause state + unlock time + cutaway
      if (!this.wasPausedBeforeConstruct) GameRules.bRunning = true;
      GameRules.bTimeLocked = false;
      GameRules.enableCutawayMode(this.bCutawayModeWasEnabled);
    });
    confirmEl.addEventListener('mouseenter', () => { confirmEl.style.background = AMBER; confirmIcon.style.filter = 'brightness(0)'; confirmLbl.style.color = '#000'; });
    confirmEl.addEventListener('mouseleave', () => { confirmEl.style.background = 'transparent'; confirmIcon.style.cssText = `width:32px;height:32px;object-fit:contain;${ICON_FILTER_AMBER}`; confirmLbl.style.color = AMBER; });
    this.constructSub.appendChild(confirmEl);

    // ── Build mode buttons — matching Lua ConstructMenu order ──
    // Screenshot order: Cancel, Confirm, label, then mode buttons
    // Screenshot order: Room, Wall, Floor, Object, Tear Down, Vaporize, Erase
    // Layout: [icon] Label           hotkey  (matching screenshot 20.32.27)
    // No Door/Airlock button (doors auto-placed at room boundaries in original)
    const subBtns: { label: string; hotkey: string; mode: BuildMode; icon: string; iconSrc?: string }[] = [
      { label: line('HUDHUD013TEXT'), hotkey: 'c', mode: 'room',      icon: '\u25A3', iconSrc: 'assets/ui/icons/ui_iconIso_room.png' },  // Room (⬓ square with inner)
      { label: line('HUDHUD014TEXT'), hotkey: 'w', mode: 'wall',      icon: '\u2592', iconSrc: 'assets/ui/icons/ui_iconIso_Wall.png' },  // Wall (▒ medium shade)
      { label: line('HUDHUD027TEXT'), hotkey: 'b', mode: 'floor',     icon: '\u2B1C', iconSrc: 'assets/ui/icons/ui_iconIso_floor.png' },  // Floor (⬜ large white square)
      { label: line('ZONEUI014TEXT'), hotkey: 'p', mode: 'object',    icon: '\u2B1A', iconSrc: 'assets/ui/icons/ui_iconIso_object.png' },  // Object (⬚ dotted square)
      { label: line('HUDHUD017TEXT'), hotkey: 'x', mode: 'demolish',  icon: '\u21B5', iconSrc: 'assets/ui/icons/ui_iconIso_demolish.png' },  // Tear Down (↵ arrow)
      { label: line('BUILDM009TEXT'), hotkey: 'v', mode: 'vaporize',  icon: '\u26A1', iconSrc: 'assets/ui/icons/ui_iconIso_demolish.png' },  // Vaporize reuses demolish icon (Lua parity)
      { label: line('HUDHUD011TEXT'), hotkey: 'e', mode: 'erase',     icon: '\u2716', iconSrc: 'assets/ui/icons/ui_iconIso_erase.png' },  // Erase (✖ heavy multiply)
    ];
    this.constructSubModes = [];
    for (const sb of subBtns) {
      const el = document.createElement('div');
      el.style.cssText = `
        height:${BUTTON_H}px;display:flex;align-items:center;padding:0 12px;cursor:pointer;
        gap:8px;position:relative;
      `;
      // Icon on LEFT — use real game icon if available, fallback to text
      let iconEl: HTMLElement;
      if (sb.iconSrc) {
        const img = document.createElement('img');
        img.src = sb.iconSrc;
        img.style.cssText = `width:32px;height:32px;object-fit:contain;${ICON_FILTER_AMBER}`;
        const wrap = document.createElement('div');
        wrap.style.cssText = `width:48px;display:flex;align-items:center;justify-content:center;flex-shrink:0;`;
        wrap.appendChild(img);
        iconEl = wrap;
      } else {
        iconEl = document.createElement('span');
        iconEl.textContent = sb.icon;
        iconEl.style.cssText = `font-size:24px;color:${AMBER};width:48px;text-align:center;flex-shrink:0;`;
      }
      // Label in CENTER
      const lbl = document.createElement('span');
      lbl.textContent = sb.label;
      lbl.style.cssText = `font-size:40px;color:${AMBER};font-family:'Dosis',sans-serif;font-weight:400;flex:1;`; // Lua dosisregular40
      // Hotkey on RIGHT (screenshot: small lowercase letter)
      const hk = document.createElement('span');
      hk.textContent = sb.hotkey;
      hk.style.cssText = `font-size:22px;color:${AMBER};font-family:'Dosis',sans-serif;font-weight:600;opacity:0.6;`; // Lua dosissemibold22
      el.appendChild(iconEl);
      el.appendChild(lbl);
      el.appendChild(hk);
      this.constructSubModes.push(sb.mode);
      el.addEventListener('click', () => {
        SoundManager.playUI('UI_Select');
        const newMode = this.getBuildMode() === sb.mode ? 'none' : sb.mode;
        this.setBuildMode(newMode);
        if (newMode === 'object') {
          // Entering object mode — show zone list (Lua ObjectMenu)
          this.objectMenuState = 'zones';
          this.selectedObjectName = '';
          playWarble(this.sidebarEl);
        }
      });
      el.addEventListener('mouseenter', () => {
        SoundManager.playUI('UI_Hilight');
        el.style.background = AMBER;
        if (sb.iconSrc) {
          const img = iconEl.querySelector('img');
          if (img) img.style.filter = 'brightness(0)';
        } else {
          (iconEl as HTMLSpanElement).style.color = '#000';
        }
        lbl.style.color = '#000';
        hk.style.color = '#000';
      });
      el.addEventListener('mouseleave', () => {
        el.style.background = 'transparent';
        if (sb.iconSrc) {
          const img = iconEl.querySelector('img');
          if (img) img.style.filter = 'none';
        } else {
          (iconEl as HTMLSpanElement).style.color = AMBER;
        }
        lbl.style.color = AMBER;
        hk.style.color = AMBER;
      });
      this.constructSub.appendChild(el);
    }

    this.uiRoot.appendChild(this.constructSub);

    // ── Object Menu — Lua ObjectMenu: zone category buttons (330×72) ──
    this.objectMenuEl = document.createElement('div');
    this.objectMenuEl.style.cssText = `display:none;position:absolute;top:0;left:0;width:${OBJECT_PICKER_W}px;z-index:5;background:rgba(0,0,0,0.95);pointer-events:auto;`;
    this.buildObjectZoneMenu();
    this.uiRoot.appendChild(this.objectMenuEl);

    // ── Object Sub-Menu — Lua SelectObjectForZoneMenu: individual object buttons (430×81) ──
    this.objectSubMenuEl = document.createElement('div');
    this.objectSubMenuEl.style.cssText = `display:none;position:absolute;top:0;left:0;width:${CONSTRUCT_MENU_W}px;z-index:5;background:rgba(0,0,0,0.95);pointer-events:auto;`;
    this.uiRoot.appendChild(this.objectSubMenuEl);

    // Mine sub-menu — Lua MineMenu: replaces sidebar with Confirm/>>Mine/Mine/Erase
    this.mineSub = document.createElement('div');
    this.mineSub.style.cssText = `display:none;position:absolute;top:0;left:0;width:${CONSTRUCT_MENU_W}px;z-index:5;background:rgba(0,0,0,0.95);pointer-events:auto;`;

    // Confirm button
    const mineConfirmEl = document.createElement('div');
    mineConfirmEl.style.cssText = `height:${BUTTON_H}px;display:flex;align-items:center;padding:0 12px;cursor:pointer;gap:8px;`;
    const mineConfirmIcon = document.createElement('span');
    mineConfirmIcon.textContent = '\u2714';
    mineConfirmIcon.style.cssText = `font-size:24px;color:#A5D318;`; // Lua Gui.GREEN
    const mineConfirmLbl = document.createElement('span');
    mineConfirmLbl.textContent = line('HUDHUD019TEXT');
    mineConfirmLbl.style.cssText = `font-size:40px;color:#A5D318;font-family:'Dosis',sans-serif;font-weight:600;`; // Lua Gui.GREEN, dosisregular40
    const mineConfirmHk = document.createElement('span');
    mineConfirmHk.textContent = 'ESC';
    mineConfirmHk.style.cssText = `font-size:22px;color:${AMBER};font-family:'Dosis',sans-serif;margin-left:auto;opacity:0.6;`; // Lua dosissemibold22
    mineConfirmEl.append(mineConfirmIcon, mineConfirmLbl, mineConfirmHk);
    mineConfirmEl.addEventListener('click', () => {
      if (this.onConfirmBuild) this.onConfirmBuild();
      this.setBuildMode('none');
      GameRules.bRunning = true;
    });
    mineConfirmEl.addEventListener('mouseenter', () => { mineConfirmEl.style.background = '#A5D318'; mineConfirmIcon.style.color = '#000'; mineConfirmLbl.style.color = '#000'; });
    mineConfirmEl.addEventListener('mouseleave', () => { mineConfirmEl.style.background = 'transparent'; mineConfirmIcon.style.color = '#A5D318'; mineConfirmLbl.style.color = '#A5D318'; });
    this.mineSub.appendChild(mineConfirmEl);

    // ">> Mine" label
    const mineLabel = document.createElement('div');
    mineLabel.textContent = '>> ' + line('HUDHUD008TEXT'); // Lua prepends ">>" to submenu headers
    mineLabel.style.cssText = `font-size:22px;color:${AMBER};font-family:'Dosis',sans-serif;font-weight:600;padding:4px 12px;opacity:0.7;`; // Lua dosissemibold22
    this.mineSub.appendChild(mineLabel);

    // Mine button — icon + label(flex:1) + hotkey(right), matching construct menu pattern
    const mineBtnEl = document.createElement('div');
    mineBtnEl.style.cssText = `height:${BUTTON_H}px;display:flex;align-items:center;padding:0 12px;cursor:pointer;gap:8px;background:${AMBER};`;
    const mineBtnIcon = document.createElement('span');
    mineBtnIcon.textContent = '\u26CF'; // ⛏ pickaxe
    mineBtnIcon.style.cssText = `font-size:24px;color:#000;width:48px;text-align:center;flex-shrink:0;`;
    const mineBtnLbl = document.createElement('span');
    mineBtnLbl.textContent = line('HUDHUD008TEXT');
    mineBtnLbl.style.cssText = `font-size:40px;color:#000;font-family:'Dosis',sans-serif;font-weight:400;flex:1;`; // Lua dosisregular40
    const mineBtnHk = document.createElement('span');
    mineBtnHk.textContent = 'm';
    mineBtnHk.style.cssText = `font-size:22px;color:#000;font-family:'Dosis',sans-serif;font-weight:600;opacity:0.6;`; // Lua dosissemibold22
    mineBtnEl.append(mineBtnIcon, mineBtnLbl, mineBtnHk);
    mineBtnEl.addEventListener('click', () => {
      SoundManager.playUI('UI_Select');
      // Already in mine mode, no-op
    });
    this.mineSub.appendChild(mineBtnEl);

    // Erase button — icon + label(flex:1) + hotkey(right)
    const mineEraseEl = document.createElement('div');
    mineEraseEl.style.cssText = `height:${BUTTON_H}px;display:flex;align-items:center;padding:0 12px;cursor:pointer;gap:8px;`;
    const mineEraseIcon = document.createElement('span');
    mineEraseIcon.textContent = '\u2716';
    mineEraseIcon.style.cssText = `font-size:24px;color:${AMBER};width:48px;text-align:center;flex-shrink:0;`;
    const mineEraseLbl = document.createElement('span');
    mineEraseLbl.textContent = line('HUDHUD011TEXT');
    mineEraseLbl.style.cssText = `font-size:40px;color:${AMBER};font-family:'Dosis',sans-serif;font-weight:400;flex:1;`; // Lua dosisregular40
    const mineEraseHk = document.createElement('span');
    mineEraseHk.textContent = 'e';
    mineEraseHk.style.cssText = `font-size:22px;color:${AMBER};font-family:'Dosis',sans-serif;font-weight:600;opacity:0.6;`; // Lua dosissemibold22
    mineEraseEl.append(mineEraseIcon, mineEraseLbl, mineEraseHk);
    mineEraseEl.addEventListener('click', () => {
      SoundManager.playUI('UI_Select');
      // Erase pending mine commands
      this.setBuildMode('erase');
    });
    mineEraseEl.addEventListener('mouseenter', () => {
      SoundManager.playUI('UI_Hilight');
      mineEraseEl.style.background = AMBER;
      mineEraseIcon.style.color = '#000';
      mineEraseLbl.style.color = '#000';
      mineEraseHk.style.color = '#000';
    });
    mineEraseEl.addEventListener('mouseleave', () => {
      mineEraseEl.style.background = 'transparent';
      mineEraseIcon.style.color = AMBER;
      mineEraseLbl.style.color = AMBER;
      mineEraseHk.style.color = AMBER;
    });
    this.mineSub.appendChild(mineEraseEl);
    this.uiRoot.appendChild(this.mineSub);

    // Beacon sub-menu — Lua BeaconMenu.lua: replaces sidebar when beacon/security mode is active
    this.beaconSub = document.createElement('div');
    this.beaconSub.style.cssText = `display:none;position:absolute;top:0;left:0;width:${CONSTRUCT_MENU_W}px;z-index:5;background:rgba(0,0,0,0.95);pointer-events:auto;`;

    // Done button
    const beaconDoneEl = document.createElement('div');
    beaconDoneEl.style.cssText = `height:${BUTTON_H}px;display:flex;align-items:center;padding:0 12px;cursor:pointer;gap:8px;`;
    const beaconDoneLbl = document.createElement('span');
    beaconDoneLbl.textContent = line('HUDHUD035TEXT'); // Lua: "Done"
    beaconDoneLbl.style.cssText = `font-size:40px;color:${AMBER};font-family:'Dosis',sans-serif;font-weight:600;`; // Lua dosisregular40
    const beaconDoneHk = document.createElement('span');
    beaconDoneHk.textContent = 'ESC';
    beaconDoneHk.style.cssText = `font-size:22px;color:${AMBER};font-family:'Dosis',sans-serif;margin-left:auto;opacity:0.6;`; // Lua dosissemibold22
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
    secLabel.textContent = '>> ' + line('HUDHUD036TEXT'); // Lua prepends ">>" to submenu headers
    secLabel.style.cssText = `font-size:22px;color:${AMBER};font-family:'Dosis',sans-serif;font-weight:600;padding:4px 12px;opacity:0.7;`; // Lua dosissemibold22
    this.beaconSub.appendChild(secLabel);

    // Clear Beacon button — Lua HUDHUD037TEXT
    const clearBeaconEl = this._createBeaconButton(`\u2716 ${line('HUDHUD037TEXT')}`, () => {
      // Placeholder: clear all beacons
      SoundManager.playUI('UI_Select');
    });
    this.beaconSub.appendChild(clearBeaconEl);

    // Violence level buttons (Lua: Non-lethal, Necessary, Lethal)
    // Screenshot: Lethal uses RED text, active level gets amber background
    const violenceBtns = [
      { label: line('HUDHUD051TEXT'), level: 'nonlethal', color: AMBER },  // Force: Non-lethal
      { label: line('HUDHUD049TEXT'), level: 'default', color: AMBER },    // Force: Necessary
      { label: line('HUDHUD050TEXT'), level: 'lethal', color: '#FF3D00' }, // Force: Lethal (Lua Gui.RED)
    ];
    for (const vb of violenceBtns) {
      const el = document.createElement('div');
      el.style.cssText = `height:${BUTTON_H}px;display:flex;align-items:center;padding:0 12px;cursor:pointer;gap:8px;`;
      const lbl = document.createElement('span');
      lbl.textContent = vb.label;
      lbl.style.cssText = `font-size:40px;color:${vb.color};font-family:'Dosis',sans-serif;font-weight:400;`; // Lua dosisregular40
      el.appendChild(lbl);
      el.addEventListener('click', () => {
        SoundManager.playUI('UI_Select');
        this.selectedViolenceLevel = vb.level;
      });
      el.addEventListener('mouseenter', () => {
        SoundManager.playUI('UI_Hilight');
        el.style.background = vb.color;
        lbl.style.color = '#000';
      });
      el.addEventListener('mouseleave', () => {
        // Restore: active level keeps amber bg, others transparent
        const isActive = this.selectedViolenceLevel === vb.level;
        el.style.background = isActive ? AMBER : 'transparent';
        lbl.style.color = isActive ? '#000' : vb.color;
      });
      (el as any)._violenceLevel = vb.level;
      (el as any)._violenceColor = vb.color;
      this.beaconSub.appendChild(el);
    }
    this.uiRoot.appendChild(this.beaconSub);

    // Disaster sub-menu — debug menu for triggering emergency scenarios
    this.disasterSub = document.createElement('div');
    this.disasterSub.style.cssText = `display:none;position:absolute;top:0;left:0;width:${CONSTRUCT_MENU_W}px;z-index:5;background:rgba(0,0,0,0.95);pointer-events:auto;`;

    // Cancel button
    const disasterCancelEl = document.createElement('div');
    disasterCancelEl.style.cssText = `height:${BUTTON_H}px;display:flex;align-items:center;padding:0 12px;cursor:pointer;gap:8px;`;
    const disasterCancelIcon = document.createElement('span');
    disasterCancelIcon.textContent = '\u2716';
    disasterCancelIcon.style.cssText = `font-size:24px;color:#f44;`;
    const disasterCancelLbl = document.createElement('span');
    disasterCancelLbl.textContent = line('HUDHUD019TEXT'); // "Done"
    disasterCancelLbl.style.cssText = `font-size:40px;color:#f44;font-family:'Dosis',sans-serif;font-weight:600;`;
    const disasterCancelHk = document.createElement('span');
    disasterCancelHk.textContent = 'ESC';
    disasterCancelHk.style.cssText = `font-size:22px;color:${AMBER};font-family:'Dosis',sans-serif;margin-left:auto;opacity:0.6;`;
    disasterCancelEl.append(disasterCancelIcon, disasterCancelLbl, disasterCancelHk);
    disasterCancelEl.addEventListener('click', () => {
      SoundManager.playUI('UI_Select');
      this.disasterSubActive = false;
    });
    disasterCancelEl.addEventListener('mouseenter', () => { disasterCancelEl.style.background = '#f44'; disasterCancelIcon.style.color = '#000'; disasterCancelLbl.style.color = '#000'; });
    disasterCancelEl.addEventListener('mouseleave', () => { disasterCancelEl.style.background = 'transparent'; disasterCancelIcon.style.color = '#f44'; disasterCancelLbl.style.color = '#f44'; });
    this.disasterSub.appendChild(disasterCancelEl);

    // ">> Disasters" label
    const disasterLabel = document.createElement('div');
    disasterLabel.textContent = '>> ' + line('HUDHUD062TEXT');
    disasterLabel.style.cssText = `font-size:22px;color:${AMBER};font-family:'Dosis',sans-serif;font-weight:600;padding:4px 12px;opacity:0.7;`;
    this.disasterSub.appendChild(disasterLabel);

    // Disaster action buttons
    const disasterBtns: { label: string; icon: string; action: () => void }[] = [
      { label: 'Spawn Raiders', icon: '\u2694', action: () => { this.onSpawnRaiders?.(); } },
      { label: 'Start Fire', icon: '\uD83D\uDD25', action: () => { this.onStartFire?.(); } },
      { label: 'Meteor Shower', icon: '\u2604', action: () => { this.onMeteorShower?.(); } },
      { label: 'Spawn Monster', icon: '\uD83D\uDC7E', action: () => { this.onSpawnMonster?.(); } },
    ];
    for (const db of disasterBtns) {
      const el = document.createElement('div');
      el.style.cssText = `height:${BUTTON_H}px;display:flex;align-items:center;padding:0 12px;cursor:pointer;gap:8px;`;
      const iconEl = document.createElement('span');
      iconEl.textContent = db.icon;
      iconEl.style.cssText = `font-size:24px;color:${AMBER};width:48px;text-align:center;flex-shrink:0;`;
      const lbl = document.createElement('span');
      lbl.textContent = db.label;
      lbl.style.cssText = `font-size:40px;color:${AMBER};font-family:'Dosis',sans-serif;font-weight:400;flex:1;`;
      el.append(iconEl, lbl);
      el.addEventListener('click', () => {
        SoundManager.playUI('UI_Select');
        db.action();
      });
      el.addEventListener('mouseenter', () => {
        SoundManager.playUI('UI_Hilight');
        el.style.background = AMBER;
        iconEl.style.color = '#000';
        lbl.style.color = '#000';
      });
      el.addEventListener('mouseleave', () => {
        el.style.background = 'transparent';
        iconEl.style.color = AMBER;
        lbl.style.color = AMBER;
      });
      this.disasterSub.appendChild(el);
    }
    this.uiRoot.appendChild(this.disasterSub);

    // Object placement cursor label (U-43) — follows mouse in object mode
    this.objectCursorLabel = document.createElement('div');
    this.objectCursorLabel.style.cssText = `
      position:absolute;display:none;pointer-events:none;z-index:20;
      background:rgba(0,0,0,0.85);border:1px solid ${AMBER};color:${AMBER};
      font-family:'Dosis',sans-serif;font-weight:600;font-size:18px;
      padding:4px 10px;white-space:nowrap;
    `;
    this.uiRoot.appendChild(this.objectCursorLabel);

    // Endcap — Lua: ui_hud_anglebottom positioned at bottom of button column
    this.sidebarEndcap = document.createElement('img');
    this.sidebarEndcap.src = 'assets/ui/hud/ui_hud_anglebottom.png';
    this.sidebarEndcap.style.cssText = `width:100%;height:auto;display:block;pointer-events:none;`;
    sidebar.appendChild(this.sidebarEndcap);

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
        font-size:22px;color:${AMBER};opacity:0.6; /* Lua dosissemibold22 */
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
    lbl.style.cssText = `font-size:40px;color:${AMBER};font-family:'Dosis',sans-serif;font-weight:400;`; // Lua dosisregular40
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
        font-size:22px;color:${AMBER};background:rgba(0,0,0,0.85); /* Lua dosissemibold22 */
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

  // ── Object Picker (Lua ObjectMenu + SelectObjectForZoneMenu, sidebar-integrated) ──

  private createObjectPicker() {
    // Legacy floating picker — no longer used, kept as empty stub
    this.objectPicker = document.createElement('div');
    this.objectPicker.style.cssText = `display:none;`;
    this.uiRoot.appendChild(this.objectPicker);
  }

  private refreshObjectPicker() {
    // No-op: object picker is now sidebar-integrated via objectMenuEl/objectSubMenuEl
  }

  /**
   * Lua ObjectMenu zone buttons — Lua ObjectMenuLayout.lua:
   * nButtonWidth=330, nButtonHeight=72
   * Order: Back(ESC), Cancel(X), Confirm(C), then zone buttons
   * Zone hotkeys: Z=All, A=Airlock, T=Reactor, G=Garden, S=LifeSupport, B=Pub,
   *               F=Refinery, R=Residence, N=Fitness, H=Research, I=Infirmary
   */
  private buildObjectZoneMenu() {
    this.objectMenuEl.innerHTML = '';
    const btnW = OBJECT_PICKER_W; // 330

    // ── Back button (ESC) — Lua ObjectMenuLayout BackButton ──
    const backEl = this.createMenuButton(btnW, OBJECT_BTN_H, 'ESC', line('HUDHUD018TEXT'), AMBER, () => {
      SoundManager.playUI('UI_Select');
      // Return to construct submenu
      this.objectMenuState = 'zones';
      this.objectMenuEl.style.display = 'none';
      this.objectSubMenuEl.style.display = 'none';
      // Re-enter the last non-object construct mode (room by default)
      this.setBuildMode('room');
    });
    this.objectMenuEl.appendChild(backEl);

    // ── Cancel button (X) — Lua ObjectMenuLayout CancelButton ──
    const cancelEl = this.createMenuButton(btnW, OBJECT_BTN_H, 'X', line('HUDHUD020TEXT'), '#FF3D00', () => {
      SoundManager.playUI('UI_Select');
      if (this.onCancelBuild) this.onCancelBuild();
      this.setBuildMode('none');
      GameRules.bRunning = true;
    });
    this.objectMenuEl.appendChild(cancelEl);

    // ── Confirm button (C) — Lua ObjectMenuLayout ConfirmButton ──
    const confirmEl = this.createMenuButton(btnW, OBJECT_BTN_H, 'C', line('HUDHUD019TEXT'), '#A5D318', () => {
      SoundManager.playUI('UI_Select');
      if (this.onConfirmBuild) this.onConfirmBuild();
      this.setBuildMode('none');
      GameRules.bRunning = true;
    });
    this.objectMenuEl.appendChild(confirmEl);

    // ── ">> Select Zone Type" label (screenshot 20.32.31: Lua HUDHUD024TEXT) ──
    const zoneLabel = document.createElement('div');
    zoneLabel.textContent = '>> ' + line('HUDHUD024TEXT'); // Lua prepends ">>" to submenu headers
    zoneLabel.style.cssText = `
      font-size:22px;color:${AMBER};font-family:'Dosis',sans-serif;font-weight:600;
      padding:4px 12px;opacity:0.7;
    `; // Lua dosissemibold22
    this.objectMenuEl.appendChild(zoneLabel);

    // ── Zone category buttons — Lua ObjectMenu zone buttons ──
    // Lua order from ObjectMenuLayout.lua: All, Airlock, Reactor, Garden, LifeSupport,
    //   Pub, Refinery, Residence, Fitness, Research, Infirmary
    const zoneEntries: { zone: ZoneType; hotkey: string; lc: string }[] = [
      { zone: ZoneType.PLAIN, hotkey: 'Z', lc: 'ZONEUI058TEXT' },       // All
      { zone: ZoneType.AIRLOCK, hotkey: 'A', lc: 'ZONEUI036TEXT' },
      { zone: ZoneType.POWER, hotkey: 'T', lc: 'ZONEUI003TEXT' },       // Reactor
      { zone: ZoneType.GARDEN, hotkey: 'G', lc: 'ZONEUI069TEXT' },
      { zone: ZoneType.LIFESUPPORT, hotkey: 'S', lc: 'ZONEUI001TEXT' },
      { zone: ZoneType.PUB, hotkey: 'B', lc: 'ZONEUI046TEXT' },
      { zone: ZoneType.REFINERY, hotkey: 'F', lc: 'ZONEUI037TEXT' },
      { zone: ZoneType.RESIDENCE, hotkey: 'R', lc: 'ZONEUI042TEXT' },
      { zone: ZoneType.FITNESS, hotkey: 'N', lc: 'ZONEUI109TEXT' },
      { zone: ZoneType.RESEARCH, hotkey: 'H', lc: 'ZONEUI126TEXT' },
      { zone: ZoneType.INFIRMARY, hotkey: 'I', lc: 'ZONEUI049TEXT' },
    ];

    for (const ze of zoneEntries) {
      const el = this.createMenuButton(btnW, OBJECT_BTN_H, ze.hotkey, line(ze.lc), AMBER, () => {
        SoundManager.playUI('UI_Select');
        this.objectMenuZone = ze.zone;
        this.objectMenuState = 'objects';
        this.buildObjectSubMenu(ze.zone);
        this.objectMenuEl.style.display = 'none';
        this.objectSubMenuEl.style.display = 'block';
        this.sidebarEl.style.width = `${CONSTRUCT_MENU_W}px`; // 430px for object list
        playWarble(this.sidebarEl);
      });
      this.objectMenuEl.appendChild(el);
    }
  }

  /**
   * Lua SelectObjectForZoneMenu — individual objects for a zone.
   * Lua SelectObjectSubmenuLayout.lua: nButtonWidth=430, nButtonHeight=81
   * Sequential hotkeys: 1-9, 0, A-F, O
   */
  private buildObjectSubMenu(zone: ZoneType) {
    this.objectSubMenuEl.innerHTML = '';
    const btnW = CONSTRUCT_MENU_W; // 430
    const kHOTKEYS = ['1','2','3','4','5','6','7','8','9','0','A','B','C','D','E','F','O'];

    // ── Back button — returns to zone list ──
    const backEl = this.createMenuButton(btnW, OBJECT_SUB_BTN_H, 'ESC', line('HUDHUD018TEXT'), AMBER, () => {
      SoundManager.playUI('UI_Select');
      this.objectMenuState = 'zones';
      this.objectSubMenuEl.style.display = 'none';
      this.objectMenuEl.style.display = 'block';
      this.sidebarEl.style.width = `${OBJECT_PICKER_W}px`; // 330px for zone list
      this.selectedObjectName = '';
      playWarble(this.sidebarEl);
    });
    this.objectSubMenuEl.appendChild(backEl);

    // ── Object buttons ──
    const items = getMenuForZone(zone);
    let hotkeyIdx = 0;
    for (const objName of items) {
      const objData = tObjects[objName];
      if (!objData || !objData.showInObjectMenu) continue;

      const hotkey = hotkeyIdx < kHOTKEYS.length ? kHOTKEYS[hotkeyIdx] : '';
      hotkeyIdx++;

      const isSelected = objName === this.selectedObjectName;
      const el = document.createElement('div');
      el.style.cssText = `
        height:${OBJECT_SUB_BTN_H}px;display:flex;align-items:center;padding:0 12px;cursor:pointer;
        gap:8px;position:relative;background:${isSelected ? AMBER : 'transparent'};
      `;

      // Label + cost column (LEFT side)
      const col = document.createElement('div');
      col.style.cssText = 'flex:1;';
      const lbl = document.createElement('div');
      lbl.textContent = objData.friendlyName;
      lbl.style.cssText = `font-size:40px;color:${isSelected ? '#000' : AMBER};font-family:'Dosis',sans-serif;font-weight:400;`; // Lua dosisregular40
      const cost = document.createElement('div');
      cost.textContent = `${line('HUDHUD042TEXT')} ${objData.matterCost}`;
      cost.style.cssText = `font-size:18px;color:${isSelected ? '#000' : AMBER};font-family:'Dosis',sans-serif;font-weight:600;opacity:0.7;`; // Lua dosissemibold18
      col.appendChild(lbl);
      col.appendChild(cost);
      el.appendChild(col);

      // Hotkey on RIGHT (screenshot: small lowercase letter)
      const hk = document.createElement('span');
      hk.textContent = hotkey ? hotkey.toLowerCase() : '';
      hk.style.cssText = `font-size:22px;color:${isSelected ? '#000' : AMBER};font-family:'Dosis',sans-serif;font-weight:600;opacity:0.6;`; // Lua dosissemibold22
      el.appendChild(hk);

      const capturedName = objName;
      el.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.uiClickConsumed = true; });
      el.addEventListener('click', () => {
        SoundManager.playUI('UI_Select');
        this.selectedObjectName = capturedName;
        this.onObjectSelected(capturedName);
        this.buildObjectSubMenu(zone); // Re-render to show selection
      });
      el.addEventListener('mouseenter', () => {
        SoundManager.playUI('UI_Hilight');
        if (!isSelected) {
          el.style.background = AMBER;
          hk.style.color = '#000';
          lbl.style.color = '#000';
          cost.style.color = '#000';
        }
      });
      el.addEventListener('mouseleave', () => {
        if (!isSelected) {
          el.style.background = 'transparent';
          hk.style.color = AMBER;
          lbl.style.color = AMBER;
          cost.style.color = AMBER;
        }
      });

      this.objectSubMenuEl.appendChild(el);
    }

    // ── Cancel button — Lua CancelButton ──
    const cancelEl = this.createMenuButton(btnW, OBJECT_SUB_BTN_H, 'X', line('HUDHUD020TEXT'), '#FF3D00', () => {
      SoundManager.playUI('UI_Select');
      if (this.onCancelBuild) this.onCancelBuild();
      this.setBuildMode('none');
      GameRules.bRunning = true;
    });
    this.objectSubMenuEl.appendChild(cancelEl);

    // ── Confirm button — Lua ConfirmButton ──
    const confirmEl = this.createMenuButton(btnW, OBJECT_SUB_BTN_H, '', line('HUDHUD019TEXT'), '#A5D318', () => {
      SoundManager.playUI('UI_Select');
      if (this.onConfirmBuild) this.onConfirmBuild();
      this.setBuildMode('none');
      GameRules.bRunning = true;
    });
    this.objectSubMenuEl.appendChild(confirmEl);
  }

  /** Helper: create a standard sidebar menu button (Lua-style).
   * Screenshot layout: label on left, hotkey as small lowercase letter on right. */
  private createMenuButton(width: number, height: number, hotkey: string, label: string, color: string, onClick: () => void): HTMLDivElement {
    const el = document.createElement('div');
    el.style.cssText = `
      height:${height}px;display:flex;align-items:center;padding:0 12px;cursor:pointer;gap:8px;
    `;
    const lbl = document.createElement('span');
    lbl.textContent = label;
    lbl.style.cssText = `font-size:40px;color:${color};font-family:'Dosis',sans-serif;font-weight:600;flex:1;`; // Lua dosisregular40
    el.appendChild(lbl);
    // Hotkey on RIGHT (screenshot: small lowercase letter)
    if (hotkey) {
      const hk = document.createElement('span');
      hk.textContent = hotkey.toLowerCase();
      hk.style.cssText = `font-size:22px;color:${color};font-family:'Dosis',sans-serif;font-weight:600;opacity:0.6;`; // Lua dosissemibold22
      el.appendChild(hk);
    }

    el.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.uiClickConsumed = true; });
    el.addEventListener('click', onClick);
    el.addEventListener('mouseenter', () => {
      SoundManager.playUI('UI_Hilight');
      el.style.background = color;
      for (const c of el.children) (c as HTMLElement).style.color = '#000';
    });
    el.addEventListener('mouseleave', () => {
      el.style.background = 'transparent';
      for (const c of el.children) (c as HTMLElement).style.color = color;
    });
    return el;
  }

  // ── Tooltip ─────────────────────────────────────────────────────

  private createTooltip() {
    this.tooltipEl = document.createElement('div');
    this.tooltipEl.style.cssText = `
      position:fixed;width:280px;z-index:999;
      background:rgba(0,0,0,0.8);color:#ccc;font-size:22px; /* Lua dosissemibold22 */
      padding:8px;line-height:1.6;white-space:pre-wrap;
      display:none;pointer-events:none;
    `;
    // U-36: Tooltip follows cursor (Lua WorldToolTip nOffsetX=68, nOffsetY=-30)
    // Also update object placement cursor label position (U-43)
    document.addEventListener('mousemove', (e) => {
      if (this.tooltipEl.style.display !== 'none') {
        this.tooltipEl.style.left = (e.clientX + 68) + 'px';
        this.tooltipEl.style.top = (e.clientY - 30) + 'px';
      }
      // U-43: Track mouse for object cursor label
      this._lastMouseX = e.clientX;
      this._lastMouseY = e.clientY;
    });
    document.body.appendChild(this.tooltipEl);
  }

  // ── Alert Log ───────────────────────────────────────────────────

  private createAlertLog() {
    // Lua AlertLayout.lua: right-aligned amber notification panel, newest alert on top
    // Shows "!" icon, message text, and "Spacedate XXXX.XX" below
    this.alertContainer = document.createElement('div');
    this.alertContainer.id = 'alert-panel';
    this.alertContainer.style.cssText = `
      position:absolute;top:200px;right:10px;width:380px;
      pointer-events:auto;font-size:22px; /* Lua dosissemibold22 */
    `;

    // Base name header with crew emoticons (Lua community mod: StatusBar title)
    this.baseNameHeader = document.createElement('div');
    this.baseNameHeader.style.cssText = `
      display:flex;align-items:center;gap:6px;padding:4px 8px;margin-bottom:6px;
      font-family:'Dosis',sans-serif;
    `;
    const baseName = document.createElement('span');
    baseName.textContent = 'Spacebase DF-9.0';
    baseName.style.cssText = `font-size:28px;font-weight:600;color:${AMBER};`;
    this.baseNameHeader.appendChild(baseName);
    this.crewEmoticons = document.createElement('span');
    this.crewEmoticons.style.cssText = `display:flex;gap:2px;`;
    this.baseNameHeader.appendChild(this.crewEmoticons);
    this.alertContainer.appendChild(this.baseNameHeader);

    // Alert list (shows newest alert as a notification card)
    this.alertList = document.createElement('div');
    this.alertList.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
    this.alertContainer.appendChild(this.alertList);

    // Minimize toggle at bottom
    const minRow = document.createElement('div');
    minRow.style.cssText = `text-align:right;padding:2px 4px;`;
    const minBtn = document.createElement('span');
    minBtn.textContent = 'ALERTS';
    minBtn.style.cssText = `color:${AMBER};cursor:pointer;font-size:18px;font-weight:bold;font-family:'Dosis',sans-serif;`; // Lua dosissemibold18
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
      color:${AMBER};font-family:'Dosis',sans-serif;font-weight:600;font-size:22px; /* Lua dosissemibold22 */
      padding:6px 12px;display:none;pointer-events:none;z-index:15;
    `;
    this.uiRoot.appendChild(this.costOverlay);
  }

  // ── Public API ──────────────────────────────────────────────────

  /** Dismiss the inspect submenu (called on ESC). */
  dismissInspectSub() {
    this.inspectSubActive = false;
  }

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

  /** Whether the game was paused before opening a panel. */
  private bWasPausedBeforePanel = false;

  private showPanel(panel: 'research' | 'goals') {
    this.hideActivePanel();
    this.setBuildMode('none');
    this.activePanel = panel;
    // U-11: Lua pauses game when research/goals panel opens
    this.bWasPausedBeforePanel = GameRules.playerTimeScale === 0;
    if (!this.bWasPausedBeforePanel) GameRules.togglePause();
    if (panel === 'research') {
      this.researchPanel.show();
    } else {
      this.goalsPanel.show();
    }
  }

  private hideActivePanel() {
    this.researchPanel.hide();
    this.goalsPanel.hide();
    // U-11: Restore pause state when panel closes
    if (this.activePanel !== 'none' && !this.bWasPausedBeforePanel) {
      GameRules.togglePause();
    }
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
      const matterColor = currentMatter > this.prevMatter ? '#A5D318' : '#FF3D00'; // Lua Gui.GREEN / Gui.RED
      this.matterText.style.color = matterColor;
      this.matterLabel.style.color = matterColor; // Lua: label also tinted
    }
    // Tick displayed value toward real value (Lua StatusBar:tickMatterCount — exact rate multipliers)
    if (this.displayedMatter !== currentMatter) {
      const delta = Math.abs(currentMatter - this.displayedMatter);
      // Lua: nCounterTickMult based on delta magnitude
      let mult: number;
      if (delta < 500) mult = 1;
      else if (delta < 1500) mult = 2;
      else if (delta < 2500) mult = 4;
      else mult = 6;
      const increment = mult * 2;
      if (this.displayedMatter < currentMatter) {
        this.displayedMatter = Math.min(currentMatter, this.displayedMatter + increment);
      } else {
        this.displayedMatter = Math.max(currentMatter, this.displayedMatter - increment);
      }
      SoundManager.playUI('UI_MatterScroll'); // Lua: SoundManager.playSfx('mattercounter')
    }
    if (this.matterFlashTimer > 0) {
      this.matterFlashTimer--;
      if (this.matterFlashTimer === 0 && this.displayedMatter === currentMatter) {
        this.matterText.style.color = AMBER;
        this.matterLabel.style.color = '#AF7F00';
      }
    }
    this.prevMatter = currentMatter;
    this.matterText.textContent = String(this.displayedMatter);

    // ── Stardate ──────────────────────────────────────────
    this.starDateText.textContent = `${line('HUDHUD004TEXT')} ${GameRules.sStarDate}`;

    // ── Speed buttons ─────────────────────────────────────
    const currentSpeed = (!GameRules.bRunning || GameRules.playerTimeScale === 0) ? 0 : GameRules.playerTimeScale;
    const speedMap = [0, 1, 2, 4];
    for (let i = 0; i < this.speedImgs.length; i++) {
      const active = speedMap[i] === currentSpeed;
      this.speedImgs[i].inactive.style.display = active ? 'none' : 'block';
      this.speedImgs[i].active.style.display = active ? 'block' : 'none';
    }

    // ── O2 / Wall toggle button selected state (Lua StatusBar.onTick setSelected) ──
    this._setButtonSelected(
      this.o2BtnInactive.parentElement as HTMLDivElement,
      this.o2BtnInactive, this.o2BtnActive, this.o2OverlayActive,
    );
    this._setButtonSelected(
      this.wallsBtnInactive.parentElement as HTMLDivElement,
      this.wallsBtnInactive, this.wallsBtnActive, GameRules.isCutawayModeEnabled(),
    );

    // ── Capacity (Lua GameRules:getCapacity — OxygenRecycler count) ──
    const pop = this.getPopulation();
    // Lua: capacity = sum of recyclers * RECYCLERS_PER_CITIZEN * level
    let maxCap = 0;
    for (const o of envObjects) {
      if (!o.bBuilt) continue;
      if (o.sName === 'OxygenRecycler') maxCap += RECYCLERS_PER_CITIZEN;
      else if (o.sName === 'OxygenRecyclerLevel2') maxCap += RECYCLERS_PER_CITIZEN * 2;
      else if (o.sName === 'OxygenRecyclerLevel3') maxCap += RECYCLERS_PER_CITIZEN * 3;
      else if (o.sName === 'OxygenRecyclerLevel4') maxCap += RECYCLERS_PER_CITIZEN * 4;
    }
    this.popText.textContent = String(pop);
    this.capacityText.textContent = `/${maxCap}`;
    if (pop > maxCap) {
      this.popText.style.color = '#FF3D00'; // Lua Gui.RED
    } else {
      this.popText.style.color = AMBER;
    }

    // ── Morale / Happiness (Lua: updateHappinessPercent) ──
    const aliveChars = chars.filter(c => c.isAlive());
    if (aliveChars.length > 0) {
      const avgMorale = aliveChars.reduce((sum, c) => sum + c.nMorale, 0) / aliveChars.length;
      const nTotalPercent = Math.floor(avgMorale);
      // Lua StatusBar: thresholds at 10/50/70/90 with per-threshold icon + color
      let iconName: string;
      if (nTotalPercent <= 10)       { iconName = 'ui_dialogicon_bigfrown'; }
      else if (nTotalPercent <= 50)  { iconName = 'ui_dialogicon_frown'; }
      else if (nTotalPercent <= 70)  { iconName = 'ui_dialogicon_meh'; }
      else if (nTotalPercent <= 90)  { iconName = 'ui_dialogicon_smile'; }
      else                           { iconName = 'ui_dialogicon_bigsmile'; }
      this.moraleIcon.src = `assets/ui/hud/${iconName}.png`;
      this.moraleText.textContent = `${nTotalPercent}%`;
      this.moraleText.style.color = AMBER;
    } else {
      this.moraleIcon.src = 'assets/ui/hud/ui_dialogicon_meh.png';
      this.moraleText.textContent = '0%';
    }

    // ── Machine health (Lua: updateMachineDisrepairPercent) ──
    const builtObjects = envObjects.filter(o => o.bBuilt);
    if (builtObjects.length > 0) {
      const avgCondition = builtObjects.reduce((sum, o) => sum + o.nCondition, 0) / builtObjects.length;
      this.machineHealthText.textContent = `${Math.floor(avgCondition)}%`; // Lua: math.floor
      this.machineHealthText.style.color = AMBER;
    } else {
      this.machineHealthText.textContent = '0%';
    }

    // ── Corpses (Lua: updateDeadBodies — shows raw count, always displays) ──
    const corpseCount = this.getCorpseCount?.() ?? 0;
    this.corpseText.textContent = String(corpseCount);

    // ── Crew emoticons in base name header (screenshot: small colored faces per crew member) ──
    if (this.crewEmoticons) {
      while (this.crewEmoticons.firstChild) this.crewEmoticons.removeChild(this.crewEmoticons.firstChild);
      for (const c of aliveChars) {
        const face = document.createElement('img');
        let iconName: string;
        if (c.nMorale <= 10) iconName = 'ui_dialogicon_bigfrown';
        else if (c.nMorale <= 50) iconName = 'ui_dialogicon_frown';
        else if (c.nMorale <= 70) iconName = 'ui_dialogicon_meh';
        else if (c.nMorale <= 90) iconName = 'ui_dialogicon_smile';
        else iconName = 'ui_dialogicon_bigsmile';
        face.src = `assets/ui/hud/${iconName}.png`;
        face.style.cssText = 'width:20px;height:20px;filter:sepia(1) saturate(5) hue-rotate(5deg);';
        this.crewEmoticons.appendChild(face);
      }
    }

    // ── Inspector replaces sidebar (Lua: inspector takes over left panel) ──
    const inspectorActive = this.inspectorPanel.hasEntity();
    this.sidebarEl.style.display = inspectorActive ? 'none' : '';

    // ── Sidebar active states ─────────────────────────────
    const buildMode = this.getBuildMode();
    const constructModes: BuildMode[] = ['room', 'floor', 'wall', 'door', 'zone', 'object', 'demolish', 'vaporize', 'erase'];
    const isConstructActive = constructModes.includes(buildMode);

    for (const sb of this.sidebarBtns) {
      // Lua: Disaster button hidden until bDisasterMode=true
      if (sb.action === 'disaster') {
        sb.el.style.display = GameRules.bDisasterMode ? '' : 'none';
        if (!GameRules.bDisasterMode) continue;
      }
      let active = false;
      if (sb.action === 'construct') {
        active = isConstructActive;
      } else if (sb.action === 'inspect') {
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

    // ── Construct sub-menu: replaces sidebar buttons ──
    // Lua: ConstructMenu (430px) for build modes, ObjectMenu (330px) for zone browse,
    //      SelectObjectForZoneMenu (430px) for object selection
    const isObjectMode = buildMode === 'object';
    if (isConstructActive && !isObjectMode) {
      // Standard construct submenu (build/demolish modes)
      this.constructSub.style.display = 'block';
      this.objectMenuEl.style.display = 'none';
      this.objectSubMenuEl.style.display = 'none';
      this.sidebarEl.style.width = `${CONSTRUCT_MENU_W}px`;
      this.sidebarEl.scrollTop = 0; // Ensure Cancel button is visible at top
      for (const sb of this.sidebarBtns) sb.el.style.display = 'none';
      this.sidebarEndcap.style.display = 'none'; // Hide endcap so it doesn't cover submenu
      // Highlight active sub-button (skip cancelEl + confirmEl + constructLabel = 3 children)
      const SUB_OFFSET = 2; // cancel + confirm (no header label)
      const subBtns = this.constructSub.children;
      for (let i = 0; i < this.constructSubModes.length; i++) {
        const el = subBtns[i + SUB_OFFSET] as HTMLElement;
        if (!el) continue;
        // Children: icon(0), label(1), hotkey(2)
        const isSubActive = buildMode === this.constructSubModes[i] && buildMode !== 'none';
        el.style.background = isSubActive ? AMBER : 'transparent';
         for (let c = 0; c < el.children.length; c++) {
          const child = el.children[c] as HTMLElement;
          const img = child.querySelector('img');
          if (img) {
            img.style.filter = isSubActive ? 'brightness(0)' : 'none';
          } else {
            child.style.color = isSubActive ? '#000' : AMBER;
          }
        }
      }
    } else if (isObjectMode) {
      // Object menu: show zone list or object list in sidebar (Lua ObjectMenu/SelectObjectForZoneMenu)
      this.constructSub.style.display = 'none';
      for (const sb of this.sidebarBtns) sb.el.style.display = 'none';
      this.sidebarEndcap.style.display = 'none';
      if (this.objectMenuState === 'zones') {
        this.objectMenuEl.style.display = 'block';
        this.objectSubMenuEl.style.display = 'none';
        this.sidebarEl.style.width = `${OBJECT_PICKER_W}px`; // 330px
      } else {
        this.objectMenuEl.style.display = 'none';
        this.objectSubMenuEl.style.display = 'block';
        this.sidebarEl.style.width = `${CONSTRUCT_MENU_W}px`; // 430px
      }
    } else {
      this.constructSub.style.display = 'none';
      this.objectMenuEl.style.display = 'none';
      this.objectSubMenuEl.style.display = 'none';
      this.objectMenuState = 'zones'; // Reset for next time
      this.sidebarEndcap.style.display = 'block'; // Restore endcap
    }

    // ── Flip button: show in object placement mode (Lua StatusBar.showFlipZone) ──
    if (isObjectMode && this.selectedObjectName) {
      this.flipBtnEl.style.display = 'block';
      // Update flip visual state
      const flipped = this.getFlipState?.() ?? false;
      this.flipBtnEl.style.background = flipped ? AMBER : 'rgba(0,0,0,0.8)';
      this.flipBtnEl.style.color = flipped ? '#000' : AMBER;
    } else {
      this.flipBtnEl.style.display = 'none';
    }

    // ── Object placement cursor label (U-43): show object name near cursor ──
    if (isObjectMode && this.selectedObjectName) {
      const objData = tObjects[this.selectedObjectName];
      const displayName = objData?.friendlyName ?? this.selectedObjectName;
      this.objectCursorLabel.textContent = displayName;
      this.objectCursorLabel.style.display = 'block';
      this.objectCursorLabel.style.left = (this._lastMouseX + 20) + 'px';
      this.objectCursorLabel.style.top = (this._lastMouseY + 20) + 'px';
    } else {
      this.objectCursorLabel.style.display = 'none';
    }

    // ── Mine sub-menu: replaces sidebar buttons (Lua MineMenu) ──
    const isMineActive = buildMode === 'mine';
    if (isMineActive) {
      this.mineSub.style.display = 'block';
      for (const sb of this.sidebarBtns) {
        sb.el.style.display = 'none';
      }
      this.sidebarEndcap.style.display = 'none';
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
      // Highlight active violence level (screenshot: active gets amber bg)
      const children = this.beaconSub.children;
      for (let i = 0; i < children.length; i++) {
        const el = children[i] as HTMLElement;
        const vLevel = (el as any)._violenceLevel;
        const vColor = (el as any)._violenceColor || AMBER;
        if (vLevel) {
          const active = vLevel === this.selectedViolenceLevel;
          el.style.background = active ? AMBER : 'transparent';
          const lbl = el.children[0] as HTMLElement;
          if (lbl) lbl.style.color = active ? '#000' : vColor;
        }
      }
    } else {
      this.beaconSub.style.display = 'none';
    }

    // ── Disaster sub-menu: replaces sidebar buttons ──
    if (this.disasterSubActive && !isConstructActive && !isMineActive && !isBeaconActive) {
      this.disasterSub.style.display = 'block';
      for (const sb of this.sidebarBtns) {
        sb.el.style.display = 'none';
      }
      this.sidebarEndcap.style.display = 'none';
      this.sidebarEl.style.width = `${CONSTRUCT_MENU_W}px`;
    } else {
      this.disasterSub.style.display = 'none';
      if (isConstructActive || isMineActive || isBeaconActive) {
        this.disasterSubActive = false;
      }
    }

    // ── Inspect sub-menu: replaces sidebar buttons (screenshot 20.32.12) ──
    if (this.inspectSubActive && !isConstructActive && !isMineActive && !isBeaconActive && !this.disasterSubActive) {
      this.inspectSub.style.display = 'block';
      for (const sb of this.sidebarBtns) {
        sb.el.style.display = 'none';
      }
      this.sidebarEl.style.width = `${SIDEBAR_W}px`;
    } else {
      this.inspectSub.style.display = 'none';
      // Clear inspect sub when entering another mode
      if (isConstructActive || isMineActive || isBeaconActive || this.disasterSubActive) {
        this.inspectSubActive = false;
      }
    }

    // Restore sidebar buttons and width when no submenu is active
    if (!isConstructActive && !isMineActive && !isBeaconActive && !this.inspectSubActive && !this.disasterSubActive) {
      for (const sb of this.sidebarBtns) {
        sb.el.style.display = 'flex';
      }
      // Reset sidebar width to normal expanded/collapsed state
      this.sidebarEl.style.width = this.sidebarExpanded ? `${SIDEBAR_W}px` : `${SIDEBAR_COLLAPSED_W}px`;
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

    // ── Alert log (Lua AlertLayout + HintPane: separate hint/alert colors) ──
    if (!this.alertMinimized) {
      const alerts = Base.getRecentAlerts(3);
      this.alertList.textContent = '';
      // Lua AlertLayout: ALERTLOG_BG=#B57700, ALERTLOG_BG_ALT=#CA8400
      // Lua HintPane: HINTLOG_BG=#5D807A, HINTLOG_BG_ALT=#709B93, HINTLOG_HIGHLIGHT=#BCFFFF
      const ALERTLOG_BG_COLOR = '#B57700';
      const ALERTLOG_BG_ALT_COLOR = '#CA8400';
      let alertIdx = 0;
      let hintIdx = 0;
      for (let ai = 0; ai < alerts.length; ai++) {
        const alert = alerts[ai];
        const isHint = alert.type === 'hint';
        let cardBg: string;
        if (isHint) {
          cardBg = hintIdx % 2 === 0 ? HINTLOG_BG : HINTLOG_BG_ALT;
          hintIdx++;
        } else {
          cardBg = alertIdx % 2 === 0 ? ALERTLOG_BG_COLOR : ALERTLOG_BG_ALT_COLOR;
          alertIdx++;
        }
        const el = document.createElement('div');
        el.style.cssText = `
          background:${cardBg};padding:8px 10px;display:flex;gap:8px;align-items:flex-start;
          cursor:pointer;
        `;
        el.addEventListener('click', () => {
          this.onAlertClick?.(alert.type);
          this.uiClickConsumed = true;
        });
        // Icon: "!" for alerts, "?" for hints (Lua uses different icon styles)
        const icon = document.createElement('div');
        icon.textContent = isHint ? '?' : '!';
        icon.style.cssText = `
          font-size:18px;font-weight:bold;color:#000;
          background:${isHint ? HINTLOG_HIGHLIGHT : '#dfa200'};border:2px solid #000;
          width:24px;height:24px;display:flex;align-items:center;justify-content:center;flex-shrink:0;
        `;
        // Content
        const content = document.createElement('div');
        content.style.cssText = 'flex:1;';
        const msg = document.createElement('div');
        msg.textContent = alert.message;
        msg.style.cssText = `font-size:22px;color:${isHint ? HINTLOG_HIGHLIGHT : '#000'};font-family:'Dosis',sans-serif;font-weight:500;`; /* Lua dosissemibold22 */
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
        time.style.cssText = `font-size:18px;color:${isHint ? '#a0d0cc' : '#333'};font-family:'Dosis',sans-serif;margin-top:2px;`; /* Lua dosissemibold18 */
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
      if (costInfo) {
        let html = '';
        // Lua BuildHelper: room mode shows area dimensions + capacity
        if (costInfo.w && costInfo.h && costInfo.mode === 'room' && costInfo.tileCount > 0) {
          html += `<div style="color:${AMBER};">${line('HUDHUD039TEXT')} ${costInfo.floorW} x ${costInfo.floorH}</div>`;
          if (costInfo.capacityLines && costInfo.capacityLines.length > 0) {
            html += `<div style="color:${AMBER};margin-top:4px;">${line('HUDHUD043TEXT')}</div>`;
            for (const cl of costInfo.capacityLines) {
              html += `<div style="color:${AMBER};padding-left:12px;font-size:22px;">${cl}</div>`;
            }
          }
        }
        // Lua ConstructMenu:getMatterCostText — three separate cost lines
        const bc = costInfo.buildCost ?? 0;
        const vc = costInfo.vaporizeCost ?? 0;
        const cc = costInfo.cancelCost ?? 0;
        // Build cost: positive=spending → show "-", negative=refund → show "+"
        if (bc !== 0) {
          const sign = bc < 0 ? '+' : '-';
          html += `<div style="color:${AMBER};">${sign}${Math.abs(bc)} ${line('BUILDM017TEXT')}</div>`;
        }
        // Vaporize/demolish cost: negative=refund → show "+"
        if (vc !== 0) {
          const sign = vc < 0 ? '+' : '-';
          html += `<div style="color:${AMBER};">${sign}${Math.abs(vc)} ${line('BUILDM018TEXT')}</div>`;
        }
        // Cancel/undo cost: negative=refund → show "+"
        if (cc !== 0) {
          const sign = cc < 0 ? '+' : '-';
          html += `<div style="color:${AMBER};">${sign}${Math.abs(cc)} ${line('BUILDM019TEXT')}</div>`;
        }
        // "Not enough matter" warning (Lua: NoFundsLabel)
        const totalCost = costInfo.cost ?? (bc + vc + cc);
        if (totalCost > 0 && GameRules.nMatter < totalCost) {
          html += `<div style="color:#f44;font-size:22px;">${line('BUILDM016TEXT')}</div>`;
        }
        if (html) {
          this.costOverlay.innerHTML = html;
          this.costOverlay.style.display = 'block';
        } else {
          this.costOverlay.style.display = 'none';
        }
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

  // ── UI Scale ───────────────────────────────────────────

  /**
   * Apply CSS transform scale to the entire UI root.
   * The Lua game targets 1920×1152; on smaller screens, font sizes
   * appear oversized. This scales the UI container uniformly.
   * Default auto-calculates from viewport width vs 1920.
   */
  applyUIScale() {
    const scale = UIManager.getUIScale();
    if (scale === 1) {
      this.uiRoot.style.transform = '';
      this.uiRoot.style.width = '100%';
      this.uiRoot.style.height = '100%';
    } else {
      this.uiRoot.style.transformOrigin = 'top left';
      this.uiRoot.style.transform = `scale(${scale})`;
      // Expand dimensions so scaled-down content fills viewport
      this.uiRoot.style.width = `${100 / scale}%`;
      this.uiRoot.style.height = `${100 / scale}%`;
    }
  }

  /** Get current UI scale (0.5–2.0). 0 = auto (viewport-based). */
  static getUIScale(): number {
    const stored = localStorage.getItem('df9_ui_scale');
    if (stored) {
      const v = parseFloat(stored);
      if (v > 0 && v <= 2) return v;
    }
    // Auto: scale to match Lua's 1920×1080 target resolution
    return Math.min(1, window.innerWidth / 1920);
  }

  static setUIScale(scale: number) {
    localStorage.setItem('df9_ui_scale', String(Math.max(0.3, Math.min(2, scale))));
  }

  dispose() {
    this.inspectorPanel.dispose();
    this.researchPanel.dispose();
    this.goalsPanel.dispose();
    this.jobRoster.dispose();
    this.uiRoot.remove();
  }
}
