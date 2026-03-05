import * as THREE from 'three';
import { TileGrid } from '../world/TileGrid';
import { TileType } from '../world/TileTypes';
import { tileToScreen } from '../world/IsometricUtils';
import { getWallDirection, getWallSprites, WallDirection } from '../world/WallDirection';
import { isAsteroid } from '../world/Asteroid';
import { TILE_W, TILE_H } from '../config';
import { ZoneType, getZoneFloorKey, ZONE_SPRITES } from '../world/ZoneType';
import { getTexture, hasTexture } from './AssetLoader';
import type { RoomManager } from '../rooms/RoomManager';
import type { Room } from '../rooms/Room';

/**
 * Trim offsets by wall piece suffix (same as Phaser version).
 */
const WALL_TRIM_BY_SUFFIX: Record<string, { trimX: number; trimY: number }> = {
  '_Straight01_bottom':      { trimX: 0, trimY: 0 },
  '_Corner_outer01_bottom':  { trimX: 0, trimY: 0 },
  '_Corner_inner01_bottom':  { trimX: 0, trimY: 0 },
  '_Corner_lb_bottom':       { trimX: 0, trimY: 1 },
  '_Corner_rb_bottom':       { trimX: 0, trimY: 0 },
  '_Corner_T_NE_bottom':     { trimX: 0, trimY: 0 },
  '_Corner_T_NW_bottom':     { trimX: 2, trimY: 1 },
  '_Corner_T_SE_bottom':     { trimX: 0, trimY: 0 },
  '_Corner_T_SW_bottom':     { trimX: 2, trimY: 1 },
  '_Corner_cross_bottom':    { trimX: 0, trimY: 0 },
  '_Straight01_top':         { trimX: 25, trimY: 62 },
  '_Corner_outer01_top':     { trimX: 25, trimY: 73 },
  '_Corner_inner01_top':     { trimX: 25, trimY: 62 },
  '_Corner_lb_top':          { trimX: 47, trimY: 62 },
  '_Corner_rb_top':          { trimX: 25, trimY: 62 },
  '_Corner_T_NE_top':        { trimX: 25, trimY: 62 },
  '_Corner_T_NW_top':        { trimX: 25, trimY: 62 },
  '_Corner_T_SE_top':        { trimX: 25, trimY: 62 },
  '_Corner_T_SW_top':        { trimX: 25, trimY: 62 },
  '_Corner_cross_top':       { trimX: 25, trimY: 62 },
};

const DOOR_TRIM: Record<string, { trimX: number; trimY: number }> = {
  'tile_door_closed':         { trimX: 21, trimY: 15 },
  'tile_door_open':           { trimX: 21, trimY: 15 },
  'tile_door_locked':         { trimX: 21, trimY: 15 },
  'tile_door_broken':         { trimX: 21, trimY: 15 },
  'tile_heavy_door_closed':   { trimX: 21, trimY: 15 },
  'tile_heavy_door_locked':   { trimX: 21, trimY: 15 },
  'tile_airlock_door_closed': { trimX: 21, trimY: 15 },
  'tile_airlock_door_open':   { trimX: 21, trimY: 15 },
  'tile_airlock_door_broken': { trimX: 21, trimY: 15 },
};

function getWallTrim(textureKey: string): { trimX: number; trimY: number } {
  const doorTrim = DOOR_TRIM[textureKey];
  if (doorTrim) return doorTrim;
  const firstUnderscore = textureKey.indexOf('_');
  if (firstUnderscore >= 0) {
    const suffix = textureKey.substring(firstUnderscore);
    const trim = WALL_TRIM_BY_SUFFIX[suffix];
    if (trim) return trim;
  }
  return { trimX: 0, trimY: 0 };
}

/**
 * Depth layering (same scheme as Phaser version, mapped to Z coordinate).
 */
const DEPTH_SPACE = (y: number) => y;
const DEPTH_FLOOR = (y: number) => 10000 + y * 3;
const DEPTH_WALL_BOTTOM = (y: number) => 10000 + y * 3 + 1;
const DEPTH_WALL_TOP = (y: number) => 10000 + y * 3 + 2;

/** Material cache to avoid creating duplicate materials. */
const materialCache = new Map<string, THREE.MeshBasicMaterial>();

