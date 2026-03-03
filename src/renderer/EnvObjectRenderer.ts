import * as THREE from 'three';
import { tileToScreen } from '../world/IsometricUtils';
import { TILE_HALF_W, TILE_HALF_H } from '../config';
import { DAMAGED_CONDITION } from '../envobjects/EnvObject';

/**
 * Renders environment objects (furniture, machines, etc.) as sprites.
 * Supports ghost (unbuilt) objects at 50% opacity and condition-based tints.
 */
export class EnvObjectRenderer {
  private scene: THREE.Scene;
  private objects: Map<string, THREE.Mesh> = new Map();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /** Add a placeholder object sprite at a tile position. */
  addObject(id: string, tileX: number, tileY: number, _objectType: string, built = true) {
    const pos = tileToScreen(tileX, tileY);

    // Create a simple colored quad as placeholder
    const geo = new THREE.PlaneGeometry(24, 24);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x888888,
      transparent: true,
      opacity: built ? 0.6 : 0.3,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(
      pos.x + TILE_HALF_W,
      -(pos.y + TILE_HALF_H),
      15000 + pos.y + TILE_HALF_H,
    );

    this.scene.add(mesh);
    this.objects.set(id, mesh);
  }

  /** Update an object's visual state based on built status and condition. */
  updateObject(id: string, built: boolean, condition: number) {
    const mesh = this.objects.get(id);
    if (!mesh) return;
    const mat = mesh.material as THREE.MeshBasicMaterial;

    if (!built) {
      // Ghost: 50% opacity, neutral color
      mat.opacity = 0.3;
      mat.color.setHex(0x888888);
    } else if (condition <= 0) {
      // Destroyed: dark/broken
      mat.opacity = 0.6;
      mat.color.setHex(0x333333);
    } else if (condition < DAMAGED_CONDITION) {
      // Damaged: reddish tint
      mat.opacity = 0.6;
      mat.color.setHex(0xCC4444);
    } else {
      // Normal: full
      mat.opacity = 0.6;
      mat.color.setHex(0x888888);
    }
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
