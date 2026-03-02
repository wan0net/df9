/**
 * Zone types — matches original Lua Zone.lua definitions.
 * All 13 zone types from the original game (12 player-assignable + EXTERIOR).
 */
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
}

/**
 * Sprite configuration for each zone, derived from original Zone.lua.
 * Floor keys match the loaded asset keys in BootScene.
 */
export const ZONE_SPRITES: Record<ZoneType, ZoneSpriteConfig> = {
  [ZoneType.PLAIN]: {
    name: 'Unzoned',
    wallPrefix: 'Base',
    floors: [{ key: 'tile_floor', weight: 1 }],
    ambientLight: [0.36, 0.33, 0.27],
  },
  [ZoneType.GARDEN]: {
    name: 'Garden',
    wallPrefix: 'Garden',
    floors: [
      { key: 'garden01', weight: 1 },
      { key: 'garden02', weight: 1 },
    ],
    ambientLight: [0.5, 0.5, 0.5],
  },
  [ZoneType.INFIRMARY]: {
    name: 'Infirmary',
    wallPrefix: 'Infirmary',
    floors: [
      { key: 'infirmary01', weight: 1 },
      { key: 'infirmary02', weight: 1 },
    ],
    ambientLight: [0.65, 0.65, 0.65],
  },
  [ZoneType.LIFESUPPORT]: {
    name: 'Life Support',
    wallPrefix: 'LifeSupport',
    floors: [
      { key: 'lifesupport01', weight: 1 },
      { key: 'lifesupport02', weight: 1 },
    ],
    ambientLight: [0.2, 0.3, 0.6],
  },
  [ZoneType.RESIDENCE]: {
    name: 'Residence',
    wallPrefix: 'Residence',
    floors: [{ key: 'residence_floor', weight: 1 }],
    ambientLight: [0.52, 0.485, 0.41],
  },
  [ZoneType.PUB]: {
    name: 'Pub',
    wallPrefix: 'Pub',
    floors: [{ key: 'pub_floor', weight: 1 }],
    ambientLight: [0.8, 0.5, 1.0],
  },
  [ZoneType.POWER]: {
    name: 'Reactor',
    wallPrefix: 'Reactor',
    floors: [
      { key: 'reactor02', weight: 1 },
      { key: 'reactor01', weight: 1 },
    ],
    ambientLight: [0.5, 0.2, 0.2],
  },
  [ZoneType.AIRLOCK]: {
    name: 'Airlock',
    wallPrefix: 'Airlock',
    floors: [
      { key: 'airlock02', weight: 1 },
      { key: 'airlock01', weight: 1 },
    ],
    ambientLight: [0.3, 0.5, 0.6],
  },
  [ZoneType.REFINERY]: {
    name: 'Refinery',
    wallPrefix: 'Refinery',
    floors: [{ key: 'refinery01', weight: 1 }],
    ambientLight: [0.235, 0.22, 0.265],
  },
  [ZoneType.FITNESS]: {
    name: 'Fitness',
    wallPrefix: 'Fitness',
    floors: [
      { key: 'fitness01', weight: 1 },
      { key: 'fitness02', weight: 1 },
    ],
    ambientLight: [0.6, 0.6, 0.6],
  },
  [ZoneType.RESEARCH]: {
    name: 'Research Lab',
    wallPrefix: 'Research',
    floors: [
      { key: 'research01', weight: 1 },
      { key: 'research02', weight: 1 },
    ],
    ambientLight: [0.3, 0.5, 0.6],
  },
  [ZoneType.BRIG]: {
    name: 'Brig',
    wallPrefix: 'Brig',
    floors: [
      { key: 'brig01', weight: 1 },
      { key: 'brig02', weight: 7 },
      { key: 'brig03', weight: 1 },
    ],
    ambientLight: [0.4, 0.45, 0.5],
  },
  [ZoneType.EXTERIOR]: {
    name: 'External',
    wallPrefix: 'Exterior',
    floors: [{ key: 'tile_floor', weight: 1 }],
    ambientLight: [0.3, 0.3, 0.3],
  },
};

/** All player-assignable zone types in the original Lua tOrderedZoneList order */
export const ZONE_LIST: ZoneType[] = [
  ZoneType.PLAIN,
  ZoneType.GARDEN,
  ZoneType.INFIRMARY,
  ZoneType.LIFESUPPORT,
  ZoneType.RESIDENCE,
  ZoneType.PUB,
  ZoneType.POWER,
  ZoneType.AIRLOCK,
  ZoneType.REFINERY,
  ZoneType.FITNESS,
  ZoneType.RESEARCH,
  ZoneType.BRIG,
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
