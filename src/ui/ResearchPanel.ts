/**
 * ResearchPanel.ts — Full-screen overlay for research assignment.
 * Matches original ResearchAssignment.lua: two-pane layout with
 * ZoneScrollPane (left) + ProjectScrollPane (right), Back+ESC,
 * Tech/Disease tabs, project list with progress bars.
 *
 * Left pane: research zone rooms (ResearchZoneEntry.lua)
 * Right pane: research projects (ResearchProjectEntry.lua)
 * Clicking a zone selects it; clicking a project assigns it to the selected zone.
 */

import { researchSystem } from '../research/ResearchSystem';
import { RESEARCH_DEFS } from '../research/ResearchData';
import { ResearchZone } from '../zones/ResearchZone';
import { Malady } from '../malady/Malady';
import { line } from '../localization/Localization';
import { playWarble } from './WarbleEffect';
import type { Room } from '../rooms/Room';
import { ZoneType } from '../world/ZoneType';

const AMBER = '#dfa200';
const ICON_FILTER_AMBER = 'brightness(0) saturate(100%) invert(55%) sepia(72%) saturate(1273%) hue-rotate(18deg) brightness(90%) contrast(177%)';

/** Exact ResearchData.lua sIcon assignments; absent entries use Lua's help icon. */
const RESEARCH_ICON_BY_ID: Record<string, string> = {
  SpaceSuit2: 'ui_jobs_iconJobUnemployed',
  VaporizeLevel2: 'ui_jobs_iconJobBuilder',
  MaintenanceLevel2: 'ui_jobs_iconJobTechnician',
  BuildLevel2: 'ui_jobs_iconJobBuilder',
  PlantLevel2: 'ui_jobs_iconJobBotanist',
  LaserRifles: 'ui_jobs_iconJobResponse',
  ArmorLevel2: 'ui_jobs_iconJobResponse',
  TeamTactics: 'ui_jobs_iconJobResponse',
  OxygenRecyclerLevel2: 'ui_jobs_iconJobUnemployed',
  OxygenRecyclerLevel3: 'ui_jobs_iconJobUnemployed',
  OxygenRecyclerLevel4: 'ui_jobs_iconJobUnemployed',
  GeneratorLevel2: 'ui_jobs_iconJobUnemployed',
  GeneratorLevel3: 'ui_jobs_iconJobUnemployed',
  GeneratorLevel4: 'ui_jobs_iconJobUnemployed',
  AirScrubber: 'ui_jobs_iconJobDoctor',
  HappyBot: 'ui_jobs_iconJobDoctor',
  FridgeLevel2: 'ui_jobs_iconJobBarkeep',
  RefineryDropoffLevel2: 'ui_jobs_iconJobMiner',
  WallMountedTurret2: 'ui_jobs_iconJobResponse',
};

/** Data for a research zone entry (mirrors Lua getAllZoneItems). */
interface ZoneItem {
  sName: string;
  nZoneID: number;
  sProjectID: string | null;
  sProjectName: string | null;
  bAssigned: boolean;
  room: Room;
}

export class ResearchPanel {
  private el: HTMLDivElement;
  private contentEl!: HTMLDivElement;
  private visible = false;
  private currentTab: 'tech' | 'disease' = 'tech';
  private getRooms: () => Room[];

  /** Currently selected zone for project assignment (Lua rSelectedZoneEntry). */
  private selectedZoneId: number | null = null;

