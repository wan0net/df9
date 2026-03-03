import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { TILE_HALF_W, TILE_HALF_H } from '../config';
import type { Character } from '../characters/Character';

/**
 * Renders characters in the Three.js scene.
 *
 * Loads Citizen_Base.glb for normal characters and Spacesuit.glb for spacewalking.
 * Applies procedural animations (walk bob, idle breathing).
 */

const MODEL_PATH = 'assets/models/Citizen_Base.glb';
const SPACESUIT_PATH = 'assets/models/Spacesuit.glb';
const MODEL_SCALE = 56;

/** Walk bob amplitude in screen pixels. */
const WALK_BOB_AMPLITUDE = 4;
/** Walk bob speed (cycles per second). */
const WALK_BOB_SPEED = 6;
/** Idle breathing amplitude. */
const BREATHE_AMPLITUDE = 1.5;
/** Idle breathing speed. */
const BREATHE_SPEED = 1.2;
/** Walk sway (left-right lean) amplitude in radians. */
const WALK_SWAY = 0.06;

/**
 * Subset indices from .brig (Citizen_Base) by category.
 */
const SUBSETS = {
  heads: {
    male:       [7],
    maleFat:    [6],
    maleThin:   [8],
    female:     [4],
    femaleFat:  [3],
    bird:       [1],
    cat:        [2],
    jelly:      [5],
    shamon:     [9],
  },
  bodies: {
    male:       [12],
    maleFat:    [13],
    maleThin:   [15],
    female:     [10],
    femaleFat:  [11],
    shamon:     [14],
  },
  hair: [16, 17, 18, 19, 20, 21, 22, 23, 24, 25],
  belt_m: [26],
  belt_f: [26],
  legPouch_m: [33],
  legPouch_f: [28],
  shorts_m: [37],
  shorts_f: [36],
  collar_m: [52],
  collar_f: [44],
  shirt_m: [62],
  shirt_f: [61],
  jobs: {
    builder:   [68],
    bartender: [67],
    doctor:    [72],
    emergency: [74],
    miner:     [77],
    raider:    [80],
    tech:      [82],
  },
};

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

/** Cached loaded GLTF scenes. */
let cachedCitizen: THREE.Group | null = null;
let cachedSpacesuit: THREE.Group | null = null;
let citizenLoadPromise: Promise<void> | null = null;
let spacesuitLoadPromise: Promise<void> | null = null;
let citizenLoadFailed = false;
let spacesuitLoadFailed = false;

function stripSkinning(group: THREE.Group) {
  const toReplace: { skinned: THREE.SkinnedMesh; parent: THREE.Object3D }[] = [];
  group.traverse((child) => {
    if (child instanceof THREE.SkinnedMesh && child.parent) {
      toReplace.push({ skinned: child, parent: child.parent });
    }
  });
  for (const { skinned, parent } of toReplace) {
    const mesh = new THREE.Mesh(skinned.geometry, skinned.material);
    mesh.name = skinned.name;
    mesh.visible = skinned.visible;
    parent.add(mesh);
    parent.remove(skinned);
  }
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const mat = child.material as THREE.Material;
      mat.side = THREE.DoubleSide;
    }
  });
}

function loadCitizenModel(): Promise<void> {
  if (citizenLoadPromise) return citizenLoadPromise;
  citizenLoadPromise = new Promise<void>((resolve) => {
    const loader = new GLTFLoader();
    loader.load(MODEL_PATH, (gltf) => {
      cachedCitizen = gltf.scene;
      stripSkinning(cachedCitizen);
      let mc = 0;
      cachedCitizen.traverse((c) => { if (c instanceof THREE.Mesh) mc++; });
      console.log('Citizen model loaded:', mc, 'meshes');
      resolve();
    }, undefined, (err) => {
      console.warn('Failed to load citizen model:', err);
      citizenLoadFailed = true;
      resolve();
    });
  });
  return citizenLoadPromise;
}

