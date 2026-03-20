/**
 * BrigZone.ts — Brig zone subclass.
 * Mirrors Zones/BrigZone.lua: prisoner assignment slots, cuff/imprison tracking.
 */

import { Zone } from './Zone';
import { ZoneType } from '../world/ZoneType';
import type { Room } from '../rooms/Room';

/** Static registry of all brig zones keyed by room ID. */
const brigsByRoomId: Map<number, BrigZone> = new Map();

export class BrigZone extends Zone {
  /**
   * Assignment slots: each entry has an optional charId.
   * Mirrors Lua tAssignmentSlots — always keeps one empty trailing slot.
   */
  private tAssignmentSlots: Array<{ charId: number | null }> = [{ charId: null }];

  constructor() {
    super(ZoneType.BRIG);
  }

  protected generateUniqueName(): string {
    const num = Math.floor(Math.random() * 99) + 1;
    return `Brig Zone ${num}`;
  }

  /** Called when assigned to a room. Registers in the static brig map. */
  override setRoom(room: Room): void {
    super.setRoom(room);
    brigsByRoomId.set(room.id, this);
  }

  /** Remove this brig from the static registry (call when room is unzoned/destroyed). */
  remove(): void {
    if (this.room) {
      brigsByRoomId.delete(this.room.id);
    }
  }

  /** Assign a character to this brig. Returns true if newly assigned. */
  assignChar(charId: number): boolean {
    if (this.isCharAssigned(charId)) return false;

    // Find first empty slot or append
    let placed = false;
    for (const slot of this.tAssignmentSlots) {
      if (slot.charId === null) {
        slot.charId = charId;
        placed = true;
        break;
      }
    }
    if (!placed) {
      this.tAssignmentSlots.push({ charId });
    }

    // Ensure trailing empty slot (Lua pattern)
    this._ensureEmptyTrailingSlot();
    return true;
  }

  /** Unassign a prisoner by character ID. */
  unassignChar(charId: number): void {
    this.tAssignmentSlots = this.tAssignmentSlots.filter(s => s.charId !== charId);
    this._ensureEmptyTrailingSlot();
  }

  /** Check if a character is assigned to this brig. */
  isCharAssigned(charId: number): boolean {
    return this.tAssignmentSlots.some(s => s.charId === charId);
  }

  /** Get all assigned prisoner IDs (excludes empty slots). */
  getPrisoners(): number[] {
    return this.tAssignmentSlots
      .filter(s => s.charId !== null)
      .map(s => s.charId as number);
  }

  /** Number of currently assigned prisoners. */
  getPrisonerCount(): number {
    return this.tAssignmentSlots.filter(s => s.charId !== null).length;
  }

  /** Ensure there is always one empty slot at the end. */
  private _ensureEmptyTrailingSlot(): void {
    if (this.tAssignmentSlots.length === 0 ||
        this.tAssignmentSlots[this.tAssignmentSlots.length - 1].charId !== null) {
      this.tAssignmentSlots.push({ charId: null });
    }
  }

  // ── Static helpers ───────────────────────────────────────────

  /** Get all brig zones. */
  static getAllBrigs(): BrigZone[] {
    return Array.from(brigsByRoomId.values());
  }

  /** Find the BrigZone associated with a room, or null. */
  static findBrigForRoom(room: Room): BrigZone | null {
    return brigsByRoomId.get(room.id) ?? null;
  }

  /** Find which BrigZone a character is assigned to, or null. */
  static findBrigForChar(charId: number): BrigZone | null {
    for (const brig of brigsByRoomId.values()) {
      if (brig.isCharAssigned(charId)) return brig;
    }
    return null;
  }

  /**
   * Get the Room a character is assigned to as a brig prisoner.
   * Returns null if the character is not assigned or the room is no longer a brig.
   * Mirrors Lua BrigZone.getBrigRoomForChar().
   */
  static getBrigRoomForChar(charId: number): Room | null {
    const brig = BrigZone.findBrigForChar(charId);
    if (!brig || !brig.room) return null;
    if (brig.room.zone !== ZoneType.BRIG) {
      // Room was rezoned — release the prisoner
      brig.unassignChar(charId);
      return null;
    }
    return brig.room;
  }

  /** Reset all brigs (for new game). */
  static reset(): void {
    brigsByRoomId.clear();
  }
}
