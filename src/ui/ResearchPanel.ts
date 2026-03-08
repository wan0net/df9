/**
 * ResearchPanel.ts — Full-screen overlay for research assignment.
 * Matches original ResearchAssignment.lua: full-screen with Back+ESC,
 * Tech/Disease tabs, project list with progress bars.
 */

import { researchSystem } from '../research/ResearchSystem';
import { RESEARCH_DEFS } from '../research/ResearchData';
import { Malady } from '../malady/Malady';
import { line } from '../localization/Localization';
import { playWarble } from './WarbleEffect';

const AMBER = '#dfa200';

export class ResearchPanel {
  private el: HTMLDivElement;
  private contentEl!: HTMLDivElement;
  private visible = false;
  private currentTab: 'tech' | 'disease' = 'tech';

  constructor(parent: HTMLElement) {
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
        this.updateTabStyles();
      });
      tabRow.appendChild(btn);
      this.tabButtons.push({ btn, tab: t.tab });
    }
    this.el.appendChild(tabRow);

    // Scrollable content area
    this.contentEl = document.createElement('div');
    this.contentEl.style.cssText = `
      position:absolute;top:120px;left:380px;right:60px;bottom:20px;
      overflow-y:auto;color:#ccc;font-size:22px; /* Lua dosissemibold22 base */
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
    this.updateTabStyles();
    this.update();
    playWarble(this.el, 0.3, 0.3);
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

    while (this.contentEl.firstChild) this.contentEl.removeChild(this.contentEl.firstChild);
    this.updateTabStyles();

    if (this.currentTab === 'tech') {
      this.renderTechTab(this.contentEl);
    } else {
      this.renderDiseaseTab(this.contentEl);
    }
  }

  private renderTechTab(container: HTMLDivElement) {
    const allResearch = researchSystem.getAllResearch();
    const activeId = researchSystem.getActiveResearch();
    const progress = researchSystem.getProgress();

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
      this.sectionHeader(container, line('RSCHUI008TEXT'));
      for (const [, def] of active) {
        const row = this.makeResearchRow(def.friendlyName, def.description, def.nCost);
        const pct = Math.min(100, Math.round((progress / def.nCost) * 100));
        row.appendChild(this.progressBar(pct));
        container.appendChild(row);
      }
    }

    // Available research
    if (available.length > 0) {
      this.sectionHeader(container, line('RSCHUI009TEXT'));
      for (const [id, def] of available) {
        const row = this.makeResearchRow(def.friendlyName, def.description, def.nCost);
        if (def.prerequisites.length > 0) {
          const prereqText = document.createElement('div');
          prereqText.style.cssText = 'font-size:18px;color:#666;margin-top:2px;';
          const prereqNames = def.prerequisites
            .map(p => RESEARCH_DEFS[p]?.friendlyName ?? p)
            .join(', ');
          prereqText.textContent = `${line('RSCHUI001TEXT')} ${prereqNames}`;
          row.appendChild(prereqText);
        }
        // Start button
        if (!activeId) {
          const startBtn = document.createElement('div');
          startBtn.textContent = line('RSCHUI013TEXT');
          startBtn.style.cssText = `
            display:inline-block;margin-top:6px;padding:4px 16px;
            border:1px solid ${AMBER};color:${AMBER};cursor:pointer;font-size:22px;
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
      this.sectionHeader(container, line('RSCHUI010TEXT'));
      for (const [, def] of completed) {
        const row = document.createElement('div');
        row.style.cssText = 'padding:8px 0;border-bottom:1px solid #222;';
        const check = document.createElement('div');
        check.style.cssText = 'color:#4f4;font-size:22px;';
        check.textContent = '\u2713 ' + def.friendlyName;
        const desc = document.createElement('div');
        desc.style.cssText = 'font-size:18px;color:#666;margin-top:2px;';
        desc.textContent = def.description;
        row.appendChild(check);
        row.appendChild(desc);
        container.appendChild(row);
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

    if (availableResearch.length > 0) {
      this.sectionHeader(container, line('RSCHUI011TEXT'));
      for (const entry of availableResearch) {
        const row = document.createElement('div');
        row.style.cssText = 'padding:8px 0;border-bottom:1px solid #222;';
        const name = document.createElement('div');
        name.style.cssText = `color:${AMBER};font-size:26px;`; // Lua dosissemibold26
        name.textContent = entry.sMaladyName;
        const type = document.createElement('div');
        type.style.cssText = 'font-size:18px;color:#888;margin-top:2px;';
        type.textContent = `${line('RSCHUI014TEXT')} ${entry.sMaladyType}`;
        row.appendChild(name);
        row.appendChild(type);
        const pct = Math.min(100, Math.round((entry.nCureProgress / entry.nResearchCure) * 100));
        row.appendChild(this.progressBar(pct));
        container.appendChild(row);
      }
    }

    if (completedResearch.length > 0) {
      this.sectionHeader(container, line('RSCHUI012TEXT'));
      for (const entry of completedResearch) {
        const row = document.createElement('div');
        row.style.cssText = 'padding:8px 0;border-bottom:1px solid #222;';
        const check = document.createElement('div');
        check.style.cssText = 'color:#4f4;font-size:22px;';
        check.textContent = '\u2713 ' + entry.sMaladyName;
        const type = document.createElement('div');
        type.style.cssText = 'font-size:18px;color:#666;margin-top:2px;';
        type.textContent = `${line('RSCHUI014TEXT')} ${entry.sMaladyType}`;
        row.appendChild(check);
        row.appendChild(type);
        container.appendChild(row);
      }
    }

    if (availableResearch.length === 0 && completedResearch.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'color:#888;text-align:center;padding:40px;font-size:26px;';
      empty.textContent = line('RSCHUI016TEXT');
      container.appendChild(empty);
    }
  }

  private sectionHeader(container: HTMLDivElement, text: string) {
    const h = document.createElement('div');
    h.textContent = text;
    h.style.cssText = `
      font-size:26px;font-weight:bold;color:${AMBER}; /* Lua dosissemibold26 */
      padding:10px 0 4px 0;border-bottom:1px solid #444;margin-bottom:6px;
    `;
    container.appendChild(h);
  }

  private makeResearchRow(name: string, desc: string, cost: number): HTMLDivElement {
    const row = document.createElement('div');
    row.style.cssText = 'padding:8px 0;border-bottom:1px solid #222;';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;';
    const nameEl = document.createElement('span');
    nameEl.style.cssText = `color:${AMBER};font-size:26px;`; // Lua dosissemibold26
    nameEl.textContent = name;
    const costEl = document.createElement('span');
    costEl.style.cssText = 'font-size:18px;color:#888;'; // Lua dosissemibold18
    costEl.textContent = `${line('BUILDM023TEXT')} ${cost}`;
    header.appendChild(nameEl);
    header.appendChild(costEl);
    row.appendChild(header);

    const descEl = document.createElement('div');
    descEl.style.cssText = 'font-size:18px;color:#888;margin-top:2px;'; // Lua dosissemibold18
    descEl.textContent = desc;
    row.appendChild(descEl);

    return row;
  }

  private progressBar(pct: number): HTMLDivElement {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'margin-top:6px;display:flex;align-items:center;';
    const barOuter = document.createElement('div');
    barOuter.style.cssText = 'flex:1;height:8px;background:#222;';
    const barInner = document.createElement('div');
    barInner.style.cssText = `width:${pct}%;height:100%;background:${AMBER};`;
    barOuter.appendChild(barInner);
    const label = document.createElement('span');
    label.style.cssText = 'width:50px;text-align:right;font-size:18px;color:#888;margin-left:8px;'; // Lua dosissemibold18
    label.textContent = `${pct}%`;
    wrapper.appendChild(barOuter);
    wrapper.appendChild(label);
    return wrapper;
  }

  dispose() {
    this.el.remove();
  }
}
