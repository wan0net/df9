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

/** External textures named by CharacterConstants.AccessoryDefs. */
const PROP_TEXTURES: Record<string, string> = {
  Rifle: 'assets/characters/Rifle.png',
  Builder01: 'assets/characters/Builder01.png',
  AsteroidChunk01: 'assets/characters/AsteroidChunk01.png',
  Mug01: 'assets/characters/Mug01.png',
  Probe01: 'assets/characters/Probe01.png',
  Gray: 'assets/characters/Gray.png',
  Doctor01: 'assets/characters/Doctor01.png',
  barbell01: 'assets/props/barbell01.png',
  BodyBag01: 'assets/props/BodyBag01.png',
  fooditems: 'assets/props/fooditems.png',
  Cigarette: 'assets/props/Cigarette.png',
  Tools: 'assets/props/Tools.png',
  FoodCrate: 'assets/props/FoodCrate.png',
  foodtray: 'assets/props/foodtray.png',
  BFG: 'assets/props/BFG.png',
  present: 'assets/props/present.png',
  Spaceboy01: 'assets/props/Spaceboy01.png',
  white: 'assets/props/white.png',
};

/** Cached loaded prop models. */
const modelCache = new Map<string, THREE.Group | null>();
const loadPromises = new Map<string, Promise<void>>();
const loader = new GLTFLoader();
const textureLoader = new THREE.TextureLoader();
const textureCache = new Map<string, THREE.Texture>();

function getPropTexture(materialName: string): THREE.Texture | null {
  const url = PROP_TEXTURES[materialName];
  if (!url) return null;
  const cached = textureCache.get(url);
  if (cached) return cached;
  const texture = textureLoader.load(url);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(url, texture);
  return texture;
}

function loadModel(name: string): Promise<void> {
  const existing = loadPromises.get(name);
  if (existing) return existing;

  const promise = new Promise<void>((resolve) => {
    const url = `${MODEL_BASE_PATH}${name}.glb`;
    loader.load(url, (gltf) => {
      // Strip skinning for static props
      gltf.scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const original = child.material as THREE.MeshStandardMaterial;
          const mat = original.clone();
          child.material = mat;
          mat.side = THREE.DoubleSide;
          const texture = getPropTexture(mat.name);
          if (texture) {
            mat.map = texture;
            // The extracted prop sheets are opaque. Preserve depth writes so
            // rear faces cannot bleed through the held or ground model.
            mat.transparent = false;
            mat.alphaTest = 0;
            mat.depthWrite = true;
            mat.userData.textureName = mat.name;
            mat.needsUpdate = true;
          }
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
  private requestedModels = new Map<string, string>();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /** Add a prop at a tile position. Returns immediately (loads async). */
  addProp(id: string, modelName: string, tileX: number, tileY: number, scale = PROP_SCALE) {
    this.removeProp(id);
    this.requestedModels.set(id, modelName);

    const cached = modelCache.get(modelName);
    if (cached === null) return; // Known missing

    if (cached) {
      this._addToScene(id, modelName, cached, tileX, tileY, scale);
    } else {
      // Load model then add
      loadModel(modelName).then(() => {
        const model = modelCache.get(modelName);
        if (model && this.requestedModels.get(id) === modelName && !this.props.has(id)) {
          this._addToScene(id, modelName, model, tileX, tileY, scale);
        }
      });
    }
  }

  /** Keep an existing prop when its model matches; replace it when character state changes. */
  ensureProp(id: string, modelName: string, tileX: number, tileY: number, scale = PROP_SCALE) {
    if (this.props.get(id)?.modelName === modelName || this.requestedModels.get(id) === modelName) return;
    this.addProp(id, modelName, tileX, tileY, scale);
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
    this.requestedModels.delete(id);
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

  /** Test/debug description without exposing mutable render handles. */
  getDebugInfo(id: string): { modelName: string; textures: string[] } | null {
    const handle = this.props.get(id);
    if (!handle) return null;
    const textures = new Set<string>();
    handle.object.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const material = child.material as THREE.Material;
      const textureName = material.userData.textureName;
      if (typeof textureName === 'string') textures.add(textureName);
    });
    return { modelName: handle.modelName, textures: [...textures] };
  }
}
