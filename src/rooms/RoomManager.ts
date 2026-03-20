import { TileGrid } from '../world/TileGrid';
import { TileType } from '../world/TileTypes';
import { ZoneType } from '../world/ZoneType';
import { Room } from './Room';
import { Zone } from '../zones/Zone';
import { Airlock } from '../zones/Airlock';
import { BedZone } from '../zones/BedZone';
import { BrigZone } from '../zones/BrigZone';
import { Pub } from '../zones/Pub';
import { HospitalZone } from '../zones/HospitalZone';
import { ResearchZone } from '../zones/ResearchZone';
import { FitnessZone } from '../zones/FitnessZone';
import { GameRules } from '../core/GameRules';
import { TEAM_ID_PLAYER } from '../characters/CharacterConstants';

/** Score an old room for identity-matching priority: zoned + owned rooms
 *  should be preferred when multiple old rooms compete for the same new room. */
function oldRoomScore(oldRoom: Room, overlap: number): number {
  let score = overlap;
  if (oldRoom.zone !== ZoneType.PLAIN) score += 100000;
  if (oldRoom.nTeam === TEAM_ID_PLAYER) score += 50000;
  return score;
}

/** Copy persistent state from an old room onto a new room. */
function carryForwardState(dst: Room, src: Room): void {
  dst.oxygen = src.oxygen;
  dst.zone = src.zone;
  dst.uniqueZoneName = src.uniqueZoneName;
  dst.nTeam = src.nTeam;
  dst.nDangerTimer = src.nDangerTimer;
  dst.nVisibilityTimer = src.nVisibilityTimer;
  dst.bUserBlockOxygen = src.bUserBlockOxygen;
  dst.nMoraleScore = src.nMoraleScore;
  dst.nLevel = src.nLevel;
  dst.bEmergencyAlarmEnabled = src.bEmergencyAlarmEnabled;
  dst.nLastSeen = src.nLastSeen;
  dst.nLastVisibility = src.nLastVisibility;
  dst.nLightingScheme = src.nLightingScheme;
  dst.tWalls = src.tWalls;
}

/** Create the proper Zone subclass for a given zone type. */
function createZoneInstance(zoneType: ZoneType): Zone {
  switch (zoneType) {
    case ZoneType.AIRLOCK: return new Airlock();
    case ZoneType.RESIDENCE: return new BedZone();
    case ZoneType.BRIG: return new BrigZone();
    case ZoneType.PUB: return new Pub();
    case ZoneType.INFIRMARY: return new HospitalZone();
    case ZoneType.RESEARCH: return new ResearchZone();
    case ZoneType.FITNESS: return new FitnessZone();
    default: return new Zone(zoneType);
  }
}

export class RoomManager {
  private grid: TileGrid;
  private rooms: Room[] = [];
  private dirty = true;
  private tileToRoom: Map<string, Room> = new Map();
  /** Persisted zone assignments per tile — survives room re-detection */
  private tileZones: Map<string, ZoneType> = new Map();
  /** Round-robin index for slow tick dispatch. */
  private slowTickIdx = 0;

  constructor(grid: TileGrid) {
    this.grid = grid;
  }

  /** Store zone for all tiles in a room (called when zone is assigned) */
  persistZone(room: Room) {
    for (const t of room.tiles) {
      this.tileZones.set(`${t.x},${t.y}`, room.zone);
    }
    // Create/update zone object instance
    this.assignZoneObj(room);
  }

  /** Create the appropriate Zone subclass and attach it to the room. */
  private assignZoneObj(room: Room) {
    const zoneObj = createZoneInstance(room.zone);
    zoneObj.setRoom(room);
    room.zoneObj = zoneObj;
  }

  markDirty(_tiles: { x: number; y: number }[]) {
    this.dirty = true;
  }

  update() {
    if (!this.dirty) return;
    this.dirty = false;
    this.detectRooms();
  }

  /** Tick all rooms: fast tick every frame, slow tick round-robin one per frame. */
  tick(dt: number) {
    for (const room of this.rooms) {
      room.tickFast(dt);
    }
    if (this.rooms.length > 0) {
      this.slowTickIdx = this.slowTickIdx % this.rooms.length;
      const room = this.rooms[this.slowTickIdx];
      // Always update visibility (lightweight), skip full tickSlow for culled rooms
      if (room.shouldTickRoom()) {
        room.tickSlow(dt);
      } else {
        // Still tick visibility so shouldTickRoom() stays current
        room.tickVisibility();
      }
      this.slowTickIdx++;
    }
  }

