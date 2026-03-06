/**
 * InspectorPanel.ts — Detail panel for selected character/object/room.
 * Matches original CitizenInspector.lua, ObjectInspector.lua, ZoneInspector.lua.
 */

import type { Character } from '../characters/Character';
import type { EnvObject } from '../envobjects/EnvObject';
import { Door, DOOR_STATE } from '../envobjects/Door';
import type { Room } from '../rooms/Room';
import { JOB_NAMES, tJobs, STATUS_DEAD, CAUSE_OF_DEATH } from '../characters/CharacterConstants';
import { ZONE_SPRITES } from '../world/ZoneType';
import { ITEM_TEMPLATES } from '../inventory/InventoryData';

/** Human-readable cause of death names. */
const DEATH_CAUSE_NAMES: Record<number, string> = {
  [CAUSE_OF_DEATH.UNSPECIFIED]: 'Unknown',
  [CAUSE_OF_DEATH.DEBUG]: 'Debug Kill',
  [CAUSE_OF_DEATH.SUFFOCATION]: 'Suffocation',
  [CAUSE_OF_DEATH.FIRE]: 'Fire',
  [CAUSE_OF_DEATH.DISEASE]: 'Disease',
  [CAUSE_OF_DEATH.COMBAT_RANGED]: 'Shot',
  [CAUSE_OF_DEATH.SUCKED_INTO_SPACE]: 'Sucked Into Space',
  [CAUSE_OF_DEATH.PARASITE]: 'Parasite',
  [CAUSE_OF_DEATH.STARVATION]: 'Starvation',
  [CAUSE_OF_DEATH.COMBAT_MELEE]: 'Melee Combat',
  [CAUSE_OF_DEATH.THING]: 'The Thing',
  [CAUSE_OF_DEATH.STUNNER]: 'Stunner',
};

const AMBER = '#dfa200';
const PANEL_W = 280;

export type SelectedEntity =
  | { type: 'character'; data: Character }
  | { type: 'object'; data: EnvObject }
  | { type: 'room'; data: Room }
  | null;

type InspectorTab = 'duty' | 'stats' | 'needs' | 'psych' | 'log' | 'actions' | 'stuff';

export class InspectorPanel {
  private el: HTMLDivElement;
  private contentEl!: HTMLDivElement;
  private entity: SelectedEntity = null;
  private currentTab: InspectorTab = 'duty';
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

    this.el = document.createElement('div');
    this.el.id = 'inspector-panel';
    this.el.style.cssText = `
      position:absolute;right:10px;top:200px;width:${PANEL_W}px;
      background:rgba(0,0,0,0.85);border:1px solid ${AMBER};
      color:#ccc;font-family:monospace;font-size:13px;
      display:none;pointer-events:auto;z-index:15;
    `;

    this.contentEl = document.createElement('div');
    this.el.appendChild(this.contentEl);