  constructor(parent: HTMLElement, getRooms: () => Room[], onClose: () => void) {
    this.getRooms = getRooms;

    // Full-screen overlay (matching original ResearchAssignment.lua)
    this.el = document.createElement('div');
    this.el.id = 'research-panel';
    this.el.style.cssText = `
      position:fixed;top:0;left:0;width:100%;height:100%;
      background:rgba(0,0,0,0.92);z-index:100;display:none;
      font-family:'Dosis',sans-serif;pointer-events:auto;
    `;

    // Back button (Lua: BackButton + BackLabel + BackHotkey)
    const backBtn = document.createElement('div');
    backBtn.dataset.testid = 'research-back';
    backBtn.style.cssText = `
      position:absolute;top:0;left:0;width:286px;height:98px;
      background:#000;cursor:pointer;display:flex;align-items:center;
      padding:0 20px;box-sizing:border-box;
    `;
    const backLabel = document.createElement('span');
    backLabel.textContent = line('HUDHUD035TEXT');
    backLabel.style.cssText = `color:${AMBER};font-size:40px;flex:1;`; // Lua dosisregular40
    const backHotkey = document.createElement('span');
    backHotkey.textContent = 'ESC';
    backHotkey.style.cssText = `color:${AMBER};font-size:22px;`; // Lua dosissemibold22
    backBtn.appendChild(backLabel);
    backBtn.appendChild(backHotkey);
    backBtn.addEventListener('mouseenter', () => {
      backBtn.style.background = AMBER;
      backLabel.style.color = '#000';
      backHotkey.style.color = '#000';
    });
    backBtn.addEventListener('mouseleave', () => {
      backBtn.style.background = '#000';
      backLabel.style.color = AMBER;
      backHotkey.style.color = AMBER;
    });
    backBtn.addEventListener('click', onClose);
    this.el.appendChild(backBtn);

    // Title
    const title = document.createElement('div');
    title.textContent = line('INSPEC121TEXT');
    title.style.cssText = `
      position:absolute;top:20px;left:380px;
      color:${AMBER};font-size:44px;font-weight:500; /* Lua dosismedium44 */
    `;
    this.el.appendChild(title);

    // Tab row (Lua: TechTabButton / DiseaseTabButton)
    const tabRow = document.createElement('div');
    tabRow.style.cssText = `
      position:absolute;top:70px;left:380px;display:flex;gap:0;
    `;
    const tabs: { label: string; tab: 'tech' | 'disease' }[] = [
      { label: line('RSCHUI005TEXT'), tab: 'tech' },
      { label: line('RSCHUI006TEXT'), tab: 'disease' },
    ];
    this.tabButtons = [];
    for (const t of tabs) {
      const btn = document.createElement('div');
      btn.textContent = t.label;
      btn.style.cssText = `
        padding:8px 24px;cursor:pointer;font-size:22px; /* Lua dosissemibold22 */
        border:1px solid ${AMBER};
      `;
      btn.addEventListener('click', () => {
        this.currentTab = t.tab;
        this.selectedZoneId = null;
        this.updateTabStyles();
      });
      tabRow.appendChild(btn);
      this.tabButtons.push({ btn, tab: t.tab });
    }
    this.el.appendChild(tabRow);

    // Two-pane content area (Lua: ZoneScrollPane left + ProjectScrollPane right)
    this.contentEl = document.createElement('div');
    this.contentEl.style.cssText = `
      position:absolute;top:120px;left:380px;right:60px;bottom:20px;
      display:flex;gap:24px;color:#ccc;font-size:22px;
    `;
    this.el.appendChild(this.contentEl);

    parent.appendChild(this.el);
  }

  private tabButtons: { btn: HTMLDivElement; tab: string }[] = [];

  private updateTabStyles() {
    for (const { btn, tab } of this.tabButtons) {
      const isActive = this.currentTab === tab;
      btn.style.background = isActive ? AMBER : 'transparent';
      btn.style.color = isActive ? '#000' : AMBER;
    }
  }

  show() {
    this.visible = true;
    this.el.style.display = 'block';
    this.selectedZoneId = null;
    this.updateTabStyles();
    this.update();
    playWarble(this.el, 0.3, 0.3);
  }

  hide() {
    this.visible = false;
    this.el.style.display = 'none';
    this.selectedZoneId = null;
  }

  toggle() {
    if (this.visible) this.hide();
    else this.show();
  }

  isVisible(): boolean {
    return this.visible;
  }

