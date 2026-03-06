// Grid dimensions
export const GRID_W = 256;
export const GRID_H = 256;

// Tile pixel dimensions (diamond iso)
export const TILE_W = 128;
export const TILE_H = 64;

// Half-tile for staggered rows
export const TILE_HALF_W = TILE_W / 2;  // 64
export const TILE_HALF_H = TILE_H / 2;  // 32

// Oxygen
export const O2_MAX = 255;
export const O2_FILL_RATE = 2;    // per tick, sealed rooms
export const O2_DRAIN_RATE = 4;   // per tick, breached rooms

// Characters
export const INITIAL_CREW = 3;

// ── Tile damage — mirrors WorldConstants.lua:14-24 ──────────────────────────
export const TILE_STARTING_HIT_POINTS = 100;
/** nHealth state: undamaged (75-100% HP) */
export const TILE_DAMAGE_HEALTHY      = 4;
/** nHealth state: light damage (50-75% HP) */
export const TILE_DAMAGE_LIGHT_DAMAGE = 3;
/** nHealth state: heavy damage (25-50% HP) */
export const TILE_DAMAGE_HEAVY_DAMAGE = 2;
/** nHealth state: near-destroyed (1-25% HP) */
export const TILE_DAMAGE_DESTROYED    = 1;
/** HP recovered per second (passive heal in powered rooms) */
export const TILE_HEAL_OVER_TIME      = 0.05;
/** Minimum tile clearance from world edge for player construction */
export const CHARACTER_SAFETY_TOLERANCE = 2;

// Camera
/** Lua: MIN_ZOOM=0.75, MAX_ZOOM=6.0, ZOOM_WHEEL_STEP=0.025 */
export const ZOOM_MIN = 0.75;
export const ZOOM_MAX = 6.0;
export const ZOOM_STEP = 0.025;
export const PAN_SPEED = 10;
