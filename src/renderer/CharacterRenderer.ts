import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { TileType } from '../world/TileTypes';
import type { Character } from '../characters/Character';
import type { TileGrid } from '../world/TileGrid';
import { dialogueSystem } from '../characters/DialogueSystem';
import {
  RACE_HUMAN, RACE_CAT, RACE_JELLY, RACE_TOBIAN, RACE_BIRDSHARK,
  RACE_CHICKEN, RACE_SHAMON, RACE_MONSTER, RACE_MURDERFACE, RACE_KILLBOT,
} from '../characters/CharacterConstants';

/**
 * Renders characters in the Three.js scene.
 *
 * Loads Citizen_Base.glb for normal characters and Spacesuit.glb for spacewalking.
 * Uses skeletal animations from GLTF clips when available, otherwise
 * applies procedural animations (walk bob, idle breathing).
 */

const MODEL_PATH = 'assets/models/Citizen_Base.glb';
const SPACESUIT_PATH = 'assets/models/Spacesuit.glb';
const BAD_ALIEN_PATH = 'assets/models/Bad_Alien.glb';
const MURDER_ROBOT_PATH = 'assets/models/Murder_Robot.glb';
const MODEL_SCALE = 56;
/** Lua: Bad_Alien scale = 0.65 vs Citizen_Base 0.5 → ratio 1.3× our MODEL_SCALE. */
const BAD_ALIEN_SCALE = Math.round(MODEL_SCALE * 1.3);
const MURDER_ROBOT_SCALE = MODEL_SCALE;

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

// ── Blob shadow (Lua: Character:_setUpBlobShadow) ──────────────────
/** Shadow ellipse dimensions. */
const SHADOW_W = 48;
const SHADOW_H = 20;
/** Y offset below character (Lua: setLoc(0, -25, -50)). */
const SHADOW_OFFSET_Y = 25;