  update() {
    if (!this.visible) return;

    while (this.contentEl.firstChild) this.contentEl.removeChild(this.contentEl.firstChild);
    this.updateTabStyles();

    // ── Left pane: research zone list (Lua ZoneScrollPane) ──────────────
    const zonePane = document.createElement('div');
    zonePane.style.cssText = `
      width:30%;min-width:240px;max-width:360px;overflow-y:auto;
      border-right:1px solid rgba(223,162,0,0.3);padding-right:16px;
      flex-shrink:0;
    `;

    // Zone list header (Lua: RSCHUI003TEXT = "Zone")
    this.sectionHeader(zonePane, line('RSCHUI003TEXT'));

    const zones = this.getResearchZones();
    if (zones.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'color:#888;padding:20px 0;font-size:20px;';
      empty.textContent = 'No research labs built';
      zonePane.appendChild(empty);
    } else {
      for (const zone of zones) {
        zonePane.appendChild(this.makeZoneEntry(zone));
      }
    }

    this.contentEl.appendChild(zonePane);

    // ── Right pane: project list (Lua ProjectScrollPane) ────────────────
    const projectPane = document.createElement('div');
    projectPane.style.cssText = `
      flex:1;overflow-y:auto;padding-left:8px;
    `;

    // Project list header (Lua: RSCHUI004TEXT = "Project")
    this.sectionHeader(projectPane, line('RSCHUI004TEXT'));

    // Show selection prompt when a zone is selected (Lua RSCHUI002TEXT)
    if (this.selectedZoneId !== null) {
      const prompt = document.createElement('div');
      prompt.textContent = line('RSCHUI002TEXT');
      prompt.style.cssText = `
        color:${AMBER};font-size:20px;font-style:italic;
        padding:8px 0 12px 0;opacity:0.8;
      `;
      projectPane.appendChild(prompt);
    }

    if (this.currentTab === 'tech') {
      this.renderTechTab(projectPane);
    } else {
      this.renderDiseaseTab(projectPane);
    }

    this.contentEl.appendChild(projectPane);
  }

  // ── Zone list (Lua getAllZoneItems) ──────────────────────────────────────

  /** Get all RESEARCH-zoned rooms (mirrors Lua Room.getRoomsOfTeam(PLAYER, true, 'RESEARCH')). */
  private getResearchZones(): ZoneItem[] {
    const rooms = this.getRooms();
    const items: ZoneItem[] = [];
    for (const room of rooms) {
      if (room.zone !== ZoneType.RESEARCH) continue;
      const zoneObj = room.zoneObj as ResearchZone | null;
      const sProjectID = zoneObj?.getActiveResearch() ?? null;
      let sProjectName: string | null = null;
      if (sProjectID) {
        // Check tech research first, then malady
        const def = RESEARCH_DEFS[sProjectID];
        if (def) {
          sProjectName = def.friendlyName;
        } else {
          // Could be a malady research
          sProjectName = sProjectID;
        }
      }
      items.push({
        sName: room.uniqueZoneName || `Research Lab ${room.id}`,
        nZoneID: room.id,
        sProjectID,
        sProjectName,
        bAssigned: sProjectName !== null,
        room,
      });
    }
    return items;
  }

  /** Create a zone entry element (mirrors Lua ResearchZoneEntry). */
  private makeZoneEntry(zone: ZoneItem): HTMLDivElement {
    const isSelected = this.selectedZoneId === zone.nZoneID;

    const entry = document.createElement('div');
    entry.style.cssText = `
      padding:12px 16px;margin-bottom:8px;cursor:pointer;
      border:2px solid ${AMBER};border-radius:8px;
      background:${isSelected ? AMBER : '#000'};
      transition:background 0.15s;
    `;

    // Zone name (Lua: ZoneName, dosissemibold26)
    const nameEl = document.createElement('div');
    nameEl.textContent = zone.sName;
    nameEl.style.cssText = `
      font-size:22px;font-weight:600;
      color:${isSelected ? '#000' : AMBER};
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
    `;
    entry.appendChild(nameEl);

    // Current project assignment (Lua: ProjectName / "select a project" prompt)
    const projectEl = document.createElement('div');
    if (isSelected) {
      projectEl.textContent = line('RSCHUI002TEXT');
      projectEl.style.cssText = 'font-size:18px;color:#000;font-style:italic;margin-top:4px;opacity:0.8;';
    } else if (zone.sProjectName) {
      projectEl.textContent = zone.sProjectName;
      projectEl.style.cssText = `font-size:18px;color:${AMBER};margin-top:4px;opacity:0.8;`;
    } else {
      // Lua: empty dashes when no project
      projectEl.textContent = '--';
      projectEl.style.cssText = 'font-size:18px;color:#666;margin-top:4px;';
    }
    entry.appendChild(projectEl);

    // Hover effects
    entry.addEventListener('mouseenter', () => {
      if (!isSelected) {
        entry.style.background = 'rgba(223,162,0,0.2)';
      }
    });
    entry.addEventListener('mouseleave', () => {
      if (!isSelected) {
        entry.style.background = '#000';
      }
    });

    // Click to select/deselect zone (Lua: onButtonPressed toggle)
    entry.addEventListener('click', () => {
      if (this.selectedZoneId === zone.nZoneID) {
        // Deselect
        this.selectedZoneId = null;
      } else {
        this.selectedZoneId = zone.nZoneID;
      }
      this.update();
    });

    return entry;
  }

