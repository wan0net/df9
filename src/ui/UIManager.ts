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
import type { BuildMode } from '../building/BuildSystem';
import type { Character } from '../characters/Character';
import type { EnvObject } from '../envobjects/EnvObject';
import type { Room } from '../rooms/Room';
import { EnvObjectManager } from '../envobjects/EnvObjectManager';

const AMBER = '#dfa200';
const SIDEBAR_W = 286;
const BUTTON_H = 56;

/** Alert color mapping by category */
const ALERT_COLORS: Record<string, string> = {
  system: '#ccc',
  mining: AMBER,
  build: '#4f4',
  breach: '#f44',
  fire: '#f44',
  death: '#f44',
  immigration: '#48f',
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
  private getHoveredInfo: () => string;
  private onSave: () => void;
  private onLoad: () => void;
  private onSpawn: () => void;
  private onObjectSelected: (name: string) => void;
  private getCharacters: () => Character[];
  private getEnvObjects: () => EnvObject[];
  private toggleO2Overlay: () => void;
  private getRooms: () => Room[];

  // HUD elements
  private matterText!: HTMLSpanElement;
  private popText!: HTMLSpanElement;
  private capacityText!: HTMLSpanElement;
  private starDateText!: HTMLSpanElement;
  private speedButtons: HTMLDivElement[] = [];
  private moraleText!: HTMLSpanElement;
  private machineHealthText!: HTMLSpanElement;
  private corpseText!: HTMLSpanElement;
  private prevMatter = -1;
  private matterFlashTimer = 0;

  // Zone picker
  private zonePicker!: HTMLDivElement;
  private zoneButtons: { el: HTMLDivElement; zone: ZoneType }[] = [];

  // Object picker
  private objectPicker!: HTMLDivElement;
  selectedObjectName = '';

  // Tooltip
  private tooltipEl!: HTMLDivElement;

  // Alert log
  private alertContainer!: HTMLDivElement;
  private alertList!: HTMLDivElement;
  private alertMinimized = false;

  // Sidebar buttons for active tracking
  private sidebarBtns: { el: HTMLDivElement; label: HTMLDivElement; hotkey: HTMLDivElement; icon: HTMLDivElement; mode: BuildMode; btnLabel: string }[] = [];

  // Construct sub-menu
  private constructSub!: HTMLDivElement;

  // Inspector panel
  private inspectorPanel!: InspectorPanel;

  // Job roster
  private jobRoster!: JobRoster;

  constructor(container: HTMLElement, callbacks: {
    getBuildMode: () => BuildMode;
    setBuildMode: (mode: BuildMode) => void;
    getPopulation: () => number;
    getSelectedZone: () => ZoneType;
    setSelectedZone: (zone: ZoneType) => void;
    getHoveredInfo: () => string;
    onSave: () => void;
    onLoad: () => void;
    onSpawn: () => void;
    onObjectSelected: (name: string) => void;
    getCharacters: () => Character[];
    getEnvObjects: () => EnvObject[];
    toggleO2Overlay: () => void;
    getRooms: () => Room[];
    onSetJob: (character: Character, jobId: number) => void;
  }) {
    this.container = container;
    this.getBuildMode = callbacks.getBuildMode;
    this.setBuildMode = callbacks.setBuildMode;
    this.getPopulation = callbacks.getPopulation;
    this.getSelectedZone = callbacks.getSelectedZone;
    this.setSelectedZone = callbacks.setSelectedZone;
    this.getHoveredInfo = callbacks.getHoveredInfo;
    this.onSave = callbacks.onSave;
    this.onLoad = callbacks.onLoad;
    this.onSpawn = callbacks.onSpawn;
    this.onObjectSelected = callbacks.onObjectSelected;
    this.getCharacters = callbacks.getCharacters;
    this.getEnvObjects = callbacks.getEnvObjects;
    this.toggleO2Overlay = callbacks.toggleO2Overlay;
    this.getRooms = callbacks.getRooms;

    this.createUI(callbacks.onSetJob);
  }

  private createUI(onSetJob: (character: Character, jobId: number) => void) {
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

    this.container.appendChild(this.uiRoot);

    // Inspector panel
    this.inspectorPanel = new InspectorPanel(this.uiRoot, {
      onSetJob,
      getObjectsInRoom: (room: Room) => EnvObjectManager.getObjectsInRoom(room),
    });

    // Job roster
    this.jobRoster = new JobRoster(this.container, {
      getCharacters: this.getCharacters,
      onSetJob,
      onOpen: () => { GameRules.bRunning = false; },
      onClose: () => { GameRules.bRunning = true; },
    });
  }

  // ── HUD (Status Bar) ───────────────────────────────────────────

  private createHUD() {
    const hud = document.createElement('div');
    hud.style.cssText = `
      position:absolute;top:8px;right:10px;pointer-events:auto;
      color:${AMBER};display:flex;align-items:center;gap:12px;
      font-size:13px;
    `;

    // Matter
    const matterGroup = this.hudCell();
    matterGroup.innerHTML = `<span style="font-size:11px;color:#666;margin-right:4px;">MATTER</span>`;
    this.matterText = document.createElement('span');
    this.matterText.id = 'hud-matter';
    this.matterText.style.cssText = 'font-size:22px;font-weight:bold;';
    this.matterText.textContent = '0';
    matterGroup.appendChild(this.matterText);
    hud.appendChild(matterGroup);

    // Stardate
    this.starDateText = document.createElement('span');
    this.starDateText.id = 'hud-stardate';
    this.starDateText.style.cssText = `font-size:12px;color:${AMBER};`;
    hud.appendChild(this.starDateText);

    // Speed controls
    const speedRow = document.createElement('div');
    speedRow.style.cssText = 'display:flex;gap:3px;';
    const speeds = [0, 1, 2, 4];
    const labels = ['||', '>', '>>', '>>>'];
    for (let i = 0; i < 4; i++) {
      const btn = document.createElement('div');
      btn.textContent = labels[i];
      btn.style.cssText = `
        width:28px;height:22px;text-align:center;line-height:22px;
        font-size:11px;cursor:pointer;border:1px solid ${AMBER};color:${AMBER};
      `;
      btn.addEventListener('click', () => {
        if (speeds[i] === 0) { GameRules.bRunning = !GameRules.bRunning; }
        else { GameRules.bRunning = true; GameRules.setTimeScale(speeds[i]); }
      });
      speedRow.appendChild(btn);
      this.speedButtons.push(btn);
    }
    hud.appendChild(speedRow);

    // O2 toggle
    const o2Btn = document.createElement('div');
    o2Btn.textContent = 'O2';
    o2Btn.style.cssText = `
      width:28px;height:22px;text-align:center;line-height:22px;
      font-size:11px;cursor:pointer;border:1px solid ${AMBER};color:${AMBER};
    `;
    o2Btn.addEventListener('click', () => this.toggleO2Overlay());
    hud.appendChild(o2Btn);

    // Capacity (pop/beds)
    const capGroup = this.hudCell();
    this.popText = document.createElement('span');
    this.popText.id = 'hud-pop';
    this.popText.style.cssText = 'font-weight:bold;';
    this.popText.textContent = '0';
    this.capacityText = document.createElement('span');
    this.capacityText.style.cssText = 'color:#888;';
    capGroup.appendChild(this.popText);
    capGroup.appendChild(this.capacityText);
    hud.appendChild(capGroup);

    // Morale
    this.moraleText = document.createElement('span');
    this.moraleText.style.cssText = 'font-size:14px;';
    hud.appendChild(this.moraleText);

    // Machine health
    this.machineHealthText = document.createElement('span');
    this.machineHealthText.style.cssText = 'font-size:12px;color:#888;';
    hud.appendChild(this.machineHealthText);

    // Corpses
    this.corpseText = document.createElement('span');
    this.corpseText.style.cssText = 'font-size:12px;color:#f44;';
    hud.appendChild(this.corpseText);

    this.uiRoot.appendChild(hud);
  }

  private hudCell(): HTMLDivElement {
    const el = document.createElement('div');
    el.style.cssText = 'display:flex;align-items:center;gap:4px;';
    return el;
  }

  // ── Sidebar ─────────────────────────────────────────────────────

  private createSidebar() {
    const sidebar = document.createElement('div');
    sidebar.style.cssText = `
      position:absolute;top:0;left:0;width:${SIDEBAR_W}px;height:100%;
      background:rgba(0,0,0,0.8);pointer-events:auto;overflow-y:auto;
    `;

    const btnDefs: { label: string; hotkey: string; mode: BuildMode; action?: string }[] = [
      { label: 'Inspect',   hotkey: 'I', mode: 'none', action: 'inspect' },
      { label: 'Assign',    hotkey: 'R', mode: 'none', action: 'roster' },
      { label: 'Research',  hotkey: 'E', mode: 'none', action: 'stub' },
      { label: 'Goals',     hotkey: 'G', mode: 'none', action: 'stub' },
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
      label.style.cssText = `font-size:18px;color:${AMBER};flex:1;`;
      const hotkey = document.createElement('div');
      hotkey.textContent = def.hotkey;
      hotkey.style.cssText = `font-size:12px;color:${AMBER};`;

      btn.appendChild(icon);
      btn.appendChild(label);
      btn.appendChild(hotkey);

      btn.addEventListener('click', () => {
        if (def.action === 'roster') {
          this.jobRoster.toggle();
          return;
        }
        if (def.action === 'stub') {
          Base.addAlert('system', `${def.label}: Coming Soon`);
          return;
        }
        if (def.action === 'construct') {
          // Toggle construct mode — show/hide sub-menu
          if (this.getBuildMode() === 'room' || this.getBuildMode() === 'floor' ||
              this.getBuildMode() === 'door' || this.getBuildMode() === 'zone' ||
              this.getBuildMode() === 'object') {
            this.setBuildMode('none');
          } else {
            this.setBuildMode('room');
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
      { label: 'Spawn Crew', action: this.onSpawn },
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

  private refreshObjectPicker() {
    this.objectPicker.innerHTML = '';
    if (this.getBuildMode() !== 'object') {
      this.objectPicker.style.display = 'none';
      return;
    }

    const items = getMenuForZone(this.getSelectedZone());
    const btnW = 280;
    const btnH = 48;

    for (let i = 0; i < items.length; i++) {
      const objName = items[i];
      const objData = tObjects[objName];
      if (!objData || !objData.showInObjectMenu) continue;

      const el = document.createElement('div');
      el.style.cssText = `
        width:${btnW}px;height:${btnH}px;background:rgba(0,0,0,0.85);
        margin-bottom:2px;padding:6px 8px;cursor:pointer;box-sizing:border-box;
      `;
      el.innerHTML = `
        <div style="font-size:14px;color:${AMBER};">${objData.friendlyName}</div>
        <div style="font-size:11px;color:#888;">Cost: ${objData.matterCost}</div>
      `;
      el.addEventListener('click', () => {
        this.selectedObjectName = objName;
        this.onObjectSelected(objName);
      });
      el.addEventListener('mouseenter', () => { el.style.background = 'rgba(223,162,0,0.3)'; });
      el.addEventListener('mouseleave', () => { el.style.background = 'rgba(0,0,0,0.85)'; });
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

  // ── Public API ──────────────────────────────────────────────────

  /** Set the selected entity to show in the inspector panel. */
  setSelectedEntity(entity: SelectedEntity) {
    this.inspectorPanel.setEntity(entity);
  }

  /** Toggle job roster visibility. */
  toggleJobRoster() {
    this.jobRoster.toggle();
  }

  /** Check if job roster is open. */
  isJobRosterOpen(): boolean {
    return this.jobRoster.isVisible();
  }

  // ── Update Loop ─────────────────────────────────────────────────

  update() {
    const chars = this.getCharacters();
    const envObjects = this.getEnvObjects();

    // ── HUD Matter (flash green/red) ──────────────────────
    const currentMatter = GameRules.nMatter;
    if (this.prevMatter >= 0 && currentMatter !== this.prevMatter) {
      this.matterFlashTimer = 30; // frames
      this.matterText.style.color = currentMatter > this.prevMatter ? '#4f4' : '#f44';
    }
    if (this.matterFlashTimer > 0) {
      this.matterFlashTimer--;
      if (this.matterFlashTimer === 0) {
        this.matterText.style.color = AMBER;
      }
    }
    this.prevMatter = currentMatter;
    this.matterText.textContent = String(currentMatter);

    // ── Stardate ──────────────────────────────────────────
    this.starDateText.textContent = `${GameRules.sStarDate} ${GameRules.sStarTime}`;

    // ── Speed buttons ─────────────────────────────────────
    const currentSpeed = !GameRules.bRunning ? 0 : GameRules.playerTimeScale;
    const speedMap = [0, 1, 2, 4];
    for (let i = 0; i < this.speedButtons.length; i++) {
      const active = speedMap[i] === currentSpeed;
      this.speedButtons[i].style.background = active ? AMBER : 'transparent';
      this.speedButtons[i].style.color = active ? '#000' : AMBER;
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
      // Map morale from [-100,100] to [0,100] for emoticon
      const moralePct = ((avgMorale + 100) / 200) * 100;
      let emoticon: string;
      if (moralePct <= 10) emoticon = '>:(';
      else if (moralePct <= 30) emoticon = ':(';
      else if (moralePct <= 50) emoticon = ':|';
      else if (moralePct <= 70) emoticon = ':)';
      else if (moralePct <= 90) emoticon = ':)';
      else emoticon = ':D';
      this.moraleText.textContent = `${emoticon} ${Math.round(moralePct)}%`;
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

    // ── Corpses ───────────────────────────────────────────
    const corpseCount = chars.filter(c => !c.isAlive()).length;
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

    // ── Inspector panel ───────────────────────────────────
    this.inspectorPanel.update();

    // ── Job roster ────────────────────────────────────────
    this.jobRoster.update();
  }

  dispose() {
    this.inspectorPanel.dispose();
    this.jobRoster.dispose();
    this.uiRoot.remove();
  }
}
