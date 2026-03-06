import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { TILE_HALF_W, TILE_HALF_H } from '../config';
import type { Character } from '../characters/Character';

/**
 * Renders characters in the Three.js scene.
 *
 * Loads Citizen_Base.glb for normal characters and Spacesuit.glb for spacewalking.
 * Uses skeletal animations from GLTF clips when available, otherwise
 * applies procedural animations (walk bob, idle breathing).
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
/** Working/building bob speed. */
const WORK_BOB_SPEED = 4;
/** Working bob amplitude. */
const WORK_BOB_AMPLITUDE = 3;
/** Working lean (forward tilt). */
const WORK_LEAN = 0.12;

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

/**
 * Character texture variants for skin tone diversity.
 * Textures in public/assets/characters/ follow the pattern:
 *   {Species}_{Part}_{Gender}_{Variant}_base_{ToneIndex}.png
 * The _base_01 and _base_02 variants provide two skin tones per model.
 */
const CHARACTER_TEXTURE_PATH = 'assets/characters/';
const textureLoader = new THREE.TextureLoader();
const charTexCache = new Map<string, THREE.Texture>();

function loadCharTexture(filename: string): THREE.Texture | null {
  const cached = charTexCache.get(filename);
  if (cached) return cached;

  const tex = textureLoader.load(
    `${CHARACTER_TEXTURE_PATH}${filename}`,
    (t) => {
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      t.colorSpace = THREE.SRGBColorSpace;
      charTexCache.set(filename, t);
    },
    undefined,
    () => { /* silently fail for missing textures */ }
  );
  charTexCache.set(filename, tex);
  return tex;
}

/** Swap skin tone textures on a cloned citizen model based on character ID. */
function applySkinVariant(group: THREE.Group, charId: number) {
  // Use char ID to pick tone variant: _base_01 or _base_02
  const toneIdx = (charId % 2) + 1;
  const toneSuffix = `_base_0${toneIdx}.png`;

  // Walk all meshes and try to find matching variant textures
  group.traverse((child) => {
    if (!(child instanceof THREE.Mesh) && !(child instanceof THREE.SkinnedMesh)) return;
    const mat = child.material;
    if (!(mat instanceof THREE.MeshStandardMaterial) && !(mat instanceof THREE.MeshBasicMaterial)) return;
    if (!mat.map) return;

    // Get the original texture name from the material
    const origName = mat.name || child.name;
    if (!origName) return;

    // Try to find a variant texture matching this mesh's name pattern
    // E.g., for mesh "Human_Body_Male01" → try "Human_Body_Male01_base_01.png"
    const variantFile = `${origName}${toneSuffix}`;
    const tex = loadCharTexture(variantFile);
    if (tex) {
      mat.map = tex;
      mat.needsUpdate = true;
    }
  });
}

/** Cached loaded GLTF data. */
let cachedCitizen: THREE.Group | null = null;
let cachedSpacesuit: THREE.Group | null = null;
let citizenAnimClips: THREE.AnimationClip[] = [];
let spacesuitAnimClips: THREE.AnimationClip[] = [];
let citizenHasSkeleton = false;
let spacesuitHasSkeleton = false;
let citizenLoadPromise: Promise<void> | null = null;
let spacesuitLoadPromise: Promise<void> | null = null;
let citizenLoadFailed = false;
let spacesuitLoadFailed = false;

/** Map character activity state to animation clip name. */
const STATE_CLIP_MAP: Record<string, string[]> = {
  walking: ['Citizen_Walk', 'Spacewalk_Walk_Rock'],
  idle: ['Citizen_Idle_A', 'Citizen_Idle_Normal'],
  sleeping: ['Citizen_Goto_Sleep'],
  building: ['Citizen_Build'],
  eating: ['Citizen_EatReplicator'],
  fighting_melee: ['Citizen_Punch'],
  fighting_ranged: ['Citizen_EmergencyShoot'],
  dead: ['Citizen_DeathPose'],
  panicking: ['Citizen_Panic_Walk'],
};

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

function hasSkinning(group: THREE.Group): boolean {
  let found = false;
  group.traverse((child) => {
    if (child instanceof THREE.SkinnedMesh) found = true;
  });
  return found;
}