  // ── Project list rendering ──────────────────────────────────────────────

  private renderTechTab(container: HTMLDivElement) {
    const allResearch = researchSystem.getAllResearch();
    const legacyActiveId = researchSystem.getActiveResearch();
    const assignedIds = new Set(
      this.getResearchZones()
        .map(zone => zone.sProjectID)
        .filter((id): id is string => id !== null),
    );
    if (legacyActiveId) assignedIds.add(legacyActiveId);

    const active: [string, typeof allResearch[string]][] = [];
    const available: [string, typeof allResearch[string]][] = [];
    const completed: [string, typeof allResearch[string]][] = [];

    for (const [id, def] of Object.entries(allResearch)) {
      if (def.bDiscoverOnly) continue;
      if (assignedIds.has(id)) active.push([id, def]);
      else if (def.completed) completed.push([id, def]);
      else if (def.available) available.push([id, def]);
    }

    const bInSelectionMode = this.selectedZoneId !== null;

    // Active research
    if (active.length > 0) {
      this.sectionHeader(container, line('RSCHUI008TEXT'));
      for (const [id, def] of active) {
        const icon = this.getResearchIcon(id);
        const entry = this.makeResearchEntry(
          def.friendlyName, def.description, icon, researchSystem.getProgress(id), def.nCost, false,
        );
        if (bInSelectionMode) {
          this.addAssignButton(entry, id);
        }
        container.appendChild(entry);
      }
    }

    // Available research
    if (available.length > 0) {
      this.sectionHeader(container, line('RSCHUI009TEXT'));
      for (const [id, def] of available) {
        const icon = this.getResearchIcon(id);
        const entry = this.makeResearchEntry(
          def.friendlyName, def.description, icon, researchSystem.getProgress(id), def.nCost, false,
        );
        if (bInSelectionMode) {
          this.addAssignButton(entry, id);
        } else if (assignedIds.size === 0) {
          // Legacy behavior: click to start global research when no zone selected
          entry.addEventListener('click', () => {
            researchSystem.startResearch(id);
            this.update();
          });
        }
        container.appendChild(entry);
      }
    }

    // Completed research
    if (completed.length > 0) {
      this.sectionHeader(container, line('RSCHUI010TEXT'));
      for (const [, def] of completed) {
        container.appendChild(this.makeResearchEntry(
          def.friendlyName, def.description, 'ui_jobs_icon_checkCircle', def.nCost, def.nCost, true,
        ));
      }
    }

    if (active.length === 0 && available.length === 0 && completed.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'color:#888;text-align:center;padding:40px;font-size:26px;';
      empty.textContent = line('RSCHUI015TEXT');
      container.appendChild(empty);
    }
  }

