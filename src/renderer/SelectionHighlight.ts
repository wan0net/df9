import * as THREE from 'three';
import { tileToScreen } from '../world/IsometricUtils';
import { TILE_W, TILE_H, TILE_HALF_W, TILE_HALF_H } from '../config';
import type { SelectedEntity } from '../ui/InspectorPanel';
import type { Character } from '../characters/Character';
import { getTexture } from './AssetLoader';

/**
 * Renders an amber pulsing highlight on the selected entity.
 * Lua: GuiManager.createSelectionProp() uses 'character_selected' sprite
 * with AMBER color (223/255, 162/255, 0).
 *
 * For characters/objects: diamond highlight at tile position.
 * For rooms: brightens all room tiles (Lua: Lighting.setRoomHighlight 0.3).
 */

const MAX_ROOM_HIGHLIGHT_TILES = 300;

/** Create a diamond-shaped highlight texture. */
function createDiamondTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const cx = size / 2, cy = size / 2;
  const hw = size / 2 - 4, hh = size / 4 - 2;

  ctx.strokeStyle = '#dfa200';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#dfa200';
  ctx.shadowBlur = 8;

  ctx.beginPath();
  ctx.moveTo(cx, cy - hh);
  ctx.lineTo(cx + hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx - hw, cy);
  ctx.closePath();
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.5;
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

let diamondTex: THREE.Texture | null = null;
function getDiamondTexture(): THREE.Texture {
  if (!diamondTex) diamondTex = getTexture('ui_character_selected') ?? createDiamondTexture();
  return diamondTex;
}

export class SelectionHighlight {
  private scene: THREE.Scene;
  private mesh: THREE.Mesh;
  private mat: THREE.MeshBasicMaterial;
  private roomMeshes: THREE.Mesh[] = [];
  private roomMat: THREE.MeshBasicMaterial;
  /** Track which entity was last highlighted to avoid rebuilding room meshes every frame. */
  private lastEntityData: unknown = null;
  private lastEntityType: string | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    const geo = new THREE.PlaneGeometry(TILE_W, TILE_H);
    this.mat = new THREE.MeshBasicMaterial({
      map: getDiamondTexture(),
      color: 0xdfa200,
      transparent: true,
      depthWrite: false,
      opacity: 0.8,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.visible = false;
    this.scene.add(this.mesh);

    this.roomMat = new THREE.MeshBasicMaterial({
      map: getDiamondTexture(),
      color: 0xdfa200,
      transparent: true,
      depthWrite: false,
      opacity: 0.15,
    });
  }

  update(entity: SelectedEntity) {
    if (!entity) {
      this.mesh.visible = false;
      this.clearRoomMeshes();
      this.lastEntityData = null;
      this.lastEntityType = null;
      return;
    }

    const pulse = 0.6 + 0.3 * Math.sin(performance.now() / 300);

    if (entity.type === 'character') {
      const char = entity.data as Character;
      this.mesh.visible = true;
      this.mat.opacity = pulse;
      this.mesh.position.set(
        char.screenX,
        -(char.screenY),
        25000 + char.screenY,
      );
      if (this.lastEntityType !== 'character' || this.lastEntityData !== entity.data) {
        this.clearRoomMeshes();
      }
    } else if (entity.type === 'object') {
      const obj = entity.data as { tileX: number; tileY: number };
      const pos = tileToScreen(obj.tileX, obj.tileY);
      this.mesh.visible = true;
      this.mat.opacity = pulse;
      this.mesh.position.set(
        pos.x + TILE_HALF_W,
        -(pos.y + TILE_HALF_H),
        25000 + pos.y + TILE_HALF_H,
      );
      if (this.lastEntityType !== 'object' || this.lastEntityData !== entity.data) {
        this.clearRoomMeshes();
      }
    } else if (entity.type === 'room') {
      this.mesh.visible = false;
      // Only rebuild room meshes when selection changes
      if (this.lastEntityData !== entity.data || this.lastEntityType !== 'room') {
        this.clearRoomMeshes();
        const room = entity.data as { tiles: { x: number; y: number }[] };
        const tiles = room.tiles.length > MAX_ROOM_HIGHLIGHT_TILES
          ? room.tiles.slice(0, MAX_ROOM_HIGHLIGHT_TILES)
          : room.tiles;
        for (const t of tiles) {
          const pos = tileToScreen(t.x, t.y);
          const geo = new THREE.PlaneGeometry(TILE_W, TILE_H);
          const m = new THREE.Mesh(geo, this.roomMat);
          m.position.set(
            pos.x + TILE_HALF_W,
            -(pos.y + TILE_HALF_H),
            14999 + pos.y + TILE_HALF_H,
          );
          this.scene.add(m);
          this.roomMeshes.push(m);
        }
      }
      // Animate room highlight opacity
      const roomPulse = 0.1 + 0.08 * Math.sin(performance.now() / 400);
      this.roomMat.opacity = roomPulse;
    }

    this.lastEntityData = entity.data;
    this.lastEntityType = entity.type;
  }

  private clearRoomMeshes() {
    for (const m of this.roomMeshes) {
      this.scene.remove(m);
      m.geometry.dispose();
    }
    this.roomMeshes = [];
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mat.dispose();
    this.clearRoomMeshes();
    this.roomMat.dispose();
  }
}
