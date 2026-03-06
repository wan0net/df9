/**
 * GoalsPanel.ts — Side panel showing goal/achievement progress.
 * Lists all 12 goals with completion status.
 */

import { GOAL_DEFS } from '../goals/GoalData';
import type { GoalSystem } from '../goals/GoalSystem';

const AMBER = '#dfa200';
const PANEL_W = 340;

export class GoalsPanel {
  private el: HTMLDivElement;
  private contentEl!: HTMLDivElement;
  private visible = false;
  private goalSystem: GoalSystem;

  constructor(parent: HTMLElement, goalSystem: GoalSystem) {
    this.goalSystem = goalSystem;

    this.el = document.createElement('div');
    this.el.id = 'goals-panel';
    this.el.style.cssText = `
      position:absolute;left:296px;top:10px;width:${PANEL_W}px;
      background:rgba(0,0,0,0.85);border:1px solid ${AMBER};
      color:#ccc;font-family:'Orbitron',monospace;font-size:13px;
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
    const completedCount = this.goalSystem.getCompletedCount();
    const totalGoals = this.goalSystem.getTotalGoals();
    const header = document.createElement('div');
    header.style.cssText = `padding:8px;font-size:16px;font-weight:bold;color:${AMBER};border-bottom:1px solid #333;`;
    header.textContent = `GOALS (${completedCount}/${totalGoals})`;
    this.contentEl.appendChild(header);

    // Goal list
    const body = document.createElement('div');
    body.style.cssText = 'padding:8px;';

    for (const goal of GOAL_DEFS) {
      const done = this.goalSystem.isCompleted(goal.sName);
      const row = document.createElement('div');
      row.style.cssText = `
        padding:6px 0;border-bottom:1px solid #222;
        display:flex;align-items:flex-start;gap:8px;
      `;

      const icon = document.createElement('span');
      icon.style.cssText = `font-size:14px;color:${done ? '#4f4' : '#444'};min-width:16px;`;
      icon.textContent = done ? '✓' : '○';

      const text = document.createElement('div');
      text.innerHTML = `
        <div style="color:${done ? '#4f4' : AMBER};font-size:12px;">${goal.friendlyName}</div>
        <div style="font-size:10px;color:#888;margin-top:2px;">${goal.description}</div>
      `;

      row.appendChild(icon);
      row.appendChild(text);
      body.appendChild(row);
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

  dispose() {
    this.el.remove();
  }
}
