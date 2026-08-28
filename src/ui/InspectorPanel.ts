/**
 * InspectorPanel.ts — Detail panel for selected character/object/room.
 * Matches original CitizenInspector.lua, ObjectInspector.lua, ZoneInspector.lua.
 */

import type { Character } from '../characters/Character';
import type { EnvObject } from '../envobjects/EnvObject';
import { GameRules } from '../core/GameRules';
import { Door, DOOR_STATE, DOOR_OPERATION } from '../envobjects/Door';
import { BrigZone } from '../zones/BrigZone';
import type { Room } from '../rooms/Room';
import {
  JOB_NAMES, tJobs, STATUS_DEAD, CAUSE_OF_DEATH, MEMORY_SENT_TO_HOSPITAL, UNEMPLOYED,
} from '../characters/CharacterConstants';
import { ensureCharacterAppearance, getPortraitLayers } from '../characters/CharacterAppearance';
import { ZoneType, ZONE_LIST, ZONE_SPRITES } from '../world/ZoneType';

import { line } from '../localization/Localization';
import { getTopicName } from '../characters/Topics';
import { assetUrl } from '../assetUrl';

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
const AMBER_OPAQUE = '#3b2600';
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
type ObjectTab = 'stats' | 'action' | 'about';
type RoomTab = 'info' | 'rezone' | 'actions';

