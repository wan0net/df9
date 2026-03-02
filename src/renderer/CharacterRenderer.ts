import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { TILE_HALF_W, TILE_HALF_H } from '../config';
import type { Character } from '../characters/Character';

/**
 * Renders characters as 3D models loaded from Citizen_Base.glb.
 *
 * The model contains 89 subsets (head, body, hair, uniform variants).
 * Each character clone shows a subset selection based on their appearance.
 * For now, we show a default human male subset selection.
 *
 * The model is ~0.86 units tall in its native space.
 * A tile is 128x64 px; characters should be roughly 64px tall on screen.
 * Scale factor: 64 / 0.86 ≈ 74.
 */

const MODEL_PATH = 'assets/models/Citizen_Base.glb';
const MODEL_SCALE = 74;

/**
 * Default visible subsets for a human male citizen.
 * Indices match the .brig subset order (see extract_brig.py output).
 */
const DEFAULT_VISIBLE_SUBSETS = new Set([
  7,   // Male01_Head
  12,  // Male01_Body
  18,  // Short01 hair
  26,  // Belt01
  33,  // M_LegPouch01
  52,  // M_Collar01
  62,  // TouristShirt_M
]);

/** Cached loaded GLTF scene. */
let cachedGLTF: THREE.Group | null = null;
let loadPromise: Promise<void> | null = null;
let loadFailed = false;

/** Subset names from the loaded model, indexed by primitive order. */
let subsetMaterialNames: string[] = [];

function loadModel(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = new Promise<void>((resolve) => {
    const loader = new GLTFLoader();
    loader.load(
      MODEL_PATH,
      (gltf) => {
        cachedGLTF = gltf.scene;

        // Collect material names and ensure double-sided rendering
        cachedGLTF.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const mat = child.material as THREE.Material;
            subsetMaterialNames.push(mat.name || '');
            mat.side = THREE.DoubleSide;
            if (mat instanceof THREE.MeshStandardMaterial) {
              mat.alphaTest = 0.01;
            }
          }
        });

        resolve();
      },
      undefined,
      (err) => {
        console.warn('Failed to load character model:', err);
        loadFailed = true;
        resolve();
      },
    );
  });
  return loadPromise;
}

// Start loading immediately on import
loadModel();

