/**
 * Zone types — matches original Lua Zone.lua definitions.
 * All 13 zone types from the original game (12 player-assignable + EXTERIOR).
 */
import { line } from '../localization/Localization';

export enum ZoneType {
  PLAIN = 'PLAIN',
  GARDEN = 'GARDEN',
  INFIRMARY = 'INFIRMARY',
  LIFESUPPORT = 'LIFESUPPORT',
  RESIDENCE = 'RESIDENCE',
  PUB = 'PUB',
  POWER = 'POWER',
  AIRLOCK = 'AIRLOCK',
  REFINERY = 'REFINERY',
  FITNESS = 'FITNESS',
  RESEARCH = 'RESEARCH',
  BRIG = 'BRIG',
  /** Internal zone for building preview wireframe walls. Not player-assignable. */
  CONSTRUCTION = 'CONSTRUCTION',
  /** Special zone for exterior/spacewalk areas. Not player-assignable. */
  EXTERIOR = 'EXTERIOR',
}

export interface ZoneSpriteConfig {
  /** Display name for UI */
  name: string;
  /** Prefix used in wall sprite keys (e.g., 'Base', 'Garden') */
  wallPrefix: string;
  /** Floor tile variants with weights for deterministic random selection */
  floors: { key: string; weight: number }[];
  /** Ambient light color RGB (0-1 range), from Zone.lua tAmbientLightColor */
  ambientLight: [number, number, number];
  /** Ceiling light definitions (Lua Zone.tRoomLights). */
  roomLights?: {
    tLightColor: [number, number, number];
    nLightTileGapX: number;
    nLightTileGapY: number;
    nLightRadius: number;
  }[];
}

/**
 * Sprite configuration for each zone, derived from original Zone.lua.
 * Floor keys match the loaded asset keys in BootScene.
 */
