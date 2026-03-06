/**
 * Lighting.ts — Per-room ambient lighting.
 * Mirrors Lighting.lua + Room:updateEmergency() / Room:tickLighting().
 *
 * Scheme priority order (Room.lua:1187-1205):
 *   1. VACUUM    — no power output at all
 *   2. FIRE      — burning, breach, or O2 near suffocating
 *   3. LOWPOWER  — power deficit (draw > output)
 *   4. NORMAL    — default
 *
 * Emergency schemes (FIRE, VACUUM, LOWPOWER) flash via sine-wave oscillation.
 */

import { GameRules, type TickableSystem } from '../core/GameRules';
import type { RoomManager } from '../rooms/RoomManager';
import type { Fire as FireSystem } from '../hazards/Fire';
import { ZONE_SPRITES } from '../world/ZoneType';
import {
  LIGHTING_SCHEME_OFF,
  LIGHTING_SCHEME_NORMAL,
  LIGHTING_SCHEME_FIRE,
  LIGHTING_SCHEME_VACUUM,
  LIGHTING_SCHEME_DIM,
  LIGHTING_SCHEME_LOWPOWER,
  type Room,
} from '../rooms/Room';

/** Re-export scheme constants as a convenience map (keep backwards-compat). */
export const LIGHTING_SCHEME = {
  OFF:      LIGHTING_SCHEME_OFF,
  NORMAL:   LIGHTING_SCHEME_NORMAL,
  FIRE:     LIGHTING_SCHEME_FIRE,
  VACUUM:   LIGHTING_SCHEME_VACUUM,
  DIM:      LIGHTING_SCHEME_DIM,
  LOWPOWER: LIGHTING_SCHEME_LOWPOWER,
} as const;

/**
 * O2 level (room 0-255 scale) below which the room triggers FIRE lighting.
 * Lua: getOxygenScore() < Character.OXYGEN_SUFFOCATING (100) in Lua tile units;
 * converted: 100/65535*255 ≈ 0.4 → use a practical threshold of 10.
 */
const O2_SUFFOCATING_ROOM = 10;

export class Lighting implements TickableSystem {
  private roomManager: RoomManager;
  private fire: FireSystem | null = null;

  constructor(roomManager: RoomManager, fire?: FireSystem) {
    this.roomManager = roomManager;
    this.fire = fire ?? null;
  }

  setFire(fire: FireSystem) {
    this.fire = fire;
  }

  init() {
    GameRules.registerSystem(10, this);
  }

  /** Resolve the lighting scheme for a room — mirrors Room:updateEmergency(). */
  private computeScheme(room: Room): number {
    // No power → vacuum darkness
    if (room.nPowerOutput === 0 && room.nPowerDraw > 0) {
      return LIGHTING_SCHEME_VACUUM;
    }

    // Breach, fire, or suffocating O2 → emergency red
    const bBurning = this.roomHasFire(room);
    const bBreach = !room.sealed;
    const bSuffocating = room.oxygen < O2_SUFFOCATING_ROOM;
    if (bBurning || bBreach || bSuffocating) {
      return LIGHTING_SCHEME_FIRE;
    }

    // Power deficit → dim yellow
    if (room.nPowerSupply < 0) {
      return LIGHTING_SCHEME_LOWPOWER;
    }

    // Zone lighting override (e.g. non-functional Airlock → VACUUM)
    const override = (room.zoneObj as any)?.getLightingOverride?.();
    if (override != null) return override;

    return LIGHTING_SCHEME_NORMAL;
  }

  /** Returns true if any fire tile belongs to this room. */
  private roomHasFire(room: Room): boolean {
    if (!this.fire) return false;
    const fireTiles = this.fire.getFireTiles();
    return room.tiles.some(t => fireTiles.has(`${t.x},${t.y}`));
  }

  /**
   * Main lighting tick — update scheme + advance flash timers.
   * Mirrors Room:tickLighting().
   */
  onTick(dt: number) {
    for (const room of this.roomManager.getRooms()) {
      room.nLightingScheme = this.computeScheme(room);

      // Flash emergency schemes via sine wave (Room.lua:2062-2078)
      const flashes = room.nLightingScheme !== LIGHTING_SCHEME_NORMAL
        && room.nLightingScheme !== LIGHTING_SCHEME_OFF
        && room.nLightingScheme !== LIGHTING_SCHEME_DIM;

      if (flashes) {
        room.nLightFadeTimer += dt * room.nLightFadesPerSecond;
        if (room.nLightFadeTimer > 1) room.nLightFadeTimer -= 1;
      } else {
        room.nLightFadeTimer = 0;
      }
    }
  }

  /**
   * Kept for legacy callers in main.ts that pass a plain room object.
   * The authoritative scheme is now room.nLightingScheme (set in onTick).
   */
  getRoomLightingScheme(room: Room): number {
    return room.nLightingScheme;
  }

  /**
   * Get tint color for a room.
   * Emergency schemes oscillate: nDarkPct modulates darkness 0-50%.
   * Mirrors Lighting.updateEmergencyForRoom() + Room:tickLighting().
   */
  getRoomTint(zone: string, scheme: number, lightFadeTimer = 0): number {
    const config = ZONE_SPRITES[zone as keyof typeof ZONE_SPRITES];
    const ambient: [number, number, number] = config?.ambientLight ?? [1, 1, 1];

    // Sine-wave darkness for flashing schemes (Room.lua:2073)
    const nDarkPct = ((Math.sin(lightFadeTimer * Math.PI * 2) * 0.5) + 0.5) * 0.5;
    const brightness = 1 - nDarkPct;

    switch (scheme) {
      case LIGHTING_SCHEME_OFF:
        // Full black (Lighting.lua: normal=1.0, emergency=0.0, dark=1.0)
        return 0x111111;

      case LIGHTING_SCHEME_VACUUM:
        // Cyan tint (Lighting.lua: tEmergencyColor = {0.3, 0.5, 0.6}) + flash
        return rgbToHex(0.3 * brightness, 0.5 * brightness, 0.6 * brightness);

      case LIGHTING_SCHEME_FIRE:
        // Red tint (Lighting.lua: tEmergencyColor = {1.0, 0.1, 0.1}) + flash
        return rgbToHex(1.0 * brightness, 0.1 * brightness, 0.1 * brightness);

      case LIGHTING_SCHEME_DIM:
        // Very dark zone ambient (Lighting.lua: dark=0.9)
        return rgbToHex(ambient[0] * 0.1, ambient[1] * 0.1, ambient[2] * 0.1);

      case LIGHTING_SCHEME_LOWPOWER:
        // Dim amber + flash (Lighting.lua: dark=0.5)
        return rgbToHex(ambient[0] * 0.5 * brightness, ambient[1] * 0.4 * brightness, ambient[2] * 0.2 * brightness);

      case LIGHTING_SCHEME_NORMAL:
      default:
        return 0xffffff; // No tint — full brightness
    }
  }
}

/** Convert 0-1 RGB to 0xRRGGBB integer. */
function rgbToHex(r: number, g: number, b: number): number {
  const ri = Math.floor(Math.max(0, Math.min(1, r)) * 255);
  const gi = Math.floor(Math.max(0, Math.min(1, g)) * 255);
  const bi = Math.floor(Math.max(0, Math.min(1, b)) * 255);
  return (ri << 16) | (gi << 8) | bi;
}
