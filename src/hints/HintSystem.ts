/**
 * HintSystem.ts — Contextual tutorial hints.
 * Shows tips when specific game conditions are met for the first time.
 */

import { Base } from '../core/Base';
import { line } from '../localization/Localization';

export interface HintProviders {
  hasEnclosedRooms: () => boolean;
  hasZonedRoom: () => boolean;
  hasStartedResearch: () => boolean;
  hasBuiltObject: () => boolean;
  getPopulation: () => number;
  hasHostiles: () => boolean;
}

interface HintDef {
  id: string;
  /** Linecode key for hint message. */
  sLC: string;
  check: (p: HintProviders) => boolean;
}

const HINTS: HintDef[] = [
  {
    id: 'build_room',
    sLC: 'HINTSX016TEXT',
    check: (p) => !p.hasEnclosedRooms(),
  },
  {
    id: 'zone_room',
    sLC: 'HINTSX026TEXT',
    check: (p) => p.hasEnclosedRooms() && !p.hasZonedRoom(),
  },
  {
    id: 'place_objects',
    sLC: 'HINTSX050TEXT',
    check: (p) => p.hasZonedRoom() && !p.hasBuiltObject(),
  },
  {
    id: 'research',
    sLC: 'HINTSX038TEXT',
    check: (p) => p.hasBuiltObject() && !p.hasStartedResearch(),
  },
  {
    id: 'combat',
    sLC: 'ALERTS017TEXT',
    check: (p) => p.hasHostiles(),
  },
];

export class HintSystem {
  private shownHints: Set<string> = new Set();
  private providers: HintProviders;
  private tickAccum = 0;
  private static readonly CHECK_INTERVAL = 10;

  constructor(providers: HintProviders) {
    this.providers = providers;
  }

  update(dt: number) {
    this.tickAccum += dt;
    if (this.tickAccum < HintSystem.CHECK_INTERVAL) return;
    this.tickAccum -= HintSystem.CHECK_INTERVAL;

    for (const hint of HINTS) {
      if (this.shownHints.has(hint.id)) continue;
      if (hint.check(this.providers)) {
        this.shownHints.add(hint.id);
        Base.addAlert('hint', line(hint.sLC));
        break; // One hint per check
      }
    }
  }

  getShownHints(): string[] {
    return Array.from(this.shownHints);
  }

  getSaveData() {
    return Array.from(this.shownHints);
  }

  loadSaveData(data: string[]) {
    this.shownHints = new Set(data);
  }
}