/** Generate a soft elliptical shadow texture procedurally. */
function createBlobShadowTexture(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  const cx = 32, cy = 16, rx = 28, ry = 12;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
  grad.addColorStop(0, 'rgba(0,0,0,0.45)');
  grad.addColorStop(0.6, 'rgba(0,0,0,0.2)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.scale(1, ry / rx);
  ctx.beginPath();
  ctx.arc(cx, cx, rx, 0, Math.PI * 2); // circle, scaled to ellipse
  ctx.restore();
  ctx.fillStyle = grad;
  ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

let blobShadowTex: THREE.Texture | null = null;
function getBlobShadowTexture(): THREE.Texture {
  if (!blobShadowTex) blobShadowTex = createBlobShadowTexture();
  return blobShadowTex;
}

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

/** R-3: Race-specific tint colors to visually distinguish alien races. */
const RACE_TINT: Record<number, number> = {
  [RACE_CAT]:       0xffaa44,  // warm orange
  [RACE_JELLY]:     0x6688ff,  // blue translucent
  [RACE_TOBIAN]:    0x44cc66,  // green
  [RACE_BIRDSHARK]: 0xaa44ff,  // purple
  [RACE_CHICKEN]:   0xffdd44,  // yellow
  [RACE_SHAMON]:    0x44ddcc,  // teal
  [RACE_MONSTER]:   0xff2222,  // hostile red
  [RACE_MURDERFACE]:0xcc4444,  // dark red
  [RACE_KILLBOT]:   0x884444,  // dark metallic red
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
 * Character texture loading.
 * GLB models have no embedded textures — all materials are flat grey.
 * Textures exist as separate PNGs in public/assets/characters/.
 * We match material names to texture files and apply them at clone time.
 */
const CHARACTER_TEXTURE_PATH = 'assets/characters/';
const textureLoader = new THREE.TextureLoader();
const charTexCache = new Map<string, THREE.Texture>();

/** Known character texture base names (without .png). */
const CHAR_TEXTURES = new Set([
  // Citizen_Alien
  'AC_LwBody01', 'AC_UpBody01', 'AC_UpBody02', 'AC_UpBody03',
  'Alien_Body01', 'Alien_Body01_base_01', 'Alien_Body01_base_02',
  'Alien_Body01_base_03', 'Alien_Body01_base_04', 'Alien_Body01_base_05',
  'Alien_Head01', 'Alien_Head01_base_01', 'Alien_Head01_base_02',
  'Alien_Head01_base_03', 'Alien_Head01_base_04', 'Alien_Head01_base_05',
  'Bad_Alien01',

  // Citizen_Base - Bird
  'Bird_Body_Female01_base_01', 'Bird_Body_Female01_base_02',
  'Bird_Body_Male01_base_01', 'Bird_Body_Male01_base_02',
  'Bird_Head_Female01_base_01', 'Bird_Head_Female01_base_02',
  'Bird_Head_Male01_base_01', 'Bird_Head_Male01_base_02',

  // Citizen_Base - Cat
  'Cat_Body_Female01_base_01', 'Cat_Body_Female01_base_02',
  'Cat_Body_Male01_base_01', 'Cat_Body_Male01_base_02',
  'Cat_Head_Female01_base_01', 'Cat_Head_Female01_base_02',
  'Cat_Head_Male01_base_01', 'Cat_Head_Male01_base_02',

  // Citizen_Base - Chicken
  'Chicken_Body01', 'Chicken_Body01_base_01', 'Chicken_Body01_base_02',
  'Chicken_Body01_base_03', 'Chicken_Body01_base_04',
  'Chicken_Head01', 'Chicken_Head01_base_01', 'Chicken_Head01_base_02',
  'Chicken_Head01_base_03', 'Chicken_Head01_base_04',
  'Chicken_Head01_bottom_01', 'Chicken_Head01_bottom_02',
  'Chicken_Head01_bottom_03', 'Chicken_Head01_bottom_04',
  'Chicken_Head01_top_01', 'Chicken_Head01_top_02',
  'Chicken_Head01_top_03', 'Chicken_Head01_top_04',

  // Citizen_Base - Human
  'Human_Body_Female01', 'Human_Body_Female01_base_01',
  'Human_Body_Female01_base_02', 'Human_Body_Female01_base_03',
  'Human_Body_Female01_base_04', 'Human_Body_Female01_base_05',
  'Human_Body_Male01', 'Human_Body_Male01_base_01',
  'Human_Body_Male01_base_02', 'Human_Body_Male01_base_03',
  'Human_Body_Male01_base_04', 'Human_Body_Male01_base_05',
  'Human_Body_Male01_bottom_01', 'Human_Body_Male01_bottom_02',
  'Human_Body_Male01_bottom_03', 'Human_Body_Male01_bottom_04',
  'Human_Body_Male01_bottom_05', 'Human_Body_Male01_bottom_06',
  'Human_Body_Male01_bottom_07', 'Human_Body_Male01_bottom_08',
  'Human_Body_Male01_bottom_10',
  'Human_Body_Male01_top_01', 'Human_Body_Male01_top_02',
  'Human_Body_Male01_top_03', 'Human_Body_Male01_top_04',
  'Human_Body_Male01_top_05', 'Human_Body_Male01_top_06',
  'Human_Body_Male01_top_07', 'Human_Body_Male01_top_08',
  'Human_Head_Female01', 'Human_Head_Female01_base_01',
  'Human_Head_Female01_base_02', 'Human_Head_Female01_base_03',
  'Human_Head_Female01_base_04', 'Human_Head_Female01_base_05',
  'Human_Head_Male01', 'Human_Head_Male01_base_01',
  'Human_Head_Male01_base_02', 'Human_Head_Male01_base_03',
  'Human_Head_Male01_base_04', 'Human_Head_Male01_base_05',
  'Human_Head_Male01_bottom_01_Color_01',
  'Human_Head_Male01_bottom_01_Color_02',
  'Human_Head_Male01_bottom_01_Color_03',
  'Human_Head_Male01_bottom_01_Color_04',
  'Human_Head_Male01_bottom_01_Color_05',
  'Human_Head_Male01_bottom_02_Color_01',
  'Human_Head_Male01_bottom_02_Color_02',
  'Human_Head_Male01_bottom_02_Color_03',
  'Human_Head_Male01_bottom_02_Color_04',
  'Human_Head_Male01_bottom_02_Color_05',
  'Human_Head_Male01_bottom_03_Color_01',
  'Human_Head_Male01_bottom_03_Color_02',
  'Human_Head_Male01_bottom_03_Color_03',
  'Human_Head_Male01_bottom_03_Color_04',
  'Human_Head_Male01_bottom_03_Color_05',
  'Human_Head_Male01_bottom_04_Color_01',
  'Human_Head_Male01_bottom_04_Color_02',
  'Human_Head_Male01_bottom_04_Color_03',
  'Human_Head_Male01_bottom_04_Color_04',
  'Human_Head_Male01_bottom_04_Color_05',
  'Human_Head_Male01_bottom_05_Color_01',
  'Human_Head_Male01_bottom_05_Color_02',
  'Human_Head_Male01_bottom_05_Color_03',
  'Human_Head_Male01_bottom_05_Color_04',
  'Human_Head_Male01_bottom_05_Color_05',

  // Citizen_Base - Jelly
  'Jelly_Body_Female01_base_01', 'Jelly_Body_Female01_base_02',
  'Jelly_Body_Female01_base_03', 'Jelly_Body_Female01_base_04',
  'Jelly_Head_Female01', 'Jelly_Head_Female01_base_01',
  'Jelly_Head_Female01_base_02', 'Jelly_Head_Female01_base_03',
  'Jelly_Head_Female01_base_04', 'Jelly_Head01',

  // Citizen_Accessories
  'Arm_Gauntlet', 'Collar_base_01', 'Collar_base_02', 'Collar_base_03',
  'Collar_base_04', 'Collar01', 'Gray', 'straps_pouches', 'Visor01',

  // Citizen_Hair
  'Elephant01_Hair01', 'Elephant01_Hair01_base_01',
  'Elephant01_Hair01_base_02', 'Elephant01_Hair01_base_03',
  'Elephant01_Hair01_base_04', 'Elephant01_Hair01_base_05',
  'Hair_Long01_Color_01', 'Hair_Long01_Color_02', 'Hair_Long01_Color_03',
  'Hair_Long01_Color_04', 'Hair_Long01_Color_05', 'Hair_Long01_Color_06',
  'Hair_Long01_Color_07',
  'Hair_Short02_Color_01', 'Hair_Short02_Color_02',
  'Hair_Short02_Color_03', 'Hair_Short02_Color_04',
  'Hair_Short02_Color_07',
  'Hair_Short03_Color_01', 'Hair_Short03_Color_02',
  'Hair_Short03_Color_03', 'Hair_Short03_Color_04',
  'Hair_Short03_Color_05', 'Hair_Short03_Color_06',
  'Hair_Short03_Color_07',
  'Hair01',
  'Moustache01_Hair01', 'Moustache01_Hair01_base_01',
  'Moustache01_Hair01_base_02', 'Moustache01_Hair01_base_03',
  'Moustache01_Hair01_base_04', 'Moustache01_Hair01_base_05',

  // Citizen_Jobs
  'Builder01', 'Builder01_Base_bottom', 'Builder01_Base_top',
  'Doctor_base', 'Doctor01',
  'Emergency01', 'Emergency02', 'Emergency03',
  'gardener_base',
  'Miner01', 'Miner01_Base_bottom', 'Miner01_Base_top', 'Miner02',
  'MinerAcc01',
  'Scientist_base', 'Scientist01',
  'Technician01', 'Technician01_Base_bottom', 'Technician01_Base_top',

  // Citizen_Tourist
  'Tourist_Shirt_Female_01', 'Tourist_Shirt_Female_02',
  'Tourist_Shirt_Female_03', 'Tourist_Shirt_Female_04',
  'Tourist_Shirt_Female_05',
  'Tourist_Shirt_Male_01', 'Tourist_Shirt_Male_02',
  'Tourist_Shirt_Male_03', 'Tourist_Shirt_Male_04',
  'Tourist_Shorts_Female_01', 'Tourist_Shorts_Female_02',
  'Tourist_Shorts_Male_01', 'Tourist_Shorts_Male_02',

  // Hostiles
  'Murder_Body01', 'Murder_Head01', 'MurderRobot01', 'MurderSlug01',
  'Probe01',
  'Raider01', 'Raider01_bottom', 'Raider01_top',
  'Shamon_Body', 'Shamon_Head01',

  // Props_Weapons
  'AsteroidChunk01', 'Mug01', 'Rifle', 'Rifle01',

  // Spacesuit
  'SpaceDefault01', 'SpaceEmergency01', 'SpaceMiner01', 'SpaceRaider01',
  'Spacesuit01', 'Spacesuit02',
]);

/** Default colors for materials without textures (approximates original game). */
const MAT_DEFAULT_COLORS: Record<string, number> = {};

const textureMaterials = new Map<THREE.Texture, Set<THREE.Material>>();

function trackTextureUser(tex: THREE.Texture, mat: THREE.Material) {
  let mats = textureMaterials.get(tex);
  if (!mats) { mats = new Set(); textureMaterials.set(tex, mats); }
  mats.add(mat);
}

function loadCharTexture(filename: string): THREE.Texture {
  const cached = charTexCache.get(filename);
  if (cached) return cached;

  const tex = textureLoader.load(
    `${CHARACTER_TEXTURE_PATH}${filename}`,
    (t) => {
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      t.colorSpace = THREE.SRGBColorSpace;
      t.needsUpdate = true;
      const mats = textureMaterials.get(t);
      if (mats) { for (const m of mats) m.needsUpdate = true; }
    },
    undefined,
    () => {
      const mats = textureMaterials.get(tex);
      if (mats) {
        for (const m of mats) {
          if (m instanceof THREE.MeshStandardMaterial || m instanceof THREE.MeshBasicMaterial) {
            if (m.map === tex) {
              m.map = null;
              m.alphaTest = 0;
              m.transparent = false;
              m.needsUpdate = true;
            }
          }
        }
      }
    }
  );
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  charTexCache.set(filename, tex);
  return tex;
}

/**
 * Apply textures and colors to a cloned character model.
 * Matches material names to texture files using multiple candidate patterns.
 */
function applyModelTextures(group: THREE.Group, charId: number) {
  // R-2: Use all 5 skin tone variants (Lua cycles through _base_01 to _base_05)
  const toneIdx = (charId % 5) + 1;

  group.traverse((child) => {
    if (!(child instanceof THREE.Mesh) && !(child instanceof THREE.SkinnedMesh)) return;
    // Clone materials per character — Three.js clone() shares material references,
    // so modifying mat.map would affect ALL characters using the same cached model.
    const origMat = child.material as THREE.MeshStandardMaterial;
    if (!origMat || !('map' in origMat)) return;
    const mat = origMat.clone();
    mat.name = origMat.name;
    child.material = mat;

    const matName = mat.name || child.name || '';

    // Try to find a matching texture file.
    // Candidate patterns (first match wins):
    //   1. Strip _base_XX + add character tone: "Human_Body_Male01_base_03" → "Human_Body_Male01_base_01"
    //      Also handles no-suffix names: "Human_Head_Male01" → "Human_Head_Male01_base_01"
    //   2. Strip trailing digits + add tone: "Collar01" → "Collar_base_01"
    //   3. Exact matName (only for non-skin materials or when tone doesn't matter)
    const strippedBase = matName.replace(/_base_\d+$/, '');
    const candidates = [
      `${strippedBase}_base_0${toneIdx}`,
      `${matName.replace(/\d+$/, '')}_base_0${toneIdx}`,
      matName,
    ];

    let applied = false;
    for (const baseName of candidates) {
      if (CHAR_TEXTURES.has(baseName)) {
        const tex = loadCharTexture(`${baseName}.png`);
        mat.map = tex;
        mat.transparent = true;
        mat.alphaTest = 0.01;
        mat.depthWrite = false;
        mat.needsUpdate = true;
        trackTextureUser(tex, mat);
        applied = true;
        break;
      }
    }

    // For materials without textures, apply a default color
    if (!applied) {
      const defaultColor = MAT_DEFAULT_COLORS[matName];
      if (defaultColor !== undefined) {
        (mat as THREE.MeshStandardMaterial).color.setHex(defaultColor);
      }
    }

    // Store base color so setCharacterTint can multiply rather than replace
    mat.userData.baseColor = (mat as THREE.MeshStandardMaterial).color.getHex();
  });
}

/** Cached loaded GLTF data. */
let cachedCitizen: THREE.Group | null = null;
let cachedSpacesuit: THREE.Group | null = null;
let cachedBadAlien: THREE.Group | null = null;
let cachedMurderRobot: THREE.Group | null = null;
let citizenAnimClips: THREE.AnimationClip[] = [];
let spacesuitAnimClips: THREE.AnimationClip[] = [];
let badAlienAnimClips: THREE.AnimationClip[] = [];
let murderRobotAnimClips: THREE.AnimationClip[] = [];
let citizenHasSkeleton = false;
let spacesuitHasSkeleton = false;
let badAlienHasSkeleton = false;
let murderRobotHasSkeleton = false;
let citizenLoadPromise: Promise<void> | null = null;
let spacesuitLoadPromise: Promise<void> | null = null;
let badAlienLoadPromise: Promise<void> | null = null;
let murderRobotLoadPromise: Promise<void> | null = null;
let citizenLoadFailed = false;
let spacesuitLoadFailed = false;
let badAlienLoadFailed = false;
let murderRobotLoadFailed = false;

/** Map character activity state to animation clip name candidates (first match wins). */
const STATE_CLIP_MAP: Record<string, string[]> = {
  walking: ['Citizen_Walk', 'Citizen_Walk_B', 'Spacewalk_Walk'],
  idle: ['Citizen_Idle_A', 'Citizen_Idle_Normal', 'Citizen_Idle_B', 'Spacewalk_Idle'],
  sleeping: ['Citizen_Sleeping', 'Citizen_Goto_Sleep'],
  building: ['Citizen_BuilderConstruct', 'Citizen_Hammer', 'Spacewalk_Build'],
  eating: ['Citizen_Eat', 'Citizen_Eat_Fork', 'Citizen_Eat_Vegetable'],
  fighting_melee: ['Citizen_Box', 'Citizen_Box_B', 'Citizen_Stun_Attack'],
  fighting_ranged: ['Citizen_EmergencyShoot', 'Citizen_EmergencyShoot_Pistol', 'Spacewalk_Shoot'],
  dead: ['Citizen_DeadPose', 'Citizen_Shot_Death'],
  panicking: ['Citizen_Panic_Walk', 'Citizen_Panic_Run', 'Citizen_Panic_Idle'],
  running: ['Citizen_Run', 'Citizen_Run_WithIntent'],
  chatting: ['Citizen_Chat_A', 'Citizen_Chat_B', 'Citizen_Talking'],
  mining: ['Citizen_MinerRefinery', 'Citizen_MinerHoldRock', 'Spacewalk_Mining'],
  carrying: ['Citizen_Carry', 'Citizen_WalkCarry'],
  firefighting: ['Citizen_FightFire_Armed', 'Citizen_FightFire_Unarmed'],
  healing: ['Citizen_Doctor_Heal', 'Citizen_DoctorScan'],
  researching: ['Citizen_ConsolePushButtons', 'Citizen_ConsolePonder'],
  spacewalk: ['Spacewalk_Idle', 'Spacewalk_Walk'],
};

/** Ensure all mesh materials are double-sided (works for both Mesh and SkinnedMesh). */
function ensureDoubleSided(group: THREE.Group) {
  group.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.SkinnedMesh) {
      const mat = child.material as THREE.Material;
      mat.side = THREE.DoubleSide;
    }
  });
}

