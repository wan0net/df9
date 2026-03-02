import { GameRules } from '../core/GameRules';
import { Base } from '../core/Base';
import { ZoneType, ZONE_LIST, ZONE_SPRITES } from '../world/ZoneType';
import { tObjects, getMenuForZone } from '../envobjects/EnvObjectData';
import type { BuildMode } from '../building/BuildSystem';

const AMBER_HEX = '#dfa200';
const SIDEBAR_W = 286;
const BUTTON_H = 81;

/**
 * In-game HTML/CSS overlay UI.
 * Replaces UIScene.ts (Phaser). All UI is pure DOM elements on top of the Three.js canvas.
 */
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

  // HUD elements
  private matterText!: HTMLSpanElement;
  private popText!: HTMLSpanElement;
  private starDateText!: HTMLSpanElement;
  private speedButtons: HTMLDivElement[] = [];

  // Zone picker
  private zonePicker!: HTMLDivElement;
  private zoneButtons: { el: HTMLDivElement; zone: ZoneType }[] = [];

  // Object picker
  private objectPicker!: HTMLDivElement;
  selectedObjectName = '';

  // Tooltip
  private tooltipEl!: HTMLDivElement;

  // Alert log
  private alertEls: HTMLDivElement[] = [];

  // Sidebar buttons for active tracking
  private sidebarBtns: { el: HTMLDivElement; label: HTMLDivElement; hotkey: HTMLDivElement; icon: HTMLDivElement; mode: BuildMode }[] = [];

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

    this.createUI();
  }

  private createUI() {
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
  }

  private createHUD() {
    const hud = document.createElement('div');
    hud.style.cssText = `
      position:absolute;top:10px;right:10px;pointer-events:auto;
      color:${AMBER_HEX};
    `;

    // Matter
    hud.innerHTML += `
      <div style="display:flex;align-items:center;margin-bottom:4px;">
        <span style="font-size:12px;color:#888;margin-right:10px;">MATTER</span>
        <span id="hud-matter" style="font-size:32px;font-weight:bold;">0</span>
      </div>
    `;

    // Population
    hud.innerHTML += `
      <div style="display:flex;align-items:center;margin-bottom:8px;">
        <span style="font-size:12px;color:#888;margin-right:10px;">POP</span>
        <span id="hud-pop" style="font-size:32px;font-weight:bold;">0</span>
      </div>
    `;

    // Star date
    hud.innerHTML += `<div id="hud-stardate" style="font-size:16px;margin-bottom:8px;"></div>`;

    // Speed buttons
    const speedRow = document.createElement('div');
    speedRow.style.cssText = 'display:flex;gap:6px;';
    const speeds = [0, 1, 2, 4];
    const labels = ['||', '>', '>>', '>>>'];
    for (let i = 0; i < 4; i++) {
      const btn = document.createElement('div');
      btn.textContent = labels[i];
      btn.style.cssText = `
        width:30px;height:24px;text-align:center;line-height:24px;
        font-size:12px;cursor:pointer;border:1px solid ${AMBER_HEX};
        color:${AMBER_HEX};
      `;
      btn.addEventListener('click', () => {
        if (speeds[i] === 0) { GameRules.bRunning = !GameRules.bRunning; }
        else { GameRules.bRunning = true; GameRules.setTimeScale(speeds[i]); }
      });
      speedRow.appendChild(btn);
      this.speedButtons.push(btn);
    }
    hud.appendChild(speedRow);

    this.uiRoot.appendChild(hud);

    this.matterText = hud.querySelector('#hud-matter')!;
    this.popText = hud.querySelector('#hud-pop')!;
    this.starDateText = hud.querySelector('#hud-stardate')!;
  }

  private createSidebar() {
    const sidebar = document.createElement('div');
    sidebar.style.cssText = `
      position:absolute;top:0;left:0;width:${SIDEBAR_W}px;
      background:rgba(0,0,0,0.8);pointer-events:auto;
    `;

    const btnDefs: { label: string; hotkey: string; mode: BuildMode }[] = [
      { label: 'Inspect',   hotkey: 'I', mode: 'none' },
      { label: 'Assign',    hotkey: 'R', mode: 'none' },
      { label: 'Research',  hotkey: 'E', mode: 'none' },
      { label: 'Goals',     hotkey: 'G', mode: 'none' },
      { label: 'Construct', hotkey: 'C', mode: 'room' },
      { label: 'Mine',      hotkey: 'M', mode: 'mine' },
      { label: 'Beacon',    hotkey: 'B', mode: 'none' },
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
      icon.style.cssText = `font-size:28px;font-weight:bold;color:${AMBER_HEX};width:60px;text-align:center;`;
      const label = document.createElement('div');
      label.textContent = def.label;
      label.style.cssText = `font-size:22px;color:${AMBER_HEX};flex:1;`;
      const hotkey = document.createElement('div');
      hotkey.textContent = def.hotkey;
      hotkey.style.cssText = `font-size:14px;color:${AMBER_HEX};`;

      btn.appendChild(icon);
      btn.appendChild(label);
      btn.appendChild(hotkey);

      btn.addEventListener('click', () => {
        if (def.mode === 'none') this.setBuildMode('none');
        else if (this.getBuildMode() === def.mode) this.setBuildMode('none');
        else this.setBuildMode(def.mode);
        this.refreshObjectPicker();
      });

      btn.addEventListener('mouseenter', () => {
        btn.style.background = AMBER_HEX;
        icon.style.color = '#000';
        label.style.color = '#000';
        hotkey.style.color = '#000';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = 'transparent';
        icon.style.color = AMBER_HEX;
        label.style.color = AMBER_HEX;
        hotkey.style.color = AMBER_HEX;
      });

      sidebar.appendChild(btn);
      this.sidebarBtns.push({ el: btn, label, hotkey, icon, mode: def.mode });
    }

    // Sub-buttons
    const subContainer = document.createElement('div');
    subContainer.style.cssText = `padding:10px;`;
    const subBtns: { label: string; mode: BuildMode }[] = [
      { label: '[Z] Zone',    mode: 'zone' },
      { label: '[P] Objects', mode: 'object' },
      { label: '[D] Door',    mode: 'door' },
      { label: '[B] Floor',   mode: 'floor' },
    ];
    for (const sb of subBtns) {
      const el = document.createElement('div');
      el.textContent = sb.label;
      el.style.cssText = `
        font-size:14px;color:${AMBER_HEX};background:rgba(0,0,0,0.8);
        padding:6px 10px;margin-bottom:4px;cursor:pointer;
      `;
      el.addEventListener('click', () => {
        this.setBuildMode(this.getBuildMode() === sb.mode ? 'none' : sb.mode);
        this.refreshObjectPicker();
      });
      subContainer.appendChild(el);
    }
    sidebar.appendChild(subContainer);

    // Utility buttons
    const utilContainer = document.createElement('div');
    utilContainer.style.cssText = 'padding:10px;display:flex;gap:8px;flex-wrap:wrap;';
    const utilBtns = [
      { label: 'Save', action: () => { this.onSave(); Base.addAlert('system', 'Game saved.'); } },
      { label: 'Load', action: () => { this.onLoad(); Base.addAlert('system', 'Game loaded.'); } },
      { label: 'Spawn Crew', action: this.onSpawn },
    ];
    for (const ub of utilBtns) {
      const el = document.createElement('div');
      el.textContent = ub.label;
      el.style.cssText = `
        font-size:13px;color:${AMBER_HEX};background:rgba(0,0,0,0.8);
        padding:6px 10px;cursor:pointer;
      `;
      el.addEventListener('click', ub.action);
      utilContainer.appendChild(el);
    }
    sidebar.appendChild(utilContainer);

    this.uiRoot.appendChild(sidebar);
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
        font-size:13px;color:${AMBER_HEX};background:rgba(0,0,0,0.85);
        padding-left:6px;cursor:pointer;box-sizing:border-box;
      `;
      el.addEventListener('click', () => this.setSelectedZone(zone));
      el.addEventListener('mouseenter', () => { el.style.background = `rgba(223,162,0,0.3)`; });
      el.addEventListener('mouseleave', () => { el.style.background = `rgba(0,0,0,0.85)`; });
      this.zonePicker.appendChild(el);
      this.zoneButtons.push({ el, zone });
    }

    this.uiRoot.appendChild(this.zonePicker);
  }

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
        <div style="font-size:14px;color:${AMBER_HEX};">${objData.friendlyName}</div>
        <div style="font-size:11px;color:#888;">Cost: ${objData.matterCost}</div>
      `;
      el.addEventListener('click', () => {
        this.selectedObjectName = objName;
        this.onObjectSelected(objName);
      });
      el.addEventListener('mouseenter', () => { el.style.background = `rgba(223,162,0,0.3)`; });
      el.addEventListener('mouseleave', () => { el.style.background = `rgba(0,0,0,0.85)`; });
      this.objectPicker.appendChild(el);
    }

    this.objectPicker.style.display = 'block';
  }

  private createTooltip() {
    this.tooltipEl = document.createElement('div');
    this.tooltipEl.style.cssText = `
      position:absolute;top:120px;right:10px;width:260px;
      background:rgba(0,0,0,0.8);color:#ccc;font-size:13px;
      padding:8px;line-height:1.6;white-space:pre-wrap;
      display:none;pointer-events:none;
    `;
    this.uiRoot.appendChild(this.tooltipEl);
  }

  private createAlertLog() {
    const alertContainer = document.createElement('div');
    alertContainer.style.cssText = `
      position:absolute;bottom:10px;right:10px;text-align:right;
      pointer-events:none;
    `;
    for (let i = 0; i < 3; i++) {
      const el = document.createElement('div');
      el.style.cssText = `font-size:12px;color:${AMBER_HEX};margin-top:4px;`;
      alertContainer.appendChild(el);
      this.alertEls.push(el);
    }
    this.uiRoot.appendChild(alertContainer);
  }

  update() {
    // HUD
    this.matterText.textContent = String(GameRules.nMatter);
    this.popText.textContent = String(this.getPopulation());
    this.starDateText.textContent = `Stardate ${GameRules.sStarDate}  ${GameRules.sStarTime}`;

    // Speed buttons
    const currentSpeed = !GameRules.bRunning ? 0 : GameRules.playerTimeScale;
    const speedMap = [0, 1, 2, 4];
    for (let i = 0; i < this.speedButtons.length; i++) {
      const active = speedMap[i] === currentSpeed;
      this.speedButtons[i].style.background = active ? AMBER_HEX : 'transparent';
      this.speedButtons[i].style.color = active ? '#000' : AMBER_HEX;
    }

    // Sidebar active states
    const buildMode = this.getBuildMode();
    for (const sb of this.sidebarBtns) {
      const active = buildMode === sb.mode && sb.mode !== 'none';
      sb.el.style.background = active ? AMBER_HEX : 'transparent';
      sb.icon.style.color = active ? '#000' : AMBER_HEX;
      sb.label.style.color = active ? '#000' : AMBER_HEX;
      sb.hotkey.style.color = active ? '#000' : AMBER_HEX;
    }

    // Zone picker visibility
    this.zonePicker.style.display = buildMode === 'zone' ? 'block' : 'none';
    if (buildMode === 'zone') {
      const selZone = this.getSelectedZone();
      for (const zb of this.zoneButtons) {
        const sel = zb.zone === selZone;
        zb.el.style.background = sel ? `rgba(223,162,0,0.4)` : `rgba(0,0,0,0.85)`;
      }
    }

    // Object picker visibility
    if (buildMode !== 'object') {
      this.objectPicker.style.display = 'none';
    }

    // Tooltip
    const info = this.getHoveredInfo();
    if (info) {
      this.tooltipEl.textContent = info;
      this.tooltipEl.style.display = 'block';
    } else {
      this.tooltipEl.style.display = 'none';
    }

    // Alerts
    const alerts = Base.getRecentAlerts(3);
    for (let i = 0; i < this.alertEls.length; i++) {
      if (i < alerts.length) {
        this.alertEls[i].textContent = alerts[i].message;
        this.alertEls[i].style.display = 'block';
      } else {
        this.alertEls[i].style.display = 'none';
      }
    }
  }

  dispose() {
    this.uiRoot.remove();
  }
}
