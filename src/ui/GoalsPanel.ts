/**
 * GoalsPanel.ts — Full-screen overlay showing goal/achievement progress.
 * Matches original GoalsList.lua + GoalsListLayout.lua + GoalEntry.lua:
 * full-screen overlay with Back+ESC, sort toggle buttons,
 * scrollable goal entries with progress bars and numeric progress labels.
 */

import { GOAL_DEFS } from '../goals/GoalData';
import type { GoalSystem } from '../goals/GoalSystem';
import { line } from '../localization/Localization';
import { playWarble } from './WarbleEffect';

const AMBER = '#dfa200';
const AMBER_DIM = 'rgba(223,162,0,0.15)';

// GoalEntryLayout.lua constants
const ENTRY_BAR_WIDTH = 300;
const ENTRY_BAR_X = 608;
const ENTRY_WIDTH = 940;
const ENTRY_SHADE_HEIGHT = 145;
const ENTRY_TOTAL_HEIGHT = ENTRY_SHADE_HEIGHT + 64; // 209
const ENTRY_MARGIN = 32;

export class GoalsPanel {
  private el: HTMLDivElement;
  private contentEl!: HTMLDivElement;
  private visible = false;
  private goalSystem: GoalSystem;
  private bCompletedFirst = false;
  private sortCompleteBtn!: HTMLDivElement;
  private sortUncompleteBtn!: HTMLDivElement;

  constructor(parent: HTMLElement, goalSystem: GoalSystem) {
    this.goalSystem = goalSystem;

    // Full-screen overlay (GoalsListLayout.lua: LargeBar = viewport size)
    this.el = document.createElement('div');
    this.el.id = 'goals-panel';
    this.el.style.cssText = `
      position:fixed;top:0;left:0;width:100%;height:100%;
      background:rgba(0,0,0,0.92);z-index:100;display:none;
      font-family:'Dosis',sans-serif;pointer-events:auto;
    `;

    // Back button (Lua: BackButton 286x98, BackLabel dosisregular40, BackHotkey dosissemibold22)
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

    // Title (GoalsListLayout.lua: GoalLabel pos(380,-20) dosismedium44)
    const title = document.createElement('div');
    title.style.cssText = `
      position:absolute;top:20px;left:380px;
      color:${AMBER};font-size:44px;font-weight:500; /* Lua dosismedium44 */
    `;
    title.textContent = line('HUDHUD052TEXT');
    this.el.appendChild(title);

    // Sort label (GoalsListLayout.lua: SortLabel pos(1031,-74) dosismedium32)
    const sortLabel = document.createElement('div');
    sortLabel.style.cssText = `
      position:absolute;top:74px;left:1031px;
      color:${AMBER};font-size:32px;font-weight:500; /* Lua dosismedium32 */
    `;
    sortLabel.textContent = line('GOALSS014TEXT');
    this.el.appendChild(sortLabel);

    // Sort buttons (GoalsListLayout.lua: pos(1106,-80) and pos(1296,-80))
    this.sortCompleteBtn = this.createSortButton(
      line('GOALSS012TEXT'), 1106, 80, true
    );
    this.sortUncompleteBtn = this.createSortButton(
      line('GOALSS013TEXT'), 1296, 80, false
    );
    this.el.appendChild(this.sortCompleteBtn);
    this.el.appendChild(this.sortUncompleteBtn);

    // Scrollable content area (GoalsListLayout.lua: GoalScrollPane pos(550,-160) rect 970x(viewport-192))
    this.contentEl = document.createElement('div');
    this.contentEl.style.cssText = `
      position:absolute;top:160px;left:550px;width:970px;bottom:32px;
      overflow-y:auto;color:#ccc;font-size:22px; /* Lua dosissemibold22 base */
    `;
    this.el.appendChild(this.contentEl);

    parent.appendChild(this.el);
  }

