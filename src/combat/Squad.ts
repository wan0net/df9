/**
 * Squad.ts — Squad management for organized combat.
 * Mirrors Squad.lua.
 */

export class Squad {
  id: number;
  name: string;
  memberIds: Set<number> = new Set();
  leaderId: number | null = null;

  constructor(id: number, name: string) {
    this.id = id;
    this.name = name;
  }

  addMember(charId: number) {
    this.memberIds.add(charId);
    if (this.leaderId === null) {
      this.leaderId = charId;
    }
  }

  removeMember(charId: number) {
    this.memberIds.delete(charId);
    if (this.leaderId === charId) {
      this.leaderId = this.memberIds.size > 0 ? this.memberIds.values().next().value! : null;
    }
  }

  getSize(): number {
    return this.memberIds.size;
  }

  hasMember(charId: number): boolean {
    return this.memberIds.has(charId);
  }
}
