/**
 * SpriteAtlasData.ts — Frame definitions for env object sprite sheets.
 * Maps sprite frame names to their source texture and UV coordinates.
 *
 * UV convention: MOAI/TexturePacker (top-left origin).
 * Conversion to Three.js (bottom-left origin) done at render time.
 */

import { ATLAS_FRAMES, ATLAS_SHEET_ENTRIES } from './SpriteAtlasData.generated';

export interface SpriteFrame {
  /** AssetLoader texture key for the sprite sheet PNG */
  textureKey: string;
  /** UV rect in MOAI convention (top-left origin) */
  u0: number;
  v0: number;
  u1: number;
  v1: number;
  /** Visual size of the full frame in pixels */
  sourceW: number;
  sourceH: number;
}

/**
 * Map from frame name → sprite frame data.
 * Frame names match what EnvObject.getSpriteKey() returns
 * (e.g. 'ReactorGen3', 'ReactorGen3_damaged', 'ReactorGen3_destroyed').
 *
 * The 'spriteName' in EnvObjectData doesn't always match the actual
 * frame name in the sprite sheet, so we also provide aliases.
 */
const frames: Record<string, SpriteFrame> = {
  // ── ReactorGen3.png (1024x512) ──────────────────────────────
  ReactorGen3:           { textureKey: 'sheet_ReactorGen3', u0: 0.0,   v0: 0.0, u1: 0.333,  v1: 0.666, sourceW: 341, sourceH: 341 },
  ReactorGen3_damaged:   { textureKey: 'sheet_ReactorGen3', u0: 0.333, v0: 0.0, u1: 0.666,  v1: 0.666, sourceW: 341, sourceH: 341 },
  ReactorGen3_destroyed: { textureKey: 'sheet_ReactorGen3', u0: 0.666, v0: 0.0, u1: 1.0,    v1: 0.666, sourceW: 341, sourceH: 341 },

  // ── ReactorGen4.png (1024x1024) ─────────────────────────────
  ReactorGen4:           { textureKey: 'sheet_ReactorGen4', u0: 0.0, v0: 0.0, u1: 0.5, v1: 0.5, sourceW: 512, sourceH: 512 },
  ReactorGen4_damaged:   { textureKey: 'sheet_ReactorGen4', u0: 0.5, v0: 0.0, u1: 1.0, v1: 0.5, sourceW: 512, sourceH: 512 },
  ReactorGen4_destroyed: { textureKey: 'sheet_ReactorGen4', u0: 0.0, v0: 0.5, u1: 0.5, v1: 1.0, sourceW: 512, sourceH: 512 },

  // ── O2Gen3.png (1024x256) ───────────────────────────────────
  O2Gen3:           { textureKey: 'sheet_O2Gen3', u0: 0.0,    v0: 0.0, u1: 0.3125, v1: 1.0, sourceW: 320, sourceH: 256 },
  O2Gen3_damaged:   { textureKey: 'sheet_O2Gen3', u0: 0.3333, v0: 0.0, u1: 0.6455, v1: 1.0, sourceW: 320, sourceH: 256 },
  O2Gen3_destroyed: { textureKey: 'sheet_O2Gen3', u0: 0.6666, v0: 0.0, u1: 0.9785, v1: 1.0, sourceW: 320, sourceH: 256 },

  // ── O2Gen4.png (1024x1024) ──────────────────────────────────
  O2Gen4:           { textureKey: 'sheet_O2Gen4', u0: 0.0625, v0: 0.125, u1: 0.4423, v1: 0.375, sourceW: 389, sourceH: 320 },
  O2Gen4_damaged:   { textureKey: 'sheet_O2Gen4', u0: 0.5625, v0: 0.125, u1: 0.9423, v1: 0.375, sourceW: 389, sourceH: 320 },
  O2Gen4_destroyed: { textureKey: 'sheet_O2Gen4', u0: 0.0625, v0: 0.625, u1: 0.4423, v1: 0.875, sourceW: 389, sourceH: 320 },

  // ── BulbousPlant.png (256x512) ──────────────────────────────
  BulbousPlant: { textureKey: 'sheet_BulbousPlant', u0: 0, v0: 0, u1: 0.585938, v1: 0.292969, sourceW: 150, sourceH: 150 },

  // ── happybot.png (201x468) ──────────────────────────────────
  happybot:           { textureKey: 'sheet_happybot', u0: 0.457711, v0: 0.653846, u1: 0.915423, v1: 1.0,      sourceW: 92, sourceH: 162 },
  happybot_damaged:   { textureKey: 'sheet_happybot', u0: 0.0,      v0: 0.307692, u1: 0.542289, v1: 0.651709, sourceW: 109, sourceH: 161 },
  happybot_destroyed: { textureKey: 'sheet_happybot', u0: 0.0,      v0: 0.0,      u1: 0.696517, v1: 0.307692, sourceW: 140, sourceH: 144 },

  // ── Jukebox.png (512x512) ───────────────────────────────────
  Jukebox:           { textureKey: 'sheet_Jukebox', u0: 0.1992, v0: 0.0, u1: 0.4004, v1: 0.2929, sourceW: 103, sourceH: 150 },
  Jukebox_damaged:   { textureKey: 'sheet_Jukebox', u0: 0.4004, v0: 0.0, u1: 0.6015, v1: 0.2929, sourceW: 103, sourceH: 150 },
  Jukebox_destroyed: { textureKey: 'sheet_Jukebox', u0: 0.6015, v0: 0.0, u1: 0.8027, v1: 0.2929, sourceW: 103, sourceH: 150 },

  // ── space_tree.png (476x788) ────────────────────────────────
  space_tree:         { textureKey: 'sheet_space_tree', u0: 0.00210084, v0: 0.51269, u1: 0.997899, v1: 0.998731, sourceW: 474, sourceH: 383 },
  space_tree_damaged: { textureKey: 'sheet_space_tree', u0: 0.00210084, v0: 0.0482234, u1: 0.989496, v1: 0.510152, sourceW: 470, sourceH: 364 },

  // ── strange_plant.png (256x256) ─────────────────────────────
  strange_plant: { textureKey: 'sheet_strange_plant', u0: 0, v0: 0, u1: 0.320312, v1: 0.8125, sourceW: 82, sourceH: 208 },
};

