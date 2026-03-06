/**
 * JobRoster.ts — Fullscreen overlay for managing character job assignments.
 * Matches original JobRoster.lua: grid of characters × jobs with competency values.
 */

import type { Character } from '../characters/Character';
import { JOB_NAMES, tJobs } from '../characters/CharacterConstants';

const AMBER = '#dfa200';

export class JobRoster {
  private el: HTMLDivElement;
  private tableBody!: HTMLTableSectionElement;
  private visible = false;
  private getCharacters: () => Character[];
  private onSetJob: (character: Character, jobId: number) => void;
  private onOpen: () => void;
  private onClose: () => void;
  private sortColumn: number | null = null;
  private sortAsc = true;
  private jobCountCells: HTMLElement[] = [];

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

    this.el = document.createElement('div');
    this.el.id = 'job-roster';
    this.el.style.cssText = `
      position:fixed;top:0;left:0;width:100%;height:100%;
      background:rgba(0,0,0,0.9);z-index:100;display:none;
      font-family:monospace;pointer-events:auto;
      display:flex;align-items:center;justify-content:center;
    `;
    this.el.style.display = 'none';

    const panel = document.createElement('div');
    panel.style.cssText = `
      background:rgba(10,10,10,0.95);border:2px solid ${AMBER};
      padding:20px;max-width:900px;width:90%;max-height:80vh;
      overflow-y:auto;
    `;

    // Header
    const headerRow = document.createElement('div');
    headerRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;';
    headerRow.innerHTML = `
      <span style="font-size:20px;font-weight:bold;color:${AMBER};">JOB ROSTER</span>
    `;
    const closeBtn = document.createElement('span');
    closeBtn.textContent = '[Close]';
    closeBtn.style.cssText = `font-size:14px;color:${AMBER};cursor:pointer;`;
    closeBtn.addEventListener('click', () => this.hide());
    headerRow.appendChild(closeBtn);
    panel.appendChild(headerRow);

    // Table
    const table = document.createElement('table');
    table.style.cssText = 'width:100%;border-collapse:collapse;color:#ccc;font-size:13px;';

    // Table header
    const thead = document.createElement('thead');
    const headerTr = document.createElement('tr');

    const headers = ['Name', 'Job', ...tJobs.map(j => this.shortJobName(j))];
    for (let i = 0; i < headers.length; i++) {
      const th = document.createElement('th');
      th.textContent = headers[i];
      th.style.cssText = `
        text-align:left;padding:6px 4px;border-bottom:1px solid ${AMBER};
        color:${AMBER};cursor:pointer;font-size:12px;white-space:nowrap;
      `;
      const colIdx = i;
      th.addEventListener('click', () => {
        if (this.sortColumn === colIdx) {
          this.sortAsc = !this.sortAsc;
        } else {
          this.sortColumn = colIdx;
          this.sortAsc = true;
        }
        this.refresh();
      });
      headerTr.appendChild(th);
    }
    // Job count row (Lua: job1Num, job2Num, ... job10Num labels)
    const countTr = document.createElement('tr');
    // Name + Job columns (empty)
    for (let i = 0; i < 2; i++) {
      const td = document.createElement('td');
      td.style.cssText = 'padding:2px 4px;font-size:10px;color:#666;';
      countTr.appendChild(td);
    }
    this.jobCountCells = [];
    for (let i = 0; i < tJobs.length; i++) {
      const td = document.createElement('td');
      td.style.cssText = `padding:2px 4px;text-align:center;font-size:10px;color:#888;border-bottom:1px solid #333;`;
      td.textContent = '0';
      countTr.appendChild(td);
      this.jobCountCells.push(td);
    }

    thead.appendChild(headerTr);
    thead.appendChild(countTr);
    table.appendChild(thead);

    this.tableBody = document.createElement('tbody');
    table.appendChild(this.tableBody);
    panel.appendChild(table);

    this.el.appendChild(panel);
    parent.appendChild(this.el);

    // Close on background click
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.hide();
    });
  }

  private shortJobName(jobId: number): string {
    const name = JOB_NAMES[jobId] ?? '?';
    return name.length > 4 ? name.substring(0, 3).toUpperCase() : name.toUpperCase();
  }

  show() {
    this.visible = true;
    this.el.style.display = 'flex';
    this.onOpen();
    this.refresh();
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
    while (this.tableBody.firstChild) this.tableBody.removeChild(this.tableBody.firstChild);

    let chars = [...this.getCharacters()].filter(c => c.isAlive());

    // Update per-column job count labels (Lua: tJobCount)
    const jobCounts: Record<number, number> = {};
    for (const jobId of tJobs) jobCounts[jobId] = 0;
    for (const c of chars) jobCounts[c.getJob()] = (jobCounts[c.getJob()] ?? 0) + 1;
    for (let i = 0; i < tJobs.length; i++) {
      if (this.jobCountCells[i]) {
        this.jobCountCells[i].textContent = String(jobCounts[tJobs[i]] ?? 0);
      }
    }

    // Sort
    if (this.sortColumn !== null) {
      const col = this.sortColumn;
      const dir = this.sortAsc ? 1 : -1;
      chars.sort((a, b) => {
        if (col === 0) {
          return a.getName().localeCompare(b.getName()) * dir;
        } else if (col === 1) {
          return a.getJobName().localeCompare(b.getJobName()) * dir;
        } else {
          const jobIdx = col - 2;
          const jobId = tJobs[jobIdx];
          const compA = a.tStats.tCompetency[jobId] ?? 0;
          const compB = b.tStats.tCompetency[jobId] ?? 0;
          return (compA - compB) * dir;
        }
        return 0;
      });
    }

    for (const char of chars) {
      const tr = document.createElement('tr');
      tr.style.cssText = 'border-bottom:1px solid #222;';

      // Name
      const nameTd = document.createElement('td');
      nameTd.textContent = char.getName();
      nameTd.style.cssText = 'padding:6px 4px;white-space:nowrap;';
      tr.appendChild(nameTd);

      // Current job
      const jobTd = document.createElement('td');
      jobTd.textContent = char.getJobName();
      jobTd.style.cssText = `padding:6px 4px;color:${AMBER};white-space:nowrap;`;
      tr.appendChild(jobTd);

      // Job competencies
      for (const jobId of tJobs) {
        const td = document.createElement('td');
        const comp = char.tStats.tCompetency[jobId] ?? 0;
        const isCurrent = char.getJob() === jobId;

        td.style.cssText = `
          padding:6px 4px;text-align:center;cursor:pointer;
          ${isCurrent ? `background:rgba(223,162,0,0.2);color:${AMBER};font-weight:bold;` : ''}
        `;
        td.textContent = comp.toFixed(1);

        td.addEventListener('click', () => {
          this.onSetJob(char, jobId);
          this.refresh();
        });
        td.addEventListener('mouseenter', () => {
          td.style.background = 'rgba(223,162,0,0.3)';
        });
        td.addEventListener('mouseleave', () => {
          td.style.background = isCurrent ? 'rgba(223,162,0,0.2)' : 'transparent';
        });

        tr.appendChild(td);
      }

      this.tableBody.appendChild(tr);
    }
  }

  update() {
    if (this.visible) this.refresh();
  }

  dispose() {
    this.el.remove();
  }
}
