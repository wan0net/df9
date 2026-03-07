/**
 * EmergencyBeacon.ts — Emergency beacon placement and squad command system.
 * Mirrors Lua Utility/EmergencyBeacon.lua.
 *
 * Beacons are placed by the player to direct security squads.
 * Two modes: MODE_TRAVELTO (go to location) and MODE_EXPLORE (explore hostile rooms).
 * Three violence levels: DEFAULT, LETHAL, NONLETHAL.
 */

import type { Squad } from './Squad';
import type { Character } from '../characters/Character';
import type { RoomManager } from '../rooms/RoomManager';

// ── Violence levels (matching Lua) ────────────────────────────────────
export const VIOLENCE_DEFAULT = 2;
export const VIOLENCE_LETHAL = 3;
export const VIOLENCE_NONLETHAL = 4;

// ── Beacon modes ─────────────────────────────────────────────────────
export const MODE_TRAVELTO = 'travelto';
export const MODE_EXPLORE = 'explore';

// ── Colors ───────────────────────────────────────────────────────────
export const COLOUR_VIOLENCE_HIGH = [0.9, 0, 0, 1];   // Lethal = red
export const COLOUR_VIOLENCE_MEDIUM = [0.93, 0.75, 0.23, 1]; // Default = amber
export const COLOUR_VIOLENCE_LOW = [138/255, 43/255, 226/255, 1]; // Nonlethal = purple

export const BEACON_TYPE_LINECODES: Record<number, string> = {
  [VIOLENCE_DEFAULT]: 'UIMISC032TEXT',
  [VIOLENCE_LETHAL]: 'UIMISC033TEXT',
  [VIOLENCE_NONLETHAL]: 'UIMISC034TEXT',
};

export interface BeaconData {
  tx: number;
  ty: number;
  eViolence: number;
  tMode: string;
  nCount: number;
  /** Characters that have responded to this beacon */
  tChars: Map<number, { nWaitTime: number; bArrived: boolean }>;
  nCharsAtBeacon: number;
  /** Target team for explore mode */
  nTargetTeam: number;
}

class EmergencyBeaconClass {
  private beacons: Map<string, BeaconData> = new Map(); // keyed by squad name
  private roomManager: RoomManager | null = null;

  init(roomManager: RoomManager) {
    this.roomManager = roomManager;
  }

  /** Place a beacon at a tile for a squad. */
  placeAt(squadName: string, tx: number, ty: number, nCount: number) {
    const tMode = this.getModeAt(tx, ty);

    const beacon: BeaconData = {
      tx,
      ty,
      eViolence: this.getViolence(squadName),
      tMode,
      nCount,
      tChars: new Map(),
      nCharsAtBeacon: 0,
      nTargetTeam: this.getTeamAtTile(tx, ty),
    };

    this.beacons.set(squadName, beacon);
  }

  /** Remove beacon for a squad. */
  removeBeacon(squadName: string) {
    this.beacons.delete(squadName);
  }

  /** Get beacon data for a squad. */
  getBeacon(squadName: string): BeaconData | undefined {
    return this.beacons.get(squadName);
  }

  /** Get all beacons. */
  getAllBeacons(): Map<string, BeaconData> {
    return this.beacons;
  }

  /** Check if a beacon exists for a squad. */
  hasBeacon(squadName: string): boolean {
    return this.beacons.has(squadName);
  }

  /** Get violence level for a squad. */
  getViolence(squadName: string): number {
    const beacon = this.beacons.get(squadName);
    return beacon?.eViolence ?? VIOLENCE_DEFAULT;
  }

  /** Set violence level for a squad. */
  setViolence(squadName: string, eViolence: number) {
    const beacon = this.beacons.get(squadName);
    if (beacon) {
      beacon.eViolence = eViolence;
    }
  }

  /** Determine beacon mode based on tile position (Lua getModeAt). */
  getModeAt(tx: number, ty: number): string {
    if (!this.roomManager) return MODE_TRAVELTO;
    const room = this.roomManager.getRoomAt(tx, ty);
    if (room && room.nTeam !== 1) { // TEAM_ID_PLAYER = 1
      return MODE_EXPLORE;
    }
    return MODE_TRAVELTO;
  }

  /** Get target team at tile. */
  private getTeamAtTile(tx: number, ty: number): number {
    if (!this.roomManager) return 0;
    const room = this.roomManager.getRoomAt(tx, ty);
    return room?.nTeam ?? 0;
  }

