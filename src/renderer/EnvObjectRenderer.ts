import * as THREE from 'three';
import { tileToScreen } from '../world/IsometricUtils';
import { TILE_HALF_W, TILE_HALF_H } from '../config';

/**
 * Renders environment objects (furniture, machines, etc.) as sprites.
 * Placeholder until 3D models are loaded from GLB files.
 */
export class EnvObjectRenderer {
  private scene: THREE.Scene;
  private objects: Map<string, THREE.Mesh> = new Map();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /** Add a placeholder object sprite at a tile position. */
  addObject(id: string, tileX: number, tileY: number, _objectType: string) {
    const pos = tileToScreen(tileX, tileY);

    // Create a simple colored quad as placeholder
    const geo = new THREE.PlaneGeometry(24, 24);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x888888,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(
      pos.x + TILE_HALF_W,
      pos.y + TILE_HALF_H,
      15000 + pos.y + TILE_HALF_H,
    );

    this.scene.add(mesh);
    this.objects.set(id, mesh);
  }

  removeObject(id: string) {
    const mesh = this.objects.get(id);
    if (mesh) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      this.objects.delete(id);
    }
  }
}
