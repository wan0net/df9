/**
 * BedZone.ts — Residential zone subclass.
 * Mirrors Zones/BedZone.lua: bed assignment tracking.
 */

import { Zone } from './Zone';
import { ZoneType } from '../world/ZoneType';

export class BedZone extends Zone {
  /** Map of bed object ID → assigned character ID (or null if unassigned) */
  private bedAssignments: Map<number, number | null> = new Map();

  constructor() {
    super(ZoneType.RESIDENCE);
  }

  protected generateUniqueName(): string {
    const num = Math.floor(Math.random() * 99) + 1;
    const letter = Math.random() < 0.5 ? String.fromCharCode(97 + Math.floor(Math.random() * 26)) : '';
    return `Residence Zone ${num}${letter}`;
  }

  /** Register a bed object as available for assignment. */
  addBed(bedId: number) {
    if (!this.bedAssignments.has(bedId)) {
      this.bedAssignments.set(bedId, null);
    }
  }

  /** Remove a bed from assignment tracking. */
  removeBed(bedId: number) {
    this.bedAssignments.delete(bedId);
  }

  /** Assign a character to a bed. Returns true on success. */
  assignChar(bedId: number, charId: number): boolean {
    if (!this.bedAssignments.has(bedId)) return false;
    if (this.bedAssignments.get(bedId) !== null) return false;
    this.bedAssignments.set(bedId, charId);
    return true;
  }

  /** Unassign a character from their bed. */
  unassignChar(charId: number) {
    for (const [bedId, assignedChar] of this.bedAssignments) {
      if (assignedChar === charId) {
        this.bedAssignments.set(bedId, null);
        return;
      }
    }
  }

  /** Check if a character is assigned to a bed in this zone. */
  isCharAssigned(charId: number): boolean {
    for (const assignedChar of this.bedAssignments.values()) {
      if (assignedChar === charId) return true;
    }
    return false;
  }

  /** Get the bed ID assigned to a character, or null. */
  getBedForChar(charId: number): number | null {
    for (const [bedId, assignedChar] of this.bedAssignments) {
      if (assignedChar === charId) return bedId;
    }
    return null;
  }

  /** Get available (unassigned) bed slots. */
  getAvailableBeds(): number[] {
    const available: number[] = [];
    for (const [bedId, assignedChar] of this.bedAssignments) {
      if (assignedChar === null) available.push(bedId);
    }
    return available;
  }
}