  /** Check if a beacon is still active for a character. */
  stillActive(charSquadName: string, tx: number, ty: number, mode: string): boolean {
    const beacon = this.beacons.get(charSquadName);
    if (!beacon) return false;
    return beacon.tx === tx && beacon.ty === ty && beacon.tMode === mode;
  }

  /** Mark character as responding to beacon. */
  charResponded(charId: number, squadName: string) {
    const beacon = this.beacons.get(squadName);
    if (!beacon) return;
    beacon.tChars.set(charId, { nWaitTime: 0, bArrived: false });
  }

  /** Mark character as arrived at beacon. */
  charArrived(charId: number, squadName: string) {
    const beacon = this.beacons.get(squadName);
    if (!beacon) return;
    const charData = beacon.tChars.get(charId);
    if (charData) {
      charData.bArrived = true;
    }
    // Recount arrived
    let nArrived = 0;
    for (const [, data] of beacon.tChars) {
      if (data.bArrived) nArrived++;
    }
    beacon.nCharsAtBeacon = nArrived;
  }

  /** Update waiting time for character at beacon. */
  charWaiting(charId: number, squadName: string, dt: number) {
    const beacon = this.beacons.get(squadName);
    if (!beacon) return;
    const charData = beacon.tChars.get(charId);
    if (charData) {
      charData.nWaitTime += dt;
    }
  }

  /** Remove character from beacon tracking. */
  charAbandoned(charId: number, squadName: string) {
    const beacon = this.beacons.get(squadName);
    if (!beacon) return;
    beacon.tChars.delete(charId);
  }

  /** Check if a character should wait at the beacon (Lua charShouldWait). */
  charShouldWait(squadName: string, squadSize: number): boolean {
    const beacon = this.beacons.get(squadName);
    if (!beacon) return false;
    if (beacon.tMode === MODE_TRAVELTO) return true;
    return beacon.nCharsAtBeacon < squadSize;
  }

  /** Check if beacon needs more responders. */
  needsMoreResponders(squadName: string): boolean {
    const beacon = this.beacons.get(squadName);
    if (!beacon) return false;
    return beacon.tChars.size < beacon.nCount;
  }

  /** Get color for violence level. */
  getViolenceColor(eViolence: number): number[] {
    switch (eViolence) {
      case VIOLENCE_LETHAL: return COLOUR_VIOLENCE_HIGH;
      case VIOLENCE_DEFAULT: return COLOUR_VIOLENCE_MEDIUM;
      case VIOLENCE_NONLETHAL: return COLOUR_VIOLENCE_LOW;
      default: return COLOUR_VIOLENCE_MEDIUM;
    }
  }

  /** Tick — cleanup beacons for explore mode if target rooms are gone. */
  onTick() {
    if (!this.roomManager) return;
    for (const [squadName, beacon] of this.beacons) {
      if (beacon.tMode === MODE_EXPLORE) {
        const room = this.roomManager.getRoomAt(beacon.tx, beacon.ty);
        if (!room) {
          this.beacons.delete(squadName);
        }
      }
    }
  }

  /** Save data for serialization. */
  getSaveData(): Array<{ squadName: string; tx: number; ty: number; eViolence: number; tMode: string; nCount: number }> {
    const data: Array<{ squadName: string; tx: number; ty: number; eViolence: number; tMode: string; nCount: number }> = [];
    for (const [squadName, b] of this.beacons) {
      data.push({ squadName, tx: b.tx, ty: b.ty, eViolence: b.eViolence, tMode: b.tMode, nCount: b.nCount });
    }
    return data;
  }

  /** Restore from save data. */
  fromSaveData(data: Array<{ squadName: string; tx: number; ty: number; eViolence: number; tMode: string; nCount: number }>) {
    this.beacons.clear();
    for (const d of data) {
      this.beacons.set(d.squadName, {
        tx: d.tx,
        ty: d.ty,
        eViolence: d.eViolence,
        tMode: d.tMode,
        nCount: d.nCount,
        tChars: new Map(),
        nCharsAtBeacon: 0,
        nTargetTeam: this.getTeamAtTile(d.tx, d.ty),
      });
    }
  }

  /** Clear all beacons. */
  clear() {
    this.beacons.clear();
  }
}

export const EmergencyBeacon = new EmergencyBeaconClass();