export const ZONE_SPRITES: Record<ZoneType, ZoneSpriteConfig> = {
  [ZoneType.PLAIN]: {
    name: line('ZONEUI005TEXT'),
    wallPrefix: 'Base',
    floors: [{ key: 'tile_floor', weight: 1 }],
    ambientLight: [0.36, 0.33, 0.27],
    roomLights: [{ tLightColor: [0.5, 0.3, 0.15], nLightTileGapX: 4, nLightTileGapY: 4, nLightRadius: 2 }],
  },
  [ZoneType.GARDEN]: {
    name: line('ZONEUI069TEXT'),
    wallPrefix: 'Garden',
    floors: [
      { key: 'garden01', weight: 1 },
      { key: 'garden02', weight: 1 },
    ],
    ambientLight: [0.5, 0.5, 0.5],
    roomLights: [{ tLightColor: [0.5, 1, 0.8], nLightTileGapX: 3, nLightTileGapY: 3, nLightRadius: 3 }],
  },
  [ZoneType.INFIRMARY]: {
    name: line('ZONEUI049TEXT'),
    wallPrefix: 'Infirmary',
    floors: [
      { key: 'infirmary01', weight: 1 },
      { key: 'infirmary02', weight: 1 },
    ],
    ambientLight: [0.65, 0.65, 0.65],
    roomLights: [{ tLightColor: [0.25, 0.25, 0.25], nLightTileGapX: 5, nLightTileGapY: 5, nLightRadius: 4 }],
  },
  [ZoneType.LIFESUPPORT]: {
    name: line('ZONEUI001TEXT'),
    wallPrefix: 'LifeSupport',
    floors: [
      { key: 'lifesupport01', weight: 1 },
      { key: 'lifesupport02', weight: 1 },
    ],
    ambientLight: [0.2, 0.3, 0.6],
    roomLights: [{ tLightColor: [0.5, 0.5, 0.8], nLightTileGapX: 4, nLightTileGapY: 4, nLightRadius: 4 }],
  },
  [ZoneType.RESIDENCE]: {
    name: line('ZONEUI042TEXT'),
    wallPrefix: 'Residence',
    floors: [{ key: 'residence_floor', weight: 1 }],
    ambientLight: [0.52, 0.485, 0.41],
    roomLights: [{ tLightColor: [1.0, 0.6, 0.3], nLightTileGapX: 4, nLightTileGapY: 5, nLightRadius: 3 }],
  },
  [ZoneType.PUB]: {
    name: line('ZONEUI046TEXT'),
    wallPrefix: 'Pub',
    floors: [{ key: 'pub_floor', weight: 1 }],
    ambientLight: [0.8, 0.5, 1.0],
    roomLights: [{ tLightColor: [0.4, 0.0, 1.0], nLightTileGapX: 4, nLightTileGapY: 4, nLightRadius: 2 }],
  },
  [ZoneType.POWER]: {
    name: line('ZONEUI003TEXT'),
    wallPrefix: 'Reactor',
    floors: [
      { key: 'reactor02', weight: 1 },
      { key: 'reactor01', weight: 1 },
    ],
    ambientLight: [0.5, 0.2, 0.2],
    roomLights: [{ tLightColor: [1.0, 0.0, 0.0], nLightTileGapX: 4, nLightTileGapY: 4, nLightRadius: 2.5 }],
  },
  [ZoneType.AIRLOCK]: {
    name: line('ZONEUI036TEXT'),
    wallPrefix: 'Airlock',
    floors: [
      { key: 'airlock02', weight: 1 },
      { key: 'airlock01', weight: 1 },
    ],
    ambientLight: [0.3, 0.5, 0.6],
    roomLights: [{ tLightColor: [0.1, 0.5, 0.2], nLightTileGapX: 4, nLightTileGapY: 4, nLightRadius: 2 }],
  },
  [ZoneType.REFINERY]: {
    name: line('ZONEUI037TEXT'),
    wallPrefix: 'Refinery',
    floors: [{ key: 'refinery01', weight: 1 }],
    ambientLight: [0.235, 0.22, 0.265],
    roomLights: [{ tLightColor: [1.0, 0.7, 0.4], nLightTileGapX: 5, nLightTileGapY: 5, nLightRadius: 3 }],
  },
  [ZoneType.FITNESS]: {
    name: line('ZONEUI109TEXT'),
    wallPrefix: 'Fitness',
    floors: [
      { key: 'fitness01', weight: 1 },
      { key: 'fitness02', weight: 1 },
    ],
    ambientLight: [0.6, 0.6, 0.6],
    roomLights: [{ tLightColor: [1.0, 1.0, 1.0], nLightTileGapX: 4, nLightTileGapY: 4, nLightRadius: 2 }],
  },
  [ZoneType.RESEARCH]: {
    name: line('ZONEUI126TEXT'),
    wallPrefix: 'Research',
    floors: [
      { key: 'research01', weight: 1 },
      { key: 'research02', weight: 1 },
    ],
    ambientLight: [0.3, 0.5, 0.6],
    roomLights: [{ tLightColor: [0.2, 1.0, 0.4], nLightTileGapX: 4, nLightTileGapY: 4, nLightRadius: 3 }],
  },
  [ZoneType.BRIG]: {
    name: line('ZONEUI142TEXT'),
    wallPrefix: 'Brig',
    floors: [
      { key: 'brig01', weight: 1 },
      { key: 'brig02', weight: 7 },
      { key: 'brig03', weight: 1 },
    ],
    ambientLight: [0.4, 0.45, 0.5],
    roomLights: [{ tLightColor: [0.7, 0.5, 0.5], nLightTileGapX: 4, nLightTileGapY: 4, nLightRadius: 1 }],
  },
  [ZoneType.CONSTRUCTION]: {
    name: 'Construction',
    wallPrefix: 'Base',
    floors: [{ key: 'tile_floor', weight: 1 }],
    ambientLight: [0.8, 1.0, 0.2],
  },
  [ZoneType.EXTERIOR]: {
    name: 'External',
    wallPrefix: 'Exterior',
    floors: [{ key: 'tile_floor', weight: 1 }],
    ambientLight: [0.3, 0.3, 0.3],
  },
};

/** Zone types in Lua ZoneRezoneTab.lua order (AIRLOCK first, PLAIN/Unzoned last) */
export const ZONE_LIST: ZoneType[] = [
  ZoneType.AIRLOCK,
  ZoneType.LIFESUPPORT,
  ZoneType.POWER,
  ZoneType.REFINERY,
  ZoneType.RESIDENCE,
  ZoneType.PUB,
  ZoneType.GARDEN,
  ZoneType.FITNESS,
  ZoneType.RESEARCH,
  ZoneType.INFIRMARY,
  ZoneType.BRIG,
  ZoneType.PLAIN, // "Unzoned" — always last
];

/**
 * Deterministic weighted random floor variant selection using tile coords as seed.
 * Matches original MiscUtil.weightedRandom — uses coords to pick a consistent
 * floor variant per tile so it doesn't flicker on re-render.
 */
export function getZoneFloorKey(zone: ZoneType, x: number, y: number): string {
  const config = ZONE_SPRITES[zone];
  const floors = config.floors;
  if (floors.length === 1) return floors[0].key;

  // Simple hash from tile coords for deterministic selection
  const hash = ((x * 73856093) ^ (y * 19349663)) >>> 0;
  const totalWeight = floors.reduce((sum, f) => sum + f.weight, 0);
  let pick = hash % totalWeight;

  for (const f of floors) {
    if (pick < f.weight) return f.key;
    pick -= f.weight;
  }
  return floors[0].key;
}