  getRooms(): Room[] {
    return this.rooms;
  }

  getRoomAt(x: number, y: number): Room | undefined {
    return this.tileToRoom.get(`${x},${y}`);
  }

  /** Get rooms owned by a team (Lua Room.getRoomsOfTeam). */
  getRoomsOfTeam(nTeam: number, zoneName?: string): Room[] {
    return this.rooms.filter(r => {
      if (r.nTeam !== nTeam) return false;
      if (zoneName && r.zone !== zoneName) return false;
      return true;
    });
  }

  /** Get non-dangerous rooms owned by a team (Lua Room.getSafeRoomsOfTeam). */
  getSafeRoomsOfTeam(nTeam: number, zoneName?: string): Room[] {
    return this.getRoomsOfTeam(nTeam, zoneName).filter(r => !r.isDangerous());
  }

  /** BFS flood-fill through diagonal neighbors to find rooms */
  private detectRooms() {
    // Save old rooms for identity preservation
    const oldRooms = this.rooms;

    this.rooms = [];
    this.tileToRoom.clear();

    const visited = new Set<string>();
    let roomId = 0;

    // Scan all tiles for floor tiles.
    // Original Lua _floodRoom floods through FLOOR only — doors and walls
    // are boundaries. Each side of a door is a separate room.
    for (let y = 0; y < this.grid.height; y++) {
      for (let x = 0; x < this.grid.width; x++) {
        const tileType = this.grid.get(x, y);
        if (tileType !== TileType.FLOOR && tileType !== TileType.FLOOR_PENDING) continue;
        const key = `${x},${y}`;
        if (visited.has(key)) continue;

        // BFS flood fill through diagonal neighbors (FLOOR tiles only)
        const room = new Room(roomId++);
        const queue: { x: number; y: number }[] = [{ x, y }];
        visited.add(key);

        while (queue.length > 0) {
          const current = queue.shift()!;
          room.addTile(current.x, current.y);
          this.tileToRoom.set(`${current.x},${current.y}`, room);

          // Check diagonal neighbors for flood fill
          const neighbors = this.grid.getDiagonalNeighbors(current.x, current.y);
          let hasBreachAtTile = false;
          for (const n of neighbors) {
            const nKey = `${n.x},${n.y}`;
            const nType = this.grid.get(n.x, n.y);

            if (nType === TileType.SPACE) {
              hasBreachAtTile = true;
            } else if (nType === TileType.WALL_PENDING) {
              // Pending walls act as seal boundaries — skip (don't flood, don't breach)
              continue;
            }

            if (visited.has(nKey)) continue;

            if (nType === TileType.FLOOR || nType === TileType.FLOOR_PENDING) {
              visited.add(nKey);
              queue.push(n);
            }
            // Walls, wall-pending, doors, and space are boundaries — don't flood through
          }

          room.setPendingBreach(
            current.x,
            current.y,
            hasBreachAtTile,
            GameRules.elapsedTime,
            (nTeam: number) => this.getRoomsOfTeam(nTeam)
          );
        }

        room.sealed = room.tPendingBreaches.size === 0;

        this.rooms.push(room);
      }
    }

    // ── Phase 2: Room identity preservation ────────────────────────────
    // Build tile sets for all new rooms, then compute a full overlap matrix
    // against old rooms. Two-pass matching ensures:
    //  - Splits: the LARGEST fragment inherits the old room's identity
    //  - Merges: the old room with zone/ownership priority wins
    //  - No old room is assigned to more than one new room

    const newRoomTileSets = this.rooms.map(
      r => new Set(r.tiles.map(t => `${t.x},${t.y}`))
    );

    // overlapMap[newIdx] = Map<oldIdx, tileOverlapCount>
    const overlapMap: Map<number, number>[] = [];
    for (let ni = 0; ni < this.rooms.length; ni++) {
      const overlaps = new Map<number, number>();
      const newTiles = newRoomTileSets[ni];
      for (let oi = 0; oi < oldRooms.length; oi++) {
        let count = 0;
        for (const t of oldRooms[oi].tiles) {
          if (newTiles.has(`${t.x},${t.y}`)) count++;
        }
        if (count > 0) overlaps.set(oi, count);
      }
      overlapMap.push(overlaps);
    }

    const oldRoomClaimed = new Set<number>();
    const newRoomMatch: (Room | null)[] = new Array(this.rooms.length).fill(null);
    const newRoomOverlap: number[] = new Array(this.rooms.length).fill(0);

    // First pass — iterate old rooms. Each old room is assigned to the new
    // room with which it has the LARGEST overlap. If two old rooms both want
    // the same new room (merge), the one with the higher priority score wins.
    for (let oi = 0; oi < oldRooms.length; oi++) {
      let bestNewIdx = -1;
      let bestOverlap = 0;
      for (let ni = 0; ni < this.rooms.length; ni++) {
        const ov = overlapMap[ni].get(oi) ?? 0;
        if (ov > bestOverlap) {
          bestOverlap = ov;
          bestNewIdx = ni;
        }
      }
      if (bestNewIdx < 0) continue;

      const existing = newRoomMatch[bestNewIdx];
      if (existing) {
        const existingScore = oldRoomScore(existing, newRoomOverlap[bestNewIdx]);
        const candidateScore = oldRoomScore(oldRooms[oi], bestOverlap);
        if (candidateScore <= existingScore) continue;
        // Candidate wins — release old claim (it may get picked up in pass 2)
      }
      newRoomMatch[bestNewIdx] = oldRooms[oi];
      newRoomOverlap[bestNewIdx] = bestOverlap;
      oldRoomClaimed.add(oi);
    }

    // Second pass — unmatched new rooms try unclaimed old rooms (split fragments)
    for (let ni = 0; ni < this.rooms.length; ni++) {
      if (newRoomMatch[ni]) continue;
      let bestOi = -1;
      let bestScore = 0;
      for (const [oi, ov] of overlapMap[ni]) {
        if (oldRoomClaimed.has(oi)) continue;
        const score = oldRoomScore(oldRooms[oi], ov);
        if (score > bestScore) {
          bestScore = score;
          bestOi = oi;
        }
      }
      if (bestOi >= 0) {
        newRoomMatch[ni] = oldRooms[bestOi];
        newRoomOverlap[ni] = overlapMap[ni].get(bestOi) ?? 0;
        oldRoomClaimed.add(bestOi);
      }
    }

    // Apply matched state, then fall back to tileZones for unmatched rooms
    for (let ni = 0; ni < this.rooms.length; ni++) {
      const room = this.rooms[ni];
      const matchedOld = newRoomMatch[ni];

      if (matchedOld) {
        carryForwardState(room, matchedOld);
      }

      // Restore persisted zone via majority vote from per-tile zone map
      // (only if no old room matched or matched room was PLAIN)
      if (!matchedOld || matchedOld.zone === ZoneType.PLAIN) {
        const zoneCounts = new Map<ZoneType, number>();
        for (const t of room.tiles) {
          const z = this.tileZones.get(`${t.x},${t.y}`);
          if (z !== undefined) {
            zoneCounts.set(z, (zoneCounts.get(z) ?? 0) + 1);
          }
        }
        if (zoneCounts.size > 0) {
          let bestZone = ZoneType.PLAIN;
          let bestCount = 0;
          for (const [z, c] of zoneCounts) {
            if (c > bestCount) { bestZone = z; bestCount = c; }
          }
          room.zone = bestZone;
        }
      }

      this.assignZoneObj(room);
    }
  }

  /**
   * Spread combat awareness to characters in nearby rooms.
   * Lua Room.spreadCombatAwareness: find room at tile, notify all characters in that room + adjoining rooms.
   * @param attackerId — ID of the attacking character
   * @param tx — tile X of attack
   * @param ty — tile Y of attack
   * @param onAlert — callback invoked for each character in alert range
   */
  spreadCombatAwareness(attackerId: number, tx: number, ty: number, onAlert: (charId: number) => void): void {
    const room = this.getRoomAt(tx, ty);
    if (!room) return;

    const notifyRooms = new Set<Room>();
    notifyRooms.add(room);
    for (const adj of room.getAdjoiningRooms()) {
      notifyRooms.add(adj);
    }

    for (const r of notifyRooms) {
      r.nLastCombatAlert = Date.now() / 1000; // approximate elapsed time
      for (const charId of r.tCharacters) {
        if (charId !== attackerId) {
          onAlert(charId);
        }
      }
    }
  }
}
