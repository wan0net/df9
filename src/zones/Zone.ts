/**
 * Zone.ts — Base zone class.
 * Mirrors Zones/Zone.lua: zone data, room lights, naming, power tracking.
 */

import { ZoneType, ZONE_SPRITES, ZoneSpriteConfig } from '../world/ZoneType';
import type { Room } from '../rooms/Room';

/** Room light definition (from Zone.lua tRoomLights) */
export interface RoomLightDef {
  tLightColor: [number, number, number];
  nLightTileGapX: number;
  nLightTileGapY: number;
  nLightRadius: number;
}

/** Per-zone room light definitions matching Zone.lua */
const ZONE_ROOM_LIGHTS: Record<ZoneType, RoomLightDef> = {
  [ZoneType.PLAIN]: { tLightColor: [0.5, 0.3, 0.15], nLightTileGapX: 4, nLightTileGapY: 4, nLightRadius: 2 },
  [ZoneType.GARDEN]: { tLightColor: [0.5, 1.0, 0.8], nLightTileGapX: 3, nLightTileGapY: 3, nLightRadius: 3 },
  [ZoneType.INFIRMARY]: { tLightColor: [0.25, 0.25, 0.25], nLightTileGapX: 5, nLightTileGapY: 5, nLightRadius: 4 },
  [ZoneType.LIFESUPPORT]: { tLightColor: [0.5, 0.5, 0.8], nLightTileGapX: 4, nLightTileGapY: 4, nLightRadius: 4 },
  [ZoneType.RESIDENCE]: { tLightColor: [1.0, 0.6, 0.3], nLightTileGapX: 4, nLightTileGapY: 5, nLightRadius: 3 },
  [ZoneType.PUB]: { tLightColor: [0.4, 0.0, 1.0], nLightTileGapX: 4, nLightTileGapY: 4, nLightRadius: 2 },
  [ZoneType.POWER]: { tLightColor: [1.0, 0.0, 0.0], nLightTileGapX: 4, nLightTileGapY: 4, nLightRadius: 2.5 },
  [ZoneType.AIRLOCK]: { tLightColor: [0.1, 0.5, 0.2], nLightTileGapX: 4, nLightTileGapY: 4, nLightRadius: 2 },
  [ZoneType.REFINERY]: { tLightColor: [1.0, 0.7, 0.4], nLightTileGapX: 5, nLightTileGapY: 5, nLightRadius: 3 },
  [ZoneType.FITNESS]: { tLightColor: [1.0, 1.0, 1.0], nLightTileGapX: 4, nLightTileGapY: 4, nLightRadius: 2 },
  [ZoneType.RESEARCH]: { tLightColor: [0.2, 1.0, 0.4], nLightTileGapX: 4, nLightTileGapY: 4, nLightRadius: 3 },
  [ZoneType.BRIG]: { tLightColor: [0.7, 0.5, 0.5], nLightTileGapX: 4, nLightTileGapY: 4, nLightRadius: 1 },
  [ZoneType.CONSTRUCTION]: { tLightColor: [0.8, 1.0, 0.2], nLightTileGapX: 3, nLightTileGapY: 3, nLightRadius: 3 },
  [ZoneType.EXTERIOR]: { tLightColor: [0.3, 0.3, 0.3], nLightTileGapX: 4, nLightTileGapY: 4, nLightRadius: 2 },
};

/** Associated job IDs per zone (matching CharacterConstants job IDs, -1 = none) */
export const ZONE_JOBS: Record<ZoneType, number> = {
  [ZoneType.PLAIN]: -1,
  [ZoneType.GARDEN]: 8, // BOTANIST
  [ZoneType.INFIRMARY]: 12, // DOCTOR
  [ZoneType.LIFESUPPORT]: 3, // TECHNICIAN
  [ZoneType.RESIDENCE]: -1,
  [ZoneType.PUB]: 7, // BARTENDER
  [ZoneType.POWER]: 3, // TECHNICIAN
  [ZoneType.AIRLOCK]: -1,
  [ZoneType.REFINERY]: 4, // MINER
  [ZoneType.FITNESS]: -1,
  [ZoneType.RESEARCH]: 9, // SCIENTIST
  [ZoneType.BRIG]: -1,
  [ZoneType.CONSTRUCTION]: -1,
  [ZoneType.EXTERIOR]: -1,
};

/** Maximum objects for specific zone types (only AIRLOCK has a limit) */
export const ZONE_MAX_PROPS: Partial<Record<ZoneType, number>> = {
  [ZoneType.AIRLOCK]: 1,
};

/**
 * Base Zone class — manages zone-specific state for a room.
 * Subclasses add zone-specific behavior (bed assignments, pub capacity, etc.).
 */
export class Zone {
  readonly zoneType: ZoneType;
  readonly spriteConfig: ZoneSpriteConfig;
  readonly roomLights: RoomLightDef;
  readonly associatedJob: number;
  readonly nMaxProps: number;

  room: Room | null = null;
  uniqueName = '';

  // Power tracking (used in Phase 6)
  nPowerOutput = 0;
  nPowerDraw = 0;

  constructor(zoneType: ZoneType) {
    this.zoneType = zoneType;
    this.spriteConfig = ZONE_SPRITES[zoneType];
    this.roomLights = ZONE_ROOM_LIGHTS[zoneType];
    this.associatedJob = ZONE_JOBS[zoneType];
    this.nMaxProps = ZONE_MAX_PROPS[zoneType] ?? Infinity;
  }

  /** Called when assigned to a room. */
  setRoom(room: Room) {
    this.room = room;
    this.uniqueName = this.generateUniqueName();
  }

  /** Generate a unique name for this zone instance (mirrors Lua Zone.lua naming). */
  protected generateUniqueName(): string {
    const pick = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
    const GREEK = ['Alpha','Beta','Gamma','Delta','Epsilon','Zeta','Eta','Theta','Iota','Kappa','Lambda','Mu','Nu','Xi','Omicron','Pi'];
    const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // excludes I, O
    switch (this.zoneType) {
      case ZoneType.POWER:
        return `Reactor Zone ${pick(GREEK)}`;
      case ZoneType.GARDEN:
        return `Garden Zone ${pick(['Red','Orange','Yellow','Green','Blue','Indigo','Violet','White','Black','Silver','Gold','Crimson'])}`;
      case ZoneType.LIFESUPPORT: {
        const num = Math.random() < 0.01 ? '0451' : String(Math.floor(Math.random() * 100)).padStart(2, '0');
        return `Life Support Zone ${num}${LETTERS[Math.floor(Math.random() * LETTERS.length)]}`;
      }
      case ZoneType.REFINERY:
        return `Refinery Zone ${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
      case ZoneType.PLAIN:
        return 'Unzoned Area';
      default:
        return this.spriteConfig.name;
    }
  }

  /** Called every tick. Override in subclasses. */
  onTick(_dt: number) {}
}
