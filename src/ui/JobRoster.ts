/**
 * JobRoster.ts — Fullscreen overlay for managing character job assignments.
 * Matches original JobRoster.lua + JobRosterEntry.lua layout:
 * - Full-screen left-aligned overlay
 * - "Back" button with ESC hotkey
 * - Star ratings (5 levels) with competency-colored backgrounds
 * - Affinity emoticon faces per job cell
 * - Full job names in sortable column headers
 * - Job count row under headers
 */

import type { Character } from '../characters/Character';
import {
  JOB_NAMES, tJobs, UNEMPLOYED,
  DUTY_AFFINITY_LIKE, DUTY_AFFINITY_DISLIKE,
} from '../characters/CharacterConstants';
import { line } from '../localization/Localization';
import { playWarble } from './WarbleEffect';

const AMBER = '#dfa200';
const AMBER_RGB = '223,162,0';

// Lua CharacterConstants.tJobLevels — competency thresholds → star level
const COMPETENCY_LEVELS = [
  { nLevel: 1, nMinCompetency: 0 },
  { nLevel: 2, nMinCompetency: 0.16 },
  { nLevel: 3, nMinCompetency: 0.28 },
  { nLevel: 4, nMinCompetency: 0.60 },
  { nLevel: 5, nMinCompetency: 0.90 },
];

// Lua CharacterConstants.JOB_COMPETENCY_COLORS (RGB 0-1 → CSS)
const COMPETENCY_COLORS: Record<number, string> = {
  1: 'rgb(79,28,1)',     // dark brown-red
  2: 'rgb(105,69,14)',   // brown
  3: 'rgb(87,81,1)',     // olive
  4: 'rgb(37,78,0)',     // green
  5: 'rgb(28,91,118)',   // teal-blue
};

// Lua AFFINITY_ICONS — actual sprite images from UI sprite sheet
const AFFINITY_ICONS = [
  { icon: 'assets/ui/hud/ui_dialogicon_bigfrown.png', minAff: -10, color: '#ff3333' },
  { icon: 'assets/ui/hud/ui_dialogicon_frown.png', minAff: -7.5, color: '#ff8800' },
  { icon: 'assets/ui/hud/ui_dialogicon_meh.png', minAff: DUTY_AFFINITY_DISLIKE, color: AMBER },
  { icon: 'assets/ui/hud/ui_dialogicon_smile.png', minAff: DUTY_AFFINITY_LIKE, color: '#88cc00' },
  { icon: 'assets/ui/hud/ui_dialogicon_bigsmile.png', minAff: 7.5, color: '#44cc44' },
];

function getAffinityDisplay(affinity: number): { icon: string; color: string } {
  let result = AFFINITY_ICONS[0];
  for (const entry of AFFINITY_ICONS) {
    if (affinity >= entry.minAff) result = entry;
  }
  return result;
}

function getCompetencyLevel(competency: number): number {
  let level = 1;
  for (const entry of COMPETENCY_LEVELS) {
    if (competency > entry.nMinCompetency) level = entry.nLevel;
  }
  return level;
}

function renderStars(level: number): string {
  return '\u2605'.repeat(level);  // filled star ★
}

// Display columns: tJobs + UNEMPLOYED
const DISPLAY_JOBS = [...tJobs, UNEMPLOYED];

export class JobRoster {
  private el: HTMLDivElement;
  private scrollPane!: HTMLDivElement;
  private visible = false;
  private getCharacters: () => Character[];
  private onSetJob: (character: Character, jobId: number) => void;
  private onOpen: () => void;
  private onClose: () => void;
  private sortColumn: number | null = 1; // default: sort by Name (column 1)
  private sortAsc = true;

