/**
 * ResearchPanel.ts — Side panel showing tech tree and disease research.
 * Two tabs: Tech | Disease. Matches original ResearchMenu.lua layout.
 */

import { researchSystem } from '../research/ResearchSystem';
import { RESEARCH_DEFS } from '../research/ResearchData';
import { Malady, type ResearchEntry } from '../malady/Malady';
import { GameRules } from '../core/GameRules';

const AMBER = '#dfa200';
const PANEL_W = 340;

export class ResearchPanel {
  private el: HTMLDivElement;
  private contentEl!: HTMLDivElement;
  private visible = false;
  private currentTab: 'tech' | 'disease' = 'tech';

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.id = 'research-panel';
    this.el.style.cssText = `
      position:absolute;left:296px;top:10px;width:${PANEL_W}px;
      background:rgba(0,0,0,0.85);border:1px solid ${AMBER};
      color:#ccc;font-family:monospace;font-size:13px;
      display:none;pointer-events:auto;z-index:15;
      max-height:80vh;overflow-y:auto;
    `;

    this.contentEl = document.createElement('div');
    this.el.appendChild(this.contentEl);

    parent.appendChild(this.el);
  }

  show() {
    this.visible = true;
    this.el.style.display = 'block';
  }

  hide() {
    this.visible = false;
    this.el.style.display = 'none';
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

    this.contentEl.innerHTML = '';

    // Header
    const header = document.createElement('div');
    header.style.cssText = `padding:8px;font-size:16px;font-weight:bold;color:${AMBER};border-bottom:1px solid #333;`;
    header.textContent = 'RESEARCH';
    this.contentEl.appendChild(header);

    // Tab row
    const tabRow = document.createElement('div');
    tabRow.style.cssText = 'display:flex;border-bottom:1px solid #333;';
    const tabs: { label: string; tab: 'tech' | 'disease' }[] = [
      { label: 'Tech', tab: 'tech' },
      { label: 'Disease', tab: 'disease' },
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
      });
      tabRow.appendChild(btn);
    }
    this.contentEl.appendChild(tabRow);

    // Tab content
    const body = document.createElement('div');
    body.style.cssText = 'padding:8px;';
    if (this.currentTab === 'tech') {
      this.renderTechTab(body);
    } else {
      this.renderDiseaseTab(body);
    }
    this.contentEl.appendChild(body);

    // Close button
    const closeBtn = document.createElement('div');
    closeBtn.textContent = '[X] Close';
    closeBtn.style.cssText = `
      text-align:center;padding:6px;cursor:pointer;color:${AMBER};
      border-top:1px solid #333;font-size:12px;
    `;
    closeBtn.addEventListener('click', () => this.hide());
    this.contentEl.appendChild(closeBtn);
  }

  private renderTechTab(container: HTMLDivElement) {
    const allResearch = researchSystem.getAllResearch();
    const activeId = researchSystem.getActiveResearch();
    const progress = researchSystem.getProgress();

    // Group into sections
    const active: [string, typeof allResearch[string]][] = [];
    const available: [string, typeof allResearch[string]][] = [];
    const completed: [string, typeof allResearch[string]][] = [];

    for (const [id, def] of Object.entries(allResearch)) {
      if (def.bDiscoverOnly) continue;
      if (id === activeId) active.push([id, def]);
      else if (def.completed) completed.push([id, def]);
      else if (def.available) available.push([id, def]);
    }

    // Active research
    if (active.length > 0) {
      this.sectionHeader(container, 'ACTIVE');
      for (const [id, def] of active) {
        const row = this.makeResearchRow(def.friendlyName, def.description, def.nCost);
        const pct = Math.min(100, Math.round((progress / def.nCost) * 100));
        row.appendChild(this.progressBar(pct));
        container.appendChild(row);
      }
    }

    // Available research
    if (available.length > 0) {
      this.sectionHeader(container, 'AVAILABLE');
      for (const [id, def] of available) {
        const row = this.makeResearchRow(def.friendlyName, def.description, def.nCost);
        if (def.prerequisites.length > 0) {
          const prereqText = document.createElement('div');
          prereqText.style.cssText = 'font-size:10px;color:#666;margin-top:2px;';
          const prereqNames = def.prerequisites
            .map(p => RESEARCH_DEFS[p]?.friendlyName ?? p)
            .join(', ');
          prereqText.textContent = `Requires: ${prereqNames}`;
          row.appendChild(prereqText);
        }
        // Start button
        if (!activeId) {
          const startBtn = document.createElement('div');
          startBtn.textContent = 'Start';
          startBtn.style.cssText = `
            display:inline-block;margin-top:4px;padding:2px 8px;
            border:1px solid ${AMBER};color:${AMBER};cursor:pointer;font-size:11px;
          `;
          startBtn.addEventListener('click', () => {
            researchSystem.startResearch(id);
          });
          startBtn.addEventListener('mouseenter', () => { startBtn.style.background = 'rgba(223,162,0,0.2)'; });
          startBtn.addEventListener('mouseleave', () => { startBtn.style.background = 'transparent'; });
          row.appendChild(startBtn);
        }
        container.appendChild(row);
      }
    }

    // Completed research
    if (completed.length > 0) {
      this.sectionHeader(container, 'COMPLETED');
      for (const [, def] of completed) {
        const row = document.createElement('div');
        row.style.cssText = 'padding:4px 0;border-bottom:1px solid #222;';
        row.innerHTML = `
          <div style="color:#4f4;font-size:12px;">✓ ${def.friendlyName}</div>
          <div style="font-size:10px;color:#666;">${def.description}</div>
        `;
        container.appendChild(row);
      }
    }

    if (active.length === 0 && available.length === 0 && completed.length === 0) {
      container.innerHTML = `<div style="color:#888;text-align:center;padding:20px;">No research available</div>`;
    }
  }

  private renderDiseaseTab(container: HTMLDivElement) {
    const availableResearch = Malady.getAvailableResearch();
    const completedResearch = Malady.getCompletedResearch();

    if (availableResearch.length > 0) {
      this.sectionHeader(container, 'IN PROGRESS');
      for (const entry of availableResearch) {
        const row = document.createElement('div');
        row.style.cssText = 'padding:4px 0;border-bottom:1px solid #222;';
        const pct = Math.min(100, Math.round((entry.nCureProgress / entry.nResearchCure) * 100));
        row.innerHTML = `
          <div style="color:${AMBER};font-size:12px;">${entry.sMaladyName}</div>
          <div style="font-size:10px;color:#888;">Type: ${entry.sMaladyType}</div>
        `;
        row.appendChild(this.progressBar(pct));
        container.appendChild(row);
      }
    }

    if (completedResearch.length > 0) {
      this.sectionHeader(container, 'CURES DISCOVERED');
      for (const entry of completedResearch) {
        const row = document.createElement('div');
        row.style.cssText = 'padding:4px 0;border-bottom:1px solid #222;';
        row.innerHTML = `
          <div style="color:#4f4;font-size:12px;">✓ ${entry.sMaladyName}</div>
          <div style="font-size:10px;color:#666;">Type: ${entry.sMaladyType}</div>
        `;
        container.appendChild(row);
      }
    }

    if (availableResearch.length === 0 && completedResearch.length === 0) {
      container.innerHTML = `<div style="color:#888;text-align:center;padding:20px;">No diseases encountered</div>`;
    }
  }

  private sectionHeader(container: HTMLDivElement, text: string) {
    const h = document.createElement('div');
    h.textContent = text;
    h.style.cssText = `
      font-size:11px;font-weight:bold;color:${AMBER};
      padding:6px 0 2px 0;border-bottom:1px solid #444;margin-bottom:4px;
    `;
    container.appendChild(h);
  }

  private makeResearchRow(name: string, desc: string, cost: number): HTMLDivElement {
    const row = document.createElement('div');
    row.style.cssText = 'padding:4px 0;border-bottom:1px solid #222;';
    row.innerHTML = `
      <div style="display:flex;justify-content:space-between;">
        <span style="color:${AMBER};font-size:12px;">${name}</span>
        <span style="font-size:10px;color:#888;">Cost: ${cost}</span>
      </div>
      <div style="font-size:10px;color:#888;margin-top:2px;">${desc}</div>
    `;
    return row;
  }

  private progressBar(pct: number): HTMLDivElement {
    const bar = document.createElement('div');
    bar.style.cssText = 'margin-top:4px;';
    bar.innerHTML = `
      <div style="display:flex;align-items:center;">
        <div style="flex:1;height:6px;background:#222;">
          <div style="width:${pct}%;height:100%;background:${AMBER};"></div>
        </div>
        <span style="width:35px;text-align:right;font-size:10px;color:#888;">${pct}%</span>
      </div>
    `;
    return bar;
  }

  dispose() {
    this.el.remove();
  }
}
