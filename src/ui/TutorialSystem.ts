/**
 * TutorialSystem.ts — 20-stage guided tutorial matching Lua GameRules.lua.
 * Each stage has a completion condition. When met, the tutorial advances.
 * Displayed as a persistent text panel at the bottom of the screen.
 */

import { line } from '../localization/Localization';

const AMBER = '#dfa200';

interface TutorialStage {
  sName: string;
  sLC: string;
  /** Returns true when the stage is complete. */
  check: (providers: TutorialProviders) => boolean;
}

export interface TutorialProviders {
  hasZoomed: () => boolean;
  hasPanned: () => boolean;
  hasSelected: () => boolean;
  hasDeselected: () => boolean;
  hasSetTimeSpeed: () => boolean;
  hasBuiltO2Recycler: () => boolean;
  hasBuildConfirmed: () => boolean;
  hasAssignedBuilders: () => boolean;
  hasUsedVizModes: () => boolean;
  hasBuiltFoodReplicator: () => boolean;
  hasFlippedObject: () => boolean;
  hasBuiltAirlock: () => boolean;
  hasSpedUpTime: () => boolean;
  hasRepairedBreach: () => boolean;
  hasZonedResidence: () => boolean;
  hasMineConfirmed: () => boolean;
  hasAssignedTechs: () => boolean;
  hasExploredDerelict: () => boolean;
}

// 20 tutorial stages from Lua GameRules.lua:51-72
const STAGES: TutorialStage[] = [
  { sName: 'ZoomedView', sLC: 'TRAING001TEXT', check: (p) => p.hasZoomed() },
  { sName: 'PannedView', sLC: 'TRAING002TEXT', check: (p) => p.hasPanned() },
  { sName: 'SelectedSomething', sLC: 'TRAING003TEXT', check: (p) => p.hasSelected() },
  { sName: 'DeselectedThing', sLC: 'TRAING017TEXT', check: (p) => p.hasDeselected() },
  { sName: 'SetTimeSpeed', sLC: 'TRAING004TEXT', check: (p) => p.hasSetTimeSpeed() },
  { sName: 'BuiltO2', sLC: 'TRAING005TEXT', check: (p) => p.hasBuiltO2Recycler() },
  { sName: 'BuildConfirm', sLC: 'TRAING013TEXT', check: (p) => p.hasBuildConfirmed() },
  { sName: 'AssignedBuilders', sLC: 'TRAING012TEXT', check: (p) => p.hasAssignedBuilders() },
  { sName: 'UsedVizModes', sLC: 'TRAING020TEXT', check: (p) => p.hasUsedVizModes() },
  { sName: 'SelectedFoodRep', sLC: 'TRAING006TEXT', check: (p) => p.hasBuiltFoodReplicator() },
  { sName: 'FlippedObject', sLC: 'TRAING018TEXT', check: (p) => p.hasFlippedObject() },
  { sName: 'BuiltAirlock', sLC: 'TRAING008TEXT', check: (p) => p.hasBuiltAirlock() },
  { sName: 'SpeedUpTime', sLC: 'TRAING015TEXT', check: (p) => p.hasSpedUpTime() },
  { sName: 'RepairedBreach', sLC: 'TRAING007TEXT', check: (p) => p.hasRepairedBreach() },
  { sName: 'ZonedResidence', sLC: 'TRAING010TEXT', check: (p) => p.hasZonedResidence() },
  { sName: 'MineConfirm', sLC: 'TRAING014TEXT', check: (p) => p.hasMineConfirmed() },
  { sName: 'AssignedTechs', sLC: 'TRAING019TEXT', check: (p) => p.hasAssignedTechs() },
  { sName: 'ExploredDerelict', sLC: 'TRAING009TEXT', check: (p) => p.hasExploredDerelict() },
  { sName: 'Final1', sLC: 'TRAING011TEXT', check: () => true }, // auto-advance after display
  { sName: 'Final2', sLC: 'TRAING016TEXT', check: () => true }, // auto-advance after display
];

// Lua: Final stages have 30-second delays
const FINAL_STAGE_DELAY = 30;

export class TutorialSystem {
  private currentStage = 0;
  private active = false;
  private providers: TutorialProviders | null = null;
  private overlay: HTMLDivElement | null = null;
  private textEl: HTMLDivElement | null = null;
  private stageTimer = 0;
  private completedConditions = new Set<string>();

  start(container: HTMLElement, providers: TutorialProviders) {
    this.active = true;
    this.currentStage = 0;
    this.providers = providers;
    this.stageTimer = 0;
    this.completedConditions.clear();

    // Create tutorial text panel (bottom of screen, matching Lua tutorialText)
    this.overlay = document.createElement('div');
    this.overlay.id = 'tutorial-panel';
    this.overlay.style.cssText = `
      position:absolute;bottom:40px;left:50%;transform:translateX(-50%);
      max-width:700px;width:90%;z-index:80;pointer-events:none;
    `;

    const bg = document.createElement('div');
    bg.style.cssText = `
      background:rgba(0,0,0,0.85);border:1px solid ${AMBER};
      padding:16px 24px;border-radius:4px;
    `;

    const header = document.createElement('div');
    header.textContent = 'TUTORIAL';
    header.style.cssText = `
      color:${AMBER};font-family:'Dosis',sans-serif;font-size:35px; /* Lua dosissemibold35 */
      margin-bottom:8px;letter-spacing:1px;opacity:0.7;
    `;
    bg.appendChild(header);

    this.textEl = document.createElement('div');
    this.textEl.style.cssText = `
      color:#fff;font-family:'Dosis',sans-serif;font-size:30px; /* Lua dosissemibold30 */
      line-height:1.5;
    `;
    bg.appendChild(this.textEl);

    this.overlay.appendChild(bg);
    container.appendChild(this.overlay);

    this.updateDisplay();
  }

  /** Mark a tutorial condition as completed (called from input handlers). */
  completeCondition(sName: string) {
    this.completedConditions.add(sName);
  }

  /** Check if a condition is completed. */
  isConditionComplete(sName: string): boolean {
    return this.completedConditions.has(sName);
  }

  update(dt: number) {
    if (!this.active || !this.providers) return;
    if (this.currentStage >= STAGES.length) {
      this.stop();
      return;
    }

    const stage = STAGES[this.currentStage];

    // Check completion
    let isComplete = false;

    // Final stages use timer-based completion (Lua: 30s delay)
    if (stage.sName === 'Final1' || stage.sName === 'Final2') {
      this.stageTimer += dt;
      if (this.stageTimer >= FINAL_STAGE_DELAY) {
        isComplete = true;
      }
    } else {
      // Check via completedConditions or provider checks
      isComplete = this.completedConditions.has(stage.sName) || stage.check(this.providers);
    }

    if (isComplete) {
      this.completedConditions.add(stage.sName);
      this.currentStage++;
      this.stageTimer = 0;
      this.updateDisplay();
    }
  }

  private updateDisplay() {
    if (!this.textEl) return;
    if (this.currentStage >= STAGES.length) {
      this.stop();
      return;
    }
    const stage = STAGES[this.currentStage];
    this.textEl.textContent = line(stage.sLC);
  }

  stop() {
    this.active = false;
    this.overlay?.remove();
    this.overlay = null;
    this.textEl = null;
  }

  isActive(): boolean {
    return this.active;
  }

  getCurrentStage(): number {
    return this.currentStage;
  }

  getTotalStages(): number {
    return STAGES.length;
  }

  getCompletedConditions(): string[] {
    return Array.from(this.completedConditions);
  }
}
