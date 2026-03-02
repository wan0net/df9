/**
 * Lighting.ts — Per-room ambient lighting.
 * Mirrors Lighting.lua: schemes, zone ambient colors, room tints.
 */

import { GameRules, type TickableSystem } from '../core/GameRules';
import type { RoomManager } from '../rooms/RoomManager';
import { ZONE_SPRITES } from '../world/ZoneType';

/** Lighting schemes matching Lua */
export const LIGHTING_SCHEME = {
  OFF: 0,
  NORMAL: 1,
  FIRE: 2,
  VACUUM: 3,
  DIM: 4,
  LOWPOWER: 5,
} as const;

export class Lighting implements TickableSystem {
  private roomManager: RoomManager;

  constructor(roomManager: RoomManager) {
    this.roomManager = roomManager;
  }

  init() {
    // Register at slot 10 (Lighting.onTick in Lua tick order)
    GameRules.registerSystem(10, this);
  }

  /**
   * Determine the lighting scheme for a room based on its state.
   */
  getRoomLightingScheme(room: { sealed: boolean; nPowerSupply: number; oxygen: number }): number {
    if (!room.sealed) return LIGHTING_SCHEME.VACUUM;
    if (room.nPowerSupply < 0) return LIGHTING_SCHEME.LOWPOWER;
    return LIGHTING_SCHEME.NORMAL;
  }

  /**
   * Get the tint color for a room based on its zone and lighting scheme.
   * Returns RGB as 0xRRGGBB integer for Phaser sprite tinting.
   */
  getRoomTint(zone: string, scheme: number): number {
    const config = ZONE_SPRITES[zone as keyof typeof ZONE_SPRITES];
    if (!config) return 0xffffff;

    const ambient = config.ambientLight;

    switch (scheme) {
      case LIGHTING_SCHEME.OFF:
        return 0x111111;
      case LIGHTING_SCHEME.VACUUM:
        // Emergency red
        return rgbToHex(0.6, 0.15, 0.1);
      case LIGHTING_SCHEME.DIM:
        return rgbToHex(ambient[0] * 0.3, ambient[1] * 0.3, ambient[2] * 0.3);
      case LIGHTING_SCHEME.LOWPOWER:
        // Dim flickering
        return rgbToHex(ambient[0] * 0.4, ambient[1] * 0.4, ambient[2] * 0.4);
      case LIGHTING_SCHEME.FIRE:
        return rgbToHex(0.8, 0.3, 0.1);
      case LIGHTING_SCHEME.NORMAL:
      default:
        return rgbToHex(
          Math.min(1, ambient[0] + 0.4),
          Math.min(1, ambient[1] + 0.4),
          Math.min(1, ambient[2] + 0.4),
        );
    }
  }

  onTick(_dt: number) {
    // Lighting updates will drive TileRenderer tinting in future phases
  }
}

/** Convert 0-1 RGB to 0xRRGGBB integer. */
function rgbToHex(r: number, g: number, b: number): number {
  const ri = Math.floor(Math.max(0, Math.min(1, r)) * 255);
  const gi = Math.floor(Math.max(0, Math.min(1, g)) * 255);
  const bi = Math.floor(Math.max(0, Math.min(1, b)) * 255);
  return (ri << 16) | (gi << 8) | bi;
}
