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

// Camera
export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 4;
export const ZOOM_STEP = 0.1;
export const PAN_SPEED = 10;
