/**
 * DecalRenderer.ts — Floor decals (blood splats, damage marks).
 * Mirrors Lua World.setFloorDecal / Character._getBloodTile.
 * Blood decals: "blood01"-"blood05" placed on combat death tiles.
 * Damage decals: "char03" placed on tiles taking damage.
 */

import * as THREE from 'three';
import { tileToScreen } from '../world/IsometricUtils';
import { TILE_W, TILE_H, TILE_HALF_W, TILE_HALF_H } from '../config';
import { getTexture } from './AssetLoader';

const BLOOD_DECALS = ['blood01', 'blood02', 'blood03', 'blood04', 'blood05'];

interface Decal {
  mesh: THREE.Mesh;
  tx: number;
  ty: number;
  sDecal: string;
}

export class DecalRenderer {
  private scene: THREE.Scene;
  private decals = new Map<string, Decal>();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /** Place a random blood decal at a tile (Lua Character._getBloodTile). */
  addBloodDecal(tx: number, ty: number) {
    const sDecal = BLOOD_DECALS[Math.floor(Math.random() * BLOOD_DECALS.length)];
    this.setFloorDecal(tx, ty, sDecal);
  }

  /** Place a floor decal at a tile (Lua World.setFloorDecal). */
  setFloorDecal(tx: number, ty: number, sDecal: string | null) {
    const key = `${tx},${ty}`;

    // Remove existing decal at this tile
    const existing = this.decals.get(key);
    if (existing) {
      this.scene.remove(existing.mesh);
      existing.mesh.geometry.dispose();
      (existing.mesh.material as THREE.Material).dispose();
      this.decals.delete(key);
    }

    if (!sDecal) return;

    const tex = getTexture(`decal_${sDecal}`);
    if (!tex) return;

    const imgW = tex.image?.width || TILE_W;
    const imgH = tex.image?.height || TILE_H;
    const aspect = imgH / imgW;
    const renderW = TILE_W;
    const renderH = TILE_W * aspect;

    const geo = new THREE.PlaneGeometry(renderW, renderH);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      alphaTest: 0.01,
      depthWrite: false,
      opacity: 0.85,
    });

    const mesh = new THREE.Mesh(geo, mat);
    const pos = tileToScreen(tx, ty);
    // Position on floor, slightly above floor tiles but below objects
    mesh.position.set(
      pos.x + TILE_HALF_W,
      -(pos.y + TILE_HALF_H),
      14000 + pos.y + TILE_HALF_H, // Just above floor z but below objects (15000)
    );

    this.scene.add(mesh);
    this.decals.set(key, { mesh, tx, ty, sDecal });
  }

  /** Remove decal at a tile (Lua World.setFloorDecal(tx,ty,nil)). */
  removeDecal(tx: number, ty: number) {
    this.setFloorDecal(tx, ty, null);
  }

  /** Clear all decals. */
  clear() {
    for (const [, decal] of this.decals) {
      this.scene.remove(decal.mesh);
      decal.mesh.geometry.dispose();
      (decal.mesh.material as THREE.Material).dispose();
    }
    this.decals.clear();
  }

  /** Get save data for all decals. */
  getSaveData(): Array<{ tx: number; ty: number; sDecal: string }> {
    const data: Array<{ tx: number; ty: number; sDecal: string }> = [];
    for (const [, d] of this.decals) {
      data.push({ tx: d.tx, ty: d.ty, sDecal: d.sDecal });
    }
    return data;
  }

  /** Restore decals from save data. */
  fromSaveData(data: Array<{ tx: number; ty: number; sDecal: string }>) {
    this.clear();
    for (const d of data) {
      this.setFloorDecal(d.tx, d.ty, d.sDecal);
    }
  }
}
