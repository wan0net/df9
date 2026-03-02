import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { TILE_HALF_W, TILE_HALF_H } from '../config';
import type { Character } from '../characters/Character';

/**
 * Renders characters in the Three.js scene.
 *
 * Phase 1: Colored box placeholder (always visible, confirms positioning works)
 * Phase 2: Load Citizen_Base.glb and clone per-character with subset visibility
 */

const MODEL_PATH = 'assets/models/Citizen_Base.glb';
const MODEL_SCALE = 74;

/** Correct subset indices from .brig for a default human male. */
const DEFAULT_VISIBLE_SUBSETS = new Set([
  7,   // Male01_Head
  12,  // Male01_Body
  18,  // Short01 hair
  26,  // Belt01
  33,  // M_LegPouch01
  52,  // M_Collar01
  62,  // TouristShirt_M
]);

const JOB_COLORS: Record<number, number> = {
  2: 0xffcc44,   // BUILDER - yellow
  3: 0x44aaff,   // TECHNICIAN - blue
  4: 0xff8844,   // MINER - orange
  5: 0xff4444,   // EMERGENCY - red
  7: 0xcc44ff,   // BARTENDER - purple
  8: 0x44cc44,   // BOTANIST - green
  9: 0x44dddd,   // SCIENTIST - cyan
  12: 0xffffff,  // DOCTOR - white
  13: 0x888888,  // JANITOR - grey
};

/** Cached loaded GLTF scene. */
let cachedGLTF: THREE.Group | null = null;
let loadPromise: Promise<void> | null = null;
let loadFailed = false;

function loadModel(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = new Promise<void>((resolve) => {
    const loader = new GLTFLoader();
    loader.load(
      MODEL_PATH,
      (gltf) => {
        cachedGLTF = gltf.scene;
        // Ensure double-sided rendering on all meshes
        cachedGLTF.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const mat = child.material as THREE.Material;
            mat.side = THREE.DoubleSide;
          }
        });
        console.log('Character model loaded:', cachedGLTF.children.length, 'children');
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

// Start loading on import
loadModel();

export interface CharacterRenderHandle {
  object: THREE.Object3D;
  needBarsEl: HTMLDivElement;
  needBarsObj: CSS2DObject;
  is3D: boolean;
}

export class CharacterRenderer {
  private scene: THREE.Scene;
  private overlayScene: THREE.Scene;
  private handles = new Map<number, CharacterRenderHandle>();
  private pendingUpgrade: Character[] = [];

  constructor(scene: THREE.Scene, overlayScene: THREE.Scene) {
    this.scene = scene;
    this.overlayScene = overlayScene;
  }

  createCharacter(char: Character): CharacterRenderHandle {
    // Try 3D model first, fall back to box
    let object: THREE.Object3D;
    let is3D = false;

    if (cachedGLTF && !loadFailed) {
      object = this.create3DModel(char);
      is3D = true;
      console.log(`[CharRenderer] Created 3D model for char ${char.id} at (${char.screenX}, ${char.screenY})`);
    } else {
      object = this.createBoxPlaceholder(char);
      console.log(`[CharRenderer] Created box placeholder for char ${char.id} at (${char.screenX}, ${char.screenY})`);
      // Queue for upgrade when model loads
      this.pendingUpgrade.push(char);
      loadModel().then(() => this.upgradePending());
    }

    this.positionCharacter(object, char);
    this.scene.add(object);

    // Need bars
    const needBarsEl = document.createElement('div');
    needBarsEl.className = 'need-bars';
    needBarsEl.style.cssText = 'width:32px;pointer-events:none;';
    const needBarsObj = new CSS2DObject(needBarsEl);
    this.positionNeedBars(needBarsObj, char);
    this.overlayScene.add(needBarsObj);

    const handle: CharacterRenderHandle = { object, needBarsEl, needBarsObj, is3D };
    this.handles.set(char.id, handle);
    return handle;
  }

  /** Simple colored box — guaranteed visible for debugging positioning. */
  private createBoxPlaceholder(char: Character): THREE.Mesh {
    const color = JOB_COLORS[char.getJob()] ?? 0xcccccc;
    const geo = new THREE.BoxGeometry(16, 32, 8);
    const mat = new THREE.MeshBasicMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);
    return mesh;
  }

  /** Clone the GLTF model with subset visibility. */
  private create3DModel(char: Character): THREE.Group {
    const group = new THREE.Group();
    const clone = cachedGLTF!.clone(true);
    clone.scale.set(MODEL_SCALE, MODEL_SCALE, MODEL_SCALE);

    // Hide subsets not in the visible set
    let idx = 0;
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.visible = DEFAULT_VISIBLE_SUBSETS.has(idx);
        idx++;
      }
    });

    group.add(clone);
    return group;
  }

  private positionCharacter(object: THREE.Object3D, char: Character) {
    // Place at character's screen position.
    // screenX/screenY are in screen-space (Y-down). Negate Y for Three.js.
    // Z uses depth ordering: characters above tiles (20000+) sorted by screenY.
    object.position.set(
      char.screenX,
      -(char.screenY),
      20000 + char.screenY,
    );
  }

  private positionNeedBars(obj: CSS2DObject, char: Character) {
    obj.position.set(
      char.screenX,
      -(char.screenY - 40),
      20001 + char.screenY,
    );
  }

  private upgradePending() {
    if (!cachedGLTF || loadFailed) return;
    for (const char of this.pendingUpgrade) {
      const handle = this.handles.get(char.id);
      if (!handle || handle.is3D) continue;

      // Remove old box
      this.scene.remove(handle.object);
      if (handle.object instanceof THREE.Mesh) {
        handle.object.geometry.dispose();
      }

      // Replace with 3D model
      const newObj = this.create3DModel(char);
      this.positionCharacter(newObj, char);
      this.scene.add(newObj);
      handle.object = newObj;
      handle.is3D = true;
    }
    this.pendingUpgrade = [];
  }

  updateCharacter(char: Character) {
    const handle = this.handles.get(char.id);
    if (!handle) return;

    this.positionCharacter(handle.object, char);
    this.positionNeedBars(handle.needBarsObj, char);
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

  destroyCharacter(charId: number) {
    const handle = this.handles.get(charId);
    if (!handle) return;
    this.scene.remove(handle.object);
    handle.object.traverse((child) => {
      if (child instanceof THREE.Mesh) child.geometry.dispose();
    });
    this.overlayScene.remove(handle.needBarsObj);
    handle.needBarsEl.remove();
    this.handles.delete(charId);
  }
}