    parent.appendChild(this.el);
  }

  setEntity(entity: SelectedEntity) {
    this.entity = entity;
    this.currentTab = 'duty';
    this.editingName = false;
    if (entity) {
      this.el.style.display = 'block';
    } else {
      this.el.style.display = 'none';
    }
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

    this.contentEl.innerHTML = '';

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
        font-size:16px;font-weight:bold;color:${AMBER};background:#111;
        border:1px solid ${AMBER};outline:none;font-family:monospace;
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
      nameSpan.style.cssText = `font-size:16px;font-weight:bold;color:${AMBER};cursor:pointer;`;
      nameSpan.title = 'Click to edit name';
      nameSpan.addEventListener('click', () => {
        this.editingName = true;
        this.update();
      });
      nameRow.appendChild(nameSpan);
    }

    const jobSpan = document.createElement('span');
    const dutyStr = char.isAlive() && char.onDuty() ? ' (On Duty)' : '';
    jobSpan.textContent = `[${char.getJobName()}${dutyStr}]`;
    jobSpan.style.cssText = 'font-size:12px;color:#888;';
    nameRow.appendChild(jobSpan);
    header.appendChild(nameRow);

    const hpDiv = document.createElement('div');
    hpDiv.style.cssText = 'margin-top:4px;';
    hpDiv.innerHTML = this.bar('HP', char.getHP(), char.tStats.nMaxHP, isDead ? '#f44' : '#4f4');
    header.appendChild(hpDiv);

    // Activity text (current task description)
    const activityDiv = document.createElement('div');
    activityDiv.style.cssText = 'margin-top:4px;color:#aaa;font-size:11px;';
    const taskName = char.currentTask?.name ?? (isDead ? 'Dead' : 'Idle');
    activityDiv.textContent = taskName;
    header.appendChild(activityDiv);

    // Location text (room name or "Space")
    const locationDiv = document.createElement('div');
    locationDiv.style.cssText = 'display:flex;justify-content:space-between;margin-top:2px;';
    let locationText = 'Space';
    if (!char.bSpacewalking) {
      const room = this.getRoomForChar?.(char);
      if (room?.uniqueZoneName) locationText = room.uniqueZoneName;
      else if (room) locationText = `Room ${room.id}`;
      else locationText = `(${char.tileX}, ${char.tileY})`;
    }
    const moraleText = isDead
      ? `Dead: ${DEATH_CAUSE_NAMES[char.nCauseOfDeath] ?? 'Unknown'}`
      : `Morale: ${char.nMorale}`;
    locationDiv.innerHTML = `<span>${moraleText}</span><span style="color:#888">${this.escapeHtml(locationText)}</span>`;
    header.appendChild(locationDiv);

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
          font-size:10px;color:${AMBER};border:1px solid ${AMBER};
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
    const tabs: { label: string; tab: InspectorTab }[] = isPlayer
      ? [
          { label: 'Duty', tab: 'duty' },
          { label: 'Stats', tab: 'stats' },
          { label: 'Needs', tab: 'needs' },
          { label: 'Psych', tab: 'psych' },
          { label: 'Stuff', tab: 'stuff' },
          { label: 'Log', tab: 'log' },
          { label: 'Actions', tab: 'actions' },
        ]
      : [
          { label: 'Stats', tab: 'stats' },
          { label: 'Log', tab: 'log' },
        ];
    for (const t of tabs) {
      const btn = document.createElement('div');
      btn.textContent = t.label;
      const isActive = this.currentTab === t.tab;
      btn.style.cssText = `
        flex:1;text-align:center;padding:6px 0;cursor:pointer;font-size:12px;
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
      case 'needs':
        this.renderNeedsTab(body, char);
        break;
      case 'psych':
        this.renderPsychTab(body, char);
        break;
      case 'stuff':
        this.renderStuffTab(body, char);
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
        <span style="width:30px;text-align:right;font-size:11px;color:#888;">${Math.round(comp * 100)}%</span>
      `;
      container.appendChild(row);
    }
  }

  private renderStatsTab(container: HTMLDivElement, char: Character) {
    container.innerHTML = `
      <div style="margin-bottom:6px;">
        ${this.bar('HP', char.getHP(), char.tStats.nMaxHP, char.getHP() < 30 ? '#f44' : '#4f4')}
      </div>
      <div style="margin-bottom:6px;">
        ${this.bar('O2', Math.round(char.needs.oxygen), 100, char.needs.oxygen < 30 ? '#f44' : '#48f')}
      </div>
      <div style="margin-bottom:4px;">
        Location: ${char.bSpacewalking ? 'Spacewalking' : `(${char.tileX}, ${char.tileY})`}
      </div>
      <div style="margin-bottom:4px;">XP: ${char.tStats.nXP}</div>
      <div style="margin-bottom:4px;">Anger: ${char.nAnger}</div>
      <div>Status: ${char.isAlive() ? (char.tStats.nStatus === 1 ? 'Healthy' : 'Injured') : 'Dead'}</div>
    `;
  }

  private renderNeedsTab(container: HTMLDivElement, char: Character) {
    const needs: { label: string; value: number }[] = [
      { label: 'Hunger', value: char.needs.hunger },
      { label: 'Energy', value: char.needs.energy },
      { label: 'Amusement', value: char.needs.amusement },
      { label: 'Social', value: char.needs.social },
      { label: 'Duty', value: char.needs.duty },
    ];

    for (const n of needs) {
      // Needs range -100..+100; remap to 0..100% for display
      const displayPct = (n.value + 100) / 2;
      const color = n.value > 30 ? '#4f4' : n.value > -30 ? '#ff0' : '#f44';
      const row = document.createElement('div');
      row.style.cssText = 'margin-bottom:6px;';
      // Note: bar() uses only numeric values derived from game state, not user input
      row.innerHTML = this.bar(n.label, Math.max(0, displayPct), 100, color);
      container.appendChild(row);
    }
  }

  private renderPsychTab(container: HTMLDivElement, char: Character) {
    const p = char.tStats.personality;

    // Slider traits (0-1 range)
    const sliders: { label: string; value: number; lowLabel: string; highLabel: string }[] = [
      { label: 'Bravery', value: p.nBravery, lowLabel: 'Cowardly', highLabel: 'Brave' },
      { label: 'Temper', value: p.nTemper, lowLabel: 'Calm', highLabel: 'Hot-headed' },
      { label: 'Work Ethic', value: p.nWorkEthic, lowLabel: 'Lazy', highLabel: 'Diligent' },
      { label: 'Gregariousness', value: p.nGregariousness, lowLabel: 'Loner', highLabel: 'Social' },
      { label: 'Chattiness', value: p.nChattiness, lowLabel: 'Quiet', highLabel: 'Chatty' },
      { label: 'Neatness', value: p.nNeatness, lowLabel: 'Messy', highLabel: 'Tidy' },
      { label: 'Positivity', value: p.nPositivity, lowLabel: 'Pessimist', highLabel: 'Optimist' },
      { label: 'Authority', value: p.nAuthoritarian, lowLabel: 'Rebel', highLabel: 'Obedient' },
    ];

    for (const s of sliders) {
      const pct = Math.round(s.value * 100);
      const desc = s.value < 0.3 ? s.lowLabel : s.value > 0.7 ? s.highLabel : 'Average';
      const row = document.createElement('div');
      row.style.cssText = 'margin-bottom:4px;';
      row.innerHTML = `
        <div style="display:flex;align-items:center;">
          <span style="width:95px;font-size:11px;color:#888;">${s.label}</span>
          <div style="flex:1;height:6px;background:#222;margin:0 4px;position:relative;">
            <div style="width:${pct}%;height:100%;background:${AMBER};"></div>
          </div>
          <span style="width:65px;text-align:right;font-size:10px;color:#888;">${desc}</span>
        </div>
      `;
      container.appendChild(row);
    }

    // Boolean traits
    const boolTraits: { label: string; value: boolean }[] = [
      { label: 'Xenophobe', value: p.bXenophobe },
      { label: 'Anxious', value: p.bAnxious },
      { label: 'Gourmand', value: p.bGourmand },
      { label: 'Joker', value: p.bJoker },
      { label: 'Sentimental', value: p.bSentimental },
      { label: 'Competitive', value: p.bCompetitive },
      { label: 'Hipster', value: p.bHipster },
    ];

    const activeTraits = boolTraits.filter(t => t.value);
    if (activeTraits.length > 0) {
      const traitDiv = document.createElement('div');
      traitDiv.style.cssText = `margin-top:6px;padding-top:6px;border-top:1px solid #333;`;
      traitDiv.innerHTML = `<div style="font-size:11px;color:${AMBER};margin-bottom:4px;">Quirks</div>`;
      for (const t of activeTraits) {
        const tag = document.createElement('span');
        tag.textContent = t.label;
        tag.style.cssText = `
          display:inline-block;margin:2px;padding:2px 6px;
          border:1px solid #555;color:#ccc;font-size:10px;
        `;
        traitDiv.appendChild(tag);
      }
      container.appendChild(traitDiv);
    }
  }

  private renderStuffTab(container: HTMLDivElement, char: Character) {
    const items = char.inventory.getAll();
    const heldItem = char.heldItem;

    // Held item
    if (heldItem) {
      const heldDiv = document.createElement('div');
      heldDiv.style.cssText = `margin-bottom:8px;padding:4px;border:1px solid ${AMBER};`;
      heldDiv.innerHTML = `<span style="color:${AMBER};font-size:11px;">Carrying:</span> <span style="color:#ccc;">${this.escapeHtml(heldItem)}</span>`;
      container.appendChild(heldDiv);
    }

    if (items.length === 0 && !heldItem) {
      const empty = document.createElement('div');
      empty.style.cssText = 'color:#888;font-style:italic;';
      empty.textContent = 'No items.';
      container.appendChild(empty);
      return;
    }

    for (const item of items) {
      const tmpl = ITEM_TEMPLATES[item.sTemplate];
      const row = document.createElement('div');
      row.style.cssText = 'margin-bottom:4px;padding:2px 0;border-bottom:1px solid #222;font-size:11px;';
      const countStr = item.nCount > 1 ? ` x${item.nCount}` : '';
      const tagStr = tmpl?.bStuff ? ' [Stuff]' : tmpl?.bDisplayable ? ' [Display]' : '';
      row.innerHTML = `<span style="color:#ccc;">${this.escapeHtml(item.sName)}${countStr}</span><span style="color:#666;font-size:10px;">${tagStr}</span>`;
      container.appendChild(row);
    }
  }

  private renderLogTab(container: HTMLDivElement, char: Character) {
    const log = char.tLog;
    if (log.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'color:#888;font-style:italic;';
      empty.textContent = 'No log entries yet.';
      container.appendChild(empty);
      return;
    }

    // Show most recent entries first, up to 20
    const maxEntries = 20;
    const start = Math.max(0, log.length - maxEntries);
    for (let i = log.length - 1; i >= start; i--) {
      const entry = log[i];
      const row = document.createElement('div');
      row.style.cssText = `
        margin-bottom:4px;padding:3px 4px;border-bottom:1px solid #222;
        font-size:11px;line-height:1.3;color:#ccc;
      `;
      row.textContent = entry.sLine;
      container.appendChild(row);
    }
  }

  private renderActionsTab(container: HTMLDivElement, char: Character) {
    const isDead = !char.isAlive();

    // Cuff / Uncuff
    const cuffBtn = this.makeActionButton(
      char.bCuffed ? 'Uncuff' : 'Cuff',
      isDead,
      () => { if (this.onCuffCharacter) this.onCuffCharacter(char); },
    );
    container.appendChild(cuffBtn);

    // Send to Brig
    const brigRooms = this.getBrigRooms ? this.getBrigRooms() : [];
    const brigBtn = this.makeActionButton(
      'Send to Brig',
      isDead || brigRooms.length === 0,
      () => {
        if (this.onCuffCharacter && !char.bCuffed) this.onCuffCharacter(char);
      },
    );
    if (brigRooms.length === 0) {
      const note = document.createElement('div');
      note.textContent = 'No brig zone exists';
      note.style.cssText = 'font-size:10px;color:#666;margin-top:-4px;margin-bottom:8px;';
      container.appendChild(brigBtn);
      container.appendChild(note);
    } else {
      container.appendChild(brigBtn);
    }

    // Execute (red)
    const execBtn = this.makeActionButton(
      'Execute',
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
      border:1px solid ${baseColor};color:${baseColor};font-size:12px;text-align:center;
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
      case DOOR_STATE.OPEN: return '<span style="color:#4f4;">Open</span>';
      case DOOR_STATE.CLOSED: return 'Closed';
      case DOOR_STATE.LOCKED: return '<span style="color:#f44;">Locked</span>';
      case DOOR_STATE.BROKEN_OPEN: return '<span style="color:#f44;">Broken (Open)</span>';
      case DOOR_STATE.BROKEN_CLOSED: return '<span style="color:#f44;">Broken (Closed)</span>';
      default: return 'Unknown';
    }
  }

  private renderObject(obj: EnvObject) {
    const header = this.makeSection();
    const condStr = obj.getConditionUIString();
    const status = obj.isFunctioning() ? 'Functioning' : obj.isDestroyed() ? 'Destroyed' : 'Offline';
    const statusColor = obj.isDestroyed() ? '#f44' :
      obj.isDamaged() ? '#ff0' :
      obj.isFunctioning() ? '#4f4' : '#888';

    const emergencyStr = obj.getEmergencyString();
    header.innerHTML = `
      <div style="font-size:16px;font-weight:bold;color:${AMBER};margin-bottom:6px;">
        ${obj.tData.friendlyName}
        ${emergencyStr ? `<span style="color:#f44;font-size:11px;margin-left:8px;">[${emergencyStr}]</span>` : ''}
      </div>
      <div style="margin-bottom:6px;">
        ${this.bar('Condition', Math.round(obj.nCondition), 100, obj.nCondition < 50 ? '#f44' : '#4f4')}
      </div>
      <div style="margin-bottom:4px;">Condition: ${condStr} | Status: <span style="color:${statusColor};">${status}</span></div>
      ${obj.tData.nPowerOutput > 0 ? `<div style="margin-bottom:4px;">Power Output: ${obj.getPowerOutput()}</div>` : ''}
      ${obj.tData.nPowerDraw > 0 ? `<div style="margin-bottom:4px;">Power Draw: ${obj.getPowerDraw()}</div>` : ''}
      ${obj.tData.oxygenLevel > 0 ? `<div style="margin-bottom:4px;">O2 Output: ${obj.getOxygenOutput()}</div>` : ''}
      ${obj instanceof Door ? `<div style="margin-bottom:4px;">Door: ${this.getDoorStatusText(obj)}</div>` : ''}
      ${obj.sBuilderName ? `<div style="margin-bottom:4px;">Built by: ${obj.sBuilderName}</div>` : ''}
      ${obj.sBuildTime ? `<div style="margin-bottom:4px;">Built: ${obj.sBuildTime}</div>` : ''}
      <div style="margin-bottom:4px;">Position: (${obj.tileX}, ${obj.tileY})</div>
      ${obj.tData.bCanDeactivate ? `
        <div style="margin-top:8px;">
          <span style="cursor:pointer;color:${AMBER};border:1px solid ${AMBER};padding:2px 8px;"
                id="inspector-toggle-active">${obj.bActive ? 'Deactivate' : 'Activate'}</span>
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
        `Demolish (+${refund} matter)`,
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
    const objCount = this.getObjectsInRoom ? this.getObjectsInRoom(room).length : 0;

    const header = this.makeSection();
    header.innerHTML = `
      <div style="font-size:16px;font-weight:bold;color:${AMBER};margin-bottom:6px;">
        ${zoneName} <span style="color:#888;">Room #${room.id}</span>
      </div>
      <div style="margin-bottom:4px;">Tiles: ${room.size}</div>
      <div style="margin-bottom:6px;">
        ${this.bar('O2', room.oxygen, 255, room.oxygen < 50 ? '#f44' : '#48f')}
      </div>
      <div style="margin-bottom:4px;">
        Sealed: <span style="color:${room.sealed ? '#4f4' : '#f44'};">${room.sealed ? 'Yes' : 'BREACHED'}</span>
      </div>
      <div style="margin-bottom:4px;">
        Power: <span style="color:#4f4;">+${room.nPowerOutput}</span> / <span style="color:#f44;">-${room.nPowerDraw}</span>
      </div>
      <div style="margin-bottom:4px;">Objects: ${objCount}</div>
    `;
    this.contentEl.appendChild(header);

    this.addCloseButton();
  }

  // ── Helpers ─────────────────────────────────────────────

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
        <span style="width:70px;font-size:11px;color:#888;">${label}</span>
        <div style="flex:1;height:8px;background:#222;margin:0 6px;">
          <div style="width:${Math.round(pct)}%;height:100%;background:${color};"></div>
        </div>
        <span style="width:50px;text-align:right;font-size:11px;">${Math.round(value)}/${max}</span>
      </div>
    `;
  }

  private addCloseButton() {
    const closeBtn = document.createElement('div');
    closeBtn.textContent = '[X] Close';
    closeBtn.style.cssText = `
      text-align:center;padding:6px;cursor:pointer;color:${AMBER};
      border-top:1px solid #333;font-size:12px;
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
