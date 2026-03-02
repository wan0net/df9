/**
 * SquadList.ts — Squad registry.
 * Mirrors SquadList.lua.
 */

import { Squad } from './Squad';

class SquadListClass {
  private squads: Map<number, Squad> = new Map();
  private nextId = 1;

  createSquad(name: string): Squad {
    const squad = new Squad(this.nextId++, name);
    this.squads.set(squad.id, squad);
    return squad;
  }

  removeSquad(id: number) {
    this.squads.delete(id);
  }

  getSquad(id: number): Squad | undefined {
    return this.squads.get(id);
  }

  getSquadForChar(charId: number): Squad | undefined {
    for (const squad of this.squads.values()) {
      if (squad.hasMember(charId)) return squad;
    }
    return undefined;
  }

  getAllSquads(): Squad[] {
    return Array.from(this.squads.values());
  }
}

export const SquadList = new SquadListClass();