/**
 * Aliases mapping EnvObjectData spriteName values to actual atlas frame names.
 * These are looked up when getSpriteFrame() doesn't find a direct match.
 */
const SPRITE_ALIASES: Record<string, string> = {
  // Generators
  ReactorGen: 'generator',
  ReactorGen_damaged: 'generator_damaged',
  ReactorGen_destroyed: 'generator_destroyed',
  // O2 recyclers
  O2Gen: 'oxygen_recycler',
  O2Gen_damaged: 'oxygen_recycler_damaged',
  O2Gen_destroyed: 'oxygen_recycler_destroyed',
  // Residence
  Bed: 'bed',
  Dresser: 'residence_dresser01',
  WallShelf: 'ShelvesWallStack',
  Rug1: 'residence_rug01',
  HousePoint: 'residence_houseplant',
  HousePlant: 'residence_houseplant',
  // Pub
  Bar: 'bar',
  Fridge: 'fridge',
  Fridge_damaged: 'fridge_damaged',
  Fridge_destroyed: 'fridge_destroyed',
  Stove: 'stove',
  Stove_damaged: 'stove_damaged',
  Stove_destroyed: 'stove_destroyed',
  StandingTable: 'standing_table',
  BurgerSign: 'dec_wall_neon_burger',
  PizzaSign: 'dec_wall_neon_pizza',
  FriesSign: 'dec_wall_neon_fries',
  // Refinery
  Refinery: 'refinery',
  Refinery_damaged: 'refinery_damaged',
  Refinery_destroyed: 'refinery_destroyed',
  // Fitness
  WeightBench: 'weightbench',
  // Research
  ResearchDesk: 'research_desk',
  ResearchDesk_damaged: 'research_desk_damaged',
  ResearchDesk_destroyed: 'research_desk_destroyed',
  // Hospital
  HospitalBed: 'hospital_bed',
  HospitalBed_damaged: 'hospital_bed_damaged',
  HospitalBed_destroyed: 'hospital_bed_destroyed',
  // Airlock
  AirlockLocker: 'airlock_locker',
  AirlockLocker_damaged: 'airlock_locker_damaged',
  AirlockLocker_destroyed: 'airlock_locker_destroyed',
  // Safety
  FirePanel: 'fire_panel',
  EmergencyAlarm: 'alarm_panel',
  // Entertainment
  Juke: 'Jukebox',              // R-16: Lua spriteName='Juke'
  Juke_damaged: 'Jukebox_damaged',
  Juke_destroyed: 'Jukebox_destroyed',
  HappyBot: 'happybot',         // R-17: case mismatch
  HappyBot_damaged: 'happybot_damaged',
  HappyBot_destroyed: 'happybot_destroyed',
  TVScreen1: 'tv_screen01',
  // Food
  FoodReplicator: 'food_replicator',
  FoodReplicator_damaged: 'food_replicator_damaged',
  FoodReplicator_destroyed: 'food_replicator_destroyed',
  // Military — R-21: Lua uses turret_frames0003 (idle), not 0001
  Turret: 'turret_frames0003',
  Turret_damaged: 'turret_frames0003',    // show idle frame when damaged
  Turret_destroyed: 'turret_destroyed',
  TurretLv2: 'turret_lv2_frames0003',
  TurretLv2_damaged: 'turret_lv2_frames0003', // show idle frame when damaged
  TurretLv2_destroyed: 'turret_lv2_destroyed',
  // Garden
  HydroPlant: 'hydro_farm',
  HydroPlant_destroyed: 'hydro_farm_destroyed',
  // Special
  SpaceshipEngine: 'ShipEngine',
  BaseSeed: 'seedpod01',
  // R-22: Lua uses 'SpaceTree_Healthy.png' with .png suffix
  'SpaceTree_Healthy.png': 'space_tree',
  SpaceTree_Healthy: 'space_tree',
};