  private renderDiseaseTab(container: HTMLDivElement) {
    const availableResearch = Malady.getAvailableResearch();
    const completedResearch = Malady.getCompletedResearch();

    const bInSelectionMode = this.selectedZoneId !== null;

    for (const entry of availableResearch) {
      const desc = `${line('RSCHUI014TEXT')} ${entry.sMaladyType}`;
      const el = this.makeResearchEntry(
        entry.sMaladyName, desc, 'ui_jobs_iconHelp',
        entry.nCureProgress, entry.nResearchCure, false,
      );
      if (bInSelectionMode) {
        this.addAssignButton(el, entry.sMaladyName);
      }
      container.appendChild(el);
    }

    for (const entry of completedResearch) {
      const desc = `${line('RSCHUI014TEXT')} ${entry.sMaladyType}`;
      const el = this.makeResearchEntry(
        entry.sMaladyName, desc, 'ui_jobs_icon_checkCircle',
        entry.nResearchCure, entry.nResearchCure, true,
      );
      container.appendChild(el);
    }

    if (availableResearch.length === 0 && completedResearch.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'color:#888;text-align:center;padding:40px;font-size:26px;';
      empty.textContent = line('RSCHUI016TEXT');
      container.appendChild(empty);
    }
  }

  /**
   * Add an "Assign" button to a project entry when in zone-selection mode.
   * Mirrors Lua projectSelected: sets zoneObj.setActiveResearch, deselects zone.
   */
  private addAssignButton(entry: HTMLDivElement, projectId: string) {
    const btn = document.createElement('div');
    btn.textContent = line('RSCHUI013TEXT'); // "Start" — used as assign label
    btn.style.cssText = `
      display:inline-block;margin-top:8px;padding:6px 20px;
      background:${AMBER};color:#000;border-radius:4px;
      font-size:18px;font-weight:600;cursor:pointer;
      transition:opacity 0.15s;
    `;
    btn.addEventListener('mouseenter', () => { btn.style.opacity = '0.8'; });
    btn.addEventListener('mouseleave', () => { btn.style.opacity = '1'; });
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.assignProjectToZone(projectId);
    });
    entry.appendChild(btn);
  }

  /** Assign a research project to the currently selected zone (Lua projectSelected + setZoneProject). */
  private assignProjectToZone(projectId: string) {
    if (this.selectedZoneId === null) return;
    const rooms = this.getRooms();
    const room = rooms.find(r => r.id === this.selectedZoneId);
    if (!room) return;
    const zoneObj = room.zoneObj as ResearchZone | null;
    if (!zoneObj || typeof zoneObj.setActiveResearch !== 'function') return;

    // Toggle: if already assigned this project, unassign (Lua toggle behavior)
    if (zoneObj.getActiveResearch() === projectId) {
      zoneObj.setActiveResearch(null);
    } else {
      zoneObj.setActiveResearch(projectId);
    }

    // Deselect zone after assignment (Lua: zoneSelected(nil) after projectSelected)
    this.selectedZoneId = null;
    this.update();
  }

  /**
   * Create a research entry matching the screenshot layout:
   * rounded amber-bordered name bar (icon + name + progress) above description shade box.
   * Mirrors GoalEntry pattern from GoalEntryLayout.lua / ZoneResearchButtonLayout.lua.
   */
  private makeResearchEntry(
    name: string, desc: string, iconSprite: string,
    nProgress: number, nTotal: number, bCompleted: boolean,
  ): HTMLDivElement {
    const ENTRY_WIDTH = 700;
    const BAR_WIDTH = 200;
    const entry = document.createElement('div');
    entry.style.cssText = `position:relative;width:${ENTRY_WIDTH}px;margin-bottom:24px;`;

    // Name bar — rounded pill (Lua: TemplateButton outline)
    const nameBar = document.createElement('div');
    nameBar.style.cssText = `
      position:relative;height:64px;
      background:#000;border:2px solid ${AMBER};border-radius:32px;
      display:flex;align-items:center;box-sizing:border-box;
    `;

    // Icon (Lua: ProjectIcon from UI/JobRoster)
    const iconEl = document.createElement('img');
    iconEl.src = `/assets/ui/hud/${iconSprite}.png`;
    iconEl.alt = '';
    iconEl.dataset.sourceSprite = iconSprite;
    iconEl.style.cssText = `
      margin-left:20px;width:32px;height:32px;object-fit:contain;flex-shrink:0;
      filter:${ICON_FILTER_AMBER};
    `;
    nameBar.appendChild(iconEl);

    // Name (Lua: ProjectName, dosissemibold26)
    const nameEl = document.createElement('span');
    nameEl.textContent = name;
    nameEl.style.cssText = `
      margin-left:12px;flex:1;font-size:26px;font-weight:600;
      color:${AMBER};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
    `;
    nameBar.appendChild(nameEl);

    // Progress bar container on right side (Lua: ProjectProgressBar + ProjectProgressLabel)
    const barContainer = document.createElement('div');
    barContainer.style.cssText = `
      position:absolute;right:0;top:0;width:${BAR_WIDTH + 32}px;height:64px;
      display:flex;align-items:center;
    `;

    // Progress bar background
    const barBg = document.createElement('div');
    barBg.style.cssText = `
      position:absolute;left:0;top:0;width:${BAR_WIDTH}px;height:64px;
      background:#111;border:2px solid ${AMBER};border-radius:32px;
      box-sizing:border-box;overflow:hidden;
    `;

    const pct = nTotal > 0 ? Math.min(100, Math.round((nProgress / nTotal) * 100)) : 0;
    const fillPct = bCompleted ? 100 : pct;
    const barFill = document.createElement('div');
    barFill.style.cssText = `
      width:${fillPct}%;height:100%;background:${AMBER};
      border-radius:30px 0 0 30px;
    `;
    if (fillPct >= 100) barFill.style.borderRadius = '30px';
    barBg.appendChild(barFill);

    // Progress label (Lua: "N / TOTAL" or "Researched")
    const progressLabel = document.createElement('span');
    progressLabel.style.cssText = `
      position:absolute;left:0;top:0;width:${BAR_WIDTH}px;height:64px;
      display:flex;align-items:center;justify-content:flex-end;
      padding-right:20px;box-sizing:border-box;
      font-size:22px;font-weight:600;color:${AMBER};
    `;
    if (bCompleted) {
      progressLabel.textContent = line('RSCHUI007TEXT');
    } else {
      progressLabel.textContent = `${nProgress} / ${nTotal}`;
    }

    barContainer.appendChild(barBg);
    barContainer.appendChild(progressLabel);
    nameBar.appendChild(barContainer);
    entry.appendChild(nameBar);

    // Description shade box below bar
    const descBox = document.createElement('div');
    descBox.style.cssText = `
      width:${ENTRY_WIDTH}px;padding:12px 24px;box-sizing:border-box;
      background:rgba(223,162,0,0.1);
      border-left:2px solid rgba(223,162,0,0.3);
      border-right:2px solid rgba(223,162,0,0.3);
      border-bottom:2px solid rgba(223,162,0,0.3);
    `;
    const descEl = document.createElement('div');
    descEl.textContent = desc;
    descEl.style.cssText = `font-size:22px;color:${AMBER};line-height:1.4;font-style:italic;`;
    descBox.appendChild(descEl);
    entry.appendChild(descBox);

    // Hover effects
    entry.style.cursor = 'pointer';
    entry.addEventListener('mouseenter', () => {
      nameBar.style.background = AMBER;
      nameEl.style.color = '#000';
      iconEl.style.filter = 'brightness(0)';
      descBox.style.background = 'rgba(223,162,0,0.25)';
    });
    entry.addEventListener('mouseleave', () => {
      nameBar.style.background = '#000';
      nameEl.style.color = AMBER;
      iconEl.style.filter = ICON_FILTER_AMBER;
      descBox.style.background = 'rgba(223,162,0,0.1)';
    });

    return entry;
  }

  /** Lua ResearchProjectEntry uses sIcon or the JobRoster help sprite. */
  private getResearchIcon(id: string): string {
    return RESEARCH_ICON_BY_ID[id] ?? 'ui_jobs_iconHelp';
  }

  private sectionHeader(container: HTMLDivElement, text: string) {
    const h = document.createElement('div');
    h.textContent = text;
    h.style.cssText = `
      font-size:26px;font-weight:bold;color:${AMBER};
      padding:10px 0 4px 0;border-bottom:1px solid #444;margin-bottom:6px;
    `;
    container.appendChild(h);
  }

  dispose() {
    this.el.remove();
  }
}