function loadSpacesuitModel(): Promise<void> {
  if (spacesuitLoadPromise) return spacesuitLoadPromise;
  spacesuitLoadPromise = new Promise<void>((resolve) => {
    const loader = new GLTFLoader();
    loader.load(SPACESUIT_PATH, (gltf) => {
      cachedSpacesuit = gltf.scene;
      stripSkinning(cachedSpacesuit);
      let mc = 0;
      cachedSpacesuit.traverse((c) => { if (c instanceof THREE.Mesh) mc++; });
      console.log('Spacesuit model loaded:', mc, 'meshes');
      resolve();
    }, undefined, (err) => {
      console.warn('Failed to load spacesuit model:', err);
      spacesuitLoadFailed = true;
      resolve();
    });
  });
  return spacesuitLoadPromise;
}

// Start loading both models
loadCitizenModel();
loadSpacesuitModel();

export interface CharacterRenderHandle {
  object: THREE.Object3D;
  /** Inner model group that gets procedural animation. */
  modelGroup: THREE.Group;
  needBarsEl: HTMLDivElement;
  needBarsObj: CSS2DObject;
  is3D: boolean;
  /** Whether currently showing spacesuit model. */
  showingSpacesuit: boolean;
  /** Animation phase (unique per character for variety). */
  animPhase: number;
}

export class CharacterRenderer {
  private scene: THREE.Scene;
  private overlayScene: THREE.Scene;
  private handles = new Map<number, CharacterRenderHandle>();
  private pendingUpgrade: Character[] = [];
  private elapsedTime = 0;

  constructor(scene: THREE.Scene, overlayScene: THREE.Scene) {
    this.scene = scene;
    this.overlayScene = overlayScene;
  }

