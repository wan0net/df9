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
      this.rooms[this.slowTickIdx].tickSlow(dt);
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

        let isSealed = true;

        while (queue.length > 0) {
          const current = queue.shift()!;
          room.addTile(current.x, current.y);
          this.tileToRoom.set(`${current.x},${current.y}`, room);

          // Check diagonal neighbors for flood fill
          const neighbors = this.grid.getDiagonalNeighbors(current.x, current.y);
          for (const n of neighbors) {
            const nKey = `${n.x},${n.y}`;
            const nType = this.grid.get(n.x, n.y);

            if (nType === TileType.SPACE) {
              // Floor directly diagonal-adjacent to space = breached
              // But pending walls count as boundaries (they will become walls)
              isSealed = false;
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
        }

        room.sealed = isSealed;

        // ── Room identity preservation ─────────────────────────────────
        // Match new room to old room by maximum tile overlap
        const newTileSet = new Set(room.tiles.map(t => `${t.x},${t.y}`));
        let bestOldRoom: Room | null = null;
        let bestOverlap = 0;

        for (const oldRoom of oldRooms) {
          let overlap = 0;
          for (const t of oldRoom.tiles) {
            if (newTileSet.has(`${t.x},${t.y}`)) overlap++;
          }
          if (overlap > bestOverlap) {
            bestOverlap = overlap;
            bestOldRoom = oldRoom;
          }
        }

        // Carry forward state from matching old room
        if (bestOldRoom && bestOverlap > 0) {
          room.oxygen = bestOldRoom.oxygen;
          room.zone = bestOldRoom.zone;
          room.uniqueZoneName = bestOldRoom.uniqueZoneName;
          room.nTeam = bestOldRoom.nTeam;
          room.nDangerTimer = bestOldRoom.nDangerTimer;
          room.nVisibilityTimer = bestOldRoom.nVisibilityTimer;
          room.bUserBlockOxygen = bestOldRoom.bUserBlockOxygen;
          room.nMoraleScore = bestOldRoom.nMoraleScore;
          room.nLevel = bestOldRoom.nLevel;
          room.bEmergencyAlarmEnabled = bestOldRoom.bEmergencyAlarmEnabled;
          room.nLastSeen = bestOldRoom.nLastSeen;
          room.nLastVisibility = bestOldRoom.nLastVisibility;
          room.nLightingScheme = bestOldRoom.nLightingScheme;
          room.tWalls = bestOldRoom.tWalls;
        }

        // Restore persisted zone: majority vote from tile zone assignments
        // (only if no old room match or old room was PLAIN)
        if (!bestOldRoom || bestOldRoom.zone === ZoneType.PLAIN) {
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

        // Create zone object instance
        this.assignZoneObj(room);

        this.rooms.push(room);
      }
    }
  }
}
