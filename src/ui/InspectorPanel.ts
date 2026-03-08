/**
 * InspectorPanel.ts — Detail panel for selected character/object/room.
 * Matches original CitizenInspector.lua, ObjectInspector.lua, ZoneInspector.lua.
 */

import type { Character } from '../characters/Character';
import type { EnvObject } from '../envobjects/EnvObject';
import { GameRules } from '../core/GameRules';
import { Door, DOOR_STATE } from '../envobjects/Door';
import type { Room } from '../rooms/Room';
import { JOB_NAMES, tJobs, STATUS_DEAD, CAUSE_OF_DEATH } from '../characters/CharacterConstants';
import { ZoneType, ZONE_LIST, ZONE_SPRITES } from '../world/ZoneType';

import { line } from '../localization/Localization';

const TEAM_ID_PLAYER = 1;

/** Human-readable cause of death names (Lua INSPEC098-109). */
function getDeathCauseName(cause: number): string {
  switch (cause) {
    case CAUSE_OF_DEATH.UNSPECIFIED: return line('INSPEC103TEXT');
    case CAUSE_OF_DEATH.DEBUG: return 'Debug Kill';
    case CAUSE_OF_DEATH.SUFFOCATION: return line('INSPEC098TEXT');
    case CAUSE_OF_DEATH.FIRE: return line('INSPEC100TEXT');
    case CAUSE_OF_DEATH.DISEASE: return line('INSPEC109TEXT');
    case CAUSE_OF_DEATH.COMBAT_RANGED: return line('INSPEC102TEXT');
    case CAUSE_OF_DEATH.SUCKED_INTO_SPACE: return line('INSPEC105TEXT');
    case CAUSE_OF_DEATH.PARASITE: return line('INSPEC104TEXT');
    case CAUSE_OF_DEATH.STARVATION: return line('INSPEC099TEXT');
    case CAUSE_OF_DEATH.COMBAT_MELEE: return line('INSPEC101TEXT');
    case CAUSE_OF_DEATH.THING: return 'The Thing';
    case CAUSE_OF_DEATH.STUNNER: return 'Stunner';
    default: return line('INSPEC103TEXT');
  }
}

const AMBER = '#dfa200';
const PANEL_W = 418; // Lua CitizenInspectorLayout.lua: nButtonWidth=418

/** Morale value → text label (Lua CharacterConstants.lua morale thresholds). */
function getMoraleText(morale: number): string {
  if (morale >= 75) return line('INSPEC069TEXT'); // Ecstatic
  if (morale >= 50) return line('INSPEC067TEXT'); // Very Happy
  if (morale >= 25) return line('INSPEC024TEXT'); // Happy
  if (morale >= 5) return line('INSPEC066TEXT');  // Kinda Happy
  if (morale >= -5) return line('INSPEC025TEXT'); // Neutral
  if (morale >= -25) return line('INSPEC065TEXT'); // Kinda Sad
  if (morale >= -50) return line('INSPEC023TEXT'); // Sad
  if (morale >= -75) return line('INSPEC064TEXT'); // Very Sad
  return line('INSPEC068TEXT'); // Deeply Sad
}

/** Health status text (Lua INSPEC011TEXT field: "Diagnosis: Healthy/Hurt"). */
function getHealthStatusText(char: Character): string {
  if (!char.isAlive()) return line('INSPEC010TEXT'); // Dead
  if (char.getHP() < char.tStats.nMaxHP * 0.5) return line('INSPEC021TEXT'); // Hurt
  return line('INSPEC022TEXT'); // Healthy
}

export type SelectedEntity =
  | { type: 'character'; data: Character }
  | { type: 'object'; data: EnvObject }
  | { type: 'room'; data: Room }
  | null;

type InspectorTab = 'duty' | 'stats' | 'psych' | 'log' | 'actions';
type RoomTab = 'info' | 'rezone' | 'actions';

export class InspectorPanel {
  private el: HTMLDivElement;
  private contentEl!: HTMLDivElement;
  private entity: SelectedEntity = null;
  private currentTab: InspectorTab = 'duty';
  private roomTab: RoomTab = 'info';
  private editingName = false;
  private onSetJob: ((character: Character, jobId: number) => void) | null = null;
  private getObjectsInRoom: ((room: Room) => EnvObject[]) | null = null;
  private onCuffCharacter: ((character: Character) => void) | null = null;
  private onExecuteCharacter: ((character: Character) => void) | null = null;
  private onDemolishObject: ((obj: EnvObject) => void) | null = null;
  private getBrigRooms: (() => Room[]) | null = null;
  private getRoomForChar: ((char: Character) => Room | null) | null = null;
  private onCenterCamera: ((char: Character) => void) | null = null;
  private onSelectRoom: ((room: Room) => void) | null = null;
  private onRezoneRoom: ((room: Room, zone: ZoneType) => void) | null = null;