/** Fallback: procedural sprite for when GLB hasn't loaded yet. */
let fallbackTexture: THREE.Texture | null = null;
function getFallbackTexture(): THREE.Texture {
  if (fallbackTexture) return fallbackTexture;
  const w = 32, h = 48;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ddbb99';
  ctx.beginPath(); ctx.arc(w/2, 10, 7, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#665544';
  ctx.beginPath(); ctx.ellipse(w/2, 6, 7, 4, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#cccccc';
  ctx.fillRect(w/2-8, 16, 16, 14);
  ctx.fillRect(w/2-11, 17, 4, 10);
  ctx.fillRect(w/2+7, 17, 4, 10);
  ctx.fillStyle = '#ddbb99';
  ctx.beginPath(); ctx.arc(w/2-9, 28, 2.5, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(w/2+9, 28, 2.5, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#444466';
  ctx.fillRect(w/2-6, 30, 5, 12); ctx.fillRect(w/2+1, 30, 5, 12);
  ctx.fillStyle = '#333333';
  ctx.fillRect(w/2-7, 41, 6, 4); ctx.fillRect(w/2+1, 41, 6, 4);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(w/2, 46, 10, 3, 0, 0, Math.PI*2); ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  fallbackTexture = tex;
  return tex;
}

export interface CharacterRenderHandle {
  object: THREE.Object3D;
  needBarsEl: HTMLDivElement;
  needBarsObj: CSS2DObject;
  isFallback: boolean;
}

export class CharacterRenderer {
  private scene: THREE.Scene;
  private overlayScene: THREE.Scene;
  private handles = new Map<number, CharacterRenderHandle>();
  /** Characters waiting for the model to load. */
  private pending: Character[] = [];

  constructor(scene: THREE.Scene, overlayScene: THREE.Scene) {
    this.scene = scene;
    this.overlayScene = overlayScene;
  }

  /** Create render objects for a character. */
  createCharacter(char: Character): CharacterRenderHandle {
    const handle = this.createHandle(char);
    this.handles.set(char.id, handle);

    // If model not yet loaded, queue for upgrade
    if (handle.isFallback && !loadFailed) {
      this.pending.push(char);
      loadModel().then(() => this.upgradePending());
    }

    return handle;
  }

  private createHandle(char: Character): CharacterRenderHandle {
    let object: THREE.Object3D;
    let isFallback: boolean;

    if (cachedGLTF && !loadFailed) {
      // Clone the 3D model
      object = this.create3DCharacter(char);
      isFallback = false;
    } else {
      // Fallback sprite
      object = this.createFallbackSprite(char);
      isFallback = true;
    }

    this.positionObject(object, char);
    this.scene.add(object);

    // Need bars
    const needBarsEl = document.createElement('div');
    needBarsEl.className = 'need-bars';
    needBarsEl.style.cssText = 'width:32px;pointer-events:none;';
    const needBarsObj = new CSS2DObject(needBarsEl);
    needBarsObj.position.set(char.screenX, -(char.screenY - 46), 20001 + char.screenY);
    this.overlayScene.add(needBarsObj);

    return { object, needBarsEl, needBarsObj, isFallback };
  }

  private create3DCharacter(char: Character): THREE.Group {
    const group = new THREE.Group();

    // Clone the loaded GLTF scene
    const clone = cachedGLTF!.clone(true);

    // Scale: model is ~0.86 units tall, we want ~64px on screen
    clone.scale.set(MODEL_SCALE, MODEL_SCALE, MODEL_SCALE);

    // The model's Y axis is up (standard), matching Three.js.
    // Rotate to face the camera (front-facing in isometric view).
    // The camera looks along -Z, so no rotation needed for front view.

    group.add(clone);

    // Subset visibility: hide all, then show only the subsets for this character
    const visibleSet = this.getVisibleSubsets(char);
    let subsetIdx = 0;
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.visible = visibleSet.has(subsetIdx);
        subsetIdx++;
      }
    });

    return group;
  }

  /** Determine which subsets to show for a given character. */
  private getVisibleSubsets(char: Character): Set<number> {
    // For now use a simple selection: one head, one body, one hair, collar
    // A more complete system would use CharacterConstants.lua race/appearance data
    return DEFAULT_VISIBLE_SUBSETS;
  }

  private createFallbackSprite(char: Character): THREE.Mesh {
    const tex = getFallbackTexture();
    const geo = new THREE.PlaneGeometry(32, 48);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      alphaTest: 0.01,
      depthWrite: false,
      color: 0xcccccc,
    });
    return new THREE.Mesh(geo, mat);
  }

  private positionObject(object: THREE.Object3D, char: Character) {
    // Screen position with negated Y for Three.js Y-up
    object.position.set(char.screenX, -(char.screenY - 16), 20000 + char.screenY);
  }

  /** Upgrade pending fallback sprites to 3D models once loaded. */
  private upgradePending() {
    if (!cachedGLTF) return;

    for (const char of this.pending) {
      const handle = this.handles.get(char.id);
      if (!handle || !handle.isFallback) continue;

      // Remove old fallback
      this.scene.remove(handle.object);
      if (handle.object instanceof THREE.Mesh) {
        handle.object.geometry.dispose();
      }

      // Create 3D replacement
      const newObj = this.create3DCharacter(char);
      this.positionObject(newObj, char);
      this.scene.add(newObj);

      handle.object = newObj;
      handle.isFallback = false;
    }
    this.pending = [];
  }

  /** Update character visual position and need bars. */
  updateCharacter(char: Character) {
    const handle = this.handles.get(char.id);
    if (!handle) return;

    this.positionObject(handle.object, char);

    // Need bars
    handle.needBarsObj.position.set(char.screenX, -(char.screenY - 46), 20001 + char.screenY);
    this.drawNeedBars(handle.needBarsEl, char);
  }

  private drawNeedBars(el: HTMLDivElement, char: Character) {
    const bars = [
      { value: char.needs.oxygen, color: '#4488ff' },
      { value: char.needs.hunger, color: '#ff8844' },
      { value: char.needs.energy, color: '#aaaa44' },
      { value: Math.max(0, (char.nMorale + 100) / 2), color: '#44cc44' },
    ];
    let html = '';
    for (const bar of bars) {
      const color = bar.value > 30 ? bar.color : '#ff0000';
      const pct = Math.max(0, Math.min(100, bar.value));
      html += `<div style="width:32px;height:3px;margin-bottom:1px;background:#333;position:relative;">` +
        `<div style="width:${pct}%;height:100%;background:${color};"></div></div>`;
    }
    el.innerHTML = html;
  }

  /** Remove render objects for a character. */
  destroyCharacter(charId: number) {
    const handle = this.handles.get(charId);
    if (!handle) return;

    this.scene.remove(handle.object);
    // Dispose geometry recursively
    handle.object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
      }
    });

    this.overlayScene.remove(handle.needBarsObj);
    handle.needBarsEl.remove();

    this.handles.delete(charId);
  }
}
