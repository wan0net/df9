/**
 * PropRenderer.ts — Renders 3D prop models for pickups and held tools.
 *
 * Loads GLB models converted from .brig files by tools/convert_to_gltf.py.
 * Used for:
 *   - Pickup items on the ground (corpses, debris, food)
 *   - Tools held by characters (Builder, Pistol, etc.)
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { tileToScreen } from '../world/IsometricUtils';
import { TILE_HALF_W, TILE_HALF_H } from '../config';

const PROP_SCALE = 30;
const MODEL_BASE_PATH = 'assets/models/';

/** Cached loaded prop models. */
const modelCache = new Map<string, THREE.Group | null>();
const loadPromises = new Map<string, Promise<void>>();
const loader = new GLTFLoader();

function loadModel(name: string): Promise<void> {
  const existing = loadPromises.get(name);
  if (existing) return existing;

  const promise = new Promise<void>((resolve) => {
    const url = `${MODEL_BASE_PATH}${name}.glb`;
    loader.load(url, (gltf) => {
      // Strip skinning for static props
      gltf.scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const mat = child.material as THREE.Material;
          mat.side = THREE.DoubleSide;
        }
      });
      modelCache.set(name, gltf.scene);
      resolve();
    }, undefined, () => {
      // Model not found — cache null so we don't retry
      modelCache.set(name, null);
      resolve();
    });
  });

  loadPromises.set(name, promise);
  return promise;
}

interface PropHandle {
  object: THREE.Object3D;
  modelName: string;
}

export class PropRenderer {
  private scene: THREE.Scene;
  private props = new Map<string, PropHandle>();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /** Add a prop at a tile position. Returns immediately (loads async). */
  addProp(id: string, modelName: string, tileX: number, tileY: number, scale = PROP_SCALE) {
    this.removeProp(id);

    const cached = modelCache.get(modelName);
    if (cached === null) return; // Known missing

    if (cached) {
      this._addToScene(id, modelName, cached, tileX, tileY, scale);
    } else {
      // Load model then add
      loadModel(modelName).then(() => {
        const model = modelCache.get(modelName);
        if (model && !this.props.has(id)) {
          this._addToScene(id, modelName, model, tileX, tileY, scale);
        }
      });
    }
  }

  private _addToScene(id: string, modelName: string, template: THREE.Group, tileX: number, tileY: number, scale: number) {
    const clone = template.clone(true);
    clone.scale.set(scale, scale, scale);
    // Isometric rotation to match character models
    clone.rotation.x = 0.4;
    clone.rotation.y = 0.6;

    const pos = tileToScreen(tileX, tileY);
    clone.position.set(
      pos.x + TILE_HALF_W,
      -(pos.y + TILE_HALF_H),
      15000 + pos.y,
    );

    this.scene.add(clone);
    this.props.set(id, { object: clone, modelName });
  }

  /** Update a prop's position (e.g., for held items following a character). */
  updatePropPosition(id: string, screenX: number, screenY: number) {
    const handle = this.props.get(id);
    if (!handle) return;
    handle.object.position.set(screenX, -screenY, 20000 + screenY);
  }

  /** Remove a prop from the scene. */
  removeProp(id: string) {
    const handle = this.props.get(id);
    if (!handle) return;
    this.scene.remove(handle.object);
    handle.object.traverse((child) => {
      if (child instanceof THREE.Mesh) child.geometry.dispose();
    });
    this.props.delete(id);
  }

  /** Preload a set of prop models. */
  preload(modelNames: string[]) {
    for (const name of modelNames) {
      loadModel(name);
    }
  }

  /** Get the number of active props. */
  getCount(): number {
    return this.props.size;
  }
}