/** Look up a sprite frame by name. Returns undefined if not found.
 *  Checks hand-tuned frames first, then aliases, then auto-generated atlas frames.
 */
export function getSpriteFrame(frameName: string): SpriteFrame | undefined {
  const direct = frames[frameName] ?? ATLAS_FRAMES[frameName];
  if (direct) return direct;
  // Try alias
  const alias = SPRITE_ALIASES[frameName];
  if (alias) return frames[alias] ?? ATLAS_FRAMES[alias];
  return undefined;
}

/** Check if a sprite frame exists. */
export function hasSpriteFrame(frameName: string): boolean {
  if (frameName in frames || frameName in ATLAS_FRAMES) return true;
  const alias = SPRITE_ALIASES[frameName];
  return alias ? (alias in frames || alias in ATLAS_FRAMES) : false;
}

/** All texture keys that need to be loaded as sprite sheet PNGs.
 *  Includes both hand-tuned multi-variant sheets and auto-extracted atlas sprites.
 */
export const SPRITE_SHEET_ENTRIES: [string, string][] = [
  // Hand-tuned multi-variant sheets (higher quality UV coords)
  ['sheet_ReactorGen3',   'assets/environments/ReactorGen3.png'],
  ['sheet_ReactorGen4',   'assets/environments/ReactorGen4.png'],
  ['sheet_O2Gen3',        'assets/environments/O2Gen3.png'],
  ['sheet_O2Gen4',        'assets/environments/O2Gen4.png'],
  ['sheet_BulbousPlant',  'assets/environments/BulbousPlant.png'],
  ['sheet_happybot',      'assets/environments/happybot.png'],
  ['sheet_Jukebox',       'assets/environments/Jukebox.png'],
  ['sheet_space_tree',    'assets/environments/space_tree.png'],
  ['sheet_strange_plant', 'assets/environments/strange_plant.png'],
  // Auto-extracted atlas sprites
  ...ATLAS_SHEET_ENTRIES,
];
