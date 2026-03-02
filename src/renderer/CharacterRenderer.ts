import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
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
// Model is 0.86 units tall. Target ~48px screen height for normal zoom.
const MODEL_SCALE = 56;

/**
 * Subset indices from .brig (Citizen_Base) by category.
 * Full list from extract_brig.py output.
 */
const SUBSETS = {
  // Heads (pick one)
  heads: {
    male:       [7],   // Male01_Head
    maleFat:    [6],   // Male01_FatHead
    maleThin:   [8],   // Male01_ThinHead
    female:     [4],   // Female01_Head
    femaleFat:  [3],   // Female01_FatHead
    bird:       [1],   // Bird01_Head
    cat:        [2],   // Cat01_Head
    jelly:      [5],   // Jelly01_Head
    shamon:     [9],   // Shamon01_Head
  },
  // Bodies (pick one)
  bodies: {
    male:       [12],  // Male01_Body
    maleFat:    [13],  // Male01_FatBody
    maleThin:   [15],  // Male01_ThinBody
    female:     [10],  // Female01_Body
    femaleFat:  [11],  // Female01_FatBody
    shamon:     [14],  // Male01_ShamonBody
  },
  // Hair (pick one)
  hair: [16, 17, 18, 19, 20, 21, 22, 23, 24, 25],
  // Cat01, Long01, Short01-08

  // Lower body accessories
  belt_m: [26],        // Belt01
  belt_f: [26],        // same belt
  legPouch_m: [33],    // M_LegPouch01
  legPouch_f: [28],    // F_LegPouch01
  shorts_m: [37],      // TouristShorts_M
  shorts_f: [36],      // TouristShorts_F

  // Upper body
  collar_m: [52],      // M_Collar01
  collar_f: [44],      // F_Collar01
  shirt_m: [62],       // TouristShirt_M
  shirt_f: [61],       // TouristShirt_F

  // Job uniforms (pick one based on job)
  jobs: {
    builder:   [68],   // Builder_Suit02
    bartender: [67],   // Bartender_Suit02_M
    doctor:    [72],   // Doctor_Suit02
    emergency: [74],   // Emergency_Suit02
    miner:     [77],   // Miner_Suit02
    raider:    [80],   // Raider_Suit02
    tech:      [82],   // Tech_Suit02
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

        // Strip skinning — the .brig skeleton uses MOAI bone conventions
        // that produce distorted results with glTF skinning. Convert all
        // SkinnedMesh to plain Mesh so the model renders in its bind pose.
        const toReplace: { skinned: THREE.SkinnedMesh; parent: THREE.Object3D }[] = [];
        cachedGLTF.traverse((child) => {
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

        // Ensure double-sided rendering
        cachedGLTF.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const mat = child.material as THREE.Material;
            mat.side = THREE.DoubleSide;
          }
        });

        // Count meshes for debug
        let meshCount = 0;
        cachedGLTF.traverse((child) => {
          if (child instanceof THREE.Mesh) meshCount++;
        });
        console.log('Character model loaded:', meshCount, 'meshes (unskinned)');
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
    } else {
      object = this.createBoxPlaceholder(char);
      this.pendingUpgrade.push(char);
      loadModel().then(() => this.upgradePending());
    }

    this.positionCharacter(object, char);

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

  /** Colored box placeholder — sized to be visible at isometric scale. */
  private createBoxPlaceholder(char: Character): THREE.Mesh {
    const color = JOB_COLORS[char.getJob()] ?? 0xcccccc;
    // Tiles are 128x64 px. A character should be roughly half a tile wide, one tile tall.
    const geo = new THREE.BoxGeometry(40, 60, 20);
    const mat = new THREE.MeshBasicMaterial({ color });
    return new THREE.Mesh(geo, mat);
  }

  /** Clone the GLTF model with subset visibility. */
  private create3DModel(char: Character): THREE.Group {
    const group = new THREE.Group();
    // Clone the static (unskinned) model
    const clone = cachedGLTF!.clone(true);
    clone.scale.set(MODEL_SCALE, MODEL_SCALE, MODEL_SCALE);

    // Rotate for isometric camera view.
    // Camera looks along -Z. Model stands Y-up.
    // Tilt forward slightly and rotate for 3/4 view.
    clone.rotation.x = 0.4;
    clone.rotation.y = 0.6;

    // Subset visibility
    const visibleSet = this.getVisibleSubsets(char);
    let meshIdx = 0;
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.visible = visibleSet.has(meshIdx);
        meshIdx++;
      }
    });

    group.add(clone);
    return group;
  }

  /** Pick which subsets to show based on character traits. */
  private getVisibleSubsets(char: Character): Set<number> {
    const visible = new Set<number>();

    // Pick head + body based on character ID (deterministic variety)
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
      visible.add(SUBSETS.belt_m[0]); // same belt
      visible.add(SUBSETS.legPouch_f[0]);
    }

    // Pick hair based on char ID
    const hairIdx = char.id % SUBSETS.hair.length;
    visible.add(SUBSETS.hair[hairIdx]);

    // Pick job uniform
    const job = char.getJob();
    const jobMap: Record<number, number[]> = {
      2: SUBSETS.jobs.builder,
      3: SUBSETS.jobs.tech,
      4: SUBSETS.jobs.miner,
      5: SUBSETS.jobs.emergency,
      7: SUBSETS.jobs.bartender,
      9: SUBSETS.jobs.tech,     // scientist uses tech suit
      12: SUBSETS.jobs.doctor,
      13: SUBSETS.jobs.tech,    // janitor uses tech suit
    };
    const jobSubsets = jobMap[job];
    if (jobSubsets) {
      for (const s of jobSubsets) visible.add(s);
    } else {
      // Default: tourist shirt
      visible.add(isMale ? SUBSETS.shirt_m[0] : SUBSETS.shirt_f[0]);
    }

    return visible;
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