  private createSortButton(label: string, x: number, y: number, isCompleteFirst: boolean): HTMLDivElement {
    const btn = document.createElement('div');
    btn.style.cssText = `
      position:absolute;top:${y}px;left:${x}px;
      padding:6px 16px;cursor:pointer;font-size:22px; /* Lua dosissemibold22 */
      border:1px solid ${AMBER};color:${AMBER};
      background:transparent;
    `;
    btn.textContent = label;
    btn.addEventListener('click', () => {
      this.bCompletedFirst = isCompleteFirst;
      this.updateSortButtonStyles();
      this.update();
    });
    btn.addEventListener('mouseenter', () => {
      if ((isCompleteFirst && !this.bCompletedFirst) || (!isCompleteFirst && this.bCompletedFirst)) {
        btn.style.background = 'rgba(223,162,0,0.2)';
      }
    });
    btn.addEventListener('mouseleave', () => {
      this.updateSortButtonStyles();
    });
    return btn;
  }

  private updateSortButtonStyles() {
    // Active button = filled amber bg, black text; inactive = transparent bg, amber text
    this.sortCompleteBtn.style.background = this.bCompletedFirst ? AMBER : 'transparent';
    this.sortCompleteBtn.style.color = this.bCompletedFirst ? '#000' : AMBER;
    this.sortUncompleteBtn.style.background = !this.bCompletedFirst ? AMBER : 'transparent';
    this.sortUncompleteBtn.style.color = !this.bCompletedFirst ? '#000' : AMBER;
  }

  show() {
    this.visible = true;
    this.el.style.display = 'block';
    this.updateSortButtonStyles();
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

    // Get all goals with progress and sort (GoalsList.lua:getAllGoals)
    const allProgress = this.goalSystem.getAllGoalProgress();
    const sorted = this.sortGoals(allProgress);

    for (const gp of sorted) {
      const goal = GOAL_DEFS.find(g => g.sName === gp.sName);
      if (!goal) continue;
      this.contentEl.appendChild(this.createGoalEntry(gp, goal));
    }
  }

  /** Sort goals matching GoalsList.lua sort logic. */
  private sortGoals(goals: { sName: string; friendlyName: string; progress: number; completed: boolean; nProgress: number; nTarget: number }[]) {
    const indexed = goals.map((g, i) => ({ ...g, nTieBreaker: i }));
    indexed.sort((x, y) => {
      // Sort completed to top or bottom depending on toggle
      if (this.bCompletedFirst) {
        if (x.completed && !y.completed) return -1;
        if (y.completed && !x.completed) return 1;
      } else {
        if (!x.completed && y.completed) return -1;
        if (x.completed && !y.completed) return 1;
      }
      // Sort by progress ratio (higher first)
      const ratioX = x.nTarget > 0 ? x.nProgress / x.nTarget : 0;
      const ratioY = y.nTarget > 0 ? y.nProgress / y.nTarget : 0;
      if (ratioX !== ratioY) return ratioY - ratioX;
      // Tie-break by original index (higher index first, matching Lua)
      return y.nTieBreaker - x.nTieBreaker;
    });
    return indexed;
  }

