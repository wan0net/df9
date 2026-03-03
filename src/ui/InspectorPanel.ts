/**
 * InspectorPanel.ts — Detail panel for selected character/object/room.
 * Matches original CitizenInspector.lua, ObjectInspector.lua, ZoneInspector.lua.
 */

import type { Character } from '../characters/Character';
import type { EnvObject } from '../envobjects/EnvObject';
import type { Room } from '../rooms/Room';
import { JOB_NAMES, tJobs, STATUS_DEAD } from '../characters/CharacterConstants';
import { ZONE_SPRITES } from '../world/ZoneType';

const AMBER = '#dfa200';
const PANEL_W = 280;

export type SelectedEntity =
  | { type: 'character'; data: Character }
  | { type: 'object'; data: EnvObject }
  | { type: 'room'; data: Room }
  | null;

type InspectorTab = 'duty' | 'stats' | 'needs';

export class InspectorPanel {
  private el: HTMLDivElement;
  private contentEl!: HTMLDivElement;
  private entity: SelectedEntity = null;
  private currentTab: InspectorTab = 'duty';
  private onSetJob: ((character: Character, jobId: number) => void) | null = null;
  private getObjectsInRoom: ((room: Room) => EnvObject[]) | null = null;

  constructor(
    parent: HTMLElement,
    callbacks: {
      onSetJob: (character: Character, jobId: number) => void;
      getObjectsInRoom: (room: Room) => EnvObject[];
    },
  ) {
    this.onSetJob = callbacks.onSetJob;
    this.getObjectsInRoom = callbacks.getObjectsInRoom;

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

    // Header
    const header = this.makeSection();
    header.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:16px;font-weight:bold;color:${AMBER};">${char.getName()}</span>
        <span style="font-size:12px;color:#888;">[${char.getJobName()}]</span>
      </div>
      <div style="margin-top:4px;">
        ${this.bar('HP', char.getHP(), char.tStats.nMaxHP, isDead ? '#f44' : '#4f4')}
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:4px;">
        <span>Morale: ${char.nMorale}</span>
        <span>Task: ${char.currentTask?.name ?? (isDead ? 'Dead' : 'Idle')}</span>
      </div>
    `;
    this.contentEl.appendChild(header);

    // Tab row
    const tabRow = document.createElement('div');
    tabRow.style.cssText = `
      display:flex;border-top:1px solid #333;border-bottom:1px solid #333;
    `;
    const tabs: { label: string; tab: InspectorTab }[] = [
      { label: 'Duty', tab: 'duty' },
      { label: 'Stats', tab: 'stats' },
      { label: 'Needs', tab: 'needs' },
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
      const color = n.value > 60 ? '#4f4' : n.value > 30 ? '#ff0' : '#f44';
      const row = document.createElement('div');
      row.style.cssText = 'margin-bottom:6px;';
      row.innerHTML = this.bar(n.label, Math.max(0, n.value), 100, color);
      container.appendChild(row);
    }
  }

  // ── Object Inspector ────────────────────────────────────

  private renderObject(obj: EnvObject) {
    const header = this.makeSection();
    const status = obj.isDestroyed() ? 'Destroyed' :
      obj.isDamaged() ? 'Damaged' :
      obj.isFunctioning() ? 'Functioning' : 'Offline';
    const statusColor = obj.isDestroyed() ? '#f44' :
      obj.isDamaged() ? '#ff0' :
      obj.isFunctioning() ? '#4f4' : '#888';

    header.innerHTML = `
      <div style="font-size:16px;font-weight:bold;color:${AMBER};margin-bottom:6px;">
        ${obj.tData.friendlyName}
      </div>
      <div style="margin-bottom:6px;">
        ${this.bar('Condition', Math.round(obj.nCondition), 100, obj.nCondition < 50 ? '#f44' : '#4f4')}
      </div>
      <div style="margin-bottom:4px;">Status: <span style="color:${statusColor};">${status}</span></div>
      ${obj.tData.nPowerOutput > 0 ? `<div style="margin-bottom:4px;">Power Output: ${obj.getPowerOutput()}</div>` : ''}
      ${obj.tData.nPowerDraw > 0 ? `<div style="margin-bottom:4px;">Power Draw: ${obj.getPowerDraw()}</div>` : ''}
      ${obj.tData.oxygenLevel > 0 ? `<div style="margin-bottom:4px;">O2 Output: ${obj.getOxygenOutput()}</div>` : ''}
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