/** Check if a loaded GLTF scene contains any SkinnedMesh (i.e. has a skeleton). */
function detectSkeleton(group: THREE.Group): boolean {
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
      // Keep SkinnedMesh intact so skeletal animation clips can drive the skeleton.
      citizenHasSkeleton = detectSkeleton(cachedCitizen);
      ensureDoubleSided(cachedCitizen);

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
      // Keep SkinnedMesh intact so skeletal animation clips can drive the skeleton.
      spacesuitHasSkeleton = detectSkeleton(cachedSpacesuit);
      ensureDoubleSided(cachedSpacesuit);

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

function loadBadAlienModel(): Promise<void> {
  if (badAlienLoadPromise) return badAlienLoadPromise;
  badAlienLoadPromise = new Promise<void>((resolve) => {
    const loader = new GLTFLoader();
    loader.load(BAD_ALIEN_PATH, (gltf) => {
      cachedBadAlien = gltf.scene;
      badAlienAnimClips = gltf.animations || [];
      badAlienHasSkeleton = detectSkeleton(cachedBadAlien);
      ensureDoubleSided(cachedBadAlien);
      let mc = 0;
      cachedBadAlien.traverse((c) => { if (c instanceof THREE.Mesh || c instanceof THREE.SkinnedMesh) mc++; });
      console.log(`Bad_Alien model loaded: ${mc} meshes, ${badAlienAnimClips.length} clips, skeleton=${badAlienHasSkeleton}`);
      resolve();
    }, undefined, (err) => {
      console.warn('Failed to load Bad_Alien model:', err);
      badAlienLoadFailed = true;
      resolve();
    });
  });
  return badAlienLoadPromise;
}

function loadMurderRobotModel(): Promise<void> {
  if (murderRobotLoadPromise) return murderRobotLoadPromise;
  murderRobotLoadPromise = new Promise<void>((resolve) => {
    const loader = new GLTFLoader();
    loader.load(MURDER_ROBOT_PATH, (gltf) => {
      cachedMurderRobot = gltf.scene;
      murderRobotAnimClips = gltf.animations || [];
      murderRobotHasSkeleton = detectSkeleton(cachedMurderRobot);
      ensureDoubleSided(cachedMurderRobot);
      let mc = 0;
      cachedMurderRobot.traverse((c) => { if (c instanceof THREE.Mesh || c instanceof THREE.SkinnedMesh) mc++; });
      console.log(`Murder_Robot model loaded: ${mc} meshes, ${murderRobotAnimClips.length} clips, skeleton=${murderRobotHasSkeleton}`);
      resolve();
    }, undefined, (err) => {
      console.warn('Failed to load Murder_Robot model:', err);
      murderRobotLoadFailed = true;
      resolve();
    });
  });
  return murderRobotLoadPromise;
}

// Start loading all models
loadCitizenModel();
loadSpacesuitModel();
loadBadAlienModel();
loadMurderRobotModel();

// ── Thought bubble (Lua Task:showEmoticon / Character:setEmoticon) ────
/** Duration to show thought bubble text (Lua EMOTICON_INITIAL_DURATION=5). */
const THOUGHT_DURATION = 5;

/** Friendly display names for internal task names (Lua OptionData.UIText). */
const TASK_DISPLAY_NAMES: Record<string, string> = {
  Idle: 'Idle',
  Wander: 'Wandering',
  SleepInBed: 'Sleeping',
  SleepOnFloor: 'Napping',
  Eat: 'Eating',
  GetDrink: 'Drinking',
  BuildTile: 'Building',
  BuildEnvObject: 'Building',
  Mine: 'Mining',
  MaintainEnvObject: 'Repairing',
  MaintainPlants: 'Gardening',
  AttackEnemy: 'Fighting!',
  ExtinguishFire: 'Firefighting',
  GoToSafety: 'Fleeing!',
  FieldScan: 'Scanning',
  Research: 'Researching',
  Chat: 'Chatting',
  Socialize: 'Socializing',
  RefineRock: 'Refining',
  DropOffRock: 'Hauling',
  Explore: 'Exploring',
  HealCharacter: 'Healing',
  DeliverFood: 'Delivering',
  ChatPartner: 'Chatting',
  MaintainPub: 'Bartending',
  EatAtFoodReplicator: 'Eating',
  EatPlant: 'Eating',
  EatAtTable: 'Eating',
  PlayGameSystem: 'Playing',
  WorkOutInGym: 'Working Out',
  WorkOut: 'Working Out',
  DestroyEnvObject: 'Demolishing',
  DropEverything: 'Dropping Items',
  RunTo: 'Running!',
  PanicOnFire: 'On Fire!',
  GoOutside: 'Going Outside',
  GoInside: 'Going Inside',
  VacuumPull: 'Decompression!',
  CheckInToHospital: 'In Hospital',
  PanicFire: 'Panicking!',
  PanicOxygen: 'Suffocating!',
  PanicThreat: 'Panicking!',
  FireFleeArea: 'Fleeing Fire!',
  OxygenFleeArea: 'Fleeing!',
  FleeThreat: 'Fleeing!',
  Patrol: 'Patrolling',
  ServeDrink: 'Serving',
  ServeFoodAtTable: 'Serving',
  Cuff: 'Cuffing',
  Brawl: 'Brawling',
  PickUpFloorItem: 'Picking Up',
  DropOffCorpse: 'Hauling',
  DropOffRocks: 'Hauling',
  Sabotage: 'Sabotaging!',
  RampageTantrum: 'Rampaging!',
  PutOnSuit: 'Suiting Up',
  BedHeal: 'Healing',
  LiftAtWeightBench: 'Lifting',
  ListenToJukebox: 'Listening',
  HarvestAndDeliverFood: 'Harvesting',
  Breathe: 'Idle',
  IncapacitatedOnFloor: 'Injured',
  FieldScanAndHeal: 'Treating',
  ResearchInLab: 'Researching',
};

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
  /** Blob shadow mesh (Lua: rBlobShadow). */
  shadow: THREE.Mesh;
  /** Thought bubble DOM + CSS2DObject. */
  thoughtEl: HTMLDivElement;
  thoughtTextSpan: HTMLSpanElement;
  thoughtTail: HTMLElement;
  thoughtObj: CSS2DObject;
  /** Last shown task name (to detect task change). */
  lastTaskName: string;
  /** Time when current thought was shown. */
  thoughtShowTime: number;
}