  constructor(
    parent: HTMLElement,
    callbacks: {
      onSetJob: (character: Character, jobId: number) => void;
      getObjectsInRoom: (room: Room) => EnvObject[];
      onCuffCharacter?: (character: Character) => void;
      onExecuteCharacter?: (character: Character) => void;
      onDemolishObject?: (obj: EnvObject) => void;
      getBrigRooms?: () => Room[];
      getRoomForChar?: (char: Character) => Room | null;
      onCenterCamera?: (char: Character) => void;
      onSelectRoom?: (room: Room) => void;
      onRezoneRoom?: (room: Room, zone: ZoneType) => void;
    },
  ) {
    this.onSetJob = callbacks.onSetJob;
    this.getObjectsInRoom = callbacks.getObjectsInRoom;
    this.onCuffCharacter = callbacks.onCuffCharacter ?? null;
    this.onExecuteCharacter = callbacks.onExecuteCharacter ?? null;
    this.onDemolishObject = callbacks.onDemolishObject ?? null;
    this.getBrigRooms = callbacks.getBrigRooms ?? null;
    this.getRoomForChar = callbacks.getRoomForChar ?? null;
    this.onCenterCamera = callbacks.onCenterCamera ?? null;
    this.onSelectRoom = callbacks.onSelectRoom ?? null;
    this.onRezoneRoom = callbacks.onRezoneRoom ?? null;

    this.el = document.createElement('div');
    this.el.id = 'inspector-panel';
    this.el.style.cssText = `
      position:absolute;left:0;top:0;width:${PANEL_W}px;height:100%;
      background:rgba(0,0,0,0.85);
      color:#ccc;font-family:'nevis','Dosis',sans-serif;font-size:20px; /* Lua nevisBody=20 */
      display:none;pointer-events:auto;z-index:16;overflow-y:auto;
    `;

    this.contentEl = document.createElement('div');
    this.el.appendChild(this.contentEl);

    parent.appendChild(this.el);
  }

  setEntity(entity: SelectedEntity) {
    this.entity = entity;
    this.currentTab = 'duty';
    this.roomTab = 'info';
    this.editingName = false;
    if (entity) {
      this.el.style.display = 'block';
    } else {
      this.el.style.display = 'none';
    }
  }

  /** Whether the inspector is currently showing an entity. */
  hasEntity(): boolean {
    return this.entity !== null;
  }

  update() {
    if (!this.entity) {
      this.el.style.display = 'none';
      return;
    }

    // Auto-close if inspected object was destroyed (condition <= 0)
    if (this.entity.type === 'object' && this.entity.data.isDestroyed()) {
      this.setEntity(null);
      return;
    }
    // Auto-close if inspected character was removed
    if (this.entity.type === 'character' && !this.entity.data.isAlive() && this.entity.data.getHP() <= 0) {
      // Keep showing dead characters for inspection, but could auto-close after decay
    }

    this.contentEl.textContent = '';

    // Back button + ">> Inspect" header (Lua: CitizenInspector top bar)
    const topBar = document.createElement('div');
    topBar.style.cssText = `display:flex;justify-content:space-between;align-items:center;padding:6px 10px;`;
    const backBtn = document.createElement('div');
    backBtn.textContent = 'Back';
    backBtn.style.cssText = `font-size:22px;color:${AMBER};cursor:pointer;font-family:'Dosis',sans-serif;`; // Lua dosissemibold22
    backBtn.addEventListener('click', () => this.setEntity(null));
    const closeBtn = document.createElement('div');
    closeBtn.textContent = 'X';
    closeBtn.style.cssText = `font-size:22px;color:${AMBER};cursor:pointer;font-family:'Dosis',sans-serif;`; // Lua dosissemibold22
    closeBtn.addEventListener('click', () => this.setEntity(null));
    topBar.appendChild(backBtn);
    topBar.appendChild(closeBtn);
    this.contentEl.appendChild(topBar);

    const inspLabel = document.createElement('div');
    inspLabel.textContent = `>> ${line('HUDHUD005TEXT')}`;
    inspLabel.style.cssText = `font-size:22px;color:${AMBER};padding:0 10px 4px;font-family:'Dosis',sans-serif;`; // Lua dosissemibold22
    this.contentEl.appendChild(inspLabel);

    switch (this.entity.type) {
      case 'character':
        this.renderCharacter(this.entity.data);
        break;
      case 'object':
        this.renderObject(this.entity.data);
        break;
      case 'room':
        this.renderRoom(this.entity.data);
        break;
    }
  }

  // ── Character Inspector ─────────────────────────────────