function getSpriteMaterial(textureKey: string): THREE.MeshBasicMaterial | null {
  const cached = materialCache.get(textureKey);
  if (cached) return cached;

  const tex = getTexture(textureKey);
  if (!tex) return null;

  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    alphaTest: 0.01,
    side: THREE.FrontSide,
    depthWrite: false,
  });
  materialCache.set(textureKey, mat);
  return mat;
}

/** Create a PlaneGeometry quad for a sprite.
 *  x, y are in screen-space (Y-down). We negate Y for Three.js Y-up.
 */
function createSpriteQuad(
  textureKey: string,
  x: number,
  y: number,
  depth: number,
  flipX: boolean = false,
): THREE.Mesh | null {
  const mat = getSpriteMaterial(textureKey);
  if (!mat || !mat.map) return null;

  const tex = mat.map;
  const w = tex.image?.width ?? TILE_W;
  const h = tex.image?.height ?? TILE_H;

  const geo = new THREE.PlaneGeometry(w, h);
  const mesh = new THREE.Mesh(geo, mat);

  if (flipX) {
    mesh.scale.x = -1;
  }

  // Position: origin at top-left of the quad (matching Phaser's setOrigin(0,0))
  // Negate Y for Three.js Y-up convention.
  mesh.position.set(x + w / 2, -(y + h / 2), depth);

  return mesh;
}

export class TileRenderer3D {
  private meshes: Map<number, THREE.Object3D[]> = new Map();
  private grid: TileGrid;
  private scene: THREE.Scene;
  private roomManager: RoomManager | null = null;
  /** Callback to get the correct door sprite key for a tile position. */
  getDoorSpriteAt: ((x: number, y: number) => string) | null = null;

  private visMinX = 0;
  private visMaxX = 0;
  private visMinY = 0;
  private visMaxY = 0;

  constructor(scene: THREE.Scene, grid: TileGrid) {
    this.scene = scene;
    this.grid = grid;
  }

  setRoomManager(rm: RoomManager) {
    this.roomManager = rm;
  }

  /** Re-render a single tile (e.g. when door state changes). */
  rerenderTile(x: number, y: number) {
    if (x >= this.visMinX && x <= this.visMaxX && y >= this.visMinY && y <= this.visMaxY) {
      this.renderTile(x, y);
    }
  }