export class CharacterRenderer {
  private scene: THREE.Scene;
  private overlayScene: THREE.Scene;
  private handles = new Map<number, CharacterRenderHandle>();
  private pendingUpgrade: Character[] = [];
  private lastFrameTime = 0;
  private frameDt = 1 / 60;
  private grid: TileGrid | null = null;

  constructor(scene: THREE.Scene, overlayScene: THREE.Scene) {
    this.scene = scene;
    this.overlayScene = overlayScene;
  }

  /** Set tile grid for shadow visibility checks. */
  setGrid(grid: TileGrid) {
    this.grid = grid;
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
    } else if (char.tStats.nRace === RACE_MONSTER && !cachedBadAlien && !badAlienLoadFailed) {
      // R-5: Monster model not loaded yet — placeholder until ready
      object = this.createBoxPlaceholder(char);
      this.pendingUpgrade.push(char);
      loadBadAlienModel().then(() => this.upgradePending());
    } else if (char.tStats.nRace === RACE_KILLBOT && !cachedMurderRobot && !murderRobotLoadFailed) {
      // R-5: Killbot model not loaded yet — placeholder until ready
      object = this.createBoxPlaceholder(char);
      this.pendingUpgrade.push(char);
      loadMurderRobotModel().then(() => this.upgradePending());
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

    // Blob shadow (Lua: _setUpBlobShadow)
    const shadow = this.createBlobShadow();
    this.positionShadow(shadow, char);
    this.scene.add(shadow);

    // Need bars
    const needBarsEl = document.createElement('div');
    needBarsEl.className = 'need-bars';
    needBarsEl.style.cssText = 'width:32px;pointer-events:none;';
    const needBarsObj = new CSS2DObject(needBarsEl);
    this.positionNeedBars(needBarsObj, char);
    this.overlayScene.add(needBarsObj);

    // Thought bubble (Lua setEmoticon — bubble tail + text)
    const thoughtEl = document.createElement('div');
    thoughtEl.className = 'thought-bubble';
    thoughtEl.style.cssText =
      'pointer-events:none;font-family:"Dosis",sans-serif;font-size:9px;color:#fff;' +
      'background:rgba(0,0,0,0.7);border-radius:4px;' +
      'padding:4px 8px;white-space:nowrap;text-align:center;display:none;' +
      'width:fit-content;';
    const thoughtTextSpan = document.createElement('span');
    thoughtEl.appendChild(thoughtTextSpan);
    const thoughtTail = document.createElement('div');
    thoughtTail.style.cssText =
      'position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);' +
      'width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;' +
      'border-top:6px solid rgba(0,0,0,0.7);';
    thoughtEl.appendChild(thoughtTail);
    const thoughtObj = new CSS2DObject(thoughtEl);
    thoughtObj.position.set(char.screenX, -(char.screenY - 60), 20002 + char.screenY);
    this.overlayScene.add(thoughtObj);

    const handle: CharacterRenderHandle = {
      object, modelGroup, needBarsEl, needBarsObj, is3D,
      showingSpacesuit: char.bSpacewalking,
      animPhase: Math.random() * Math.PI * 2,
      mixer,
      currentAction: null,
      currentAnimState: '',
      shadow,
      thoughtEl,
      thoughtTextSpan,
      thoughtTail,
      thoughtObj,
      lastTaskName: '',
      thoughtShowTime: 0,
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

      // Apply textures and default colors
      applyModelTextures(clone, char.id);
      ensureDoubleSided(clone);

      // Reset skeleton bind pose after clone so meshes render correctly
      clone.traverse((child) => {
        if (child instanceof THREE.SkinnedMesh && child.skeleton) {
          child.skeleton.pose();
        }
      });

      group.add(clone);

      // Set up animation mixer if clips available
      if (spacesuitHasSkeleton && spacesuitAnimClips.length > 0) {
        mixer = new THREE.AnimationMixer(clone);
      }
    } else if (char.tStats.nRace === RACE_MONSTER && cachedBadAlien && !badAlienLoadFailed) {
      // R-5: Monster race uses Bad_Alien.glb (Lua: RIG_MONSTER, scale 0.65)
      const clone = badAlienHasSkeleton
        ? cloneSkeleton(cachedBadAlien) as THREE.Group
        : cachedBadAlien.clone(true);
      clone.scale.set(BAD_ALIEN_SCALE, BAD_ALIEN_SCALE, BAD_ALIEN_SCALE);
      clone.rotation.x = 30 * (Math.PI / 180);
      clone.rotation.y = 45 * (Math.PI / 180);

      applyModelTextures(clone, char.id);
      ensureDoubleSided(clone);
      clone.traverse((child) => {
        if (child instanceof THREE.SkinnedMesh && child.skeleton) child.skeleton.pose();
      });
      group.add(clone);

      if (badAlienHasSkeleton && badAlienAnimClips.length > 0) {
        mixer = new THREE.AnimationMixer(clone);
      }
    } else if (char.tStats.nRace === RACE_KILLBOT && cachedMurderRobot && !murderRobotLoadFailed) {
      // R-5: Killbot race uses Murder_Robot.glb (Lua: RIG_KILLBOT, scale 0.5)
      const clone = murderRobotHasSkeleton
        ? cloneSkeleton(cachedMurderRobot) as THREE.Group
        : cachedMurderRobot.clone(true);
      clone.scale.set(MURDER_ROBOT_SCALE, MURDER_ROBOT_SCALE, MURDER_ROBOT_SCALE);
      clone.rotation.x = 30 * (Math.PI / 180);
      clone.rotation.y = 45 * (Math.PI / 180);

      applyModelTextures(clone, char.id);
      ensureDoubleSided(clone);
      clone.traverse((child) => {
        if (child instanceof THREE.SkinnedMesh && child.skeleton) child.skeleton.pose();
      });
      group.add(clone);

      if (murderRobotHasSkeleton && murderRobotAnimClips.length > 0) {
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

      // Apply textures and default colors
      applyModelTextures(clone, char.id);
      ensureDoubleSided(clone);

      // R-3: Apply race tint to visually distinguish alien races
      const raceTint = RACE_TINT[char.tStats.nRace];
      if (raceTint !== undefined) {
        const tintColor = new THREE.Color(raceTint);
        clone.traverse((child) => {
          if (child instanceof THREE.Mesh || child instanceof THREE.SkinnedMesh) {
            const mat = child.material;
            if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshBasicMaterial) {
              mat.color.multiply(tintColor);
              mat.userData.baseColor = mat.color.getHex();
            }
          }
        });
      }

      // Reset skeleton bind pose after clone so meshes render correctly
      clone.traverse((child) => {
        if (child instanceof THREE.SkinnedMesh && child.skeleton) {
          child.skeleton.pose();
        }
      });

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
    // R-3: Use nRace to determine gender-like body type, not just char.id % 2
    const isMale = char.id % 2 === 0;
    const race = char.tStats.nRace;

    // Race-specific heads and bodies (Lua Character:_setBody / _setHead per RACE_TYPE.tBodies)
    switch (race) {
      case RACE_CAT:
        visible.add(SUBSETS.heads.cat[0]);
        visible.add(isMale ? SUBSETS.bodies.male[0] : SUBSETS.bodies.female[0]);
        break;
      case RACE_JELLY:
        visible.add(SUBSETS.heads.jelly[0]);
        visible.add(isMale ? SUBSETS.bodies.female[0] : SUBSETS.bodies.female[0]); // Jelly uses female body (Lua: all jelly are female body type)
        break;
      case RACE_BIRDSHARK:
        visible.add(SUBSETS.heads.bird[0]);
        visible.add(isMale ? SUBSETS.bodies.male[0] : SUBSETS.bodies.female[0]);
        break;
      case RACE_SHAMON:
        visible.add(SUBSETS.heads.shamon[0]);
        visible.add(SUBSETS.bodies.shamon[0]);
        break;
      case RACE_CHICKEN:
        // Chicken uses bird head (closest available), male/female body
        visible.add(SUBSETS.heads.bird[0]);
        visible.add(isMale ? SUBSETS.bodies.male[0] : SUBSETS.bodies.female[0]);
        break;
      case RACE_TOBIAN:
        // Tobian is alien rig but our Citizen_Base has no dedicated tobian head;
        // use jelly head as closest approximation with distinct tint
        visible.add(SUBSETS.heads.jelly[0]);
        visible.add(isMale ? SUBSETS.bodies.male[0] : SUBSETS.bodies.female[0]);
        break;
      case RACE_MURDERFACE:
        // Murderface uses alien rig in Lua; use male head + body as base, tinted
        visible.add(isMale ? SUBSETS.heads.male[0] : SUBSETS.heads.female[0]);
        visible.add(isMale ? SUBSETS.bodies.male[0] : SUBSETS.bodies.female[0]);
        break;
      default:
        // RACE_HUMAN and fallback
        if (isMale) {
          visible.add(SUBSETS.heads.male[0]);
          visible.add(SUBSETS.bodies.male[0]);
        } else {
          visible.add(SUBSETS.heads.female[0]);
          visible.add(SUBSETS.bodies.female[0]);
        }
        break;
    }

    // Accessories — non-human races with unusual body shapes skip some accessories
    const hasHumanoidAccessories = race === RACE_HUMAN || race === RACE_CAT ||
      race === RACE_BIRDSHARK || race === RACE_CHICKEN || race === RACE_MURDERFACE;
    if (hasHumanoidAccessories) {
      if (isMale) {
        visible.add(SUBSETS.collar_m[0]);
        visible.add(SUBSETS.belt_m[0]);
        visible.add(SUBSETS.legPouch_m[0]);
      } else {
        visible.add(SUBSETS.collar_f[0]);
        visible.add(SUBSETS.belt_m[0]);
        visible.add(SUBSETS.legPouch_f[0]);
      }
    }

    // Hair — skip for non-humanoid races (Lua: BODY_TYPE.bNoReplacements for monster/killbot/shamon)
    const hasHair = race === RACE_HUMAN || race === RACE_MURDERFACE;
    if (hasHair) {
      const hairIdx = char.id % SUBSETS.hair.length;
      visible.add(SUBSETS.hair[hairIdx]);
    }

    // Job outfit
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
    } else if (hasHumanoidAccessories) {
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

  private createBlobShadow(): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(SHADOW_W, SHADOW_H);
    const mat = new THREE.MeshBasicMaterial({
      map: getBlobShadowTexture(),
      transparent: true,
      depthWrite: false,
    });
    return new THREE.Mesh(geo, mat);
  }

  private positionShadow(shadow: THREE.Mesh, char: Character) {
    shadow.position.set(
      char.screenX,
      -(char.screenY + SHADOW_OFFSET_Y),
      19999 + char.screenY, // Just below character Z
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
      // R-5: If monster model not loaded yet, keep waiting
      if (char.tStats.nRace === RACE_MONSTER && !cachedBadAlien && !badAlienLoadFailed) {
        remaining.push(char);
        continue;
      }
      // R-5: If killbot model not loaded yet, keep waiting
      if (char.tStats.nRace === RACE_KILLBOT && !cachedMurderRobot && !murderRobotLoadFailed) {
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

    // Compute frame dt once per frame
    const now = performance.now() / 1000;
    if (now - this.lastFrameTime > 0.001) {
      this.frameDt = Math.min(0.1, now - this.lastFrameTime);
      this.lastFrameTime = now;
    }

    // Switch model if spacesuit state changed
    if (handle.is3D && handle.showingSpacesuit !== char.bSpacewalking) {
      this.scene.remove(handle.object);
      handle.object.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.SkinnedMesh) child.geometry.dispose();
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
    this.positionShadow(handle.shadow, char);
    this.positionNeedBars(handle.needBarsObj, char);

    // Shadow visibility: show only on solid tiles (Lua: hide in SPACE)
    if (this.grid) {
      const tv = this.grid.get(char.tileX, char.tileY);
      handle.shadow.visible = tv !== TileType.SPACE;
    }

    // Rotate model to face movement direction (Lua: 30° X-tilt, Y = facing angle)
    if (handle.is3D && handle.modelGroup.children.length > 0) {
      const model = handle.modelGroup.children[0];
      // R-5: Per-race model scale (Bad_Alien is 1.3× larger in Lua)
      const baseScale = char.tStats.nRace === RACE_MONSTER ? BAD_ALIEN_SCALE
        : char.tStats.nRace === RACE_KILLBOT ? MURDER_ROBOT_SCALE
        : MODEL_SCALE;

      // Vacuum death animation: shrink + spin (Lua Character:_vacuumDisappear)
      if (char.nVacuumScale >= 0) {
        const s = Math.max(0, char.nVacuumScale) * baseScale;
        model.scale.set(s, s, s);
        model.rotation.x = 30 * (Math.PI / 180);
        model.rotation.y = char.facingAngle + char.nVacuumRotation;
        model.rotation.z = char.nVacuumRotation;
      } else if (!char.isAlive()) {
        // R-6: Procedural death pose — rotate 90° on X to lie flat + flatten Y.
        // Combined with the isometric 30° tilt, this makes the character appear
        // to be lying on the ground, clearly dead.
        model.scale.set(baseScale, baseScale * 0.3, baseScale);
        model.rotation.x = 30 * (Math.PI / 180) + Math.PI / 2; // 30° iso + 90° lie flat
        model.rotation.y = char.facingAngle;
        model.rotation.z = 0;
      } else {
        // Normal: Lua setRot(30, dirAngle, 0) — 30° isometric tilt on X-axis
        model.scale.set(baseScale, baseScale, baseScale);
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

    // Thought bubble (Lua Task:showEmoticon — show for EMOTICON_INITIAL_DURATION on task change)
    this.updateThoughtBubble(handle, char);

    // Speech bubble (dialogue system)
    this.updateSpeechBubble(handle, char);

    // Need bars
    this.drawNeedBars(handle.needBarsEl, char);
  }

  /** Get the animation state key for a character. */
  private getAnimState(char: Character): string {
    if (!char.isAlive()) return 'dead';
    if (char.moving) return 'walking';
    const taskName = char.currentTask?.name;
    if (taskName === 'SleepInBed' || taskName === 'SleepOnFloor') return 'sleeping';
    if (taskName === 'BuildEnvObject' || taskName === 'BuildTile') return 'building';
    if (taskName === 'Eat' || taskName === 'GetDrink') return 'eating';
    if (taskName === 'AttackEnemy' && char.weapon) return 'fighting_ranged';
    if (taskName === 'AttackEnemy') return 'fighting_melee';
    if (taskName === 'Mine') return 'mining';
    if (taskName === 'Chat' || taskName === 'Socialize') return 'chatting';
    if (taskName === 'ExtinguishFire') return 'firefighting';
    if (taskName === 'HealCharacter') return 'healing';
    if (taskName === 'Research') return 'researching';
    if (taskName === 'GoToSafety') return 'panicking';
    return 'idle';
  }

  /** Find the best matching animation clip for a state. */
  private findClip(state: string, spacesuit: boolean, race?: number): THREE.AnimationClip | null {
    const candidates = STATE_CLIP_MAP[state] || [];
    // R-5: Select clip pool based on model type
    let clips: THREE.AnimationClip[];
    if (race === RACE_MONSTER) clips = badAlienAnimClips;
    else if (race === RACE_KILLBOT) clips = murderRobotAnimClips;
    else if (spacesuit) clips = spacesuitAnimClips;
    else clips = citizenAnimClips;

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

      const clip = this.findClip(state, handle.showingSpacesuit, char.tStats.nRace);
      if (clip && handle.mixer) {
        if (handle.currentAction) {
          handle.currentAction.fadeOut(0.2);
        }
        const action = handle.mixer.clipAction(clip);
        action.reset().fadeIn(0.2).play();
        handle.currentAction = action;
      }
    }

    handle.mixer!.update(this.frameDt);
  }

  /** Check if character is doing a working task (building, mining, maintaining). */
  private isWorking(char: Character): boolean {
    const name = char.currentTask?.name;
    return name === 'BuildTile' || name === 'BuildEnvObject' || name === 'Mine' ||
           name === 'MaintainEnvObject' || name === 'MaintainPlants';
  }

  /** Apply procedural walk bob / idle breathing / working animation. */
  private applyProceduralAnim(handle: CharacterRenderHandle, char: Character) {
    // Dead characters: no procedural animation (death pose handled in updateCharacter rotation)
    if (!char.isAlive()) return;

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

  /** Update thought bubble — shows task name for 5 seconds on task change (Lua Task:showEmoticon). */
  private updateThoughtBubble(handle: CharacterRenderHandle, char: Character) {
    const taskName = char.currentTask?.name ?? '';
    const now = performance.now() / 1000;

    // Position thought bubble above character
    handle.thoughtObj.position.set(
      char.screenX,
      -(char.screenY - 60),
      20002 + char.screenY,
    );

    // Detect task change — show bubble
    if (taskName && taskName !== handle.lastTaskName) {
      handle.lastTaskName = taskName;
      handle.thoughtShowTime = now;
      // Map internal task names to friendly display text
      const label = TASK_DISPLAY_NAMES[taskName] ?? taskName;
      handle.thoughtTextSpan.textContent = label;
      handle.thoughtEl.style.cssText =
        'pointer-events:none;font-family:"Dosis",sans-serif;font-size:9px;color:#fff;' +
        'background:rgba(0,0,0,0.7);border-radius:4px;' +
        'padding:4px 8px;white-space:nowrap;text-align:center;display:block;' +
        'width:fit-content;';
      handle.thoughtTail.style.borderTopColor = 'rgba(0,0,0,0.7)';
    }

    // Dismiss after THOUGHT_DURATION
    if (handle.thoughtEl.style.display !== 'none' && now - handle.thoughtShowTime > THOUGHT_DURATION) {
      handle.thoughtEl.style.display = 'none';
    }

    // Hide for dead characters
    if (!char.isAlive()) {
      handle.thoughtEl.style.display = 'none';
    }
  }

  private updateSpeechBubble(handle: CharacterRenderHandle, char: Character) {
    const bubbleText = dialogueSystem.getBubbleText(char.id);
    
    if (bubbleText && handle.thoughtEl.style.display === 'none') {
      handle.thoughtTextSpan.textContent = bubbleText;
      handle.thoughtEl.style.cssText =
        'pointer-events:none;font-family:"Orbitron",monospace;font-size:11px;color:#000;' +
        'background:rgba(255,255,255,0.85);border-radius:4px;' +
        'padding:4px 8px;white-space:nowrap;text-align:center;display:block;' +
        'width:fit-content;';
      handle.thoughtTail.style.borderTopColor = 'rgba(255,255,255,0.85)';
    } else if (!bubbleText && handle.thoughtTextSpan.textContent && !handle.lastTaskName) {
      handle.thoughtEl.style.display = 'none';
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
      if (child instanceof THREE.Mesh || child instanceof THREE.SkinnedMesh) child.geometry.dispose();
    });
    // Remove blob shadow
    this.scene.remove(handle.shadow);
    handle.shadow.geometry.dispose();
    (handle.shadow.material as THREE.Material).dispose();

    this.overlayScene.remove(handle.needBarsObj);
    handle.needBarsEl.remove();
    // Remove thought bubble
    this.overlayScene.remove(handle.thoughtObj);
    handle.thoughtEl.remove();
    this.handles.delete(charId);
  }

  /** Get citizen animation clip count (for testing). */
  getCitizenClipCount(): number { return citizenAnimClips.length; }
  /** Get spacesuit animation clip count (for testing). */
  getSpacesuitClipCount(): number { return spacesuitAnimClips.length; }
  /** Check if citizen model has skeleton (for testing). */
  hasCitizenSkeleton(): boolean { return citizenHasSkeleton; }

  /** Debug: get material info for first character's meshes. */
  debugMaterials(): { name: string; type: string; hasMap: boolean; color: string; visible: boolean }[] {
    const first = this.handles.values().next().value as CharacterRenderHandle | undefined;
    if (!first) return [];
    const mats: { name: string; type: string; hasMap: boolean; color: string; visible: boolean }[] = [];
    first.object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const m = child.material as THREE.MeshStandardMaterial;
        mats.push({
          name: m.name || child.name,
          type: m.type,
          hasMap: !!m.map,
          color: '#' + (m.color?.getHexString?.() ?? '000000'),
          visible: child.visible,
        });
      }
    });
    return mats;
  }

  /** Apply room lighting tint to a character (Lua room ambient → character shader). */
  setCharacterTint(charId: number, tint: number) {
    const handle = this.handles.get(charId);
    if (!handle) return;
    const tintColor = new THREE.Color(tint);
    handle.object.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.SkinnedMesh) {
        const mat = child.material;
        if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshBasicMaterial) {
          // Multiply base color by tint (preserves default material colors)
          const baseHex = mat.userData.baseColor as number | undefined;
          if (baseHex !== undefined) {
            mat.color.setHex(baseHex).multiply(tintColor);
          } else {
            mat.color.copy(tintColor);
          }
        }
      }
    });
  }
}