function loadCitizenModel(): Promise<void> {
  if (citizenLoadPromise) return citizenLoadPromise;
  citizenLoadPromise = new Promise<void>((resolve) => {
    const loader = new GLTFLoader();
    loader.load(MODEL_PATH, (gltf) => {
      cachedCitizen = gltf.scene;
      citizenAnimClips = gltf.animations || [];
      citizenHasSkeleton = hasSkinning(cachedCitizen) && citizenAnimClips.length > 0;

      // Only strip skinning if we have no usable animation clips
      if (!citizenHasSkeleton) {
        stripSkinning(cachedCitizen);
      }

      // Ensure double-sided materials
      cachedCitizen.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const mat = child.material as THREE.Material;
          mat.side = THREE.DoubleSide;
        }
      });

      let mc = 0;
      cachedCitizen.traverse((c) => { if (c instanceof THREE.Mesh || c instanceof THREE.SkinnedMesh) mc++; });
      console.log(`Citizen model loaded: ${mc} meshes, ${citizenAnimClips.length} clips, skeleton=${citizenHasSkeleton}`);
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
      spacesuitAnimClips = gltf.animations || [];
      spacesuitHasSkeleton = hasSkinning(cachedSpacesuit) && spacesuitAnimClips.length > 0;

      if (!spacesuitHasSkeleton) {
        stripSkinning(cachedSpacesuit);
      }

      cachedSpacesuit.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const mat = child.material as THREE.Material;
          mat.side = THREE.DoubleSide;
        }
      });

      let mc = 0;
      cachedSpacesuit.traverse((c) => { if (c instanceof THREE.Mesh || c instanceof THREE.SkinnedMesh) mc++; });
      console.log(`Spacesuit model loaded: ${mc} meshes, ${spacesuitAnimClips.length} clips, skeleton=${spacesuitHasSkeleton}`);
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
  /** AnimationMixer for skeletal clips (null if no clips). */
  mixer: THREE.AnimationMixer | null;
  /** Currently playing animation action. */
  currentAction: THREE.AnimationAction | null;
  /** Current animation state key. */
  currentAnimState: string;
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
    let mixer: THREE.AnimationMixer | null = null;

    // If spacewalking and spacesuit model not loaded yet, queue for upgrade
    if (char.bSpacewalking && !cachedSpacesuit && !spacesuitLoadFailed) {
      object = this.createBoxPlaceholder(char);
      this.pendingUpgrade.push(char);
      loadSpacesuitModel().then(() => this.upgradePending());
    } else if (cachedCitizen && !citizenLoadFailed) {
      const result = this.createModel(char, char.bSpacewalking);
      modelGroup = result.group;
      mixer = result.mixer;
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
      mixer,
      currentAction: null,
      currentAnimState: '',
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

  /** Create either citizen or spacesuit model. Returns { group, mixer }. */
  private createModel(char: Character, spacesuit: boolean): { group: THREE.Group; mixer: THREE.AnimationMixer | null } {
    const group = new THREE.Group();
    let mixer: THREE.AnimationMixer | null = null;

    if (spacesuit && cachedSpacesuit && !spacesuitLoadFailed) {
      // Spacesuit model — show base suit + job-specific accessories
      const clone = spacesuitHasSkeleton
        ? cloneSkeleton(cachedSpacesuit) as THREE.Group
        : cachedSpacesuit.clone(true);
      clone.scale.set(MODEL_SCALE, MODEL_SCALE, MODEL_SCALE);
      clone.rotation.x = 30 * (Math.PI / 180); // Lua: 30° iso tilt
      clone.rotation.y = 45 * (Math.PI / 180); // Lua: initial facing SE

      // Spacesuit.glb has 7 primitives by material:
      // 0: Head (always), 1: Suit body (always), 2: AsteroidChunk (MINER),
      // 3: Builder tool (BUILDER), 4: Suit body (always),
      // 5: SpaceEmergency (EMERGENCY), 6: MinerAcc (MINER)
      const job = char.getJob();
      const visibleMats = new Set(['Human_Head_Male01', 'Spacesuit01']);
      if (job === 4) { // MINER
        visibleMats.add('AsteroidChunk01');
        visibleMats.add('MinerAcc01');
      } else if (job === 2) { // BUILDER
        visibleMats.add('Builder01');
      } else if (job === 5) { // EMERGENCY
        visibleMats.add('SpaceEmergency01');
      }
      clone.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.SkinnedMesh) {
          const matName = (child.material as THREE.Material)?.name ?? '';
          child.visible = visibleMats.has(matName);
        }
      });

      group.add(clone);

      // Set up animation mixer if clips available
      if (spacesuitHasSkeleton && spacesuitAnimClips.length > 0) {
        mixer = new THREE.AnimationMixer(clone);
      }
    } else if (cachedCitizen && !citizenLoadFailed) {
      // Citizen model with subset visibility
      const clone = citizenHasSkeleton
        ? cloneSkeleton(cachedCitizen) as THREE.Group
        : cachedCitizen.clone(true);
      clone.scale.set(MODEL_SCALE, MODEL_SCALE, MODEL_SCALE);
      clone.rotation.x = 30 * (Math.PI / 180); // Lua: 30° iso tilt
      clone.rotation.y = 45 * (Math.PI / 180); // Lua: initial facing SE

      const visibleSet = this.getVisibleSubsets(char);
      let meshIdx = 0;
      clone.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.SkinnedMesh) {
          child.visible = visibleSet.has(meshIdx);
          meshIdx++;
        }
      });

      // Apply skin tone variant textures for visual diversity
      applySkinVariant(clone, char.id);

      group.add(clone);

      // Set up animation mixer if clips available
      if (citizenHasSkeleton && citizenAnimClips.length > 0) {
        mixer = new THREE.AnimationMixer(clone);
      }
    } else {
      // Fallback box
      const color = JOB_COLORS[char.getJob()] ?? 0xcccccc;
      const geo = new THREE.BoxGeometry(40, 60, 20);
      const mat = new THREE.MeshBasicMaterial({ color });
      group.add(new THREE.Mesh(geo, mat));
    }

    return { group, mixer };
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
    const remaining: Character[] = [];
    for (const char of this.pendingUpgrade) {
      const handle = this.handles.get(char.id);
      if (!handle || handle.is3D) continue;

      // If character needs spacesuit but it's not loaded yet, keep waiting
      if (char.bSpacewalking && !cachedSpacesuit && !spacesuitLoadFailed) {
        remaining.push(char);
        continue;
      }
      // If citizen model not loaded yet, keep waiting
      if (!char.bSpacewalking && (!cachedCitizen || citizenLoadFailed)) {
        remaining.push(char);
        continue;
      }

      this.scene.remove(handle.object);
      if (handle.object instanceof THREE.Mesh) {
        handle.object.geometry.dispose();
      }

      const result = this.createModel(char, char.bSpacewalking);
      this.positionCharacter(result.group, char);
      this.scene.add(result.group);
      handle.object = result.group;
      handle.modelGroup = result.group;
      handle.mixer = result.mixer;
      handle.is3D = true;
      handle.showingSpacesuit = char.bSpacewalking;
    }
    this.pendingUpgrade = remaining;
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

      const result = this.createModel(char, char.bSpacewalking);
      this.scene.add(result.group);
      handle.object = result.group;
      handle.modelGroup = result.group;
      handle.mixer = result.mixer;
      handle.currentAction = null;
      handle.currentAnimState = '';
      handle.showingSpacesuit = char.bSpacewalking;
    }

    // Base position
    this.positionCharacter(handle.object, char);
    this.positionNeedBars(handle.needBarsObj, char);

    // Rotate model to face movement direction (Lua: 30° X-tilt, Y = facing angle)
    if (handle.is3D && handle.modelGroup.children.length > 0) {
      const model = handle.modelGroup.children[0];

      // Vacuum death animation: shrink + spin (Lua Character:_vacuumDisappear)
      if (char.nVacuumScale >= 0) {
        const s = Math.max(0, char.nVacuumScale) * MODEL_SCALE;
        model.scale.set(s, s, s);
        model.rotation.x = 30 * (Math.PI / 180);
        model.rotation.y = char.facingAngle + char.nVacuumRotation;
        model.rotation.z = char.nVacuumRotation;
      } else {
        // Normal: Lua setRot(30, dirAngle, 0) — 30° isometric tilt on X-axis
        model.scale.set(MODEL_SCALE, MODEL_SCALE, MODEL_SCALE);
        model.rotation.x = 30 * (Math.PI / 180); // 30° = 0.5236 rad
        model.rotation.y = char.facingAngle;
        model.rotation.z = 0;
      }
    }

    // Animation: use skeletal clips if available, else procedural
    if (handle.mixer) {
      this.updateSkeletalAnim(handle, char);
    } else {
      this.applyProceduralAnim(handle, char);
    }

    // Need bars
    this.drawNeedBars(handle.needBarsEl, char);
  }

  /** Get the animation state key for a character. */
  private getAnimState(char: Character): string {
    if (!char.isAlive()) return 'dead';
    if (char.moving) return 'walking';
    const taskName = char.currentTask?.name;
    if (taskName === 'sleep' || taskName === 'SleepInBed' || taskName === 'SleepOnFloor') return 'sleeping';
    if (taskName === 'BuildEnvObject' || taskName === 'BuildTile') return 'building';
    if (taskName === 'Eat' || taskName === 'GetDrink') return 'eating';
    if (taskName === 'AttackEnemy' && char.weapon) return 'fighting_ranged';
    if (taskName === 'AttackEnemy') return 'fighting_melee';
    if (taskName === 'Mine') return 'building'; // Use build animation for mining too
    return 'idle';
  }

  /** Find the best matching animation clip for a state. */
  private findClip(state: string, spacesuit: boolean): THREE.AnimationClip | null {
    const candidates = STATE_CLIP_MAP[state] || [];
    const clips = spacesuit ? spacesuitAnimClips : citizenAnimClips;

    for (const name of candidates) {
      const clip = clips.find(c => c.name === name);
      if (clip) return clip;
    }
    // Fallback: try partial match
    for (const name of candidates) {
      const clip = clips.find(c => c.name.includes(name));
      if (clip) return clip;
    }
    return null;
  }

  /** Update skeletal animation from mixer clips. */
  private updateSkeletalAnim(handle: CharacterRenderHandle, char: Character) {
    const state = this.getAnimState(char);

    // Switch clip if state changed
    if (state !== handle.currentAnimState) {
      handle.currentAnimState = state;

      const clip = this.findClip(state, handle.showingSpacesuit);
      if (clip && handle.mixer) {
        if (handle.currentAction) {
          handle.currentAction.fadeOut(0.2);
        }
        const action = handle.mixer.clipAction(clip);
        action.reset().fadeIn(0.2).play();
        handle.currentAction = action;
      }
    }

    // Update mixer (use real time delta)
    const dt = 1 / 60; // Approximate — called once per frame
    handle.mixer!.update(dt);
  }

  /** Check if character is doing a working task (building, mining, maintaining). */
  private isWorking(char: Character): boolean {
    const name = char.currentTask?.name;
    return name === 'BuildTile' || name === 'BuildEnvObject' || name === 'Mine' ||
           name === 'MaintainEnvObject' || name === 'MaintainPlants';
  }

  /** Apply procedural walk bob / idle breathing / working animation. */
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
    } else if (this.isWorking(char)) {
      // Working: smooth sawtooth — lean forward, brief dip, return (rhythmic tap)
      const cycle = ((t * WORK_BOB_SPEED + phase) % (Math.PI * 2)) / (Math.PI * 2); // 0..1
      // Ease-in dip at cycle peak (0.4..0.6), gentle return
      const dip = cycle < 0.4 ? 0 : cycle < 0.6 ? Math.sin((cycle - 0.4) / 0.2 * Math.PI) : 0;
      handle.object.position.y += dip * WORK_BOB_AMPLITUDE;

      // Forward lean: ramp up to strike, snap back
      if (handle.modelGroup.children.length > 0) {
        const lean = cycle < 0.5 ? cycle * 2 : (1 - cycle) * 2; // triangle wave 0..1..0
        handle.modelGroup.children[0].rotation.z = lean * WORK_LEAN;
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
    // Needs range -100..+100; remap to 0..100 for bar display
    const remap = (v: number) => Math.max(0, Math.min(100, (v + 100) / 2));
    const bars = [
      { value: remap(char.needs.oxygen), color: '#4488ff' },
      { value: remap(char.needs.hunger), color: '#ff8844' },
      { value: remap(char.needs.energy), color: '#aaaa44' },
      { value: Math.max(0, (char.nMorale + 100) / 2), color: '#44cc44' },
    ];
    // Build bars using DOM methods to avoid innerHTML (values are game-state-derived numbers)
    el.textContent = '';
    for (const bar of bars) {
      const color = bar.value > 30 ? bar.color : '#ff0000';
      const pct = Math.max(0, Math.min(100, bar.value));
      const outer = document.createElement('div');
      outer.style.cssText = 'width:32px;height:3px;margin-bottom:1px;background:#333;position:relative;';
      const inner = document.createElement('div');
      inner.style.cssText = `width:${Math.round(pct)}%;height:100%;background:${color};`;
      outer.appendChild(inner);
      el.appendChild(outer);
    }
  }

  destroyCharacter(charId: number) {
    const handle = this.handles.get(charId);
    if (!handle) return;

    // Clean up animation mixer
    if (handle.mixer) {
      handle.mixer.stopAllAction();
    }

    this.scene.remove(handle.object);
    handle.object.traverse((child) => {
      if (child instanceof THREE.Mesh) child.geometry.dispose();
    });
    this.overlayScene.remove(handle.needBarsObj);
    handle.needBarsEl.remove();
    this.handles.delete(charId);
  }
}
