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
        const icon = this.getResearchIcon(def.sName);
        container.appendChild(this.makeResearchEntry(
          def.friendlyName, def.description, icon, progress, def.nCost, false,
        ));
      }
    }

    // Available research
    if (available.length > 0) {
      this.sectionHeader(container, line('RSCHUI009TEXT'));
      for (const [id, def] of available) {
        const icon = this.getResearchIcon(id);
        const entry = this.makeResearchEntry(
          def.friendlyName, def.description, icon, 0, def.nCost, false,
        );
        // Click to start research
        if (!activeId) {
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
        const icon = this.getResearchIcon(def.sName);
        container.appendChild(this.makeResearchEntry(
          def.friendlyName, def.description, '✓', def.nCost, def.nCost, true,
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

    for (const entry of availableResearch) {
      const desc = `${line('RSCHUI014TEXT')} ${entry.sMaladyType}`;
      const el = this.makeResearchEntry(
        entry.sMaladyName, desc, '+',
        entry.nCureProgress, entry.nResearchCure, false,
      );
      container.appendChild(el);
    }

    for (const entry of completedResearch) {
      const desc = `${line('RSCHUI014TEXT')} ${entry.sMaladyType}`;
      const el = this.makeResearchEntry(
        entry.sMaladyName, desc, '✓',
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
   * Create a research entry matching the screenshot layout:
   * rounded amber-bordered name bar (icon + name + progress) above description shade box.
   * Mirrors GoalEntry pattern from GoalEntryLayout.lua / ZoneResearchButtonLayout.lua.
   */
  private makeResearchEntry(
    name: string, desc: string, icon: string,
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
    const iconEl = document.createElement('span');
    iconEl.textContent = icon;
    iconEl.style.cssText = `
      margin-left:20px;font-size:28px;min-width:36px;text-align:center;
      color:${AMBER};
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
      iconEl.style.color = '#000';
      descBox.style.background = 'rgba(223,162,0,0.25)';
    });
    entry.addEventListener('mouseleave', () => {
      nameBar.style.background = '#000';
      nameEl.style.color = AMBER;
      iconEl.style.color = AMBER;
      descBox.style.background = 'rgba(223,162,0,0.1)';
    });

    return entry;
  }

  /** Map research ID to a simple icon character (Lua uses UI/JobRoster sprites). */
  private getResearchIcon(id: string): string {
    // Map by research type/unlocks — approximate the Lua sprite icons
    if (id.includes('Reactor') || id.includes('Power') || id.includes('DarkMatter')) return '⚛';
    if (id.includes('Vaporize') || id.includes('Build')) return 'T';
    if (id.includes('Green') || id.includes('Garden') || id.includes('Botani')) return '♥';
    if (id.includes('Refinery') || id.includes('Matter')) return '▶';
    if (id.includes('Suit') || id.includes('Space')) return '◉';
    if (id.includes('Security') || id.includes('Turret')) return '⚔';
    if (id.includes('Medical') || id.includes('Hospital')) return '+';
    if (id.includes('Fitness') || id.includes('Gym')) return '★';
    return '◆';
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