export class InspectorPanel {
  private el: HTMLDivElement;
  private contentEl!: HTMLDivElement;
  private entity: SelectedEntity = null;
  private currentTab: InspectorTab = 'duty';
  private objectTab: ObjectTab = 'action'; // Lua default: ObjectActionTab selected on show
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
  /** Dirty flag — when true, DOM will be rebuilt on next update(). */
  private dirty = true;
  private lastRebuildTime = 0;
  /** How often to rebuild DOM for live data refresh (ms). */
  private static REBUILD_INTERVAL = 500;

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
      position:absolute;left:0;top:81px;width:${PANEL_W}px;height:calc(100% - 81px);
      background:rgba(0,0,0,0.96);
      color:#ccc;font-family:'Dosis',sans-serif;font-size:20px;
      display:none;pointer-events:auto;z-index:16;overflow-y:auto;
    `;

    this.contentEl = document.createElement('div');
    this.el.appendChild(this.contentEl);

    parent.appendChild(this.el);
  }

  setEntity(entity: SelectedEntity) {
    this.entity = entity;
    // Lua CitizenInspector.setCitizen: smart tab defaults
    // Unemployed → duty tab, employed → action tab
    if (entity?.type === 'character') {
      const char = entity.data;
      if (char.tStats.nTeam === TEAM_ID_PLAYER) {
        this.currentTab = char.getJob() === UNEMPLOYED ? 'duty' : 'actions';
      } else {
        this.currentTab = 'stats'; // hostiles default to stats
      }
    } else {
      this.currentTab = 'duty';
    }
    this.objectTab = 'action'; // Lua: default tab is ObjectActionTab
    this.roomTab = 'rezone'; // Lua: clicking a room defaults to Rezone tab
    this.editingName = false;
    this.dirty = true;
    if (entity) {
      this.el.style.display = 'block';
    } else {
      this.el.style.display = 'none';
    }
  }

  /** Force an immediate DOM rebuild (used by internal event handlers). */
  private refresh() {
    this.dirty = true;
    this.update();
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

    // Throttle DOM rebuilds so click events can complete.
    // update() is called every frame but full DOM rebuild destroys/recreates elements,
    // preventing click events (mousedown target != mouseup target). Only rebuild when
    // dirty (user interaction) or every REBUILD_INTERVAL for live data refresh.
    const now = performance.now();
    if (!this.dirty && now - this.lastRebuildTime < InspectorPanel.REBUILD_INTERVAL) {
      return;
    }
    this.dirty = false;
    this.lastRebuildTime = now;

    this.contentEl.textContent = '';

    // InspectMenu occupies the first 81px. This title band brings the citizen
    // portrait to source y=163 without duplicating Back/Close controls.
    const inspLabel = document.createElement('div');
    inspLabel.textContent = `>> ${line('HUDHUD005TEXT')}`;
    inspLabel.style.cssText = `height:82px;display:flex;align-items:center;padding:0 12px;box-sizing:border-box;font-size:40px;font-weight:400;color:${AMBER};font-family:'Dosis',sans-serif;`;
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

  // ── Portraits ──────────────────────────────────────────

  /** Build the source portrait stack from UI/Portraits. */
  private buildCharacterPortrait(char: Character): HTMLDivElement {
    const wrapper = document.createElement('div');
    wrapper.dataset.testid = 'character-portrait';
    wrapper.title = 'Center Camera';
    wrapper.style.cssText = `position:absolute;left:30px;top:-19px;width:110px;height:124px;overflow:hidden;background:${AMBER};cursor:pointer;`;

    const bg = document.createElement('img');
    bg.src = assetUrl('assets/ui/portraits/Background_01.png');
    bg.alt = '';
    bg.style.cssText = 'position:absolute;inset:0;width:110px;height:126px;object-fit:cover;image-rendering:auto;';
    wrapper.appendChild(bg);

    const layers = getPortraitLayers(ensureCharacterAppearance(char.tStats));
    for (const [index, filename] of layers.entries()) {
      const portrait = document.createElement('img');
      portrait.src = assetUrl(`assets/ui/portraits/${filename}`);
      portrait.alt = index === 0 ? char.getRaceDef().sName : '';
      portrait.dataset.portraitLayer = index === 0 ? 'base' : filename.includes('_Hair_') ? 'hair' : 'facial-hair';
      portrait.style.cssText = `position:absolute;inset:0;width:110px;height:126px;object-fit:cover;image-rendering:auto;${char.isAlive() ? '' : 'filter:grayscale(1);opacity:0.65;'}`;
      wrapper.appendChild(portrait);
    }
    wrapper.addEventListener('click', () => this.onCenterCamera?.(char));

    return wrapper;
  }

  /** Build the original object portrait from UI/Portraits. */
  private buildObjectPortrait(obj: EnvObject): HTMLDivElement {
    const wrapper = document.createElement('div');
    wrapper.dataset.testid = 'object-portrait';
    wrapper.style.cssText = `position:absolute;left:30px;top:-19px;width:110px;height:124px;overflow:hidden;background:${AMBER};`;

    const portrait = document.createElement('img');
    const portraitName = obj.tData.portrait ?? 'portrait_generic';
    portrait.src = assetUrl(`assets/ui/portraits/${portraitName}.png`);
    portrait.alt = obj.tData.friendlyName;
    portrait.style.cssText = 'position:absolute;left:3px;top:1px;width:105px;height:120px;object-fit:contain;image-rendering:auto;';
    portrait.addEventListener('error', () => {
      if (!portrait.src.endsWith('/portrait_generic.png')) {
        portrait.src = assetUrl('assets/ui/portraits/portrait_generic.png');
      }
    });
    wrapper.appendChild(portrait);

    return wrapper;
  }

  // ── Character Inspector ─────────────────────────────────

  private renderCharacter(char: Character) {
    const isDead = !char.isAlive();
    const isPlayer = char.tStats.nTeam === 1; // TEAM_ID_PLAYER

    // Lua PictureLargeBG / NameEditBG: a single 418×106 amber summary band.
    const summary = document.createElement('div');
    summary.dataset.testid = 'character-summary';
    summary.style.cssText = `position:relative;width:${PANEL_W}px;height:106px;background:${AMBER};box-sizing:border-box;`;
    summary.appendChild(this.buildCharacterPortrait(char));

    if (this.editingName) {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = char.getName();
      input.style.cssText = `
        position:absolute;left:150px;top:8px;width:245px;height:35px;box-sizing:border-box;
        font-size:26px;font-weight:600;color:${AMBER};background:#000;
        border:1px solid #000;outline:none;font-family:'Dosis',sans-serif;padding:1px 4px;
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
      summary.appendChild(input);
      // Focus on next frame
      setTimeout(() => input.focus(), 0);
    } else {
      const nameSpan = document.createElement('span');
      nameSpan.textContent = char.getName();
      nameSpan.style.cssText = `position:absolute;left:150px;top:8px;max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:26px;line-height:35px;font-weight:600;color:#000;cursor:pointer;`;
      nameSpan.title = 'Click to edit name';
      nameSpan.addEventListener('click', () => {
        this.editingName = true;
        this.refresh();
      });
      summary.appendChild(nameSpan);
    }

    const jobLine = document.createElement('div');
    const dutyStr = char.isAlive() && char.onDuty() ? ` ${line('DUTIES015TEXT')}` : '';
    jobLine.textContent = `${char.getJobName()}${dutyStr}`;
    jobLine.style.cssText = `position:absolute;left:150px;top:50px;max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:26px;line-height:35px;color:#000;font-weight:400;`;
    summary.appendChild(jobLine);
    this.contentEl.appendChild(summary);

    // Lua StatsBG: four 36px source rows with the original inspector icons.
    const infoSection = document.createElement('div');
    infoSection.dataset.testid = 'character-stats-summary';
    infoSection.style.cssText = `height:152px;background:${AMBER_OPAQUE};padding:4px 0;box-sizing:border-box;`;

    infoSection.appendChild(this.makeCharacterInfoRow(
      'ui_icon_health.png',
      line('INSPEC011TEXT'),
      getHealthStatusText(char),
      isDead ? '#ff3d00' : AMBER,
      () => { this.currentTab = 'stats'; this.refresh(); },
    ));

    if (isDead) {
      infoSection.appendChild(this.makeCharacterInfoRow(
        'ui_icon_enemy.png',
        line('INSPEC106TEXT'),
        getDeathCauseName(char.nCauseOfDeath),
        '#ff3d00',
        () => { this.currentTab = 'stats'; this.refresh(); },
      ));
    } else {
      infoSection.appendChild(this.makeCharacterInfoRow(
        'ui_icon_morale.png',
        line('INSPEC012TEXT'),
        getMoraleText(char.nMorale),
        AMBER,
        () => { this.currentTab = 'psych'; this.refresh(); },
      ));
    }

    let locationText = line('INSPUI036TEXT');
    let characterRoom: Room | null = null;
    if (!char.bSpacewalking) {
      characterRoom = this.getRoomForChar?.(char) ?? null;
      if (characterRoom?.uniqueZoneName) locationText = characterRoom.uniqueZoneName;
      else if (characterRoom) locationText = `Room ${characterRoom.id}`;
      else locationText = `(${char.tileX}, ${char.tileY})`;
    }
    infoSection.appendChild(this.makeCharacterInfoRow(
      'ui_icon_location.png',
      line('INSPEC013TEXT'),
      locationText,
      AMBER,
      () => { if (characterRoom && this.onSelectRoom) this.onSelectRoom(characterRoom); },
    ));

    const taskName = char.currentTask?.name ?? (isDead ? line('INSPEC010TEXT') : line('UITASK029TEXT'));
    infoSection.appendChild(this.makeCharacterInfoRow(
      'ui_icon_bulletpoint.png',
      line('INSPEC014TEXT'),
      taskName,
      AMBER,
      () => { this.currentTab = 'actions'; this.refresh(); },
    ));
    this.contentEl.appendChild(infoSection);

    // Tab row
    const tabRow = document.createElement('div');
    tabRow.style.cssText = `
      width:${PANEL_W}px;height:50px;display:flex;align-items:flex-start;
      box-sizing:border-box;background:${AMBER_OPAQUE};border-bottom:3px solid ${AMBER};
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
    const charTabIcons: Record<string, string> = {
      duty: assetUrl('assets/ui/inspector/ui_icon_duty.png'),
      stats: assetUrl('assets/ui/inspector/ui_icon_stats.png'),
      psych: assetUrl('assets/ui/inspector/ui_icon_psych.png'),
      log: assetUrl('assets/ui/inspector/ui_icon_spaceface.png'),
      // CitizenInspector.lua deliberately reuses the duty icon for Action.
      actions: assetUrl('assets/ui/inspector/ui_icon_duty.png'),
    };
    const charTabCount = tabs.length;
    const charFolderActive = charTabCount >= 5
      ? 'assets/ui/inspector/ui_inspector_folderActive_5wide.png'
      : 'assets/ui/inspector/ui_inspector_folderActive.png';
    const charFolderInactive = charTabCount >= 5
      ? 'assets/ui/inspector/ui_inspector_folderInactive_5wide.png'
      : 'assets/ui/inspector/ui_inspector_folderInactive.png';
    for (const t of tabs) {
      const btn = document.createElement('div');
      const isActive = this.currentTab === t.tab;
      const iconSrc = charTabIcons[t.tab];
      btn.title = t.label;
      btn.dataset.tab = t.tab;
      btn.style.cssText = `
        width:83px;height:47px;box-sizing:border-box;cursor:pointer;
        display:flex;align-items:center;justify-content:center;
        background-image:url('${isActive ? charFolderActive : charFolderInactive}');
        background-size:100% 100%;background-repeat:no-repeat;
      `;
      if (iconSrc) {
        const img = document.createElement('img');
        img.src = iconSrc;
        img.alt = t.label;
        img.style.cssText = `width:28px;height:28px;object-fit:contain;image-rendering:auto;${isActive ? 'filter:brightness(0);' : 'filter:brightness(0) saturate(100%) invert(55%) sepia(72%) saturate(1273%) hue-rotate(18deg) brightness(90%) contrast(177%);'}`;
        btn.appendChild(img);
      }
      btn.addEventListener('click', () => {
        this.currentTab = t.tab;
        this.refresh();
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

  }

  private renderDutyTab(container: HTMLDivElement, char: Character) {
    // Lua CitizenDutyTab tJobOptions: UNEMPLOYED first, then all jobs
    for (const jobId of [UNEMPLOYED, ...tJobs]) {
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
        this.refresh();
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
    const appendStat = (text: string, style = 'margin-bottom:4px;') => {
      const row = document.createElement('div');
      row.style.cssText = style;
      row.textContent = text;
      statsDiv.appendChild(row);
    };
    appendStat(`${line('INSPUI007TEXT')} ${char.tStats.nXP}`);
    appendStat(`${line('INSPUI008TEXT')} ${char.nAnger}`);
    // Join Date (Lua CitizenStatsTab: INSPEC124TEXT)
    const joinDate = GameRules.getFullStarDateString(char.nJoinTime);
    appendStat(`${line('INSPEC124TEXT')} ${joinDate}`);
    // Illness (Lua CitizenStatsTab: INSPEC146TEXT if none)
    const maladies = char.maladies ?? [];
    if (maladies.length > 0) {
      appendStat(
        maladies.map(m => m.sFriendlyName ?? m.sMaladyName).join(', '),
        'margin-bottom:4px;color:#f84;',
      );
    } else {
      appendStat(line('INSPEC146TEXT'));
    }
    // Inventory (Lua INSPEC087TEXT)
    const invItems = char.inventory.getAll();
    const invStr = invItems.length > 0 ? invItems.map(i => `${i.sName}${i.nCount > 1 ? ` x${i.nCount}` : ''}`).join(', ') : line('INSPUI010TEXT');
    appendStat(`${line('INSPEC087TEXT')} ${invStr}`);
    // Favorites (Lua INSPEC117TEXT, INSPEC049TEXT, INSPEC050TEXT)
    const favHobby = char.getFavorite('Activities');
    const favFood = char.getFavorite('Foods');
    const favBand = char.getFavorite('Bands');
    if (favHobby) appendStat(`${line('INSPEC117TEXT')} ${getTopicName(favHobby)}`);
    if (favFood) appendStat(`${line('INSPEC049TEXT')} ${getTopicName(favFood)}`);
    if (favBand) appendStat(`${line('INSPEC050TEXT')} ${getTopicName(favBand)}`);
    // Friends (Lua INSPEC047TEXT — top 4 people with positive affinity, comma-separated names)
    const friends = char.getPeopleOfAffinity(5, true).sort((a, b) => b.nAffinity - a.nAffinity).slice(0, 4);
    const friendStr = friends.length > 0
      ? friends.map(f => getTopicName(f.sID)).join(', ')
      : line('INSPEC082TEXT');
    appendStat(`${line('INSPEC047TEXT')} ${friendStr}`, 'margin-bottom:2px;');
    // Enemies (Lua INSPEC048TEXT — top 4 people with negative affinity, comma-separated names)
    const enemies = char.getPeopleOfAffinity(-5, false).sort((a, b) => a.nAffinity - b.nAffinity).slice(0, 4);
    const enemyStr = enemies.length > 0
      ? enemies.map(e => getTopicName(e.sID)).join(', ')
      : line('INSPEC082TEXT');
    appendStat(`${line('INSPEC048TEXT')} ${enemyStr}`, 'margin-bottom:2px;');
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
    const isPlayer = char.tStats.nTeam === TEAM_ID_PLAYER;

    // 1. Assign Residence (Lua CitizenActionTab button 1: bed assignment)
    const bedLabel = line('INSPEC160TEXT');
    const bedBtn = this.makeActionButton(
      bedLabel,
      isDead || !isPlayer,
      () => { /* bed assignment requires MODE_PICK — not yet wired */ },
    );
    container.appendChild(bedBtn);

    // 2. Send to Hospital / Cancel (Lua CitizenActionTab button 3: MEMORY_SENT_TO_HOSPITAL toggle)
    const isHospitalized = !!char.retrieveMemory(MEMORY_SENT_TO_HOSPITAL);
    const hospBtn = this.makeActionButton(
      isHospitalized ? line('INSPEC148TEXT') : line('INSPEC147TEXT'),
      isDead || !isPlayer,
      () => {
        if (isHospitalized) {
          char.clearMemory(MEMORY_SENT_TO_HOSPITAL);
        } else {
          char.storeMemory(MEMORY_SENT_TO_HOSPITAL, true, 9999999);
        }
      },
      isHospitalized ? AMBER : AMBER,
    );
    if (isHospitalized) hospBtn.style.borderColor = hospBtn.style.color = '#4f4'; // selected state
    container.appendChild(hospBtn);

    // 3. Cuff / Uncuff (Lua CitizenActionTab button 4)
    const cuffLabel = char.isMarkedForCuff() ? line('INSPEC194TEXT') : line('INSPEC193TEXT');
    const canCuff = !isDead && char.canBeCuffed();
    const cuffBtn = this.makeActionButton(
      cuffLabel,
      !canCuff && !char.bCuffed && !char.isMarkedForCuff(),
      () => {
        char.setMarkedForCuff(!char.bCuffed && !char.isMarkedForCuff());
      },
    );
    if (char.isMarkedForCuff()) cuffBtn.style.borderColor = cuffBtn.style.color = '#4f4'; // selected
    container.appendChild(cuffBtn);

    // 4. Execute / Cancel (Lua CitizenActionTab button 5: bMarkedForExecution toggle)
    // U-4: Lua requires character to be cuffed before execution
    const isMarkedExec = char.bMarkedForExecution;
    const isCuffed = char.bCuffed ?? false;
    const execBtn = this.makeActionButton(
      isMarkedExec ? line('INSPEC198TEXT') : line('INSPEC195TEXT'),
      isDead || !isPlayer || !isCuffed,
      () => {
        char.bMarkedForExecution = !char.bMarkedForExecution;
      },
      '#f44',
    );
    if (isMarkedExec) execBtn.style.borderColor = execBtn.style.color = '#ff0'; // selected
    container.appendChild(execBtn);

    // 5. Assign to Brig (Lua CitizenActionTab button 6)
    const isMonsterOrBot = char.tStats.nRace === 3 || char.tStats.nRace === 4; // MONSTER/KILLBOT
    const brigBtn = this.makeActionButton(
      line('INSPEC160TEXT'), // "Unassigned" placeholder — full brig assignment needs MODE_PICK
      isDead || isMonsterOrBot,
      () => { /* brig assignment requires MODE_PICK — not yet wired */ },
    );
    container.appendChild(brigBtn);
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
      btn.addEventListener('click', () => { onClick(); this.refresh(); });
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
      case DOOR_STATE.LOCKED:
        // Distinguish vacuum-locked from user-locked (Lua PROPSX052 vs PROPSX059)
        if (door.bTouchesVacuum && door.bEastSideVacuum !== door.bWestSideVacuum && door.operation !== DOOR_OPERATION.LOCKED) {
          return `<span style="color:#f44;">${line('PROPSX052TEXT')}</span>`;
        }
        return `<span style="color:#f44;">${line('PROPSX059TEXT')}</span>`;
      case DOOR_STATE.BROKEN_OPEN: return `<span style="color:#f44;">${line('PROPSX053TEXT')}</span>`;
      case DOOR_STATE.BROKEN_CLOSED: return `<span style="color:#f44;">${line('PROPSX054TEXT')}</span>`;
      default: return line('INSPEC103TEXT');
    }
  }

  private getDoorOperationLabel(door: Door): string {
    switch (door.operation) {
      case DOOR_OPERATION.NORMAL: return 'Normal';
      case DOOR_OPERATION.LOCKED: return 'Locked';
      case DOOR_OPERATION.FORCED_OPEN: return 'Forced Open';
      default: return 'Normal';
    }
  }

  private renderObject(obj: EnvObject) {
    const condStr = obj.getConditionUIString();
    const emergencyStr = obj.getEmergencyString();
    // Lua EnvObject.tConditionColors, evaluated from broadest to narrowest.
    const conditionColor = obj.nCondition < 1 ? '#b30000'
      : obj.nCondition < 25 ? '#994000'
      : obj.nCondition < 50 ? '#b38000'
      : obj.nCondition < 75 ? '#668000'
      : '#009900';

    // Lua ObjectInspectorLayout: 418×106 amber summary band, portrait at
    // (33, -145), name at (145, -174), and condition strip at (140, -218).
    const summary = document.createElement('div');
    summary.dataset.testid = 'object-summary';
    summary.style.cssText = `position:relative;width:${PANEL_W}px;height:106px;background:${AMBER};box-sizing:border-box;`;
    summary.appendChild(this.buildObjectPortrait(obj));

    const name = document.createElement('div');
    name.textContent = obj.tData.friendlyName;
    name.style.cssText = 'position:absolute;left:145px;top:8px;width:268px;height:35px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:26px;line-height:35px;font-weight:600;color:#000;';
    summary.appendChild(name);

    const condition = document.createElement('div');
    condition.dataset.testid = 'object-condition';
    condition.style.cssText = `position:absolute;left:140px;top:55px;width:273px;height:30px;box-sizing:border-box;background:${conditionColor};color:#000;display:flex;align-items:center;padding-left:5px;overflow:hidden;`;
    const conditionLabel = document.createElement('span');
    conditionLabel.textContent = `${line('INSPEC054TEXT')} `;
    conditionLabel.style.cssText = 'font-size:24px;line-height:30px;font-weight:600;white-space:nowrap;';
    const conditionValue = document.createElement('span');
    conditionValue.textContent = `${condStr} (${Math.floor(obj.nCondition)}%)`;
    conditionValue.style.cssText = 'font-size:24px;line-height:30px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
    condition.append(conditionLabel, conditionValue);
    summary.appendChild(condition);

    if (emergencyStr) {
      const emergency = document.createElement('div');
      emergency.dataset.testid = 'object-emergency';
      emergency.textContent = emergencyStr;
      emergency.style.cssText = 'position:absolute;left:140px;top:-30px;width:278px;height:30px;box-sizing:border-box;background:#f00;color:#fff;font-size:24px;line-height:30px;font-weight:600;padding-left:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      summary.appendChild(emergency);
    }
    this.contentEl.appendChild(summary);

    // Lua StatsBG: fixed 152px description field before the folder tabs.
    const info = document.createElement('div');
    info.dataset.testid = 'object-info-summary';
    info.style.cssText = `position:relative;width:${PANEL_W}px;height:152px;background:${AMBER_OPAQUE};box-sizing:border-box;color:${AMBER};overflow:hidden;`;
    const description = document.createElement('div');
    description.textContent = obj.tData.description ?? '';
    description.style.cssText = 'position:absolute;left:20px;top:8px;width:380px;max-height:64px;overflow:hidden;font-size:26px;line-height:30px;font-weight:600;';
    info.appendChild(description);
    if (obj instanceof Door) {
      const doorStatus = document.createElement('div');
      doorStatus.style.cssText = 'position:absolute;left:16px;top:82px;width:386px;height:36px;display:flex;align-items:center;overflow:hidden;font-size:26px;line-height:32px;';
      const doorLabel = document.createElement('span');
      doorLabel.textContent = `${line('PROPSX055TEXT')} `;
      doorLabel.style.fontWeight = '400';
      const doorValue = document.createElement('span');
      doorValue.innerHTML = this.getDoorStatusText(obj);
      doorValue.style.cssText = 'font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
      doorStatus.append(doorLabel, doorValue);
      info.appendChild(doorStatus);
    }
    this.contentEl.appendChild(info);

    // ── Tab bar: Stats | Action | About (Lua ObjectInspector 3 tabs) ──
    const tabRow = document.createElement('div');
    tabRow.dataset.testid = 'object-tabs';
    tabRow.style.cssText = `width:${PANEL_W}px;height:50px;display:flex;align-items:flex-start;box-sizing:border-box;background:${AMBER_OPAQUE};border-bottom:3px solid ${AMBER};`;
    const objTabs: { key: ObjectTab; label: string }[] = [
      { key: 'stats', label: line('INSPEC017TEXT') || 'Stats' },
      { key: 'action', label: line('INSPUI005TEXT') || 'Action' },
      { key: 'about', label: line('INSPUI004TEXT') || 'About' },
    ];
    const objTabIcons: Record<string, string> = {
      stats: 'assets/ui/inspector/ui_icon_stats.png',
      action: 'assets/ui/inspector/ui_icon_activity.png',
      about: 'assets/ui/inspector/ui_icon_about.png',
    };
    for (const t of objTabs) {
      const btn = document.createElement('div');
      const isActive = this.objectTab === t.key;
      const iconSrc = objTabIcons[t.key];
      btn.dataset.objectTab = t.key;
      btn.title = t.label;
      btn.style.cssText = `
        width:83px;height:47px;box-sizing:border-box;cursor:pointer;
        display:flex;align-items:center;justify-content:center;
        background-image:url('${isActive ? 'assets/ui/inspector/ui_inspector_folderActive.png' : 'assets/ui/inspector/ui_inspector_folderInactive.png'}');
        background-size:100% 100%;background-repeat:no-repeat;
      `;
      if (iconSrc) {
        const img = document.createElement('img');
        img.src = iconSrc;
        img.alt = t.label;
        img.style.cssText = `width:28px;height:28px;object-fit:contain;image-rendering:auto;${isActive ? 'filter:brightness(0);' : 'filter:brightness(0) saturate(100%) invert(55%) sepia(72%) saturate(1273%) hue-rotate(18deg) brightness(90%) contrast(177%);'}`;
        btn.appendChild(img);
      }
      btn.addEventListener('click', () => { this.objectTab = t.key; this.refresh(); });
      tabRow.appendChild(btn);
    }
    this.contentEl.appendChild(tabRow);

    // ── Tab content ──
    const body = this.makeSection();
    switch (this.objectTab) {
      case 'stats': this.renderObjectStatsTab(body, obj); break;
      case 'action': this.renderObjectActionTab(body, obj); break;
      case 'about': this.renderObjectAboutTab(body, obj); break;
    }
    this.contentEl.appendChild(body);
  }

  /** Object Stats tab — power, oxygen, condition details. */
  private renderObjectStatsTab(container: HTMLDivElement, obj: EnvObject) {
    const status = obj.isFunctioning() ? line('INSPEC089TEXT') : obj.isDestroyed() ? line('INSPEC053TEXT') : line('INSPEC091TEXT');
    const statusColor = obj.isDestroyed() ? '#f44' :
      obj.isDamaged() ? '#ff0' :
      obj.isFunctioning() ? '#4f4' : '#888';

    let html = `<div style="margin-bottom:4px;">${line('INSPEC093TEXT')} <span style="color:${statusColor};">${status}</span></div>`;

    if (obj.tData.nPowerOutput > 0) {
      html += `<div style="margin-bottom:4px;">${line('INSPEC165TEXT')} ${obj.getPowerOutput()}</div>`;
    }
    if (obj.tData.nPowerDraw > 0) {
      html += `<div style="margin-bottom:4px;">${line('INSPEC164TEXT')} ${obj.getPowerDraw()}</div>`;
    }
    if (obj.tData.oxygenLevel > 0) {
      html += `<div style="margin-bottom:4px;">${line('INSPEC059TEXT')} ${obj.getOxygenOutput()}</div>`;
    }
    html += `<div style="margin-bottom:4px;">${line('INSPUI015TEXT')} (${obj.tileX}, ${obj.tileY})</div>`;

    container.innerHTML = html;
  }

  /** Object Action tab — demolish, deactivate, door controls (Lua ObjectActionTab). */
  private renderObjectActionTab(container: HTMLDivElement, obj: EnvObject) {
    // 1. Demolish / Cancel Demolish button (Lua ObjectActionTab button 1)
    if (obj.bBuilt) {
      if (obj.bSlatedForVaporize) {
        // Cancel Demolish — object is already slated for teardown
        const cancelBtn = this.makeActionButton(
          'Cancel Demolish',
          false,
          () => { obj.bSlatedForVaporize = false; },
          AMBER,
        );
        container.appendChild(cancelBtn);
      } else {
        // Demolish with matter refund
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
        container.appendChild(demolishBtn);
      }
    }

    // 2. Deactivate toggle (Lua ObjectActionTab button 3: INSPEC171/172)
    if (obj.tData.bCanDeactivate) {
      const deactivateBtn = this.makeActionButton(
        obj.bActive ? line('INSPEC171TEXT') : line('INSPEC172TEXT'),
        false,
        () => { obj.bActive = !obj.bActive; },
      );
      container.appendChild(deactivateBtn);
    }

    // 3. Door controls — Lock / Unlock / Normal buttons (Lua DoorControls custom inspector)
    if (obj instanceof Door) {
      const door = obj as Door;
      const doorSection = document.createElement('div');
      doorSection.style.cssText = `margin-top:6px;padding:6px 0;border-top:1px solid #333;`;

      const label = document.createElement('div');
      label.style.cssText = `margin-bottom:6px;color:${AMBER};font-size:20px;`;
      label.textContent = line('PROPSX058TEXT') + ' ' + this.getDoorOperationLabel(door);
      doorSection.appendChild(label);

      const btnRow = document.createElement('div');
      btnRow.style.cssText = 'display:flex;gap:6px;';

      const lockBtn = this.makeActionButton(
        'Lock',
        door.operation === DOOR_OPERATION.LOCKED,
        () => { door.setOperation(DOOR_OPERATION.LOCKED); },
      );
      btnRow.appendChild(lockBtn);

      const unlockBtn = this.makeActionButton(
        'Unlock',
        door.operation === DOOR_OPERATION.FORCED_OPEN,
        () => { door.setOperation(DOOR_OPERATION.FORCED_OPEN); },
      );
      btnRow.appendChild(unlockBtn);

      const normalBtn = this.makeActionButton(
        'Normal',
        door.operation === DOOR_OPERATION.NORMAL,
        () => { door.setOperation(DOOR_OPERATION.NORMAL); },
      );
      btnRow.appendChild(normalBtn);

      doorSection.appendChild(btnRow);
      container.appendChild(doorSection);
    }

    // 4. Brig bed — Release Prisoner button (Lua ObjectActionTab: brig bed controls)
    if (obj.sName === 'Bed' && obj.rRoom && obj.rRoom.zone === ZoneType.BRIG) {
      const brigZone = BrigZone.findBrigForRoom(obj.rRoom);
      if (brigZone) {
        const prisoners = brigZone.getPrisoners();
        if (prisoners.length > 0) {
          const brigSection = document.createElement('div');
          brigSection.style.cssText = `margin-top:6px;padding:6px 0;border-top:1px solid #333;`;

          for (const charId of prisoners) {
            const releaseBtn = this.makeActionButton(
              `Release Prisoner #${charId}`,
              false,
              () => { brigZone.unassignChar(charId); },
            );
            brigSection.appendChild(releaseBtn);
          }
          container.appendChild(brigSection);
        }
      }
    }
  }

  /** Object About tab — description, builder info (Lua ObjectAboutTab). */
  private renderObjectAboutTab(container: HTMLDivElement, obj: EnvObject) {
    const appendAboutRow = (text: string, style: string) => {
      const row = document.createElement('div');
      row.style.cssText = style;
      row.textContent = text;
      container.appendChild(row);
    };
    // Description (Lua ObjectInspector: rObject:getDescription())
    const desc = obj.tData.description ?? '';
    if (desc) {
      appendAboutRow(desc, 'margin-bottom:8px;color:#ccc;font-size:20px;');
    }
    // Builder name (Lua INSPEC111TEXT)
    if (obj.sBuilderName) {
      appendAboutRow(`${line('INSPEC111TEXT')} ${obj.sBuilderName}`, 'margin-bottom:4px;');
    }
    // Build time (Lua INSPEC110TEXT)
    if (obj.sBuildTime) {
      appendAboutRow(`${line('INSPEC110TEXT')} ${obj.sBuildTime}`, 'margin-bottom:4px;');
    }
  }

  // ── Room Inspector ──────────────────────────────────────

  private renderRoom(room: Room) {
    const zoneName = ZONE_SPRITES[room.zone]?.name ?? 'Unknown';

    // Room header — amber bar with zone icon + black text (Lua ZoneInspector header)
    const displayName = room.uniqueZoneName
      ? room.uniqueZoneName
      : `${zoneName} Room #${room.id}`;
    // Map zone type to icon filename
    const zoneIconMap: Record<string, string> = {
      PLAIN: 'generic', GARDEN: 'garden', INFIRMARY: 'infirmary',
      LIFESUPPORT: 'lifesupport', RESIDENCE: 'residence', PUB: 'pub',
      POWER: 'reactor', AIRLOCK: 'airlock', REFINERY: 'refinery',
      FITNESS: 'fitness', RESEARCH: 'research', BRIG: 'generic',
    };
    const iconKey = zoneIconMap[room.zone] ?? 'generic';
    const header = document.createElement('div');
    header.style.cssText = `
      background:${AMBER};padding:8px 10px;display:flex;align-items:center;gap:8px;
    `;
    const iconImg = document.createElement('img');
    iconImg.src = `assets/ui/icons/ui_iconIso_${iconKey}.png`;
    iconImg.style.cssText = 'width:32px;height:32px;image-rendering:pixelated;flex-shrink:0;';
    header.appendChild(iconImg);
    const titleDiv = document.createElement('div');
    titleDiv.style.cssText = 'font-size:24px;font-weight:bold;color:#000;';
    titleDiv.textContent = displayName;
    if (room.uniqueZoneName) {
      const subSpan = document.createElement('span');
      subSpan.style.cssText = 'color:#333;font-size:18px;';
      subSpan.textContent = ` (${zoneName} #${room.id})`;
      titleDiv.appendChild(subSpan);
    }
    header.appendChild(titleDiv);
    this.contentEl.appendChild(header);

    // Tabs: Info | Rezone | Actions (Lua: ZoneInspector has folder tabs)
    const tabBar = document.createElement('div');
    tabBar.style.cssText = 'display:flex;padding:0 8px;margin-bottom:6px;gap:2px;';
    const roomTabs: { key: RoomTab; label: string }[] = [
      { key: 'info', label: line('INSPEC055TEXT').replace(':', '').trim() || 'Info' },
      { key: 'rezone', label: line('ZONEUI005TEXT').replace(':', '').trim() || 'Rezone' },
      { key: 'actions', label: line('INSPEC093TEXT').replace(':', '').trim() || 'Actions' },
    ];
    const roomTabIcons: Record<string, string> = {
      info: 'assets/ui/inspector/ui_icon_room_satisfaction.png',
      rezone: 'assets/ui/inspector/ui_icon_zoning.png',
      actions: 'assets/ui/inspector/ui_icon_activity.png',
    };
    for (const tab of roomTabs) {
      const active = this.roomTab === tab.key;
      const tabEl = document.createElement('div');
      const iconSrc = roomTabIcons[tab.key];
      tabEl.style.cssText = `
        flex:1;text-align:center;padding:4px 0;cursor:pointer;font-size:20px; /* Lua dosissemibold20 */
        display:flex;align-items:center;justify-content:center;
        background-image:url('${active ? 'assets/ui/inspector/ui_inspector_folderActive.png' : 'assets/ui/inspector/ui_inspector_folderInactive.png'}');
        background-size:100% 100%;background-repeat:no-repeat;
        color:${active ? '#000' : AMBER};
      `;
      if (iconSrc) {
        const img = document.createElement('img');
        img.src = iconSrc;
        img.style.cssText = 'width:20px;height:20px;margin-right:4px;vertical-align:middle;image-rendering:pixelated;';
        tabEl.appendChild(img);
      }
      const span = document.createElement('span');
      span.textContent = tab.label;
      tabEl.appendChild(span);
      tabEl.addEventListener('click', () => { this.roomTab = tab.key; this.refresh(); });
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
    const charCount = room.tCharacters.size;
    const citizenLabel = charCount === 1 ? line('INSPEC063TEXT') : line('INSPEC061TEXT');
    const moraleScore = room.nMoraleScore;
    const section = this.makeSection();
    section.style.cssText = 'padding:8px;background:rgba(0,0,0,0.6);margin:4px 8px;border-radius:2px;';
    let html = `
      <div style="margin-bottom:4px;">${line('INSPEC055TEXT')} ${room.size} ${line('INSPEC057TEXT')}</div>
      <div style="margin-bottom:4px;">${line('INSPEC060TEXT')} <span style="color:#fff;">${charCount}</span> ${citizenLabel}</div>
      <div style="margin-bottom:6px;">
        ${this.bar(line('INSPEC062TEXT'), room.oxygen, 255, room.oxygen < 50 ? '#f44' : '#48f')}
      </div>
      <div style="margin-bottom:4px;">
        <span style="color:${room.bUserBlockOxygen ? '#4f4' : '#f44'};">${room.bUserBlockOxygen ? line('INSPEC153TEXT') : line('INSPEC152TEXT')}</span>
      </div>
      <div style="margin-bottom:4px;">
        ${line('INSPEC167TEXT')} <span style="color:#4f4;">+${room.nPowerOutput}</span> / ${line('INSPEC163TEXT')} <span style="color:#f44;">-${room.nPowerDraw}</span>
      </div>
      <div style="margin-bottom:4px;">${line('INSPEC056TEXT')} ${objCount}</div>
      <div style="margin-bottom:4px;">${line('INSPEC012TEXT')} <span style="color:${moraleScore > 0 ? '#4f4' : moraleScore < 0 ? '#f44' : '#aaa'};">${moraleScore > 0 ? '+' : ''}${moraleScore}</span></div>
    `;
    if (room.bBurning) {
      html += `<div style="margin-bottom:4px;color:#f84;">${line('INSPEC078TEXT')} (${room.nFireTiles})</div>`;
    }
    section.innerHTML = html;
    this.contentEl.appendChild(section);
  }

  /** Room Rezone tab — scrollable zone list (Lua ZoneRezoneTab + ZoneRezoneButton). */
  private renderRoomRezone(room: Room) {
    const section = this.makeSection();
    section.style.cssText = 'padding:4px 8px;max-height:400px;overflow-y:auto;';

    // Zone icon mapping
    const ZONE_ICONS: Record<string, string> = {
      AIRLOCK: 'airlock', LIFESUPPORT: 'lifesupport', POWER: 'reactor',
      REFINERY: 'refinery', RESIDENCE: 'residence', PUB: 'pub',
      GARDEN: 'garden', FITNESS: 'fitness', RESEARCH: 'research',
      INFIRMARY: 'infirmary', BRIG: 'generic', PLAIN: 'generic',
    };

    // Lua ZoneRezoneTab: scrollable list of ZoneRezoneButtons
    for (const zone of ZONE_LIST) {
      const config = ZONE_SPRITES[zone];
      if (!config) continue;
      const isActive = room.zone === zone;
      const zoneName = ZoneType[zone] ?? 'PLAIN';

      const btn = document.createElement('div');
      btn.style.cssText = `
        display:flex;align-items:center;gap:8px;
        padding:8px 10px;margin-bottom:2px;cursor:pointer;
        background:${isActive ? AMBER : 'rgba(40,35,25,0.9)'};
        border:1px solid ${isActive ? AMBER : '#555'};
      `;

      // Zone icon
      const iconFile = ZONE_ICONS[zoneName] ?? 'generic';
      const icon = document.createElement('img');
      icon.src = `assets/ui/icons/ui_iconIso_${iconFile}.png`;
      icon.style.cssText = `width:28px;height:28px;object-fit:contain;flex-shrink:0;${isActive ? 'filter:brightness(0);' : 'filter:brightness(0) saturate(100%) invert(55%) sepia(72%) saturate(1273%) hue-rotate(18deg) brightness(90%) contrast(177%);'}`;
      btn.appendChild(icon);

      // Name + description
      const textWrap = document.createElement('div');
      textWrap.style.cssText = 'flex:1;';
      const nameEl = document.createElement('div');
      nameEl.textContent = config.name;
      nameEl.style.cssText = `font-size:22px;font-family:'Dosis',sans-serif;font-weight:600;color:${isActive ? '#000' : AMBER};`;
      textWrap.appendChild(nameEl);

      // Zone is "Unzoned" for PLAIN
      if (zone === ZoneType.PLAIN) {
        nameEl.textContent = line('ZONEUI005TEXT') || 'Unzoned';
      }

      btn.appendChild(textWrap);

      if (!isActive) {
        btn.addEventListener('click', () => {
          if (this.onRezoneRoom) this.onRezoneRoom(room, zone);
          this.refresh();
        });
        btn.addEventListener('mouseenter', () => {
          btn.style.background = 'rgba(223,162,0,0.2)';
        });
        btn.addEventListener('mouseleave', () => {
          btn.style.background = 'rgba(40,35,25,0.9)';
        });
      }
      section.appendChild(btn);
    }
    this.contentEl.appendChild(section);
  }

  /** Room Actions tab — claim/unclaim, seal/unseal (Lua ZoneActionTab). */
  private renderRoomActions(room: Room) {
    const section = this.makeSection();
    section.style.cssText = 'padding:8px;background:rgba(0,0,0,0.6);margin:4px 8px;border-radius:2px;';
    const isPlayer = room.nTeam === TEAM_ID_PLAYER;

    // Claim / Unclaim button (Lua ZoneActionTab.claimButtonPressed)
    const claimLabel = isPlayer ? line('ZONEUI112TEXT') || 'Unclaim' : line('ZONEUI111TEXT') || 'Claim';
    const claimBtn = this.makeActionButton(claimLabel, false, () => {
      if (isPlayer) { room.unclaim(); } else { room.claim(); }
      this.refresh();
    });
    section.appendChild(claimBtn);

    // Seal / Unseal oxygen button (Lua ZoneActionTab.sealButtonPressed)
    const isSealed = room.bUserBlockOxygen;
    const sealLabel = isSealed ? (line('ZONEUI072TEXT') || 'Unseal Oxygen') : (line('ZONEUI071TEXT') || 'Seal Oxygen');
    const sealBtn = this.makeActionButton(sealLabel, false, () => {
      room.bUserBlockOxygen = !room.bUserBlockOxygen;
      this.refresh();
    });
    section.appendChild(sealBtn);

    this.contentEl.appendChild(section);
  }

  // ── Helpers ─────────────────────────────────────────────

  private makeCharacterInfoRow(
    iconName: string,
    label: string,
    value: string,
    valueColor: string,
    onClick: () => void,
  ): HTMLDivElement {
    const row = document.createElement('div');
    row.style.cssText = `height:36px;display:flex;align-items:center;box-sizing:border-box;padding:0 10px;cursor:pointer;color:${AMBER};font-family:'Dosis',sans-serif;overflow:hidden;`;

    const icon = document.createElement('img');
    icon.src = assetUrl(`assets/ui/inspector/${iconName}`);
    icon.alt = '';
    icon.style.cssText = 'width:24px;height:24px;object-fit:contain;margin-right:6px;flex:0 0 24px;filter:brightness(0) saturate(100%) invert(55%) sepia(72%) saturate(1273%) hue-rotate(18deg) brightness(90%) contrast(177%);';
    row.appendChild(icon);

    const labelSpan = document.createElement('span');
    labelSpan.textContent = `${label} `;
    labelSpan.style.cssText = 'font-size:26px;line-height:32px;font-weight:400;white-space:nowrap;';
    row.appendChild(labelSpan);

    const valueSpan = document.createElement('span');
    valueSpan.textContent = value;
    valueSpan.style.cssText = `font-size:26px;line-height:32px;font-weight:600;color:${valueColor};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;`;
    row.appendChild(valueSpan);

    row.addEventListener('click', onClick);
    row.addEventListener('mouseenter', () => { row.style.background = 'rgba(223,162,0,0.12)'; });
    row.addEventListener('mouseleave', () => { row.style.background = 'transparent'; });
    return row;
  }

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