  /** Create a goal entry matching GoalEntryLayout.lua. */
  private createGoalEntry(
    gp: { sName: string; friendlyName: string; completed: boolean; nProgress: number; nTarget: number },
    goal: { friendlyName: string; description: string; sDescLC: string; nThreshold: number }
  ): HTMLDivElement {
    const bComplete = gp.completed;
    const entry = document.createElement('div');
    entry.style.cssText = `
      position:relative;width:${ENTRY_WIDTH}px;
      height:${ENTRY_TOTAL_HEIGHT - ENTRY_MARGIN}px;
      margin-bottom:${ENTRY_MARGIN}px;
    `;

    // Name bar background (Lua: rounded bar from x=0, amber outline)
    const nameBar = document.createElement('div');
    nameBar.style.cssText = `
      position:absolute;top:0;left:0;right:0;height:64px;
      background:#000;border:2px solid ${AMBER};border-radius:32px;
      display:flex;align-items:center;box-sizing:border-box;
    `;

    // Goal icon (GoalEntryLayout.lua: GoalIcon pos(20,-16))
    const icon = document.createElement('span');
    icon.style.cssText = `
      margin-left:20px;font-size:28px;min-width:36px;text-align:center; /* Lua dosissemibold28 */
      color:${AMBER};
    `;
    // checkCircle for complete, iconHelp (?) for incomplete
    icon.textContent = bComplete ? '\u2713' : '?';

    // Goal name (GoalEntryLayout.lua: GoalName pos(64,-7) dosissemibold35)
    const nameEl = document.createElement('span');
    nameEl.style.cssText = `
      margin-left:12px;flex:1;font-size:35px;font-weight:600; /* Lua dosissemibold35 */
      color:${AMBER};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
    `;
    nameEl.textContent = gp.friendlyName;

    // Progress bar container (GoalEntryLayout.lua: nBarX=608, nBarWidth=300, nBarHeight=64)
    const barContainer = document.createElement('div');
    barContainer.style.cssText = `
      position:absolute;right:0;top:0;width:${ENTRY_BAR_WIDTH + 32}px;height:64px;
      display:flex;align-items:center;
    `;

    // Progress bar BG
    const barBg = document.createElement('div');
    barBg.style.cssText = `
      position:absolute;left:0;top:0;width:${ENTRY_BAR_WIDTH}px;height:64px;
      background:#111;border:2px solid ${AMBER};border-radius:32px;
      box-sizing:border-box;overflow:hidden;
    `;

    // Progress bar fill
    const pct = gp.nTarget > 0 ? Math.min(100, Math.round((gp.nProgress / gp.nTarget) * 100)) : 0;
    const fillPct = bComplete ? 100 : pct;
    const barFill = document.createElement('div');
    barFill.style.cssText = `
      width:${fillPct}%;height:100%;background:${AMBER};
      border-radius:30px 0 0 30px;
    `;
    if (fillPct >= 100) barFill.style.borderRadius = '30px';
    barBg.appendChild(barFill);

    // Progress label (GoalEntry.lua: "X / Y" or "Complete" or "")
    const progressLabel = document.createElement('span');
    progressLabel.style.cssText = `
      position:absolute;left:0;top:0;width:${ENTRY_BAR_WIDTH}px;height:64px;
      display:flex;align-items:center;justify-content:flex-end;
      padding-right:24px;box-sizing:border-box;
      font-size:22px;font-weight:600;color:${AMBER};
    `;
    let sProgress = '';
    if (bComplete) {
      sProgress = line('GOALSS009TEXT');
    } else if (gp.nTarget === 1) {
      sProgress = '';
    } else {
      sProgress = `${gp.nProgress} / ${gp.nTarget}`;
    }
    progressLabel.textContent = sProgress;

    barContainer.appendChild(barBg);
    barContainer.appendChild(progressLabel);

    nameBar.appendChild(icon);
    nameBar.appendChild(nameEl);
    nameBar.appendChild(barContainer);
    entry.appendChild(nameBar);

    // Description shade box (GoalEntryLayout.lua: DescShadeBox pos(0,-64) 940x145)
    const descBox = document.createElement('div');
    descBox.style.cssText = `
      position:absolute;top:64px;left:0;width:${ENTRY_WIDTH}px;
      height:${ENTRY_SHADE_HEIGHT - 64}px;
      background:${AMBER_DIM};padding:16px 24px;box-sizing:border-box;
      border-left:2px solid rgba(223,162,0,0.3);
      border-right:2px solid rgba(223,162,0,0.3);
      border-bottom:2px solid rgba(223,162,0,0.3);
    `;
    // GoalDescription (GoalEntryLayout.lua: pos(96,-115) dosissemibold28, rect 800 wide)
    const descEl = document.createElement('div');
    descEl.style.cssText = `
      font-size:28px;color:${AMBER};line-height:1.4; /* Lua dosissemibold28 */
    `;
    descEl.textContent = goal.description;
    descBox.appendChild(descEl);
    entry.appendChild(descBox);

    // Hover effects matching GoalEntryLayout.lua onHoverOn/Off
    entry.style.cursor = 'pointer';
    entry.addEventListener('mouseenter', () => {
      nameBar.style.background = AMBER;
      nameEl.style.color = '#000';
      icon.style.color = '#000';
      descBox.style.background = 'rgba(223,162,0,0.25)';
    });
    entry.addEventListener('mouseleave', () => {
      nameBar.style.background = '#000';
      nameEl.style.color = AMBER;
      icon.style.color = AMBER;
      descBox.style.background = AMBER_DIM;
    });

    return entry;
  }

  dispose() {
    this.el.remove();
  }
}