  createCharacter(char: Character): CharacterRenderHandle {
    let object: THREE.Object3D;
    let modelGroup = new THREE.Group();
    let is3D = false;

    if (cachedCitizen && !citizenLoadFailed) {
      const model = this.createModel(char, char.bSpacewalking);
      modelGroup = model;
      object = modelGroup;
      is3D = true;
    } else {
      object = this.createBoxPlaceholder(char);
      this.pendingUpgrade.push(char);
      loadCitizenModel().then(() => this.upgradePending());
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

    const handle: CharacterRenderHandle = {
      object, modelGroup, needBarsEl, needBarsObj, is3D,
      showingSpacesuit: char.bSpacewalking,
      animPhase: Math.random() * Math.PI * 2,
    };
    this.handles.set(char.id, handle);
    return handle;
  }

  private createBoxPlaceholder(char: Character): THREE.Mesh {
    const color = JOB_COLORS[char.getJob()] ?? 0xcccccc;
    const geo = new THREE.BoxGeometry(40, 60, 20);
    const mat = new THREE.MeshBasicMaterial({ color });
    return new THREE.Mesh(geo, mat);
  }

  /** Create either citizen or spacesuit model. */
  private createModel(char: Character, spacesuit: boolean): THREE.Group {
    const group = new THREE.Group();

    if (spacesuit && cachedSpacesuit && !spacesuitLoadFailed) {
      // Spacesuit model
      const clone = cachedSpacesuit.clone(true);
      clone.scale.set(MODEL_SCALE, MODEL_SCALE, MODEL_SCALE);
      clone.rotation.x = 0.4;
      clone.rotation.y = 0.6;
      group.add(clone);
    } else if (cachedCitizen && !citizenLoadFailed) {
      // Citizen model with subset visibility
      const clone = cachedCitizen.clone(true);
      clone.scale.set(MODEL_SCALE, MODEL_SCALE, MODEL_SCALE);
      clone.rotation.x = 0.4;
      clone.rotation.y = 0.6;

      const visibleSet = this.getVisibleSubsets(char);
      let meshIdx = 0;
      clone.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.visible = visibleSet.has(meshIdx);
          meshIdx++;
        }
      });
      group.add(clone);
    } else {
      // Fallback box
      const color = JOB_COLORS[char.getJob()] ?? 0xcccccc;
      const geo = new THREE.BoxGeometry(40, 60, 20);
      const mat = new THREE.MeshBasicMaterial({ color });
      group.add(new THREE.Mesh(geo, mat));
    }

    return group;
  }

  private getVisibleSubsets(char: Character): Set<number> {
    const visible = new Set<number>();
    const isMale = char.id % 2 === 0;

    if (isMale) {
      visible.add(SUBSETS.heads.male[0]);
      visible.add(SUBSETS.bodies.male[0]);
      visible.add(SUBSETS.collar_m[0]);
      visible.add(SUBSETS.belt_m[0]);
      visible.add(SUBSETS.legPouch_m[0]);
    } else {
      visible.add(SUBSETS.heads.female[0]);
      visible.add(SUBSETS.bodies.female[0]);
      visible.add(SUBSETS.collar_f[0]);
      visible.add(SUBSETS.belt_m[0]);
      visible.add(SUBSETS.legPouch_f[0]);
    }

    const hairIdx = char.id % SUBSETS.hair.length;
    visible.add(SUBSETS.hair[hairIdx]);

    const job = char.getJob();
    const jobMap: Record<number, number[]> = {
      2: SUBSETS.jobs.builder,
      3: SUBSETS.jobs.tech,
      4: SUBSETS.jobs.miner,
      5: SUBSETS.jobs.emergency,
      7: SUBSETS.jobs.bartender,
      9: SUBSETS.jobs.tech,
      12: SUBSETS.jobs.doctor,
      13: SUBSETS.jobs.tech,
    };
    const jobSubsets = jobMap[job];
    if (jobSubsets) {
      for (const s of jobSubsets) visible.add(s);
    } else {
      visible.add(isMale ? SUBSETS.shirt_m[0] : SUBSETS.shirt_f[0]);
    }

    return visible;
  }

  private positionCharacter(object: THREE.Object3D, char: Character) {
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
    if (!cachedCitizen || citizenLoadFailed) return;
    for (const char of this.pendingUpgrade) {
      const handle = this.handles.get(char.id);
      if (!handle || handle.is3D) continue;

      this.scene.remove(handle.object);
      if (handle.object instanceof THREE.Mesh) {
        handle.object.geometry.dispose();
      }

      const newObj = this.createModel(char, char.bSpacewalking);
      this.positionCharacter(newObj, char);
      this.scene.add(newObj);
      handle.object = newObj;
      handle.modelGroup = newObj;
      handle.is3D = true;
      handle.showingSpacesuit = char.bSpacewalking;
    }
    this.pendingUpgrade = [];
  }

  updateCharacter(char: Character) {
    const handle = this.handles.get(char.id);
    if (!handle) return;

    // Switch model if spacesuit state changed
    if (handle.is3D && handle.showingSpacesuit !== char.bSpacewalking) {
      this.scene.remove(handle.object);
      handle.object.traverse((child) => {
        if (child instanceof THREE.Mesh) child.geometry.dispose();
      });

      const newObj = this.createModel(char, char.bSpacewalking);
      this.scene.add(newObj);
      handle.object = newObj;
      handle.modelGroup = newObj;
      handle.showingSpacesuit = char.bSpacewalking;
    }

    // Base position
    this.positionCharacter(handle.object, char);
    this.positionNeedBars(handle.needBarsObj, char);

    // Procedural animation
    this.applyProceduralAnim(handle, char);

    // Need bars
    this.drawNeedBars(handle.needBarsEl, char);
  }

  /** Apply procedural walk bob / idle breathing. */
  private applyProceduralAnim(handle: CharacterRenderHandle, char: Character) {
    const t = performance.now() / 1000;
    const phase = handle.animPhase;

    if (char.moving) {
      // Walk bob: vertical bounce
      const bob = Math.sin(t * WALK_BOB_SPEED + phase) * WALK_BOB_AMPLITUDE;
      handle.object.position.y += bob;

      // Walk sway: slight lean left/right
      if (handle.modelGroup.children.length > 0) {
        handle.modelGroup.children[0].rotation.z = Math.sin(t * WALK_BOB_SPEED * 0.5 + phase) * WALK_SWAY;
      }
    } else {
      // Idle breathing: gentle vertical pulse
      const breathe = Math.sin(t * BREATHE_SPEED + phase) * BREATHE_AMPLITUDE;
      handle.object.position.y += breathe;

      // Reset sway
      if (handle.modelGroup.children.length > 0) {
        handle.modelGroup.children[0].rotation.z = 0;
      }
    }
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