  renderRegion(minX: number, minY: number, maxX: number, maxY: number) {
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        this.renderTile(x, y);
      }
    }
    this.visMinX = minX;
    this.visMinY = minY;
    this.visMaxX = maxX;
    this.visMaxY = maxY;
  }

  updateDirty(dirtyIndices: Set<number>) {
    const toUpdate = new Set<number>();
    for (const idx of dirtyIndices) {
      toUpdate.add(idx);
      const x = idx % this.grid.width;
      const y = Math.floor(idx / this.grid.width);
      for (const n of this.grid.getAllNeighbors(x, y)) {
        toUpdate.add(n.y * this.grid.width + n.x);
      }
    }
    for (const idx of toUpdate) {
      const x = idx % this.grid.width;
      const y = Math.floor(idx / this.grid.width);
      if (x >= this.visMinX && x <= this.visMaxX && y >= this.visMinY && y <= this.visMaxY) {
        this.renderTile(x, y);
      }
    }
  }

  updateVisibility(scrollX: number, scrollY: number, viewW: number, viewH: number) {
    const margin = 8;

    const minY = Math.max(0, Math.floor(scrollY / (TILE_H / 2)) - margin);
    const maxY = Math.min(this.grid.height - 1, Math.floor((scrollY + viewH) / (TILE_H / 2)) + margin);
    const minX = Math.max(0, Math.floor(scrollX / TILE_W) - margin);
    const maxX = Math.min(this.grid.width - 1, Math.floor((scrollX + viewW) / TILE_W) + margin);

    if (minX !== this.visMinX || maxX !== this.visMaxX || minY !== this.visMinY || maxY !== this.visMaxY) {
      // Remove out-of-range tiles
      for (const [key, objects] of this.meshes) {
        const sx = key % this.grid.width;
        const sy = Math.floor(key / this.grid.width);
        if (sx < minX || sx > maxX || sy < minY || sy > maxY) {
          for (const o of objects) this.scene.remove(o);
          this.meshes.delete(key);
        }
      }

      // Add new tiles
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const key = y * this.grid.width + x;
          if (!this.meshes.has(key)) {
            this.renderTile(x, y);
          }
        }
      }

      this.visMinX = minX;
      this.visMaxX = maxX;
      this.visMinY = minY;
      this.visMaxY = maxY;
    }
  }

  private destroyTileMeshes(key: number) {
    const existing = this.meshes.get(key);
    if (existing) {
      for (const o of existing) {
        this.scene.remove(o);
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
        }
      }
      this.meshes.delete(key);
    }
  }

  /**
   * Create a wall sprite mesh with correct alignment using original trim data.
   */
  private createWallSprite(
    textureKey: string,
    tileX: number,
    tileY: number,
    depth: number,
    flip: boolean
  ): THREE.Mesh | null {
    const mat = getSpriteMaterial(textureKey);
    if (!mat || !mat.map) return null;

    const tex = mat.map;
    const spriteW = tex.image?.width ?? TILE_W;
    const spriteH = tex.image?.height ?? TILE_H;

    const pos = tileToScreen(tileX, tileY);
    const baseX = pos.x;
    const baseY = pos.y + TILE_H; // Bottom-left of tile

    const trim = getWallTrim(textureKey);

    let finalX: number;
    if (flip) {
      finalX = baseX + TILE_W - trim.trimX - spriteW;
    } else {
      finalX = baseX + trim.trimX;
    }
    const finalY = baseY - trim.trimY - spriteH; // Y-up → top of sprite

    const geo = new THREE.PlaneGeometry(spriteW, spriteH);
    const mesh = new THREE.Mesh(geo, mat);

    if (flip) {
      mesh.scale.x = -1;
    }

    // Position at center of quad. Negate Y for Three.js Y-up.
    mesh.position.set(finalX + spriteW / 2, -(finalY + spriteH / 2), depth);

    return mesh;
  }

  /**
   * Determine the zone for a wall/door tile by checking diagonal neighbors.
   */
  private getWallZone(x: number, y: number): ZoneType {
    if (!this.roomManager) return ZoneType.PLAIN;

    for (const n of this.grid.getDiagonalNeighbors(x, y)) {
      const room = this.roomManager.getRoomAt(n.x, n.y);
      if (room) return room.zone;
    }

    for (const n of this.grid.getDiagonalNeighbors(x, y)) {
      for (const nn of this.grid.getDiagonalNeighbors(n.x, n.y)) {
        const room = this.roomManager.getRoomAt(nn.x, nn.y);
        if (room) return room.zone;
      }
    }

    return ZoneType.PLAIN;
  }

  private renderTile(x: number, y: number) {
    const key = y * this.grid.width + x;
    const tileType = this.grid.get(x, y);
    const pos = tileToScreen(x, y);

    this.destroyTileMeshes(key);

    const result: THREE.Object3D[] = [];

    if (tileType === TileType.FLOOR) {
      const room = this.roomManager?.getRoomAt(x, y);
      const zone = room?.zone ?? ZoneType.PLAIN;
      const floorKey = getZoneFloorKey(zone, x, y);

      const mesh = createSpriteQuad(floorKey, pos.x, pos.y, DEPTH_FLOOR(y));
      if (mesh) {
        this.scene.add(mesh);
        result.push(mesh);
      }

    } else if (tileType === TileType.WALL) {
      const zone = this.getWallZone(x, y);
      const dir = getWallDirection(this.grid, x, y);
      const info = getWallSprites(dir, zone);

      const bottom = this.createWallSprite(info.bottomKey, x, y, DEPTH_WALL_BOTTOM(y), info.flip);
      if (bottom) {
        this.scene.add(bottom);
        result.push(bottom);
      }

      const top = this.createWallSprite(info.topKey, x, y, DEPTH_WALL_TOP(y), info.flip);
      if (top) {
        this.scene.add(top);
        result.push(top);
      }

    } else if (tileType === TileType.DOOR) {
      const zone = this.getWallZone(x, y);
      const floorKey = getZoneFloorKey(zone, x, y);
      const floor = createSpriteQuad(floorKey, pos.x, pos.y, DEPTH_FLOOR(y));
      if (floor) {
        this.scene.add(floor);
        result.push(floor);
      }

      const dir = getWallDirection(this.grid, x, y);
      const flip = dir === WallDirection.NWSE;

      const doorSpriteKey = this.getDoorSpriteAt?.(x, y) ?? 'tile_door_closed';
      const door = this.createWallSprite(doorSpriteKey, x, y, DEPTH_WALL_TOP(y), flip);
      if (door) {
        this.scene.add(door);
        result.push(door);
      }

    } else if (tileType === TileType.FLOOR_PENDING) {
      // Ghost floor tile — original Lua prebuiltColor: RGB(0.125, 0.125, 0.5) at 50% opacity
      // Clone material so we don't pollute the shared cache with ghost tint
      const room = this.roomManager?.getRoomAt(x, y);
      const zone = room?.zone ?? ZoneType.PLAIN;
      const floorKey = getZoneFloorKey(zone, x, y);
      const mesh = createSpriteQuad(floorKey, pos.x, pos.y, DEPTH_FLOOR(y));
      if (mesh) {
        const mat = (mesh.material as THREE.MeshBasicMaterial).clone();
        mat.opacity = 0.5;
        mat.color.setHex(0x202080);
        mesh.material = mat;
        this.scene.add(mesh);
        result.push(mesh);
      }

    } else if (tileType === TileType.WALL_PENDING) {
      // Ghost wall — original Lua prebuiltColor: RGB(0.125, 0.125, 0.5) at 50% opacity
      // Clone materials so we don't pollute the shared cache with ghost tint
      const zone = this.getWallZone(x, y);
      const dir = getWallDirection(this.grid, x, y);
      const info = getWallSprites(dir, zone);

      const bottom = this.createWallSprite(info.bottomKey, x, y, DEPTH_WALL_BOTTOM(y), info.flip);
      if (bottom) {
        const mat = (bottom.material as THREE.MeshBasicMaterial).clone();
        mat.opacity = 0.5;
        mat.color.setHex(0x202080);
        bottom.material = mat;
        this.scene.add(bottom);
        result.push(bottom);
      }

      const top = this.createWallSprite(info.topKey, x, y, DEPTH_WALL_TOP(y), info.flip);
      if (top) {
        const mat = (top.material as THREE.MeshBasicMaterial).clone();
        mat.opacity = 0.5;
        mat.color.setHex(0x202080);
        top.material = mat;
        this.scene.add(top);
        result.push(top);
      }

    } else if (isAsteroid(tileType)) {
      const mesh = createSpriteQuad('asteroid01', pos.x, pos.y - 32, DEPTH_FLOOR(y));
      if (mesh) {
        this.scene.add(mesh);
        result.push(mesh);
      }
    }

    this.meshes.set(key, result);
  }

  rerenderRoom(room: Room) {
    const dirtyIndices = new Set<number>();
    for (const t of room.tiles) {
      dirtyIndices.add(t.y * this.grid.width + t.x);
    }
    this.updateDirty(dirtyIndices);
  }

  setTileTint(x: number, y: number, tint: number) {
    const key = y * this.grid.width + x;
    const objects = this.meshes.get(key);
    if (objects) {
      const r = ((tint >> 16) & 0xFF) / 255;
      const g = ((tint >> 8) & 0xFF) / 255;
      const b = (tint & 0xFF) / 255;
      for (const o of objects) {
        if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshBasicMaterial) {
          // Clone material on first tint to avoid affecting other tiles sharing it
          if (!(o.userData as Record<string, boolean>).tintCloned) {
            o.material = o.material.clone();
            (o.userData as Record<string, boolean>).tintCloned = true;
          }
          o.material.color.setRGB(r, g, b);
        }
      }
    }
  }

  clearTileTint(x: number, y: number) {
    const key = y * this.grid.width + x;
    const objects = this.meshes.get(key);
    if (objects) {
      for (const o of objects) {
        if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshBasicMaterial) {
          o.material.color.setRGB(1, 1, 1);
        }
      }
    }
  }
}
