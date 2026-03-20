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

/** Lua EnvObject.DEFAULT_ICON_OFFSET = {0, 100} — vertical offset for power icon above object. */
const POWER_ICON_OFFSET_Y = 100;
/** Size of the no-power icon sprite in world units. */
const POWER_ICON_SIZE = 32;

interface RenderedObject {
  mesh: THREE.Mesh;
  spriteName: string;
  /** "No power" blinking icon mesh, if this object has nPowerDraw > 0. */
  powerIcon: THREE.Mesh | null;
  /** Cached power state for blink logic. */
  bHasPower: boolean;
  /** Cached active state — deactivated objects show icon permanently. */
  bActive: boolean;
  /** Whether this object requires power (nPowerDraw > 0). */
  bNeedsPower: boolean;
}

export class EnvObjectRenderer {
  private scene: THREE.Scene;
  private objects: Map<string, RenderedObject> = new Map();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /** Add an object sprite at a tile position.
   *  @param bFlipX — mirror the sprite horizontally (Lua setScl(-1,1)).
   *  @param bFlipY — vertical flip (determines wall direction for againstWall objects).
   *  @param bAgainstWall — if true, shift sprite toward the adjacent wall. */
  addObject(id: string, tileX: number, tileY: number, objectType: string, built = true, bFlipX = false, bFlipY = false, bAgainstWall = false) {
    // Remove existing if re-adding
    this.removeObject(id);

    const objDef = tObjects[objectType];
    // Built doors are rendered as tile sprites by TileRenderer3D — skip here.
    // Ghost (unbuilt) doors still need a visible sprite so the player can see the placement.
    if (objDef?.door && built) return;
    const spriteName = objDef?.spriteName ?? objectType;
    const spriteKey = built ? spriteName : `tile_${spriteName}`; // ghost uses tile-prefixed sprite

    const mesh = this.createSpriteMesh(spriteKey, objDef?.width ?? 1, objDef?.height ?? 1, built);
    if (!mesh) return;

    const pos = tileToScreen(tileX, tileY);
    // Position: center on the tile footprint, sprite extends upward
    const footprintW = (objDef?.width ?? 1) * TILE_W;
    const footprintH = (objDef?.height ?? 1) * TILE_H;
    let offsetX = 0;
    let offsetY = 0;

    // Lua anchors ALL sprites at TILE_LEFT_TOP with "left","bottom" alignment.
    // Wall-mounted objects have artwork offset within their canvas to appear against
    // the wall. Shift againstWall objects toward their wall edge to match.
    // Wall direction from bFlipX/bFlipY (per _getPropFootprint):
    //   !flipX,!flipY → wall at NW;  flipX,!flipY → wall at NE
    //   !flipX, flipY → wall at SW;  flipX, flipY → wall at SE
    if (bAgainstWall) {
      // Lua anchors sprites at TILE_LEFT_TOP, but for a 1-tile-wide sprite
      // (128px on 128px tile) horizontal positioning is identical to centering.
      // The sprite artwork has the object drawn against one edge of its canvas,
      // creating the visual wall-adjacency. Apply a small shift toward the wall
      // to compensate for the vertical centering difference vs MOAI's bottom alignment.
      const dx = bFlipX ? 1 : -1;
      const dy = bFlipY ? 1 : -1;
      offsetX = dx * TILE_HALF_W * 0.25;
      offsetY = dy * TILE_HALF_H * 0.25;
    }

    mesh.position.set(
      pos.x + footprintW / 2 + offsetX,
      -(pos.y + footprintH / 2 + offsetY),
      15000 + pos.y + TILE_HALF_H,
    );

    // Mirror sprite horizontally (Lua: self:setScl(-1,1) when bFlipX)
    if (bFlipX) {
      mesh.scale.x = -1;
    }

    this.scene.add(mesh);

    // Create "no power" icon for objects that draw power (Lua EnvObject.lua:507-519)
    const bNeedsPower = (objDef?.nPowerDraw ?? 0) > 0;
    let powerIcon: THREE.Mesh | null = null;
    if (bNeedsPower) {
      powerIcon = this.createPowerIcon();
      if (powerIcon) {
        // Position above the object (Lua DEFAULT_ICON_OFFSET = {0, 100})
        powerIcon.position.set(
          mesh.position.x,
          mesh.position.y + POWER_ICON_OFFSET_Y,
          mesh.position.z + 1, // slightly in front
        );
        powerIcon.visible = false;
        this.scene.add(powerIcon);
      }
    }

    this.objects.set(id, { mesh, spriteName, powerIcon, bHasPower: true, bActive: true, bNeedsPower });
  }

