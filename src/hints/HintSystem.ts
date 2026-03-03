/**
 * HintSystem.ts — Contextual tutorial hints.
 * Shows tips when specific game conditions are met for the first time.
 */

import { Base } from '../core/Base';

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
  message: string;
  check: (p: HintProviders) => boolean;
}

const HINTS: HintDef[] = [
  {
    id: 'build_room',
    message: 'Tip: Press C to enter room build mode. Drag to create an enclosed room for your crew.',
    check: (p) => !p.hasEnclosedRooms(),
  },
  {
    id: 'zone_room',
    message: 'Tip: Press Z to assign zones to rooms. Zones determine what activities happen there.',
    check: (p) => p.hasEnclosedRooms() && !p.hasZonedRoom(),
  },
  {
    id: 'place_objects',
    message: 'Tip: Press P to place objects. Generators provide power, fridges provide food.',
    check: (p) => p.hasZonedRoom() && !p.hasBuiltObject(),
  },
  {
    id: 'research',
    message: 'Tip: Assign a Scientist to a Research zone to unlock new technologies.',
    check: (p) => p.hasBuiltObject() && !p.hasStartedResearch(),
  },
  {
    id: 'combat',
    message: 'Warning: Hostile raiders detected! Assign Security personnel to defend the station.',
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
        Base.addAlert('hint', hint.message);
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