  private renderCharacter(char: Character) {
    const isDead = !char.isAlive();
    const isPlayer = char.tStats.nTeam === 1; // TEAM_ID_PLAYER

    // Header with editable name
    const header = this.makeSection();
    const nameRow = document.createElement('div');
    nameRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;';

    if (this.editingName) {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = char.getName();
      input.style.cssText = `
        font-size:26px;font-weight:600;color:${AMBER};background:#111; /* Lua NameLabel=dosissemibold26 */
        border:1px solid ${AMBER};outline:none;font-family:'nevis','Dosis',sans-serif;
        width:180px;padding:1px 4px;
      `;
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const trimmed = input.value.trim();
          if (trimmed) char.tStats.sName = trimmed;
          this.editingName = false;
          e.stopPropagation();
        } else if (e.key === 'Escape') {
          this.editingName = false;
          e.stopPropagation();
        }
      });
      input.addEventListener('blur', () => {
        const trimmed = input.value.trim();
        if (trimmed) char.tStats.sName = trimmed;
        this.editingName = false;
      });
      nameRow.appendChild(input);
      // Focus on next frame
      setTimeout(() => input.focus(), 0);
    } else {
      const nameSpan = document.createElement('span');
      nameSpan.textContent = char.getName();
      nameSpan.style.cssText = `font-size:26px;font-weight:600;color:${AMBER};cursor:pointer; /* Lua NameLabel=dosissemibold26 */`;
      nameSpan.title = 'Click to edit name';
      nameSpan.addEventListener('click', () => {
        this.editingName = true;
        this.update();
      });
      nameRow.appendChild(nameSpan);
    }

    header.appendChild(nameRow);

    // Job title — separate line below name (Lua TitleLabel at pos {150, -216}, dosisregular26)
    const jobLine = document.createElement('div');
    const dutyStr = char.isAlive() && char.onDuty() ? ` ${line('DUTIES015TEXT')}` : '';
    jobLine.textContent = `${char.getJobName()}${dutyStr}`;
    jobLine.style.cssText = `font-size:26px;color:#888;font-weight:400;`; // Lua dosisregular26
    header.appendChild(jobLine);

    // Structured info rows (Lua CitizenInspector: Diagnosis, Morale, Location, Activity)
    // Lua StatsBG: amber opaque panel behind stat rows
    const infoSection = document.createElement('div');
    infoSection.style.cssText = `margin-top:6px;background:#3B2600;padding:4px 8px;`; // Lua Gui.AMBER_OPAQUE

    // Diagnosis row
    const diagRow = this.makeInfoRow(
      line('INSPEC011TEXT'),
      getHealthStatusText(char),
      isDead ? '#f44' : '#4f4',
    );
    infoSection.appendChild(diagRow);

    // Morale row (or Cause of Death if dead)
    if (isDead) {
      const deathRow = this.makeInfoRow(
        line('INSPEC010TEXT') + ':',
        getDeathCauseName(char.nCauseOfDeath),
        '#f44',
      );
      infoSection.appendChild(deathRow);
    } else {
      const moraleRow = this.makeInfoRow(
        line('INSPEC012TEXT'),
        getMoraleText(char.nMorale),
        AMBER,
      );
      infoSection.appendChild(moraleRow);
    }

    // Location row
    let locationText = line('INSPUI036TEXT');
    if (!char.bSpacewalking) {
      const room = this.getRoomForChar?.(char);
      if (room?.uniqueZoneName) locationText = room.uniqueZoneName;
      else if (room) locationText = `Room ${room.id}`;
      else locationText = `(${char.tileX}, ${char.tileY})`;
    }
    const locRow = this.makeInfoRow(line('INSPEC013TEXT'), locationText, '#ccc');
    infoSection.appendChild(locRow);

    // Activity row
    const taskName = char.currentTask?.name ?? (isDead ? line('INSPEC010TEXT') : line('UITASK029TEXT'));
    const actRow = this.makeInfoRow(line('INSPEC014TEXT'), taskName, '#ccc');
    infoSection.appendChild(actRow);

    header.appendChild(infoSection);

    // Shortcut buttons (Lua: HealthStatButton, MoraleButton, RoomButton, ActivityButton, CamCenterButton)
    if (isPlayer && !isDead) {
      const shortcuts = document.createElement('div');
      shortcuts.style.cssText = 'display:flex;gap:4px;margin-top:4px;padding:0 8px;';
      const shortcutDefs: { label: string; title: string; action: () => void }[] = [
        { label: 'HP', title: 'View Stats', action: () => { this.currentTab = 'stats'; this.update(); } },
        { label: 'MOR', title: 'View Morale/Psych', action: () => { this.currentTab = 'psych'; this.update(); } },
        { label: 'ROOM', title: 'View Room', action: () => {
          const room = this.getRoomForChar?.(char);
          if (room && this.onSelectRoom) this.onSelectRoom(room);
        }},
        { label: 'ACT', title: 'View Actions', action: () => { this.currentTab = 'actions'; this.update(); } },
        { label: 'CAM', title: 'Center Camera', action: () => { this.onCenterCamera?.(char); } },
      ];
      for (const sd of shortcutDefs) {
        const btn = document.createElement('div');
        btn.textContent = sd.label;
        btn.title = sd.title;
        btn.style.cssText = `
          font-size:18px;color:${AMBER};border:1px solid ${AMBER}; /* Lua dosissemibold18 */
          padding:2px 5px;cursor:pointer;
        `;
        btn.addEventListener('click', sd.action);
        btn.addEventListener('mouseenter', () => { btn.style.background = `rgba(223,162,0,0.2)`; });
        btn.addEventListener('mouseleave', () => { btn.style.background = 'transparent'; });
        shortcuts.appendChild(btn);
      }
      this.contentEl.appendChild(shortcuts);
    }

    this.contentEl.appendChild(header);

    // Tab row
    const tabRow = document.createElement('div');
    tabRow.style.cssText = `
      display:flex;border-top:1px solid #333;border-bottom:1px solid #333;
    `;
    // Lua CitizenInspector: 5 tabs (Duty, Stats, Psych, Spaceface, Action)
    const tabs: { label: string; tab: InspectorTab }[] = isPlayer
      ? [
          { label: line('INSPEC015TEXT'), tab: 'duty' },
          { label: line('INSPEC017TEXT'), tab: 'stats' },
          { label: line('INSPUI002TEXT'), tab: 'psych' },
          { label: 'Spaceface', tab: 'log' },
          { label: line('INSPUI005TEXT'), tab: 'actions' },
        ]
      : [
          { label: line('INSPEC017TEXT'), tab: 'stats' },
          { label: 'Spaceface', tab: 'log' },
        ];
    for (const t of tabs) {
      const btn = document.createElement('div');
      btn.textContent = t.label;
      const isActive = this.currentTab === t.tab;
      btn.style.cssText = `
        flex:1;text-align:center;padding:6px 0;cursor:pointer;font-size:20px; /* Lua dosissemibold20 */
        background:${isActive ? AMBER : 'transparent'};
        color:${isActive ? '#000' : AMBER};
      `;
      btn.addEventListener('click', () => {
        this.currentTab = t.tab;
        this.update();
      });
      tabRow.appendChild(btn);
    }
    this.contentEl.appendChild(tabRow);

    // Tab content
    const body = this.makeSection();
    switch (this.currentTab) {
      case 'duty':
        this.renderDutyTab(body, char);
        break;
      case 'stats':
        this.renderStatsTab(body, char);
        break;
      case 'psych':
        this.renderPsychTab(body, char);
        break;
      case 'log':
        this.renderLogTab(body, char);
        break;
      case 'actions':
        this.renderActionsTab(body, char);
        break;
    }
    this.contentEl.appendChild(body);

    // Close button
    this.addCloseButton();
  }

  private renderDutyTab(container: HTMLDivElement, char: Character) {
    for (const jobId of tJobs) {
      const name = JOB_NAMES[jobId] ?? 'Unknown';
      const comp = char.tStats.tCompetency[jobId] ?? 0;
      const isCurrent = char.getJob() === jobId;

      const row = document.createElement('div');
      row.style.cssText = `
        display:flex;align-items:center;padding:3px 0;cursor:pointer;
        ${isCurrent ? `background:rgba(223,162,0,0.2);` : ''}
      `;
      row.addEventListener('click', () => {
        if (this.onSetJob) this.onSetJob(char, jobId);
        this.update();
      });
      row.addEventListener('mouseenter', () => { row.style.background = 'rgba(223,162,0,0.15)'; });
      row.addEventListener('mouseleave', () => {
        row.style.background = isCurrent ? 'rgba(223,162,0,0.2)' : 'transparent';
      });

      row.innerHTML = `
        <span style="width:90px;color:${isCurrent ? AMBER : '#ccc'};">${name}</span>
        <div style="flex:1;height:8px;background:#222;margin:0 6px;">
          <div style="width:${Math.round(comp * 100)}%;height:100%;background:${isCurrent ? AMBER : '#666'};"></div>
        </div>
        <span style="width:40px;text-align:right;font-size:22px;color:#888;">${Math.round(comp * 100)}%</span>
      `;
      container.appendChild(row);
    }
  }

  private renderStatsTab(container: HTMLDivElement, char: Character) {
    // HP + O2 bars
    const hpDiv = document.createElement('div');
    hpDiv.style.cssText = 'margin-bottom:6px;';
    hpDiv.innerHTML = this.bar('HP', char.getHP(), char.tStats.nMaxHP, char.getHP() < 30 ? '#f44' : '#4f4');
    container.appendChild(hpDiv);

    const o2Div = document.createElement('div');
    o2Div.style.cssText = 'margin-bottom:6px;';
    o2Div.innerHTML = this.bar('O2', Math.round(char.needs.oxygen), 100, char.needs.oxygen < 30 ? '#f44' : '#48f');
    container.appendChild(o2Div);

    // Needs bars (merged from original Stats tab — Lua CitizenStatsTab shows needs)
    const needs: { label: string; value: number }[] = [
      { label: line('INSPEC085TEXT'), value: char.needs.hunger },
      { label: line('INSPEC072TEXT'), value: char.needs.energy },
      { label: line('INSPEC074TEXT'), value: char.needs.amusement },
      { label: line('INSPEC073TEXT'), value: char.needs.social },
      { label: line('INSPEC071TEXT'), value: char.needs.duty },
    ];
    for (const n of needs) {
      const displayPct = (n.value + 100) / 2;
      const color = n.value > 30 ? '#4f4' : n.value > -30 ? '#ff0' : '#f44';
      const row = document.createElement('div');
      row.style.cssText = 'margin-bottom:4px;';
      row.innerHTML = this.bar(n.label, Math.max(0, displayPct), 100, color);
      container.appendChild(row);
    }

    // XP + Anger stats
    const statsDiv = document.createElement('div');
    statsDiv.style.cssText = 'margin-top:6px;font-size:20px;color:#ccc;'; // Lua nevisBody=20
    let statsHtml = `
      <div style="margin-bottom:4px;">${line('INSPUI007TEXT')} ${char.tStats.nXP}</div>
      <div style="margin-bottom:4px;">${line('INSPUI008TEXT')} ${char.nAnger}</div>
    `;
    // Join Date (Lua CitizenStatsTab: INSPEC124TEXT)
    const joinDate = GameRules.getFullStarDateString(char.nJoinTime);
    statsHtml += `<div style="margin-bottom:4px;">${line('INSPEC124TEXT')} ${joinDate}</div>`;
    // Illness (Lua CitizenStatsTab: INSPEC146TEXT if none)
    const maladies = char.maladies ?? [];
    if (maladies.length > 0) {
      statsHtml += `<div style="margin-bottom:4px;color:#f84;">${maladies.map(m => m.sFriendlyName ?? m.sMaladyName).join(', ')}</div>`;
    } else {
      statsHtml += `<div style="margin-bottom:4px;">${line('INSPEC146TEXT')}</div>`;
    }
    // Inventory (Lua INSPEC087TEXT)
    const invItems = char.inventory.getAll();
    const invStr = invItems.length > 0 ? invItems.map(i => `${i.sName}${i.nCount > 1 ? ` x${i.nCount}` : ''}`).join(', ') : line('INSPUI010TEXT');
    statsHtml += `<div style="margin-bottom:4px;">${line('INSPEC087TEXT')} ${invStr}</div>`;
    // Favorites (Lua INSPEC117TEXT, INSPEC049TEXT, INSPEC050TEXT)
    const favHobby = char.getFavorite('Activities');
    const favFood = char.getFavorite('Foods');
    const favBand = char.getFavorite('Bands');
    if (favHobby) statsHtml += `<div style="margin-bottom:4px;">${line('INSPEC117TEXT')} ${favHobby}</div>`;
    if (favFood) statsHtml += `<div style="margin-bottom:4px;">${line('INSPEC049TEXT')} ${favFood}</div>`;
    if (favBand) statsHtml += `<div style="margin-bottom:4px;">${line('INSPEC050TEXT')} ${favBand}</div>`;
    // Friends (Lua INSPEC047TEXT — top 4 people with positive affinity)
    const friends = char.getPeopleOfAffinity(5, true).sort((a, b) => b.nAffinity - a.nAffinity).slice(0, 4);
    statsHtml += `<div style="margin-bottom:2px;color:${AMBER};">${line('INSPEC047TEXT')}</div>`;
    if (friends.length > 0) {
      for (const f of friends) statsHtml += `<div style="margin-bottom:2px;padding-left:8px;">${f.sID}</div>`;
    } else {
      statsHtml += `<div style="margin-bottom:2px;padding-left:8px;">${line('INSPEC082TEXT')}</div>`;
    }
    // Enemies (Lua INSPEC048TEXT — top 4 people with negative affinity)
    const enemies = char.getPeopleOfAffinity(-5, false).sort((a, b) => a.nAffinity - b.nAffinity).slice(0, 4);
    statsHtml += `<div style="margin-bottom:2px;color:${AMBER};">${line('INSPEC048TEXT')}</div>`;
    if (enemies.length > 0) {
      for (const e of enemies) statsHtml += `<div style="margin-bottom:2px;padding-left:8px;">${e.sID}</div>`;
    } else {
      statsHtml += `<div style="margin-bottom:2px;padding-left:8px;">${line('INSPEC082TEXT')}</div>`;
    }
    statsDiv.innerHTML = statsHtml;
    container.appendChild(statsDiv);
  }

  private renderPsychTab(container: HTMLDivElement, char: Character) {
    const p = char.tStats.personality;

    // Slider traits (0-1 range)
    const sliders: { label: string; value: number; lowLabel: string; highLabel: string }[] = [
      { label: line('INSPUI018TEXT'), value: p.nBravery, lowLabel: line('PERSON008TEXT'), highLabel: line('PERSON001TEXT') },
      { label: line('INSPUI019TEXT'), value: p.nTemper, lowLabel: line('INSPUI026TEXT'), highLabel: line('INSPUI033TEXT') },
      { label: line('INSPUI020TEXT'), value: p.nWorkEthic, lowLabel: line('PERSON015TEXT'), highLabel: line('INSPUI027TEXT') },
      { label: line('INSPUI021TEXT'), value: p.nGregariousness, lowLabel: line('PERSON009TEXT'), highLabel: line('INSPUI028TEXT') },
      { label: line('INSPUI022TEXT'), value: p.nChattiness, lowLabel: line('PERSON010TEXT'), highLabel: line('PERSON003TEXT') },
      { label: line('INSPUI023TEXT'), value: p.nNeatness, lowLabel: line('INSPUI029TEXT'), highLabel: line('INSPUI030TEXT') },
      { label: line('INSPUI024TEXT'), value: p.nPositivity, lowLabel: line('PERSON017TEXT'), highLabel: line('PERSON016TEXT') },
      { label: line('INSPUI025TEXT'), value: p.nAuthoritarian, lowLabel: line('PERSON028TEXT'), highLabel: line('PERSON027TEXT') },
    ];

    for (const s of sliders) {
      const pct = Math.round(s.value * 100);
      const desc = s.value < 0.3 ? s.lowLabel : s.value > 0.7 ? s.highLabel : line('INSPEC132TEXT');
      const row = document.createElement('div');
      row.style.cssText = 'margin-bottom:4px;';
      row.innerHTML = `
        <div style="display:flex;align-items:center;">
          <span style="width:95px;font-size:22px;color:#888;">${s.label}</span>
          <div style="flex:1;height:6px;background:#222;margin:0 4px;position:relative;">
            <div style="width:${pct}%;height:100%;background:${AMBER};"></div>
          </div>
          <span style="width:65px;text-align:right;font-size:20px;color:#888;">${desc}</span>
        </div>
      `;
      container.appendChild(row);
    }

    // Boolean traits
    const boolTraits: { label: string; value: boolean }[] = [
      { label: line('PERSON018TEXT'), value: p.bXenophobe },
      { label: line('PERSON020TEXT'), value: p.bAnxious },
      { label: line('PERSON021TEXT'), value: p.bGourmand },
      { label: line('PERSON019TEXT'), value: p.bJoker },
      { label: line('PERSON022TEXT'), value: p.bSentimental },
      { label: line('PERSON023TEXT'), value: p.bCompetitive },
      { label: line('INSPUI034TEXT'), value: p.bHipster },
    ];

    const activeTraits = boolTraits.filter(t => t.value);
    if (activeTraits.length > 0) {
      const traitDiv = document.createElement('div');
      traitDiv.style.cssText = `margin-top:6px;padding-top:6px;border-top:1px solid #333;`;
      traitDiv.innerHTML = `<div style="font-size:22px;color:${AMBER};margin-bottom:4px;">${line('INSPUI009TEXT')}</div>`;
      for (const t of activeTraits) {
        const tag = document.createElement('span');
        tag.textContent = t.label;
        tag.style.cssText = `
          display:inline-block;margin:2px;padding:2px 6px;
          border:1px solid #555;color:#ccc;font-size:18px;
        `;
        traitDiv.appendChild(tag);
      }
      container.appendChild(traitDiv);
    }
  }

  private renderLogTab(container: HTMLDivElement, char: Character) {
    const log = char.tLog;
    if (log.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'color:#888;font-style:italic;';
      empty.textContent = line('INSPUI012TEXT');
      container.appendChild(empty);
      return;
    }

    // Show most recent entries first, up to 20 (Lua Spaceface: timestamp + text)
    const maxEntries = 20;
    const start = Math.max(0, log.length - maxEntries);
    for (let i = log.length - 1; i >= start; i--) {
      const entry = log[i];
      const row = document.createElement('div');
      row.style.cssText = `
        display:flex;gap:8px;margin-bottom:4px;padding:3px 4px;border-bottom:1px solid #222;
        font-size:20px;line-height:1.3;
      `;
      // Spacedate timestamp (Lua: shows "9122.12.18" before each entry)
      const timeSpan = document.createElement('span');
      const timeStr = GameRules.getFullStarDateString(entry.nTime);
      timeSpan.textContent = timeStr;
      timeSpan.style.cssText = `color:${AMBER};font-weight:bold;white-space:nowrap;flex-shrink:0;`;
      const textSpan = document.createElement('span');
      textSpan.textContent = entry.sLine;
      textSpan.style.cssText = 'color:#ccc;';
      row.appendChild(timeSpan);
      row.appendChild(textSpan);
      container.appendChild(row);
    }
  }

  private renderActionsTab(container: HTMLDivElement, char: Character) {
    const isDead = !char.isAlive();

    // Cuff / Uncuff
    const cuffBtn = this.makeActionButton(
      char.bCuffed ? line('INSPEC194TEXT') : line('INSPEC193TEXT'),
      isDead,
      () => { if (this.onCuffCharacter) this.onCuffCharacter(char); },
    );
    container.appendChild(cuffBtn);

    // Send to Brig
    const brigRooms = this.getBrigRooms ? this.getBrigRooms() : [];
    const brigBtn = this.makeActionButton(
      line('INSPUI013TEXT'),
      isDead || brigRooms.length === 0,
      () => {
        if (this.onCuffCharacter && !char.bCuffed) this.onCuffCharacter(char);
      },
    );
    if (brigRooms.length === 0) {
      const note = document.createElement('div');
      note.textContent = line('INSPUI014TEXT');
      note.style.cssText = 'font-size:18px;color:#666;margin-top:-4px;margin-bottom:8px;';
      container.appendChild(brigBtn);
      container.appendChild(note);
    } else {
      container.appendChild(brigBtn);
    }

    // Send to Infirmary / Cancel Hospitalization (Lua CitizenActionTab: INSPEC147/148TEXT)
    const isHospitalized = char.bCuffed && char.maladies.length > 0; // simplified check
    const hospBtn = this.makeActionButton(
      isHospitalized ? line('INSPEC148TEXT') : line('INSPEC147TEXT'),
      isDead,
      () => {
        // Toggle hospitalization — quarantine flag on character
        if (this.onCuffCharacter) this.onCuffCharacter(char);
      },
    );
    container.appendChild(hospBtn);

    // Execute (red)
    const execBtn = this.makeActionButton(
      line('INSPEC195TEXT'),
      isDead,
      () => { if (this.onExecuteCharacter) this.onExecuteCharacter(char); },
      '#f44',
    );
    container.appendChild(execBtn);
  }

  private makeActionButton(
    label: string,
    disabled: boolean,
    onClick: () => void,
    color = AMBER,
  ): HTMLDivElement {
    const btn = document.createElement('div');
    btn.textContent = label;
    const baseColor = disabled ? '#555' : color;
    btn.style.cssText = `
      padding:6px 12px;margin-bottom:6px;cursor:${disabled ? 'default' : 'pointer'};
      border:1px solid ${baseColor};color:${baseColor};font-size:20px;text-align:center; /* Lua dosissemibold20 */
      opacity:${disabled ? '0.5' : '1'};
    `;
    if (!disabled) {
      btn.addEventListener('click', () => { onClick(); this.update(); });
      btn.addEventListener('mouseenter', () => { btn.style.background = `rgba(${color === '#f44' ? '255,68,68' : '223,162,0'},0.2)`; });
      btn.addEventListener('mouseleave', () => { btn.style.background = 'transparent'; });
    }
    return btn;
  }

  // ── Object Inspector ────────────────────────────────────

  private getDoorStatusText(door: Door): string {
    switch (door.state) {
      case DOOR_STATE.OPEN: return `<span style="color:#4f4;">${line('PROPSX056TEXT')}</span>`;
      case DOOR_STATE.CLOSED: return line('PROPSX057TEXT');
      case DOOR_STATE.LOCKED: return `<span style="color:#f44;">${line('PROPSX059TEXT')}</span>`;
      case DOOR_STATE.BROKEN_OPEN: return `<span style="color:#f44;">${line('PROPSX053TEXT')}</span>`;
      case DOOR_STATE.BROKEN_CLOSED: return `<span style="color:#f44;">${line('PROPSX054TEXT')}</span>`;
      default: return line('INSPEC103TEXT');
    }
  }

  private renderObject(obj: EnvObject) {
    const header = this.makeSection();
    const condStr = obj.getConditionUIString();
    const status = obj.isFunctioning() ? line('INSPEC089TEXT') : obj.isDestroyed() ? line('INSPEC053TEXT') : line('INSPEC091TEXT');
    const statusColor = obj.isDestroyed() ? '#f44' :
      obj.isDamaged() ? '#ff0' :
      obj.isFunctioning() ? '#4f4' : '#888';

    const emergencyStr = obj.getEmergencyString();
    header.innerHTML = `
      <div style="font-size:26px;font-weight:bold;color:${AMBER};margin-bottom:6px;">
        ${obj.tData.friendlyName}
        ${emergencyStr ? `<span style="color:#f44;font-size:20px;margin-left:8px;">[${emergencyStr}]</span>` : ''}
      </div>
      <div style="margin-bottom:6px;">
        ${this.bar(line('INSPEC054TEXT').replace(':', ''), Math.round(obj.nCondition), 100, obj.nCondition < 50 ? '#f44' : '#4f4')}
      </div>
      <div style="margin-bottom:4px;">${line('INSPEC054TEXT')} <span style="color:${statusColor};">${condStr} (${Math.round(obj.nCondition)}%)</span> | ${line('INSPEC093TEXT')} <span style="color:${statusColor};">${status}</span></div>
      ${obj.tData.nPowerOutput > 0 ? `<div style="margin-bottom:4px;">${line('INSPEC165TEXT')} ${obj.getPowerOutput()}</div>` : ''}
      ${obj.tData.nPowerDraw > 0 ? `<div style="margin-bottom:4px;">${line('INSPEC164TEXT')} ${obj.getPowerDraw()}</div>` : ''}
      ${obj.tData.oxygenLevel > 0 ? `<div style="margin-bottom:4px;">${line('INSPEC059TEXT')} ${obj.getOxygenOutput()}</div>` : ''}
      ${obj instanceof Door ? `<div style="margin-bottom:4px;">${line('PROPSX055TEXT')} ${this.getDoorStatusText(obj)}</div>` : ''}
      ${obj.sBuilderName ? `<div style="margin-bottom:4px;">${line('INSPEC111TEXT')} ${obj.sBuilderName}</div>` : ''}
      ${obj.sBuildTime ? `<div style="margin-bottom:4px;">${line('INSPEC110TEXT')} ${obj.sBuildTime}</div>` : ''}
      <div style="margin-bottom:4px;">${line('INSPUI015TEXT')} (${obj.tileX}, ${obj.tileY})</div>
      ${obj.tData.bCanDeactivate ? `
        <div style="margin-top:8px;">
          <span style="cursor:pointer;color:${AMBER};border:1px solid ${AMBER};padding:2px 8px;"
                id="inspector-toggle-active">${obj.bActive ? line('INSPEC171TEXT') : line('INSPEC172TEXT')}</span>
        </div>` : ''}
    `;
    this.contentEl.appendChild(header);

    // Wire toggle button
    const toggleBtn = header.querySelector('#inspector-toggle-active') as HTMLElement;
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        obj.bActive = !obj.bActive;
        this.update();
      });
    }

    // Demolish button
    if (obj.bBuilt) {
      const refund = obj.getVaporizeMatterYield();
      const demolishBtn = this.makeActionButton(
        `${line('INSPUI016TEXT')} (+${refund} ${line('INSPUI017TEXT')})`,
        false,
        () => {
          if (this.onDemolishObject) this.onDemolishObject(obj);
          this.entity = null;
          this.el.style.display = 'none';
        },
        '#f44',
      );
      demolishBtn.style.marginTop = '8px';
      demolishBtn.style.marginLeft = '8px';
      demolishBtn.style.marginRight = '8px';
      this.contentEl.appendChild(demolishBtn);
    }

    this.addCloseButton();
  }

  // ── Room Inspector ──────────────────────────────────────

  private renderRoom(room: Room) {
    const zoneName = ZONE_SPRITES[room.zone]?.name ?? 'Unknown';

    // Room header — zone name + room ID
    const header = this.makeSection();
    header.innerHTML = `
      <div style="font-size:26px;font-weight:bold;color:${AMBER};margin-bottom:6px;">
        ${zoneName} <span style="color:#888;">Room #${room.id}</span>
      </div>
    `;
    this.contentEl.appendChild(header);

    // Tabs: Info | Rezone | Actions (Lua: ZoneInspector has folder tabs)
    const tabBar = document.createElement('div');
    tabBar.style.cssText = 'display:flex;padding:0 8px;margin-bottom:6px;gap:2px;';
    const roomTabs: { key: RoomTab; label: string }[] = [
      { key: 'info', label: line('INSPEC055TEXT').replace(':', '').trim() || 'Info' },
      { key: 'rezone', label: line('ZONEUI005TEXT').replace(':', '').trim() || 'Rezone' },
      { key: 'actions', label: line('INSPEC093TEXT').replace(':', '').trim() || 'Actions' },
    ];
    for (const tab of roomTabs) {
      const active = this.roomTab === tab.key;
      const tabEl = document.createElement('div');
      tabEl.textContent = tab.label;
      tabEl.style.cssText = `
        flex:1;text-align:center;padding:4px 0;cursor:pointer;font-size:20px; /* Lua dosissemibold20 */
        background:${active ? 'rgba(223,162,0,0.3)' : 'rgba(30,30,30,0.8)'};
        color:${active ? AMBER : '#888'};
        border:1px solid ${active ? AMBER : '#444'};
      `;
      tabEl.addEventListener('click', () => { this.roomTab = tab.key; this.update(); });
      tabBar.appendChild(tabEl);
    }
    this.contentEl.appendChild(tabBar);

    switch (this.roomTab) {
      case 'info': this.renderRoomInfo(room); break;
      case 'rezone': this.renderRoomRezone(room); break;
      case 'actions': this.renderRoomActions(room); break;
    }

    this.addCloseButton();
  }

  /** Room Info tab — stats display (Lua ZoneInspector main view). */
  private renderRoomInfo(room: Room) {
    const objCount = this.getObjectsInRoom ? this.getObjectsInRoom(room).length : 0;
    const section = this.makeSection();
    section.innerHTML = `
      <div style="margin-bottom:4px;">${line('INSPEC055TEXT')} ${room.size} ${line('INSPEC057TEXT')}</div>
      <div style="margin-bottom:6px;">
        ${this.bar(line('INSPEC062TEXT'), room.oxygen, 255, room.oxygen < 50 ? '#f44' : '#48f')}
      </div>
      <div style="margin-bottom:4px;">
        <span style="color:${room.sealed ? '#4f4' : '#f44'};">${room.sealed ? line('INSPEC153TEXT') : line('INSPEC152TEXT')}</span>
      </div>
      <div style="margin-bottom:4px;">
        ${line('INSPEC167TEXT')} <span style="color:#4f4;">+${room.nPowerOutput}</span> / ${line('INSPEC163TEXT')} <span style="color:#f44;">-${room.nPowerDraw}</span>
      </div>
      <div style="margin-bottom:4px;">${line('INSPEC056TEXT')} ${objCount}</div>
    `;
    this.contentEl.appendChild(section);
  }

  /** Room Rezone tab — zone type buttons (Lua ZoneRezoneTab). */
  private renderRoomRezone(room: Room) {
    const section = this.makeSection();
    // Zone type buttons matching Lua ZoneRezoneTab.tZoneOptions order
    for (const zone of ZONE_LIST) {
      const config = ZONE_SPRITES[zone];
      if (!config) continue;
      const isActive = room.zone === zone;
      const btn = document.createElement('div');
      btn.style.cssText = `
        padding:6px 10px;margin-bottom:3px;cursor:pointer;font-size:22px; /* Lua dosissemibold22 */
        background:${isActive ? 'rgba(223,162,0,0.25)' : 'transparent'};
        color:${isActive ? AMBER : '#aaa'};
        border:1px solid ${isActive ? AMBER : '#444'};
      `;
      btn.textContent = config.name;
      if (!isActive) {
        btn.addEventListener('click', () => {
          if (this.onRezoneRoom) this.onRezoneRoom(room, zone);
          this.update();
        });
        btn.addEventListener('mouseenter', () => {
          btn.style.background = 'rgba(223,162,0,0.15)';
          btn.style.color = AMBER;
        });
        btn.addEventListener('mouseleave', () => {
          btn.style.background = 'transparent';
          btn.style.color = '#aaa';
        });
      }
      section.appendChild(btn);
    }
    this.contentEl.appendChild(section);
  }

  /** Room Actions tab — claim/unclaim, seal/unseal (Lua ZoneActionTab). */
  private renderRoomActions(room: Room) {
    const section = this.makeSection();
    const isPlayer = room.nTeam === TEAM_ID_PLAYER;

    // Claim / Unclaim button (Lua ZoneActionTab.claimButtonPressed)
    const claimLabel = isPlayer ? line('ZONEUI112TEXT') || 'Unclaim' : line('ZONEUI111TEXT') || 'Claim';
    const claimBtn = this.makeActionButton(claimLabel, false, () => {
      if (isPlayer) { room.unclaim(); } else { room.claim(); }
      this.update();
    });
    section.appendChild(claimBtn);

    // Seal / Unseal oxygen button (Lua ZoneActionTab.sealButtonPressed)
    const isSealed = room.bUserBlockOxygen;
    const sealLabel = isSealed ? (line('ZONEUI072TEXT') || 'Unseal Oxygen') : (line('ZONEUI071TEXT') || 'Seal Oxygen');
    const sealBtn = this.makeActionButton(sealLabel, false, () => {
      room.bUserBlockOxygen = !room.bUserBlockOxygen;
      this.update();
    });
    section.appendChild(sealBtn);

    this.contentEl.appendChild(section);
  }

  // ── Helpers ─────────────────────────────────────────────

  /** Structured "Label: Value" info row matching Lua CitizenInspector layout. */
  private makeInfoRow(label: string, value: string, valueColor: string): HTMLDivElement {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;padding:2px 0;font-size:22px;'; // Lua dosissemibold22
    const labelSpan = document.createElement('span');
    labelSpan.textContent = label + ' ';
    labelSpan.style.cssText = `color:#888;font-weight:600;`;
    const valueSpan = document.createElement('span');
    valueSpan.textContent = value;
    valueSpan.style.cssText = `color:${valueColor};font-weight:600;`;
    row.appendChild(labelSpan);
    row.appendChild(valueSpan);
    return row;
  }

  private makeSection(): HTMLDivElement {
    const s = document.createElement('div');
    s.style.cssText = 'padding:8px;';
    return s;
  }

  private escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private bar(label: string, value: number, max: number, color: string): string {
    const pct = Math.max(0, Math.min(100, (value / max) * 100));
    return `
      <div style="display:flex;align-items:center;">
        <span style="width:70px;font-size:22px;color:#888;">${label}</span>
        <div style="flex:1;height:8px;background:#222;margin:0 6px;">
          <div style="width:${Math.round(pct)}%;height:100%;background:${color};"></div>
        </div>
        <span style="width:60px;text-align:right;font-size:22px;">${Math.round(value)}/${max}</span>
      </div>
    `;
  }

  private addCloseButton() {
    const closeBtn = document.createElement('div');
    closeBtn.textContent = `[X] ${line('UIMISC041TEXT')}`;
    closeBtn.style.cssText = `
      text-align:center;padding:6px;cursor:pointer;color:${AMBER};
      border-top:1px solid #333;font-size:20px; /* Lua dosissemibold20 */
    `;
    closeBtn.addEventListener('click', () => {
      this.entity = null;
      this.el.style.display = 'none';
    });
    this.contentEl.appendChild(closeBtn);
  }

  dispose() {
    this.el.remove();
  }
}
