/**
 * ResearchZone.ts — Research lab zone subclass.
 * Mirrors Zones/ResearchZone.lua: active research tracking.
 */

import { Zone } from './Zone';
import { ZoneType } from '../world/ZoneType';

export class ResearchZone extends Zone {
  private activeResearch: string | null = null;

  constructor() {
    super(ZoneType.RESEARCH);
  }

  protected generateUniqueName(): string {
    const letters = [
      'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta',
      'Eta', 'Theta', 'Iota', 'Kappa', 'Lambda', 'Mu',
    ];
    return `Research Lab ${letters[Math.floor(Math.random() * letters.length)]}`;
  }

  setActiveResearch(researchId: string | null) {
    this.activeResearch = researchId;
  }

  getActiveResearch(): string | null {
    return this.activeResearch;
  }

  hasActiveResearch(): boolean {
    return this.activeResearch !== null;
  }
}