  /** Update an object's visual state based on built status and condition. */
  updateObject(id: string, built: boolean, condition: number, spriteName?: string,
    bHasPower?: boolean, bActive?: boolean) {
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

    // If sprite name changed (condition variant or interact sprite), swap the texture frame
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

    // Update cached power state for blink logic
    if (bHasPower !== undefined) obj.bHasPower = bHasPower;
    if (bActive !== undefined) obj.bActive = bActive;
  }

  /**
   * Per-frame update for "no power" blinking icons.
   * Lua: math.abs(math.sin(GameRules.elapsedTime * 200)) > 0.5
   * Called from the game loop each frame.
   */
  updatePowerIcons(elapsedTime: number): void {
    const nBlink = Math.abs(Math.sin(elapsedTime * 200));
    const blinkOn = nBlink > 0.5;

    for (const obj of this.objects.values()) {
      if (!obj.powerIcon || !obj.bNeedsPower) continue;

      if (!obj.bActive) {
        // Deactivated objects show icon permanently (Lua EnvObject.lua:1189-1190)
        obj.powerIcon.visible = true;
      } else if (!obj.bHasPower) {
        // No power — blink (Lua EnvObject.lua:1193-1198)
        obj.powerIcon.visible = blinkOn;
      } else {
        // Has power — hide
        obj.powerIcon.visible = false;
      }
    }
  }

  /** Apply room lighting tint to an object (Lua Lighting → tPropLightColor). */
  setObjectTint(id: string, tint: number) {
    const obj = this.objects.get(id);
    if (!obj) return;
    const mat = obj.mesh.material as THREE.MeshBasicMaterial;
    const r = ((tint >> 16) & 0xFF) / 255;
    const g = ((tint >> 8) & 0xFF) / 255;
    const b = (tint & 0xFF) / 255;
    mat.color.setRGB(r, g, b);
  }

  removeObject(id: string) {
    const obj = this.objects.get(id);
    if (obj) {
      this.scene.remove(obj.mesh);
      obj.mesh.geometry.dispose();
      (obj.mesh.material as THREE.Material).dispose();
      // Clean up power icon
      if (obj.powerIcon) {
        this.scene.remove(obj.powerIcon);
        obj.powerIcon.geometry.dispose();
        (obj.powerIcon.material as THREE.Material).dispose();
      }
      this.objects.delete(id);
    }
  }

  // ── Private helpers ──────────────────────────────────────────

  /** Create the "no power" icon mesh using the ui_no_power texture (Lua UIMisc/no_power sprite). */
  private createPowerIcon(): THREE.Mesh | null {
    const tex = getTexture('ui_no_power');
    if (!tex) {
      // Fallback: plain red square
      const geo = new THREE.PlaneGeometry(POWER_ICON_SIZE, POWER_ICON_SIZE);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      });
      return new THREE.Mesh(geo, mat);
    }

    const cloned = tex.clone();
    cloned.needsUpdate = true;
    const geo = new THREE.PlaneGeometry(POWER_ICON_SIZE, POWER_ICON_SIZE);
    const mat = new THREE.MeshBasicMaterial({
      map: cloned,
      color: 0xff3333, // Lua: setColor(unpack(Gui.RED))
      transparent: true,
      alphaTest: 0.01,
      depthWrite: false,
    });
    return new THREE.Mesh(geo, mat);
  }

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

    // 3. Try tile texture (doors use 'tile_' prefixed textures from wall sheet)
    const tileTex = getTexture(`tile_${spriteName}`);
    if (tileTex) {
      return this.createFromTileTexture(tileTex, gridW, built);
    }

    // 4. Fallback: simple colored quad
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

  /** Create mesh from a tile texture (doors), using the image's real aspect ratio. */
  private createFromTileTexture(tex: THREE.Texture, gridW: number, built: boolean): THREE.Mesh {
    const targetW = gridW * TILE_W;
    // Use actual image dimensions for correct aspect ratio
    const imgW = tex.image?.width || targetW;
    const imgH = tex.image?.height || targetW;
    const aspect = imgH / imgW;
    const renderW = targetW;
    const renderH = targetW * aspect;

    const geo = new THREE.PlaneGeometry(renderW, renderH);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      alphaTest: 0.01,
      opacity: built ? 1.0 : 0.3,
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