  constructor(
    parent: HTMLElement,
    callbacks: {
      getCharacters: () => Character[];
      onSetJob: (character: Character, jobId: number) => void;
      onOpen: () => void;
      onClose: () => void;
    },
  ) {
    this.getCharacters = callbacks.getCharacters;
    this.onSetJob = callbacks.onSetJob;
    this.onOpen = callbacks.onOpen;
    this.onClose = callbacks.onClose;

    // Full-screen overlay (Lua: nBGWidth=1925, left-aligned, full height)
    this.el = document.createElement('div');
    this.el.id = 'job-roster';
    this.el.style.cssText = `
      position:fixed;top:0;left:0;width:100%;height:100%;
      background:rgba(0,0,0,0.92);z-index:100;display:none;
      font-family:'Dosis',sans-serif;pointer-events:auto;
    `;

    // Back button (Lua: BackButton + BackLabel + BackHotkey)
    const backBtn = document.createElement('div');
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
    backBtn.addEventListener('click', () => this.hide());
    this.el.appendChild(backBtn);

    // Title (Lua: RosterLabel at pos 380,-20, dosismedium44)
    const title = document.createElement('div');
    title.textContent = line('HUDHUD047TEXT');
    title.style.cssText = `
      position:absolute;top:20px;left:380px;
      color:${AMBER};font-size:44px;font-weight:500; /* Lua dosismedium44 */
    `;
    this.el.appendChild(title);

    // Scroll pane for the roster table (Lua: ScrollPane at pos 10,-250)
    this.scrollPane = document.createElement('div');
    this.scrollPane.style.cssText = `
      position:absolute;top:110px;left:10px;right:60px;bottom:20px;
      overflow-y:auto;overflow-x:auto;
    `;
    this.el.appendChild(this.scrollPane);

    parent.appendChild(this.el);
  }

  show() {
    this.visible = true;
    this.el.style.display = 'block';
    this.onOpen();
    this.refresh();
    playWarble(this.el, 0.3, 0.3);
  }

  hide() {
    this.visible = false;
    this.el.style.display = 'none';
    this.onClose();
  }

  toggle() {
    if (this.visible) this.hide();
    else this.show();
  }

  isVisible(): boolean {
    return this.visible;
  }

