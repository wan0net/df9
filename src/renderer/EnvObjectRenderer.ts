import * as THREE from 'three';
import { tileToScreen } from '../world/IsometricUtils';
import { TILE_HALF_W, TILE_HALF_H, TILE_W, TILE_H } from '../config';
import { DAMAGED_CONDITION } from '../envobjects/EnvObject';
import { getSpriteFrame, type SpriteFrame } from './SpriteAtlasData';
import { getTexture } from './AssetLoader';
import { tObjects } from '../envobjects/EnvObjectData';

/**
 * Renders environment objects (furniture, machines, etc.) as sprites.
 * Uses real sprite sheet frames when available, falls back to generated placeholders.
 * Supports ghost (unbuilt) objects at 30% opacity and condition-based variants.
 */

interface RenderedObject {
  mesh: THREE.Mesh;
  spriteName: string;
}

export class EnvObjectRenderer {
  private scene: THREE.Scene;
  private objects: Map<string, RenderedObject> = new Map();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /** Add an object sprite at a tile position. */
  addObject(id: string, tileX: number, tileY: number, objectType: string, built = true) {
    // Remove existing if re-adding
    this.removeObject(id);

    const objDef = tObjects[objectType];
    // Doors are rendered as tile sprites by TileRenderer3D — skip here.
    if (objDef?.door) return;
    const spriteName = objDef?.spriteName ?? objectType;
    const spriteKey = built ? spriteName : spriteName; // ghost uses same sprite

    const mesh = this.createSpriteMesh(spriteKey, objDef?.width ?? 1, objDef?.height ?? 1, built);
    if (!mesh) return;

    const pos = tileToScreen(tileX, tileY);
    // Position: center on the tile footprint, sprite extends upward
    const footprintW = (objDef?.width ?? 1) * TILE_W;
    const footprintH = (objDef?.height ?? 1) * TILE_H;
    mesh.position.set(
      pos.x + footprintW / 2,
      -(pos.y + footprintH / 2),
      15000 + pos.y + TILE_HALF_H,
    );

    this.scene.add(mesh);
    this.objects.set(id, { mesh, spriteName });
  }

  /** Update an object's visual state based on built status and condition. */
  updateObject(id: string, built: boolean, condition: number, spriteName?: string) {
    const obj = this.objects.get(id);
    if (!obj) return;

    const mat = obj.mesh.material as THREE.MeshBasicMaterial;

    if (!built) {
      mat.opacity = 0.3;
      mat.color.setHex(0xffffff);
    } else if (condition <= 0) {
      mat.opacity = 0.5;
      mat.color.setHex(0x444444);
    } else if (condition < DAMAGED_CONDITION) {
      mat.opacity = 0.8;
      mat.color.setHex(0xff6666);
    } else {
      mat.opacity = 1.0;
      mat.color.setHex(0xffffff);
    }

    // If sprite name changed (condition variant), try swapping the texture frame
    if (spriteName && spriteName !== obj.spriteName) {
      const frame = getSpriteFrame(spriteName);
      if (frame) {
        const baseTex = getTexture(frame.textureKey);
        if (baseTex) {
          const cropped = this.cropTexture(baseTex, frame);
          mat.map = cropped;
          mat.needsUpdate = true;
          obj.spriteName = spriteName;
        }
      }
    }
  }

  removeObject(id: string) {
    const obj = this.objects.get(id);
    if (obj) {
      this.scene.remove(obj.mesh);
      obj.mesh.geometry.dispose();
      (obj.mesh.material as THREE.Material).dispose();
      this.objects.delete(id);
    }
  }

  // ── Private helpers ──────────────────────────────────────────

  private createSpriteMesh(
    spriteName: string,
    gridW: number,
    gridH: number,
    built: boolean,
  ): THREE.Mesh | null {
    // 1. Try real sprite frame from atlas
    const frame = getSpriteFrame(spriteName);
    if (frame) {
      return this.createFromSpriteFrame(frame, gridW, gridH, built);
    }

    // 2. Try generated placeholder
    const placeholderTex = getTexture(`placeholder_${spriteName}`);
    if (placeholderTex) {
      return this.createFromPlaceholder(placeholderTex, gridW, gridH, built);
    }

    // 3. Fallback: simple colored quad
    return this.createFallbackQuad(gridW, gridH, built);
  }

  private createFromSpriteFrame(
    frame: SpriteFrame,
    gridW: number,
    gridH: number,
    built: boolean,
  ): THREE.Mesh | null {
    const baseTex = getTexture(frame.textureKey);
    if (!baseTex) return this.createFallbackQuad(gridW, gridH, built);

    const cropped = this.cropTexture(baseTex, frame);

    // Scale sprite to fit the grid footprint
    // The tile footprint in pixels: gridW * TILE_W wide, gridH * TILE_H tall
    // Sprites are taller than their footprint (3D perspective), so we scale
    // to match width and let height be proportional
    const targetW = gridW * TILE_W;
    const aspect = frame.sourceH / frame.sourceW;
    const renderW = targetW;
    const renderH = targetW * aspect;

    const geo = new THREE.PlaneGeometry(renderW, renderH);
    const mat = new THREE.MeshBasicMaterial({
      map: cropped,
      transparent: true,
      alphaTest: 0.01,
      opacity: built ? 1.0 : 0.3,
      depthWrite: false,
    });

    return new THREE.Mesh(geo, mat);
  }

  private createFromPlaceholder(
    tex: THREE.Texture,
    gridW: number,
    gridH: number,
    built: boolean,
  ): THREE.Mesh {
    const w = gridW * TILE_W;
    const h = Math.max(gridH * TILE_H, TILE_H * 1.5);
    const geo = new THREE.PlaneGeometry(w, h);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      alphaTest: 0.01,
      opacity: built ? 0.85 : 0.3,
      depthWrite: false,
    });
    return new THREE.Mesh(geo, mat);
  }

  private createFallbackQuad(gridW: number, gridH: number, built: boolean): THREE.Mesh {
    const w = gridW * 32;
    const h = gridH * 32;
    const geo = new THREE.PlaneGeometry(w, h);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x888888,
      transparent: true,
      opacity: built ? 0.6 : 0.3,
      depthWrite: false,
    });
    return new THREE.Mesh(geo, mat);
  }

  /**
   * Create a cropped texture from a sprite sheet using UV offset/repeat.
   * Converts MOAI UV convention (top-left origin) to Three.js (bottom-left origin).
   */
  private cropTexture(baseTex: THREE.Texture, frame: SpriteFrame): THREE.Texture {
    const tex = baseTex.clone();
    tex.needsUpdate = true;

    const uWidth = frame.u1 - frame.u0;
    const vHeight = frame.v1 - frame.v0;

    // Three.js UV: Y=0 at bottom, MOAI UV: Y=0 at top
    tex.offset.set(frame.u0, 1 - frame.v1);
    tex.repeat.set(uWidth, vHeight);

    return tex;
  }
}