  private refresh() {
    while (this.scrollPane.firstChild) this.scrollPane.removeChild(this.scrollPane.firstChild);

    let chars = [...this.getCharacters()].filter(c => c.isAlive());

    // Compute job counts (Lua: CharacterManager.tJobCount)
    const jobCounts: Record<number, number> = {};
    for (const jobId of DISPLAY_JOBS) jobCounts[jobId] = 0;
    for (const c of chars) jobCounts[c.getJob()] = (jobCounts[c.getJob()] ?? 0) + 1;

    // Sort
    if (this.sortColumn !== null) {
      const col = this.sortColumn;
      const dir = this.sortAsc ? 1 : -1;
      chars.sort((a, b) => {
        if (col === 0) return (a.getJob() - b.getJob()) * dir;
        if (col === 1) return a.getName().localeCompare(b.getName()) * dir;
        const jobIdx = col - 2;
        const jobId = DISPLAY_JOBS[jobIdx];
        if (jobId === UNEMPLOYED) return (a.getJob() - b.getJob()) * dir;
        const compA = a.tStats.tCompetency[jobId] ?? 0;
        const compB = b.tStats.tCompetency[jobId] ?? 0;
        return (compA - compB) * dir;
      });
    }

    const table = document.createElement('table');
    table.style.cssText = 'border-collapse:collapse;color:#ccc;font-size:22px;width:100%;'; // Lua dosissemibold22 base

    // ── Header row ──
    const thead = document.createElement('thead');
    const headerTr = document.createElement('tr');
    const colDefs = [
      { label: line('HUDHUD032TEXT'), idx: 0 },
      { label: line('HUDHUD033TEXT'), idx: 1 },
      ...DISPLAY_JOBS.map((jobId, i) => ({
        label: JOB_NAMES[jobId] ?? '?',
        idx: i + 2,
      })),
    ];

    for (const colDef of colDefs) {
      const th = document.createElement('th');
      const arrow = this.sortColumn === colDef.idx
        ? (this.sortAsc ? ' \u25BC' : ' \u25B2')
        : '';
      th.textContent = colDef.label + arrow;
      th.style.cssText = `
        text-align:center;padding:8px 6px;
        border-bottom:2px solid #555;
        color:${AMBER};cursor:pointer;font-size:26px; /* Lua dosissemibold26 */
        font-weight:600;white-space:nowrap;
      `;
      if (colDef.idx <= 1) th.style.textAlign = 'left';
      th.addEventListener('click', () => {
        if (this.sortColumn === colDef.idx) {
          if (this.sortAsc) this.sortAsc = false;
          else { this.sortColumn = null; }
        } else {
          this.sortColumn = colDef.idx;
          this.sortAsc = true;
        }
        this.refresh();
      });
      headerTr.appendChild(th);
    }
    thead.appendChild(headerTr);

    // Job count row (Lua: job1Num..job10Num)
    const countTr = document.createElement('tr');
    for (let i = 0; i < 2; i++) {
      const td = document.createElement('td');
      td.style.cssText = 'padding:2px 6px;';
      countTr.appendChild(td);
    }
    for (const jobId of DISPLAY_JOBS) {
      const td = document.createElement('td');
      td.style.cssText = `
        text-align:center;padding:2px 6px;font-size:22px; /* Lua dosissemibold22 */
        color:#888;border-bottom:1px solid #333;
      `;
      td.textContent = String(jobCounts[jobId] ?? 0);
      countTr.appendChild(td);
    }
    thead.appendChild(countTr);
    table.appendChild(thead);

    // ── Body rows (one per character) ──
    const tbody = document.createElement('tbody');
    for (const char of chars) {
      const tr = document.createElement('tr');
      tr.style.cssText = 'border-bottom:1px solid #1a1a1a;';

      // Job column (current job name)
      const jobTd = document.createElement('td');
      jobTd.textContent = char.getJobName();
      jobTd.style.cssText = `padding:6px;color:${AMBER};white-space:nowrap;font-size:26px;`; // Lua dosissemibold26
      tr.appendChild(jobTd);

      // Name column
      const nameTd = document.createElement('td');
      nameTd.textContent = char.getName();
      nameTd.style.cssText = 'padding:6px;white-space:nowrap;min-width:140px;cursor:pointer;font-size:26px;'; // Lua dosissemibold26
      nameTd.addEventListener('mouseenter', () => { nameTd.style.color = AMBER; });
      nameTd.addEventListener('mouseleave', () => { nameTd.style.color = '#ccc'; });
      tr.appendChild(nameTd);

      // Job competency + affinity cells
      const currentJob = char.getJob();
      for (const jobId of DISPLAY_JOBS) {
        const td = document.createElement('td');
        td.style.cssText = `
          text-align:center;padding:4px 2px;cursor:pointer;
          min-width:80px;position:relative;
        `;

        if (jobId === UNEMPLOYED) {
          const isCurrent = currentJob === UNEMPLOYED;
          td.textContent = isCurrent ? '\u2713' : '';
          td.style.color = isCurrent ? AMBER : '#666';
          if (isCurrent) {
            td.style.background = `rgba(${AMBER_RGB},0.15)`;
            td.style.fontWeight = 'bold';
          }
        } else {
          const comp = char.tStats.tCompetency[jobId] ?? 0;
          const level = getCompetencyLevel(comp);
          const isCurrent = currentJob === jobId;
          const bgColor = COMPETENCY_COLORS[level];

          // Star rating
          const stars = document.createElement('div');
          stars.textContent = renderStars(level);
          stars.style.cssText = `font-size:20px;color:${AMBER};letter-spacing:1px;`; // Lua dosissemibold20

          // Affinity emoticon — use actual sprite images from UI sheet
          const affinity = char.getJobAffinity(jobId);
          const affDisplay = getAffinityDisplay(affinity);
          const affEl = document.createElement('div');
          affEl.style.cssText = 'margin-top:1px;text-align:center;';
          const affImg = document.createElement('img');
          affImg.src = affDisplay.icon;
          affImg.style.cssText = 'width:18px;height:18px;image-rendering:pixelated;';
          affEl.appendChild(affImg);

          td.appendChild(stars);
          td.appendChild(affEl);

          td.style.background = isCurrent
            ? `rgba(${AMBER_RGB},0.2)`
            : bgColor;
          if (isCurrent) {
            td.style.outline = `2px solid ${AMBER}`;
            td.style.outlineOffset = '-2px';
          }
        }

        td.addEventListener('click', () => {
          this.onSetJob(char, jobId);
          this.refresh();
        });
        td.addEventListener('mouseenter', () => {
          td.style.filter = 'brightness(1.4)';
        });
        td.addEventListener('mouseleave', () => {
          td.style.filter = '';
        });

        tr.appendChild(td);
      }

      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    this.scrollPane.appendChild(table);
  }

  update() {
    if (this.visible) this.refresh();
  }

  dispose() {
    this.el.remove();
  }
}
