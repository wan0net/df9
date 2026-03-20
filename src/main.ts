/**
 * Spacebase DF-9 — Three.js entry point.
 * Game loop via requestAnimationFrame. Routes through scene states.
 */

import * as THREE from 'three';
import { ThreeRenderer } from './renderer/ThreeRenderer';
import { CameraController3D } from './renderer/CameraController3D';
import { TileRenderer3D } from './renderer/TileRenderer3D';
import { CharacterRenderer } from './renderer/CharacterRenderer';
import { EnvObjectRenderer } from './renderer/EnvObjectRenderer';
import { PropRenderer } from './renderer/PropRenderer';
import { SelectionHighlight } from './renderer/SelectionHighlight';
import { FireParticles } from './renderer/FireParticles';
import { ProjectileRenderer } from './renderer/ProjectileRenderer';
import { EffectParticles } from './renderer/EffectParticles';
import { DecalRenderer } from './renderer/DecalRenderer';
import { SceneManager } from './renderer/SceneManager';
import { loadAllAssets, getTexture } from './renderer/AssetLoader';
import { InputManager } from './input/InputManager';
import { StartMenuState } from './ui/StartMenu';
import { NewGameScreenState } from './ui/NewGameScreen';
import { UIManager } from './ui/UIManager';
import type { SelectedEntity } from './ui/InspectorPanel';

import { TileGrid } from './world/TileGrid';
import { WallAutoGen } from './world/WallAutoGen';
import { BuildSystem, type BuildMode } from './building/BuildSystem';
import { BuildCursor } from './building/BuildCursor';
import { RoomManager } from './rooms/RoomManager';
import type { Room } from './rooms/Room';
import { OxygenSystem } from './oxygen/OxygenSystem';
import { VacuumSystem } from './oxygen/VacuumSystem';
import { CharacterManager } from './characters/CharacterManager';
import { GameRules, type TickableSystem, MAT_BUILD_FLOOR, MAT_VAPE_FLOOR } from './core/GameRules';
import { EnvObjectManager } from './envobjects/EnvObjectManager';
import { Door, tDoorsByAddr } from './envobjects/Door';
import { EnvObject, DANGER_ZONE, DANGER_SPARK_FREQUENCY } from './envobjects/EnvObject';
import { tObjects, resolveAlias, getObjectData, getObjectsByFunctionality as getObjsByFunc } from './envobjects/EnvObjectData';
import { ObjectPlacement } from './building/ObjectPlacement';
import { Base } from './core/Base';
import { PowerSystem } from './power/PowerSystem';
import { Lighting } from './lighting/Lighting';
import { line as locLine, getLanguage, getAvailableLanguages } from './localization/Localization';
import { DialogSystem } from './ui/DialogSystem';
import { EventController } from './events/EventController';
import { Fire } from './hazards/Fire';
import { ProjectileManager } from './hazards/Projectile';
import { SaveLoadSystem } from './save/SaveLoad';
import { researchSystem } from './research/ResearchSystem';
import { GoalSystem } from './goals/GoalSystem';
import { addLog, setElapsedTimeProvider, type LogEntry } from './characters/Log';
import {
  initializeTopicList, setCharacterProvider, generateCharacterAffinities,
  addTopic, getRandomImmigrationCategory, getAllTopics, getTopicsByCategory,
  getTopicName, getSaveData as getTopicsSaveData, fromSaveData as topicsFromSaveData,
  IMMIGRATION_ADD_TOPIC_CHANCE,
} from './characters/Topics';
import { HintSystem } from './hints/HintSystem';
import { AutoSave } from './save/AutoSave';
import { SoundManager } from './audio/SoundManager';
import { MusicSystem } from './audio/MusicSystem';
import { SpatialAudio } from './audio/SpatialAudio';
import { generateWorld } from './world/WorldGen';
import { ZoneType, ZONE_SPRITES } from './world/ZoneType';
import { GRID_W, GRID_H, TILE_W, TILE_HALF_W, TILE_HALF_H } from './config';
import { tileToScreen, getDiamondFootprint } from './world/IsometricUtils';
import { TileType } from './world/TileTypes';
import { CHANCE_OF_MALADY } from './events/EventData';
import { Pickup } from './pickups/Pickup';
import { Corpse } from './pickups/Corpse';
import { isAsteroid } from './world/Asteroid';
import { CommandQueue } from './core/CommandQueue';
import {
  createItem, createRandomStartingStuff, getWeaponData, getArmorData,
  getAffinityDecay, getIncinerateBias, allowIncinerate, canStack,
  getMaxStacks, isStuff, heldOnly, disappearOnDrop, getPickupName,
  portFromSave, type InventoryItem,
} from './inventory/Inventory';
import { ITEM_TEMPLATES, TAGS, STUFF_NAMES } from './inventory/InventoryData';
import { Malady } from './malady/Malady';
import { DebugMenu } from './ui/DebugMenu';
import { TutorialSystem } from './ui/TutorialSystem';
import { SaveSlotPanel } from './ui/SaveSlotPanel';
import { EmergencyBeacon } from './combat/EmergencyBeacon';
import { SquadList } from './combat/SquadList';
import { MALADY_DEFS, getSpawnableDiseases, getMaladyByTier } from './malady/MaladyData';
import { CAUSE_OF_DEATH, FACTION_BEHAVIOR } from './characters/CharacterConstants';
import { BASE_EVENT, EVENT_DATA } from './core/Base';
import { DerelictSystem } from './events/DerelictSystem';
import { DockingSystem } from './docking/DockingSystem';
import { dialogueSystem } from './characters/DialogueSystem';
import { ExplosionSystem } from './renderer/ExplosionSystem';
import { BrigZone } from './zones/BrigZone';

// ── Tick adapters (same as GameScene) ─────────────────────────

class OxygenTickAdapter implements TickableSystem {
  constructor(private system: OxygenSystem, private vacuum: VacuumSystem) {}
  onTick(dt: number) {
    const ms = dt * 1000;
    this.system.update(ms);
    this.vacuum.update(ms);
  }
}

class CharacterTickAdapter implements TickableSystem {
  constructor(private manager: CharacterManager) {}
  onTick(dt: number) { this.manager.update(dt * 1000); }
}

// ── Load game fonts (Lua Gui.lua font list) ──────────────────
// Local copies in public/assets/fonts/ for offline use.
// Orbitron Light — start menu titles, HUD labels
// Dosis (Regular/Medium/SemiBold) — sidebar labels, values, hotkeys, stardate
// League Gothic — inspector names, status bar titles
// Nevis — inspector labels, log text, body text
if (!document.getElementById('game-fonts')) {
  const link = document.createElement('link');
  link.id = 'game-fonts';
  link.rel = 'stylesheet';
  link.href = 'assets/fonts/fonts.css';
  document.head.appendChild(link);
}

// ── Critical cues to preload at startup ──────────────────────
const PRELOAD_CUES = [
  // UI sounds
  'UI_Select', 'UI_Confirm', 'UI_Disallow', 'UI_Expand', 'UI_Hilight',
  'UI_GridShow', 'UI_BuildScroll', 'UI_MatterScroll', 'UI_InspectorShow',
  'UI_InspectorFolder', 'UI_ShortStatic', 'UI_MapScreen',
  // Menu sounds
  'Intro_AcceptButton', 'Intro_CancelButton', 'Intro_LaunchButton',
  'Intro_LaunchOpen', 'Intro_LaunchClose', 'Intro_UIAppear', 'Intro_UIDisappear',
  // Menu music
  'Intro_GuitarTrack',
  // Alarms
  'Alarm_Alert', 'Alarm_Breach', 'Alarm_Fire', 'Alarm_LowOxygen',
  // Door sounds
  'DoorOpen', 'DoorClose',
];

// ── Main ──────────────────────────────────────────────────────

const container = document.body;

// Loading screen
const loadingEl = document.createElement('div');
loadingEl.style.cssText = `
  position:fixed;top:0;left:0;width:100%;height:100%;
  background:#000;color:#dfa200;font-family:'Orbitron',monospace;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  z-index:9999;font-size:24px;
`;
loadingEl.textContent = 'Loading...';
container.appendChild(loadingEl);

// Load assets, then start game
loadAllAssets((loaded, total) => {
  loadingEl.textContent = `Loading... ${loaded}/${total}`;
}).then(() => {
  loadingEl.remove();
  startGame();
});

// Module-level autosave reference for settings panel toggle
let activeAutoSave: AutoSave | null = null;

function startGame() {
  const sceneManager = new SceneManager(container);

  // Define scene transitions
  const startMenu = new StartMenuState({
    onNewGame: () => sceneManager.switchTo(newGameScreen),
    onTutorial: () => enterGameState(sceneManager, { tutorial: true }),
    onLoadBase: (slotName) => enterGameState(sceneManager, { loadSave: true, saveSlot: slotName }),
    settingsCallbacks: {
      getAutosaveEnabled: () => activeAutoSave?.isEnabled() ?? true,
      setAutosaveEnabled: (v) => activeAutoSave?.setEnabled(v),
      getUIScale: () => UIManager.getUIScale(),
      setUIScale: (v) => {
        UIManager.setUIScale(v);
        // Apply to active UIManager if game is running
        if ((window as any).__df9?._uiManager) {
          (window as any).__df9._uiManager.applyUIScale();
        }
      },
    },
  });

  const newGameScreen = new NewGameScreenState({
    onStartGame: (landingZone) => enterGameState(sceneManager, { landingZone }),
    onBack: () => sceneManager.switchTo(startMenu),
  });

  // Start at menu
  sceneManager.switchTo(startMenu);

  // Scene manager drives the update loop for menu states
  let lastTime = performance.now();
  let menuLoopId = 0;
  function menuLoop() {
    const now = performance.now();
    const dt = (now - lastTime) / 1000;
    lastTime = now;
    sceneManager.update(dt);
    menuLoopId = requestAnimationFrame(menuLoop);
  }
  menuLoopId = requestAnimationFrame(menuLoop);

  // Expose stop function so enterGameState can cancel the menu loop
  (sceneManager as SceneManager & { stopMenuLoop?: () => void }).stopMenuLoop = () => {
    cancelAnimationFrame(menuLoopId);
  };
}

/**
 * Enter the main game state with Three.js rendering.
 */
function enterGameState(sceneManager: SceneManager, initData: Record<string, unknown>) {
  // Stop the menu animation loop
  const sm = sceneManager as SceneManager & { stopMenuLoop?: () => void };
  sm.stopMenuLoop?.();

  // Clean up menu overlay
  sceneManager.switchTo({
    enter() {},
    update() {},
    exit() {},
  });

  // ── Initialize audio (may already be initialized from StartMenu) ──
  if (!SoundManager.isInitialized()) {
    SoundManager.init();
    SoundManager.generateFallbackSounds();
  }
  SoundManager.resume();
  SoundManager.stopMusic(); // Stop menu music
  // Preload critical audio cues (non-blocking)
  SoundManager.preloadCues(PRELOAD_CUES);
  const musicSystem = new MusicSystem();
  musicSystem.startGame();

  // ── Initialize Three.js renderer ──────────────────────────
  const threeRenderer = new ThreeRenderer(container);
  const cameraController = new CameraController3D(threeRenderer);

  // ── Initialize game systems (unchanged logic) ─────────────
  GameRules.init();
  setElapsedTimeProvider(() => GameRules.elapsedTime);
  const grid = new TileGrid();
  const tileRenderer = new TileRenderer3D(threeRenderer.scene, grid);
  const wallAutoGen = new WallAutoGen(grid);
  const buildSystem = new BuildSystem(grid, wallAutoGen);
  const buildCursor = new BuildCursor(threeRenderer.scene, grid);
  const roomManager = new RoomManager(grid);
  tileRenderer.setRoomManager(roomManager);
  buildSystem.setRoomManager(roomManager);
  const oxygenSystem = new OxygenSystem(roomManager, grid);
  const vacuumSystem = new VacuumSystem(grid);
  const characterManager = new CharacterManager(grid, roomManager);
  characterManager.setWallAutoGen(wallAutoGen);
  characterManager.setVacuumSystem(vacuumSystem);
  const objectPlacement = new ObjectPlacement(grid, roomManager);

  // Character renderer
  const characterRenderer = new CharacterRenderer(threeRenderer.scene, threeRenderer.overlayScene);
  characterRenderer.setGrid(grid);
  characterManager.setRenderer(characterRenderer);

  // Env object renderer
  const envObjRenderer = new EnvObjectRenderer(threeRenderer.scene);

  // Prop renderer for 3D pickup/held-item models
  const propRenderer = new PropRenderer(threeRenderer.scene);
  const selectionHighlight = new SelectionHighlight(threeRenderer.scene);

  // Fire particle system (replaces plain orange tint)
  const fireParticles = new FireParticles(threeRenderer.scene);

  // Projectile renderer (visible beams between attacker → target)
  const projectileRenderer = new ProjectileRenderer(threeRenderer.scene);

  // Floor decals (blood splats, damage marks)
  const decalRenderer = new DecalRenderer(threeRenderer.scene);

  // Emergency beacon system
  EmergencyBeacon.init(roomManager);

  interface BeaconVisual {
    mesh: THREE.Mesh;
    frameIndex: number;
    elapsed: number;
    frames: string[];
  }
  const beaconVisuals = new Map<string, BeaconVisual>();
  const BEACON_FRAME_DURATION = 0.1;
  const BEACON_DEPTH = 20000;

  function createBeaconMesh(tx: number, ty: number, frames: string[]): THREE.Mesh | null {
    const firstTex = getTexture(frames[0]);
    if (!firstTex || !firstTex.image) return null;
    const w = firstTex.image.width || 64;
    const h = firstTex.image.height || 64;
    const geo = new THREE.PlaneGeometry(w, h);
    const mat = new THREE.MeshBasicMaterial({
      map: firstTex,
      transparent: true,
      alphaTest: 0.01,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    const pos = tileToScreen(tx, ty);
    mesh.position.set(pos.x + TILE_HALF_W, -(pos.y + TILE_HALF_H - h * 0.5), BEACON_DEPTH + pos.y);
    return mesh;
  }

  function syncBeaconVisuals() {
    const allBeacons = EmergencyBeacon.getAllBeacons();
    const activeSquads = new Set(allBeacons.keys());

    for (const [squadName, visual] of beaconVisuals) {
      if (!activeSquads.has(squadName)) {
        threeRenderer.scene.remove(visual.mesh);
        beaconVisuals.delete(squadName);
      }
    }

    for (const [squadName, beacon] of allBeacons) {
      if (!beaconVisuals.has(squadName)) {
        const frames: string[] = [];
        for (let i = 1; i <= 6; i++) frames.push(`beacon_investigate${i}`);
        const mesh = createBeaconMesh(beacon.tx, beacon.ty, frames);
        if (mesh) {
          threeRenderer.scene.add(mesh);
          beaconVisuals.set(squadName, { mesh, frameIndex: 0, elapsed: 0, frames });
        }
      }
    }
  }

  function updateBeaconAnimations(dtSec: number) {
    for (const [, visual] of beaconVisuals) {
      visual.elapsed += dtSec;
      if (visual.elapsed >= BEACON_FRAME_DURATION) {
        visual.elapsed -= BEACON_FRAME_DURATION;
        visual.frameIndex = (visual.frameIndex + 1) % visual.frames.length;
        const tex = getTexture(visual.frames[visual.frameIndex]);
        if (tex) {
          (visual.mesh.material as THREE.MeshBasicMaterial).map = tex;
          (visual.mesh.material as THREE.MeshBasicMaterial).needsUpdate = true;
        }
      }
    }
  }

  // Effect particles (meteor trails, construction sparks)
  const effectParticles = new EffectParticles(threeRenderer.scene);
  propRenderer.preload([
    'BodyBag', 'FoodBar', 'FoodCrate', 'AsteroidChunk',
    'Pistol', 'Rifle', 'SpaceGun', 'Builder', 'Weldammer',
    'FireExtinguisher', 'Datapad', 'FoodTray', 'Mug01',
  ]);

  const derelictSystem = new DerelictSystem(characterManager);
  const dockingSystem = new DockingSystem(characterManager);
  const explosionSystem = new ExplosionSystem(threeRenderer.scene);

  Malady.reset();
  BrigZone.reset();
  // Wire air scrubber count for disease spread reduction
  Malady.getAirScrubberCount = (tx, ty, range) => {
    let count = 0;
    for (const obj of EnvObjectManager.getObjects()) {
      if (obj.tData.customClass !== 'AirScrubber') continue;
      if (!obj.bBuilt || !obj.isFunctioning()) continue;
      const dist = Math.max(Math.abs(obj.tileX - tx), Math.abs(obj.tileY - ty));
      if (dist <= range) count++;
    }
    return count;
  };
  EnvObjectManager.init(roomManager);

  // Wire door sprite lookup for TileRenderer3D
  tileRenderer.getDoorSpriteAt = (x, y) => {
    const door = EnvObjectManager.getDoorAt(x, y);
    if (!door) return 'tile_door_closed';
    // Secondary tile of a 2-wide door (e.g. Airlock): suppress sprite here;
    // the primary tile's sprite visually covers both tiles.
    if (door.secondTileX === x && door.secondTileY === y) return null;
    return door.getSpriteKey();
  };

  // Wire EnvObjectManager lifecycle → EnvObjectRenderer
  EnvObjectManager.onObjectCreated = (id, obj) => {
    envObjRenderer.addObject(String(id), obj.tileX, obj.tileY, obj.sName, obj.bBuilt, obj.bFlipX, obj.bFlipY, obj.tData.againstWall);
    // Re-render the tile so door sprite is correct immediately
    tileRenderer.rerenderTile(obj.tileX, obj.tileY);
  };
  EnvObjectManager.onObjectRemoved = (id) => {
    envObjRenderer.removeObject(String(id));
  };
  // Wire EnvObject spontaneous fire callback → Fire system
  EnvObject.onFireStart = (tileX, tileY) => {
    fire.startFire(tileX, tileY);
  };
  // Wire EnvObject visual updates (condition change, ghost→built, door open/close) → renderer
  EnvObject.onVisualUpdate = (id, obj) => {
    // When a door transitions from ghost to built, remove its ghost sprite
    // (TileRenderer3D renders built doors via the DOOR tile type instead).
    if (obj.tData.door && obj.bBuilt) {
      envObjRenderer.removeObject(String(id));
    } else {
      envObjRenderer.updateObject(String(id), obj.bBuilt, obj.nCondition, obj.getSpriteKey());
    }
    // Re-render door tiles when door state changes (open/close/lock)
    if (obj.sName === 'Door' || obj.sName === 'HeavyDoor' || obj.sName === 'Airlock') {
      tileRenderer.rerenderTile(obj.tileX, obj.tileY);
    }
  };
  Base.init();

  // Wire Base hostile-in-base callback (needs room + character data)
  Base.setCharactersInRoomsCallback(() => {
    const rooms = roomManager.getRooms();
    return rooms.map(room => ({
      roomId: room.id,
      characters: characterManager.getAllCharacters()
        .filter(c => room.tiles.some(t => t.x === c.tileX && t.y === c.tileY))
        .map(c => ({
          id: c.id,
          tileX: c.tileX,
          tileY: c.tileY,
          nTeam: c.tStats.nTeam,
          isAlive: c.isAlive(),
          bIncapacitated: Malady.isIncapacitated(c),
          bCuffed: c.bCuffed,
          tAssignedToBrig: c.tAssignedToBrig,
          tImprisonedIn: c.tImprisonedIn,
        })),
    }));
  });

  const powerSystem = new PowerSystem(grid, roomManager);
  const lighting = new Lighting(roomManager); // fire ref set below after Fire is constructed
  lighting.init();
  const eventController = new EventController();
  eventController.init(derelictSystem);
  eventController.dialogSystem = new DialogSystem(container);

  // Wire event room gates
  eventController.getHiddenRoomCount = () => {
    return roomManager.getRooms().filter(r => r.nLastVisibility === 0).length;
  };
  eventController.getExteriorRoomCount = () => {
    return roomManager.getRooms().filter(r => !r.sealed).length;
  };

  // Wire event callbacks
  eventController.onImmigration = (count) => {
    for (let i = 0; i < count; i++) {
      const char = characterManager.spawnCharacter();
      // Lua ImmigrationEvent.lua:71-77: 15% chance of malady on each immigrant
      if (char && Math.floor(Math.random() * 100) < CHANCE_OF_MALADY) {
        Malady.infectWithRandom(char);
      }
    }
  };
  // Meteor shower: per-impact callback with tile coords and size (Lua MeteorEvent.lua:183-210)
  eventController.onMeteorLand = (tx, ty, nSize, nDamage) => {
    // Meteor trail particles (Lua AnimatedSprite "asteroid01_")
    effectParticles.spawnMeteorTrail(tx, ty);

    // Spatial audio at impact site
    const screenPos = tileToScreen(tx, ty);
    SoundManager.playSfx3D('MeteorImpact', screenPos.x, screenPos.y);

    // Camera shake for large meteors (Lua: nSize > 0.9 -> shake(15, 0.2))
    if (nSize > 0.9) {
      cameraController.shake(15, 0.2);
    }

    // Explosion effect for medium+ meteors (Lua: nSize > 0.5 -> playExplosion)
    if (nSize > 0.5) {
      explosionSystem.spawnExplosion(tx, ty, nSize);
    }

    // Apply tile damage (Lua: World.damageTile)
    grid.damageTile(tx, ty, nDamage);

    // 25% fire chance if nSize > 0.5 and tile didn't become SPACE (Lua lines 208-209)
    if (nSize > 0.5 && Math.random() < 0.25) {
      const tileAfter = grid.get(tx, ty);
      if (tileAfter !== TileType.SPACE) {
        fire.startFire(tx, ty);
      }
    }

    // Force room re-detection if tile was damaged/destroyed
    roomManager.markDirty([{ x: tx, y: ty }]);
  };

  // Wire getTileType so MeteorEvent can detect SPACE tiles for pass-through
  eventController.getTileType = (tx, ty) => grid.get(tx, ty);
  eventController.onHostileSpawn = (count, hp) => {
    characterManager.spawnHostiles(count, hp);
  };
  eventController.onBreachWall = () => {
    // Pick a random wall tile adjacent to a room and destroy it
    const rooms = roomManager.getRooms();
    if (rooms.length === 0) return;
    const room = rooms[Math.floor(Math.random() * rooms.length)];
    if (room.tiles.length === 0) return;
    // Find a wall adjacent to this room
    for (const t of room.tiles) {
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const nx = t.x + dx, ny = t.y + dy;
        if (grid.get(nx, ny) === TileType.WALL) {
          grid.set(nx, ny, TileType.WALL_DESTROYED);
          fire.startFire(nx, ny);
          roomManager.markDirty([{ x: nx, y: ny }]);
          return;
        }
      }
    }
  };
  eventController.onDocking = (count) => {
    // Friendly docking — spawn immigrants
    for (let i = 0; i < count; i++) {
      characterManager.spawnCharacter();
    }
  };
  eventController.onDerelictExplore = ({ ship, event, choiceId }) => {
    if (event.type === 'hostileEncounter' && choiceId === 'fight') {
      const count = Math.max(1, Math.min(4, Math.ceil(ship.dangerLevel / 2)));
      characterManager.spawnHostiles(count, eventController.getScaledRaiderHP());
    }
  };

  const fire = new Fire();
  fire.init();
  lighting.setFire(fire);
  characterManager.setFire(fire);
  characterManager.setDecalRenderer(decalRenderer);
  fire.tileCheck = (x, y) => grid.get(x, y);
  // Lua OXYGEN_TILE_MAX=1000; our room.oxygen is 0-255. Scale to match Lua thresholds.
  fire.oxygenCheck = (x, y) => {
    const room = roomManager.getRoomAt(x, y);
    return room ? (room.oxygen / 255) * 1000 : 0;
  };
  fire.tileHealthCheck = (x, y) => grid.getTileHP(x, y);
  fire.citizenIgnite = (x, y) => {
    for (const char of characterManager.getAllCharacters()) {
      if (!char.isAlive() || char.bOnFire) continue;
      if (char.tileX === x && char.tileY === y) {
        char.catchFire();
      }
    }
  };
  // Wire fire sounds
  fire.onFireStart = (x, y) => {
    SpatialAudio.fireStart(x, y);
  };
  fire.onFireEnd = (x, y) => {
    SpatialAudio.fireEnd(x, y);
  };
  const projectileManager = new ProjectileManager();
  projectileManager.init();
  characterManager.setProjectileManager(projectileManager);
  const saveLoadSystem = new SaveLoadSystem(grid, roomManager);

  // Auto-save system + pre-event save callback (Lua: auto-save 45s before event)
  const autoSave = new AutoSave(saveLoadSystem);
  activeAutoSave = autoSave;
  eventController.onPreEventSave = () => autoSave.saveIfNeeded(45);

  // Goal system
  const goalSystem: GoalSystem = new GoalSystem({
    getPopulation: () => characterManager.getPopulation(),
    getMatter: () => GameRules.nMatter,
    getOwnedTileCount: () => {
      // Count all floor/wall tiles owned by the player (tiles in rooms)
      let count = 0;
      for (const room of roomManager.getRooms()) {
        count += room.tiles.length;
      }
      return count;
    },
    getBuiltObjectTypeCount: () => {
      const builtTypes = new Set<string>();
      for (const obj of EnvObjectManager.getObjects()) {
        if (obj.bBuilt) builtTypes.add(obj.sName);
      }
      // Count types that show in object menu (matching Lua showInObjectMenu check)
      let total = 0;
      for (const def of Object.values(tObjects)) {
        if (def.showInObjectMenu !== false) total++;
      }
      return { built: builtTypes.size, total };
    },
    getResearchedTechCount: () => {
      const completed = researchSystem.getCompletedList();
      const allResearch = researchSystem.getAllResearch();
      let total = 0;
      for (const r of Object.values(allResearch)) {
        if (!r.bDiscoverOnly) total++;
      }
      return { researched: completed.length, total };
    },
    getHappyCitizenCount: (moraleThreshold: number) => {
      return characterManager.getCharacters().filter(c => c.nMorale > moraleThreshold).length;
    },
    checkFinalSiege: () => {
      // Lua: mega-event started + 120s elapsed + friendly alive in safe room + all hostiles dead
      const megaStart = eventController.nMegaEventStartTime;
      if (megaStart <= 0) return false;
      if (GameRules.elapsedTime < megaStart + 120) return false;
      if (characterManager.getHostileCount() > 0) return false;
      // At least one player character alive in a safe room
      const safeRooms = roomManager.getSafeRoomsOfTeam(1);
      return characterManager.getCharacters().some(c =>
        c.isAlive() && c.tStats.nTeam === 1 && safeRooms.some(r =>
          r.tiles.some(t => t.x === c.tileX && t.y === c.tileY),
        ),
      );
    },
    getAllPossessionsCount: () => {
      // Lua GoalData.allPossessions: count unique bStuff+bDisplayable items
      const targetItems = new Set<string>();
      for (const [key, tmpl] of Object.entries(ITEM_TEMPLATES)) {
        if (tmpl.bStuff && tmpl.bDisplayable) targetItems.add(key);
      }
      const total = targetItems.size;
      const found = new Set<string>();
      // Scan character inventories for collected stuff
      for (const c of characterManager.getCharacters()) {
        for (const item of c.inventory.getAll()) {
          if (targetItems.has(item.sTemplate)) found.add(item.sTemplate);
        }
      }
      return { collected: found.size, total };
    },
  });

  // Hint system
  const hintSystem = new HintSystem({
    hasEnclosedRooms: () => roomManager.getRooms().length > 0,
    hasZonedRoom: () => roomManager.getRooms().some(r => r.zone !== 'PLAIN'),
    hasStartedResearch: () => researchSystem.getActiveResearch() !== null || researchSystem.getCompletedList().length > 0,
    hasBuiltObject: () => EnvObjectManager.getObjects().some(o => o.bBuilt),
    getPopulation: () => characterManager.getPopulation(),
    hasHostiles: () => characterManager.getHostileCount() > 0,
  });

  // Tutorial system (Lua GameRules.lua 20-stage tutorial)
  const tutorialSystem = new TutorialSystem();
  const isTutorialMode = initData.tutorial === true;
  // Track tutorial-relevant user actions
  const tutorialFlags = {
    zoomed: false, panned: false, selected: false, deselected: false,
    timeSpeed: false, builtO2: false, buildConfirm: false, assignedBuilders: false,
    vizModes: false, builtFood: false, flipped: false, builtAirlock: false,
    spedUp: false, repairedBreach: false, zonedResidence: false,
    mineConfirm: false, assignedTechs: false, exploredDerelict: false,
  };
  if (isTutorialMode) {
    tutorialSystem.start(container, {
      hasZoomed: () => tutorialFlags.zoomed,
      hasPanned: () => tutorialFlags.panned,
      hasSelected: () => tutorialFlags.selected,
      hasDeselected: () => tutorialFlags.deselected,
      hasSetTimeSpeed: () => tutorialFlags.timeSpeed,
      hasBuiltO2Recycler: () => tutorialFlags.builtO2 || EnvObjectManager.getObjects().some(o => o.sName === 'OxygenRecycler' && o.bBuilt),
      hasBuildConfirmed: () => tutorialFlags.buildConfirm,
      hasAssignedBuilders: () => tutorialFlags.assignedBuilders || characterManager.getCharacters().some(c => c.getJob() === 2),
      hasUsedVizModes: () => tutorialFlags.vizModes,
      hasBuiltFoodReplicator: () => tutorialFlags.builtFood || EnvObjectManager.getObjects().some(o => o.sName === 'FoodReplicator' && o.bBuilt),
      hasFlippedObject: () => tutorialFlags.flipped,
      hasBuiltAirlock: () => tutorialFlags.builtAirlock || EnvObjectManager.getObjects().some(o => o.sName === 'AirlockLocker' && o.bBuilt),
      hasSpedUpTime: () => tutorialFlags.spedUp || GameRules.playerTimeScale > 1,
      hasRepairedBreach: () => tutorialFlags.repairedBreach || roomManager.getRooms().every(r => r.sealed),
      hasZonedResidence: () => tutorialFlags.zonedResidence || roomManager.getRooms().some(r => r.zone === 'RESIDENCE'),
      hasMineConfirmed: () => tutorialFlags.mineConfirm,
      hasAssignedTechs: () => tutorialFlags.assignedTechs || characterManager.getCharacters().some(c => c.getJob() === 4),
      hasExploredDerelict: () => tutorialFlags.exploredDerelict,
    });
  }

  // Wire save/load data providers
  saveLoadSystem.getCharacterData = () => characterManager.getCharacters().map(c => ({
    id: c.id, tileX: c.tileX, tileY: c.tileY,
    name: c.getName(), job: c.getJob(), team: c.tStats.nTeam, race: c.tStats.nRace,
    hp: c.getHP(), maxHP: c.tStats.nMaxHP, status: c.tStats.nStatus,
    xp: c.tStats.nXP, competency: { ...c.tStats.tCompetency },
    morale: c.nMorale, anger: c.nAnger, nRemainingDutyTime: c.nRemainingDutyTime,
    weapon: c.weapon, bSpacesuit: c.bSpacesuit, nSuitOxygen: c.nSuitOxygen, heldItem: c.heldItem,
    maladies: c.maladies.map(m => ({ ...m })),
    tLog: c.tLog.slice(-100),
    needs: { ...c.needs },
    inventory: c.inventory.getAll().map(i => ({ sTemplate: i.sTemplate, sName: i.sName, nCount: i.nCount })),
  }));
  saveLoadSystem.getObjectData = () => EnvObjectManager.getObjects().map(o => ({
    name: o.sName, tileX: o.tileX, tileY: o.tileY,
    built: o.bBuilt, condition: o.nCondition, hasPower: o.bHasPower,
  }));
  saveLoadSystem.getResearchData = () => ({
    active: researchSystem.getActiveResearch(),
    progress: researchSystem.getProgress(),
    completed: researchSystem.getCompletedList(),
  });
  saveLoadSystem.getEventData = () => eventController.getSaveData();
  saveLoadSystem.getTopicsData = () => getTopicsSaveData();

  // Wire load callbacks
  saveLoadSystem.loadCharacterData = (chars) => {
    characterManager.clearAll();
    for (const cd of chars) {
      const char = characterManager.spawnCharacterAt(cd.tileX, cd.tileY, false, false);
      char.tStats.sName = cd.name;
      char.setJob(cd.job);
      char.tStats.nTeam = cd.team;
      if (cd.race !== undefined) char.tStats.nRace = cd.race;
      char.setHP(cd.hp);
      char.tStats.nMaxHP = cd.maxHP;
      char.tStats.nStatus = cd.status;
      char.tStats.nXP = cd.xp;
      char.tStats.tCompetency = { ...cd.competency };
      char.nMorale = cd.morale;
      char.nAnger = cd.anger;
      char.nRemainingDutyTime = cd.nRemainingDutyTime;
      char.weapon = cd.weapon;
      char.bSpacesuit = cd.bSpacesuit;
      char.nSuitOxygen = cd.nSuitOxygen;
      if (cd.heldItem !== undefined) char.heldItem = cd.heldItem;
      // Restore needs
      if (cd.needs) {
        char.needs.hunger = cd.needs.hunger;
        char.needs.energy = cd.needs.energy;
        char.needs.amusement = cd.needs.amusement;
        char.needs.social = cd.needs.social;
        char.needs.oxygen = cd.needs.oxygen;
      }
      // Restore inventory
      if (cd.inventory) {
        for (const item of cd.inventory) {
          const invItem = createItem(item.sTemplate, { sName: item.sName, nCount: item.nCount });
          char.inventory.addItem(invItem);
        }
      }
      // Restore maladies
      if (cd.maladies) {
        char.maladies = cd.maladies.map(m => ({ ...m }));
      }
      // Restore log
      if (cd.tLog) {
        char.tLog = cd.tLog.slice();
      }
    }
  };
  saveLoadSystem.loadObjectData = (objs) => {
    EnvObjectManager.clearAll();
    for (const od of objs) {
      const obj = EnvObjectManager.createObject(od.name, od.tileX, od.tileY, false, false, od.built);
      if (obj) {
        obj.nCondition = od.condition;
      }
    }
  };
  saveLoadSystem.loadResearchData = (data) => {
    researchSystem.loadSaveData(data);
  };
  saveLoadSystem.loadEventData = (data) => {
    eventController.loadSaveData(data);
  };
  saveLoadSystem.loadTopicsData = (data) => {
    topicsFromSaveData(data);
  };
  saveLoadSystem.getFireData = () => fire.getSaveData();
  saveLoadSystem.loadFireData = (data) => {
    fire.loadSaveData(data);
  };
  saveLoadSystem.getCommandData = () => CommandQueue.getSaveData();
  saveLoadSystem.loadCommandData = (data) => {
    CommandQueue.loadSaveData(data as any);
  };
  saveLoadSystem.getPickupData = () => characterManager.getPickups().map(p => ({
    sName: p.sName, tileX: p.tileX, tileY: p.tileY,
  }));
  saveLoadSystem.loadPickupData = (data) => {
    for (const p of data) {
      let pickup: Pickup;
      if (p.sName === 'Corpse') {
        pickup = new Corpse(p.tileX, p.tileY, 'Unknown', 0, 1);
      } else {
        pickup = new Pickup(p.sName, p.tileX, p.tileY);
      }
      // Register with room (Lua: Room:addProp for pickups)
      pickup.rRoom = roomManager.getRoomAt(p.tileX, p.tileY);
      characterManager.pickups.push(pickup);
    }
  };

  // Register subsystems
  GameRules.registerSystem(2, new OxygenTickAdapter(oxygenSystem, vacuumSystem));
  GameRules.registerSystem(11, new CharacterTickAdapter(characterManager));

  // ── Create space background ───────────────────────────────
  createSpaceBackground(threeRenderer);

  // ── Generate world ────────────────────────────────────────
  const landingZone = initData.landingZone as { x: number; y: number; density: number; threat: number; distance: number; interference: number } | undefined;
  const worldResult = generateWorld(grid, wallAutoGen, landingZone);

  // Wire galaxy position into event system difficulty
  if (landingZone) {
    eventController.setGalaxyValues({
      population: landingZone.density,
      hostility: landingZone.threat,
      asteroids: landingZone.interference,
    });
  }

  // When a wall is destroyed, re-flood rooms to detect new breaches
  grid.onWallDestroyed = (_x, _y) => roomManager.markDirty([]);

  roomManager.markDirty([]);
  roomManager.update();

  // Initialize Topics system (Lua Topics.initializeTopicList)
  setCharacterProvider(
    () => characterManager.getCharacters(),
    (id: string) => characterManager.getCharacters().find(c => String(c.id) === id),
  );
  initializeTopicList();

  // Load saved game if requested (Lua: LoadBase → GameRules.loadGame)
  const isLoadSave = initData.loadSave === true;
  const saveSlotName = (initData.saveSlot as string | undefined) ?? 'SpacebaseDF9AutoSave';

  if (isLoadSave) {
    const loaded = saveLoadSystem.loadFromStorage(saveSlotName);
    if (loaded) {
      // Rebuild room detection and rendering from loaded grid data
      roomManager.markDirty([]);
      roomManager.update();
      tileRenderer.renderRegion(0, 0, grid.width - 1, grid.height - 1);
    } else {
      // Load failed — fall back to spawning a new crew
      characterManager.spawnInitialCrew(worldResult.crewSpawns);
    }
  } else {
    // Spawn the initial 3 spacewalking settlers
    characterManager.spawnInitialCrew(worldResult.crewSpawns);
  }

  const cx = Math.floor(grid.width / 2);
  const cy = Math.floor(grid.height / 2);
  tileRenderer.renderRegion(cx - 20, cy - 20, cx + 20, cy + 20);

  // Place the seed pod (BaseSeed) at center — a visible marker
  if (!isLoadSave) {
    createSeedPod(threeRenderer, worldResult.seedPodX, worldResult.seedPodY);
  }

  // Lua GameRules._resetCamera: zoom=1.0, center on seed pod / first character
  {
    const spx = worldResult.seedPodX * TILE_W + TILE_HALF_W;
    const spy = worldResult.seedPodY * TILE_HALF_H;
    cameraController.zoom = 1.0;
    cameraController.centerOnWorld(spx, spy);
  }

  // Lua GameRules.lua:686 — new game starts paused
  if (!isLoadSave) {
    GameRules.bRunning = false;
  }

  // ── Input system ──────────────────────────────────────────
  const inputManager = new InputManager(threeRenderer.getCanvas(), cameraController);

  let buildMode: BuildMode = 'none';
  let showO2Overlay = false;
  let selectedZone: ZoneType = ZoneType.GARDEN;
  let selectedEntity: SelectedEntity = null;
  const prevCommandTiles = new Set<string>();

  // ── Confirm/Cancel build flow (Lua CommandObject) ──────────────
  // Tracks pending tile changes before confirm. Matter is deducted only on confirm.
  interface SavedTile { x: number; y: number; previousType: number; previousO2: number }
  let pendingSavedTiles: SavedTile[] = [];
  let pendingBuildCost = 0;    // positive = costs matter
  let pendingVaporizeCost = 0; // negative = refund
  let pendingCancelCost = 0;   // negative = refund
  let lastDragW = 0;
  let lastDragH = 0;

  function pendingTotalCost(): number {
    return pendingBuildCost + pendingVaporizeCost + pendingCancelCost;
  }

  function pendingAvailableMatter(): number {
    return GameRules.nMatter - pendingTotalCost();
  }

  /** Save tile states before modification for cancel/restore. */
  function saveTileStates(tiles: { x: number; y: number }[]) {
    for (const t of tiles) {
      // Don't double-save if already saved
      if (pendingSavedTiles.some(s => s.x === t.x && s.y === t.y)) continue;
      pendingSavedTiles.push({
        x: t.x, y: t.y,
        previousType: grid.get(t.x, t.y),
        previousO2: grid.getO2(t.x, t.y),
      });
    }
  }

  function confirmBuild(): boolean {
    const total = pendingTotalCost();
    if (GameRules.nMatter < total) {
      SoundManager.playSfx('disallow');
      return false;
    }
    GameRules.nMatter -= total;
    pendingSavedTiles = [];
    pendingBuildCost = 0;
    pendingVaporizeCost = 0;
    pendingCancelCost = 0;
    SoundManager.playSfx('confirm');
    return true;
  }

  function cancelBuild() {
    // Restore all saved tiles to their previous state
    const changed: { x: number; y: number }[] = [];
    for (const s of pendingSavedTiles) {
      grid.set(s.x, s.y, s.previousType);
      grid.setO2(s.x, s.y, s.previousO2);
      changed.push({ x: s.x, y: s.y });
    }
    // Cancel any build commands for restored tiles
    for (const s of pendingSavedTiles) {
      CommandQueue.cancelAt(s.x, s.y);
    }
    if (changed.length > 0) {
      wallAutoGen.update(changed);
      roomManager.markDirty(changed);
    }
    pendingSavedTiles = [];
    pendingBuildCost = 0;
    pendingVaporizeCost = 0;
    pendingCancelCost = 0;
    SoundManager.playSfx('degauss');
  }

  function hasPendingBuild(): boolean {
    return pendingSavedTiles.length > 0;
  }

  // Keyboard bindings
  inputManager.onKeyPress('KeyC', () => { buildMode = buildMode === 'room' ? 'none' : 'room'; });
  inputManager.onKeyPress('KeyW', () => { buildMode = buildMode === 'wall' ? 'none' : 'wall'; });
  inputManager.onKeyPress('KeyB', () => { buildMode = buildMode === 'floor' ? 'none' : 'floor'; });
  inputManager.onKeyPress('KeyD', () => { buildMode = buildMode === 'door' ? 'none' : 'door'; });
  inputManager.onKeyPress('KeyX', () => { buildMode = buildMode === 'demolish' ? 'none' : 'demolish'; });
  inputManager.onKeyPress('KeyV', () => { buildMode = buildMode === 'vaporize' ? 'none' : 'vaporize'; });
  inputManager.onKeyPress('KeyE', () => { buildMode = buildMode === 'erase' ? 'none' : 'erase'; });
  // Z key zone mode removed — zone assignment is now in room inspector Rezone tab
  inputManager.onKeyPress('KeyP', () => { buildMode = buildMode === 'object' ? 'none' : 'object'; });
  inputManager.onKeyPress('KeyM', () => { buildMode = buildMode === 'mine' ? 'none' : 'mine'; });
  inputManager.onKeyPress('Escape', () => {
    // Close full-screen overlays first (Lua: ESC closes submenu)
    if (uiManager.isJobRosterOpen()) {
      uiManager.toggleJobRoster();
      return;
    }
    if (uiManager.isResearchPanelVisible()) {
      uiManager.toggleResearchPanel();
      return;
    }
    if (uiManager.isGoalsPanelVisible()) {
      uiManager.toggleGoalsPanel();
      return;
    }
    if (hasPendingBuild()) {
      cancelBuild();
    }
    buildMode = 'none';
    buildCursor.cancelDrag();
    selectedEntity = null;
    uiManager.setSelectedEntity(null);
    uiManager.dismissInspectSub();
    tutorialFlags.deselected = true;
    GameRules.bRunning = true;
  });
  inputManager.onKeyPress('KeyO', () => { showO2Overlay = !showO2Overlay; tutorialFlags.vizModes = true; });
  inputManager.onKeyPress('KeyI', () => { buildMode = 'none'; });
  inputManager.onKeyPress('KeyR', () => { uiManager.toggleJobRoster(); });
  inputManager.onKeyPress('Space', () => { GameRules.togglePause(); tutorialFlags.timeSpeed = true; });
  inputManager.onKeyPress('Digit1', () => { GameRules.setTimeScale(1); tutorialFlags.timeSpeed = true; });
  inputManager.onKeyPress('Digit2', () => { GameRules.setTimeScale(2); tutorialFlags.timeSpeed = true; tutorialFlags.spedUp = true; });
  inputManager.onKeyPress('Digit3', () => { GameRules.setTimeScale(4); tutorialFlags.timeSpeed = true; tutorialFlags.spedUp = true; });
  // ] / [ keys: speed up / slow down time (Lua GameScreen.lua:285-291)
  inputManager.onKeyPress('BracketRight', () => { GameRules.timeFaster(); tutorialFlags.timeSpeed = true; tutorialFlags.spedUp = true; });
  inputManager.onKeyPress('BracketLeft', () => { GameRules.timeSlower(); tutorialFlags.timeSpeed = true; });
  // K key: toggle cutaway mode (Lua GameScreen.lua)
  inputManager.onKeyPress('KeyK', () => {
    GameRules.cycleCutawayMode();
    tileRenderer.setCutaway(GameRules.isCutawayModeEnabled());
    tutorialFlags.vizModes = true;
  });
  // +/= and -/_ keys: keyboard zoom (Lua GameScreen.lua:224-241, zoomAmount = ZOOM_WHEEL_STEP * 4)
  inputManager.onKeyPress('Equal', () => { cameraController.addZoom(4); tutorialFlags.zoomed = true; });
  inputManager.onKeyPress('Minus', () => { cameraController.addZoom(-4); tutorialFlags.zoomed = true; });
  // ,/. keys: cycle characters (Lua GameScreen.lua:293-334)
  inputManager.onKeyPress('Period', () => {
    const chars = characterManager.getCharacters();
    if (chars.length === 0) return;
    GameRules.selectedCharIndex = (GameRules.selectedCharIndex + 1) % chars.length;
    const c = chars[GameRules.selectedCharIndex];
    selectedEntity = { type: 'character', data: c };
    uiManager.setSelectedEntity(selectedEntity);
  });
  inputManager.onKeyPress('Comma', () => {
    const chars = characterManager.getCharacters();
    if (chars.length === 0) return;
    GameRules.selectedCharIndex = (GameRules.selectedCharIndex - 1 + chars.length) % chars.length;
    const c = chars[GameRules.selectedCharIndex];
    selectedEntity = { type: 'character', data: c };
    uiManager.setSelectedEntity(selectedEntity);
  });
  // Ctrl+S: save game (Lua GameScreen.lua:336-346)
  inputManager.onKeyPress('KeyS', (e) => {
    if (e?.ctrlKey || e?.metaKey) {
      e.preventDefault();
      saveLoadSystem.saveToStorage();
    }
  });
  // Ctrl+L: load game (Lua GameScreen.lua:348-350)
  inputManager.onKeyPress('KeyL', (e) => {
    if (e?.ctrlKey || e?.metaKey) {
      e.preventDefault();
      saveLoadSystem.loadFromStorage();
    }
  });
  // F key: toggle flip for object placement (Lua: GameScreen.bFlipProp)
  inputManager.onKeyPress('KeyF', () => {
    if (buildMode === 'object') {
      objectPlacement.bFlipProp = !objectPlacement.bFlipProp;
      Base.addAlert('system', `Object flip: ${objectPlacement.bFlipProp ? 'ON' : 'OFF'}`);
      tutorialFlags.flipped = true;
    }
  });
  // Backtick: toggle debug menu (Lua DebugMenu.lua)
  const debugMenu = new DebugMenu();
  inputManager.onKeyPress('Backquote', () => {
    if (debugMenu.isVisible()) {
      debugMenu.hide();
    } else {
      debugMenu.show(container, {
        onResearchOne: () => {
          const all = researchSystem.getAllResearch();
          for (const [id, r] of Object.entries(all)) {
            if (r.available && !r.completed) {
              researchSystem.startResearch(id);
              researchSystem.addProgress(r.nCost);
              break;
            }
          }
        },
        onResearchAll: () => {
          let changed = true;
          while (changed) {
            changed = false;
            const all = researchSystem.getAllResearch();
            for (const [id, r] of Object.entries(all)) {
              if (r.available && !r.completed) {
                researchSystem.startResearch(id);
                researchSystem.addProgress(r.nCost);
                changed = true;
              }
            }
          }
        },
        onResearchAllMalady: () => {
          Malady.researchAllCures();
        },
        onMakeAllHappy: () => {
          for (const c of characterManager.getCharacters()) {
            c.addMorale(100);
          }
        },
        onMakeAllSad: () => {
          for (const c of characterManager.getCharacters()) {
            c.addMorale(-100);
          }
        },
        onAddMatter: () => {
          GameRules.addMatter(1000);
        },
      }, () => {});
    }
  });

  // ── UI overlay ────────────────────────────────────────────
  const uiManager = new UIManager(container, {
    getBuildMode: () => buildMode,
    setBuildMode: (m) => { buildMode = m; },
    getPopulation: () => characterManager.getPopulation(),
    getSelectedZone: () => selectedZone,
    setSelectedZone: (z) => { selectedZone = z; },
    getHoveredRoomZone: () => {
      const hovered = buildCursor.hoveredTile;
      if (!hovered) return null;
      const room = roomManager.getRoomAt(hovered.x, hovered.y);
      return room?.zone ?? null;
    },
    getHoveredInfo: () => {
      const hovered = buildCursor.hoveredTile;
      if (!hovered) return '';
      const tile = grid.get(hovered.x, hovered.y);
      const room = roomManager.getRoomAt(hovered.x, hovered.y);
      let info = `(${hovered.x}, ${hovered.y})  ${tileName(tile)}`;
      if (room) {
        info += `\nRoom #${room.id}  ${room.size} tiles  Zone: ${ZONE_SPRITES[room.zone].name}`;
        info += `\nO2: ${room.oxygen}/255  ${room.sealed ? 'Sealed' : 'BREACHED'}`;
        info += `  Power: +${room.nPowerOutput}/-${room.nPowerDraw}`;
      }
      // Env objects at tile (Lua tooltip: "Name · Condition: Good (100%)")
      for (const obj of EnvObjectManager.getObjects()) {
        if (obj.tileX === hovered.x && obj.tileY === hovered.y) {
          info += `\n\n${obj.tData.friendlyName} \u00b7 ${obj.getConditionUIString()} (${Math.round(obj.nCondition)}%)`;
          if (!obj.bBuilt) info += ` [Building]`;
        }
      }
      // Characters at tile (Lua tooltip: "Name\nActivity (time)")
      for (const char of characterManager.getCharacters()) {
        if (char.tileX === hovered.x && char.tileY === hovered.y) {
          info += `\n\n${char.getName()}\n${char.currentTask?.name ?? 'Idle'}`;
        }
      }
      // Pending commands at tile
      for (const cmd of CommandQueue.getAllActive()) {
        if (cmd.tileX === hovered.x && cmd.tileY === hovered.y) {
          info += `\n[${cmd.type} command pending]`;
        }
      }
      return info;
    },
    onSave: () => {
      saveLoadSystem.saveToStorage();
      // Store metadata for the default autosave slot
      SaveSlotPanel.saveMeta('SpacebaseDF9AutoSave', characterManager.getPopulation(), GameRules.nMatter);
    },
    onLoad: () => saveLoadSystem.loadFromStorage(),
    onExport: () => saveLoadSystem.exportToFile(),
    onImport: () => saveLoadSystem.importFromFile(),
    onSpawn: () => characterManager.spawnCharacter(),
    onObjectSelected: (name) => { /* placeholder */ },
    getCharacters: () => characterManager.getCharacters(),
    getEnvObjects: () => EnvObjectManager.getObjects(),
    toggleO2Overlay: () => { showO2Overlay = !showO2Overlay; },
    onZoomIn: () => { cameraController.addZoom(3); },
    onZoomOut: () => { cameraController.addZoom(-3); },
    toggleWalls: () => {
      GameRules.cycleCutawayMode();
      tileRenderer.setCutaway(GameRules.isCutawayModeEnabled());
    },
    onFlipObject: () => {
      objectPlacement.bFlipProp = !objectPlacement.bFlipProp;
    },
    getFlipState: () => objectPlacement.bFlipProp,
    getRooms: () => roomManager.getRooms(),
    onSetJob: (character, jobId) => { character.setJob(jobId); },
    goalSystem,
    onCuffCharacter: (character) => {
      character.bCuffed = !character.bCuffed;
    },
    onExecuteCharacter: (character) => {
      character.kill(CAUSE_OF_DEATH.UNSPECIFIED);
    },
    getPendingBuildCost: () => {
      // Lua ConstructMenu:getMatterCostText — show cumulative pending costs
      const hasPending = pendingSavedTiles.length > 0;
      const hasDrag = buildCursor.isDragging && buildCursor.dragTileCount > 0;
      if (!hasPending && !hasDrag) return null;

      // Current drag info (for room size display, etc.)
      const count = hasDrag ? buildCursor.dragTileCount : 0;
      const dims = hasDrag ? buildCursor.dragDimensions : { w: 0, h: 0 };
      const totalCost = pendingBuildCost + pendingVaporizeCost + pendingCancelCost;

      if (buildMode === 'room' && hasDrag) {
        const floorW = Math.max(0, dims.w - 2);
        const floorH = Math.max(0, dims.h - 2);
        const floorCount = floorW * floorH;
        const wallCount = count - floorCount;
        const capacityLines = getProjectedCapacity(floorW, floorH);
        return { cost: totalCost, tileCount: count, mode: buildMode, w: dims.w, h: dims.h, wallCount, floorCount, floorW, floorH, capacityLines, buildCost: pendingBuildCost, vaporizeCost: pendingVaporizeCost, cancelCost: pendingCancelCost };
      }

      return { cost: totalCost, tileCount: count || pendingSavedTiles.length, mode: buildMode, w: dims.w, h: dims.h, buildCost: pendingBuildCost, vaporizeCost: pendingVaporizeCost, cancelCost: pendingCancelCost };
    },
    onConfirmBuild: () => confirmBuild(),
    onCancelBuild: () => cancelBuild(),
    hasPendingBuild: () => hasPendingBuild(),
    getCorpseCount: () => characterManager.getPickups().filter(p => p.constructor.name === 'Corpse').length,
    onDemolishObject: (obj) => {
      const refund = obj.getVaporizeMatterYield();
      EnvObjectManager.removeObject(obj);
      GameRules.addMatter(refund);
      Base.addAlert('build', `Demolished ${obj.tData.friendlyName}, refunded ${refund} matter`);
    },
    onCenterCamera: (char) => {
      const pos = tileToScreen(char.tileX, char.tileY);
      cameraController.centerOnWorld(pos.x, pos.y);
    },
    onSelectRoom: (room) => {
      // Center camera on room center tile and select the room in inspector
      if (room.tiles.length > 0) {
        const mid = room.tiles[Math.floor(room.tiles.length / 2)];
        const pos = tileToScreen(mid.x, mid.y);
        cameraController.centerOnWorld(pos.x, pos.y);
      }
      uiManager.setInspected({ type: 'room', data: room });
    },
    onRezoneRoom: (room, zone) => {
      room.zone = zone;
      roomManager.persistZone(room);
      tileRenderer.rerenderRoom(room);
    },
    onAlertClick: (alertType: string) => {
      if (eventController.dialogSystem) {
        if (eventController.dialogSystem.isOpen()) {
          eventController.dialogSystem.bringToFront();
        }
      }
    },
  });

  // Keyboard bindings for panels (must come after uiManager creation)
  inputManager.onKeyPress('KeyE', () => { uiManager.toggleResearchPanel(); });
  inputManager.onKeyPress('KeyG', () => { uiManager.toggleGoalsPanel(); });

  // ── Game loop ─────────────────────────────────────────────
  let lastTime = performance.now();

  function gameLoop() {
    const now = performance.now();
    const delta = now - lastTime;
    lastTime = now;

    // Camera
    cameraController.update();

    // Build input
    handleBuildInput();

    // Update coordinate display
    {
      const hov = buildCursor.hoveredTile;
      if (hov) {
        const tileVal = grid.get(hov.x, hov.y);
        const names: Record<number, string> = {
          [TileType.SPACE]: 'Space', [TileType.WALL]: 'Wall', [TileType.DOOR]: 'Door',
          [TileType.WALL_DESTROYED]: 'Destroyed Wall', [TileType.FLOOR]: 'Floor',
          [TileType.FLOOR_PENDING]: 'Floor (Pending)', [TileType.WALL_PENDING]: 'Wall (Pending)',
        };
        uiManager.updateTileInfo(hov.x, hov.y, names[tileVal] ?? 'Unknown');
      }
    }

    // Tile visibility culling
    const viewW = window.innerWidth / cameraController.zoom;
    const viewH = window.innerHeight / cameraController.zoom;
    tileRenderer.updateVisibility(cameraController.scrollX, cameraController.scrollY, viewW, viewH);

    // Dirty tiles
    if (grid.isDirty()) {
      const dirty = grid.consumeDirty();
      tileRenderer.updateDirty(dirty);
    }

    // Room updates
    const roomsBefore = roomManager.getRooms();
    roomManager.update();
    roomManager.tick(delta / 1000);

    if (roomManager.getRooms() !== roomsBefore) {
      for (const [, door] of tDoorsByAddr) {
        const neighbors = grid.getDiagonalNeighbors(door.tileX, door.tileY);
        const adjacentRooms = new Set<Room>();
        for (const n of neighbors) {
          const r = roomManager.getRoomAt(n.x, n.y);
          if (r) adjacentRooms.add(r);
        }
        const rooms = Array.from(adjacentRooms);
        const westRoom = rooms[0] ?? null;
        const eastRoom = rooms.length > 1 ? rooms[1] : westRoom;
        door.updateSpaceStatus(westRoom, eastRoom);
      }
    }

    // Power distribution
    powerSystem.update();

    // Pending command overlays
    renderCommandOverlays();

    // Event controller
    eventController.setPopulation(characterManager.getPopulation());

    // Passive wall healing (WorldConstants: TILE_HEAL_OVER_TIME = 0.05 HP/sec)
    // Only heals in powered rooms (Lua: Room must have power supply)
    grid.healTick(delta / 1000, (x, y) => {
      const room = roomManager.getRoomAt(x, y);
      return room != null && room.nPowerSupply > 0;
    });

    // Zone ticks (airlock pressurisation, bed zone, etc.)
    const dtSec = delta / 1000;
    for (const room of roomManager.getRooms()) {
      // Wire airlock safety check: returns true if any citizen without spacesuit is in room
      if (room.zoneObj && (room.zoneObj as any).safetyCheck === null) {
        (room.zoneObj as any).safetyCheck = () =>
          characterManager.getCharactersAt(room).some(c => !c.bSpacesuit && !c.bSpacewalking);
      }
      room.zoneObj?.onTick(dtSec);
    }

    // Master tick
    GameRules.onTick(delta / 1000);

    // Cull expired alerts (Lua Base.onTick auto-dismiss)
    Base.cullExpiredAlerts();

    // Sync 3D prop models for pickups and held items
    syncProps();

    // Emergency beacon tick
    EmergencyBeacon.onTick();
    syncBeaconVisuals();
    updateBeaconAnimations(delta / 1000);

    // Goal, hint, disease, and music systems
    const gameDt = (delta / 1000) * GameRules.playerTimeScale;
    Malady.updateElapsedTime(gameDt);
    goalSystem.update(gameDt);
    hintSystem.update(gameDt);
    try {
      derelictSystem.onTick(gameDt);
    } catch (e) {
      console.error('DerelictSystem error:', e);
    }
    try {
      dockingSystem.onTick(gameDt);
    } catch (e) {
      console.error('DockingSystem error:', e);
    }
    try {
      dialogueSystem.onTick(gameDt);
    } catch (e) {
      console.error('DialogueSystem error:', e);
    }
    try {
      explosionSystem.update(delta / 1000);
    } catch (e) {
      console.error('ExplosionSystem error:', e);
    }
    if (isTutorialMode && tutorialSystem.isActive()) {
      if (cameraController.zoom !== 1) tutorialFlags.zoomed = true;
      if (cameraController.scrollX !== 0 || cameraController.scrollY !== 0) tutorialFlags.panned = true;
    }
    tutorialSystem.update(gameDt);
    autoSave.onTick(delta / 1000);
    musicSystem.update(delta / 1000);

    // Update audio listener position from camera
    SoundManager.setListenerPosition(cameraController.scrollX, cameraController.scrollY);
    SoundManager.setZoomDepth(Math.min(1, Math.max(0, (cameraController.zoom - 0.5) / 1.5)));

    // Room lighting tints (skip when O2 overlay is active — it has its own tinting)
    if (!showO2Overlay) {
      renderRoomLighting();
    }

    // Fire tile overlays + fire particles
    renderFireOverlays();
    const activeFires = fire.getActiveFires();
    fireParticles.setFireTiles(activeFires);
    fireParticles.update(delta / 1000);

    // Projectile visuals
    projectileRenderer.update(projectileManager.getActiveProjectiles());

    // Effect particles (meteor trails, construction sparks)
    effectParticles.update(delta / 1000);
    // Construction danger sparks: objects with condition <= 20 emit sparks every 6s (Lua DANGER_SPARK_FREQUENCY)
    checkDangerSparks(delta / 1000);

    // Room lighting on characters (Lua: room ambient → character shader)
    applyCharacterRoomLighting();

    // O2 overlay (overrides room lighting tints)
    if (showO2Overlay) {
      renderO2Overlay();
    }

    // Selection highlight
    selectionHighlight.update(selectedEntity);

    // Sync cutaway state to renderer (Lua: World.updateCutaway called whenever mode changes)
    tileRenderer.setCutaway(GameRules.isCutawayModeEnabled());

    // Sync O2 overlay button state
    uiManager.o2OverlayActive = showO2Overlay;

    // UI
    uiManager.update();

    // End-of-frame input state
    inputManager.endFrame();
    uiManager.uiClickConsumed = false;

    // Render
    threeRenderer.render();

    requestAnimationFrame(gameLoop);
  }

  /** Render amber tint on tiles with pending commands (skip build_tile — those use ghost rendering). */
  function renderCommandOverlays() {
    const currentTiles = new Set<string>();
    for (const cmd of CommandQueue.getAllActive()) {
      if (cmd.type === 'build_tile') continue; // Pending tiles have their own blue ghost rendering
      const key = `${cmd.tileX},${cmd.tileY}`;
      currentTiles.add(key);
      tileRenderer.setTileTint(cmd.tileX, cmd.tileY, 0xDFA200);
    }
    // Clear tint on tiles that no longer have active commands
    for (const key of prevCommandTiles) {
      if (!currentTiles.has(key)) {
        const [x, y] = key.split(',').map(Number);
        tileRenderer.clearTileTint(x, y);
      }
    }
    prevCommandTiles.clear();
    for (const key of currentTiles) prevCommandTiles.add(key);
  }

  /**
   * Lua BuildHelper:getCapacityText — calculate how many key objects fit in floor area.
   * Uses getCapacityInDimension(objSize, objMargin, floorSize) from BuildHelper.lua.
   */
  function getProjectedCapacity(floorW: number, floorH: number): string[] {
    if (floorW <= 0 || floorH <= 0) return [];
    // Lua tPropsToCheck: key objects for capacity estimation
    const propsToCheck = ['OxygenRecycler', 'Bed', 'RefineryDropoff', 'Generator',
      'ResearchDesk', 'StandingTable', 'Bar', 'HospitalBed'];
    const lines: string[] = [];

    function capInDim(objSize: number, objMargin: number, floorSize: number): number {
      floorSize = floorSize - (objSize + objMargin * 2);
      if (floorSize < 0) return 0;
      let cap = 1;
      while (floorSize > 0) {
        floorSize -= (objSize + objMargin);
        cap++;
      }
      if (floorSize < 0) cap--;
      return cap;
    }

    for (const propName of propsToCheck) {
      const data = getObjectData(propName);
      if (!data) continue;
      const zoneName = data.zoneName;
      if (!zoneName) continue;
      const capX = capInDim(data.width, data.margin, floorW);
      const capY = capInDim(data.height, data.margin, floorH);
      const capXf = capInDim(data.height, data.margin, floorW);
      const capYf = capInDim(data.width, data.margin, floorH);
      const capacity = Math.max(capX * capY, capXf * capYf);
      if (capacity > 0) {
        lines.push(`${zoneName}: ${capacity} ${data.friendlyName}`);
      }
    }
    return lines;
  }

  function handleBuildInput() {
    const worldPos = inputManager.getWorldPointer();
    buildCursor.updateHover(worldPos.x, worldPos.y);
    const tile = buildCursor.hoveredTile;
    if (!tile) return;

    const isDragMode = buildMode === 'room' || buildMode === 'floor' ||
                       buildMode === 'wall' || buildMode === 'demolish' || buildMode === 'vaporize' ||
                       buildMode === 'erase' || buildMode === 'mine';

    // Left button just pressed (skip if a UI element consumed the click)
    if (inputManager.leftJustPressed && !uiManager.uiClickConsumed) {
      // Inspect mode: click to select character/object/room
      if (buildMode === 'none') {
        let found = false;
        // 1. Character at tile
        for (const char of characterManager.getCharacters()) {
          if (char.tileX === tile.x && char.tileY === tile.y) {
            selectedEntity = { type: 'character', data: char };
            uiManager.setSelectedEntity(selectedEntity);
            found = true;
            break;
          }
        }
        // 2. EnvObject at tile
        if (!found) {
          for (const obj of EnvObjectManager.getObjects()) {
            if (obj.tileX === tile.x && obj.tileY === tile.y) {
              selectedEntity = { type: 'object', data: obj };
              uiManager.setSelectedEntity(selectedEntity);
              found = true;
              break;
            }
          }
        }
        // 3. Room at tile
        if (!found) {
          const room = roomManager.getRoomAt(tile.x, tile.y);
          if (room) {
            selectedEntity = { type: 'room', data: room };
            uiManager.setSelectedEntity(selectedEntity);
            found = true;
          }
        }
        // Click on empty space clears selection
        if (!found) {
          selectedEntity = null;
          uiManager.setSelectedEntity(null);
        }
        if (found) tutorialFlags.selected = true;
        // Tile tip text (Lua: StatusBar:setTileTipText)
        const tileType = grid.get(tile.x, tile.y);
        uiManager.setTileTip(`(${tile.x}, ${tile.y}) ${tileName(tileType)}`);
      } else if (buildMode === 'zone') {
        const tileType = grid.get(tile.x, tile.y);
        if (tileType !== TileType.FLOOR) {
          // Zone assignment only works on completed floor tiles
        } else {
          const room = roomManager.getRoomAt(tile.x, tile.y);
          if (room) {
            room.zone = selectedZone;
            roomManager.persistZone(room);
            tileRenderer.rerenderRoom(room);
          }
        }
      } else if (buildMode === 'door') {
        const cost = buildSystem.placeDoor(tile.x, tile.y, GameRules.nMatter);
        GameRules.nMatter -= cost;
        if (cost > 0) onTilesChanged([tile]);
      } else if (buildMode === 'object') {
        const objName = uiManager.selectedObjectName;
        if (objName) {
          const check = objectPlacement.canPlace(objName, tile.x, tile.y);
          if (!check.valid) {
            const tileVal = grid.get(tile.x, tile.y);
            Base.addAlert('build', `Cannot place ${objName} at (${tile.x},${tile.y}): ${check.reason} [tile=${tileVal}]`);
          }
          const cost = objectPlacement.placeObject(objName, tile.x, tile.y);
          if (cost > 0) {
            const tilesToUpdate = [tile];
            // 2-wide doors (Airlock): also rerender the second tile
            const door = EnvObjectManager.getDoorAt(tile.x, tile.y);
            if (door && door.secondTileX >= 0) {
              tilesToUpdate.push({ x: door.secondTileX, y: door.secondTileY });
            }
            onTilesChanged(tilesToUpdate);
          }
        } else {
          Base.addAlert('build', 'No object selected — pick one from the list');
        }
      } else if (buildMode === 'beacon') {
        // Place emergency beacon at tile for first security squad
        const squads = SquadList.getAllSquads();
        if (squads.length > 0) {
          const squad = squads[0];
          EmergencyBeacon.placeAt(squad.name, tile.x, tile.y, squad.getSize());
          SoundManager.playSfx('placebeacon');
          Base.addAlert('beacon', `Beacon placed at (${tile.x},${tile.y}) for ${squad.name}`);
        } else {
          // Auto-create a default squad from EMERGENCY job characters
          const emergencyChars = characterManager.getCharacters().filter(c =>
            c.tStats.nTeam === 1 && c.tStats.nJob === 5 && c.tStats.nStatus !== 0x10 // EMERGENCY job, not dead
          );
          if (emergencyChars.length > 0) {
            const squad = SquadList.createSquad('Alpha Squad');
            for (const c of emergencyChars) squad.addMember(c.id);
            EmergencyBeacon.placeAt(squad.name, tile.x, tile.y, squad.getSize());
            SoundManager.playSfx('placebeacon');
            Base.addAlert('beacon', `Squad "${squad.name}" created and beacon placed at (${tile.x},${tile.y})`);
          } else {
            Base.addAlert('beacon', 'No security personnel available — assign crew to Emergency job first');
          }
        }
      } else if (isDragMode) {
        buildCursor.startDrag(tile.x, tile.y);
        buildCursor.updateDrag(tile.x, tile.y, buildMode as 'room' | 'floor' | 'wall' | 'demolish' | 'vaporize' | 'erase' | 'mine');
      }
    }

    // Left held — update drag + buildscroll sfx (Lua BuildHelper:refresh)
    if (inputManager.isLeftDown() && buildCursor.isDragging && isDragMode) {
      buildCursor.updateDrag(tile.x, tile.y, buildMode as 'room' | 'floor' | 'wall' | 'demolish' | 'vaporize' | 'erase' | 'mine');
      // Lua: play buildscroll sfx when drag dimensions change
      const dims = buildCursor.dragDimensions;
      if (dims.w !== lastDragW || dims.h !== lastDragH) {
        lastDragW = dims.w;
        lastDragH = dims.h;
        SoundManager.playSfx('buildscroll');
      }
    }

    // Left released — accumulate pending build (Lua: tiles placed but matter not deducted until confirm)
    if (inputManager.leftJustReleased && buildCursor.isDragging) {
      const tiles = buildCursor.endDrag();
      lastDragW = 0;
      lastDragH = 0;
      if (tiles.length > 0) {
        saveTileStates(tiles);
        if (buildMode === 'room') {
          const cost = buildSystem.buildRoom(tiles, pendingAvailableMatter());
          pendingBuildCost += cost;
        } else if (buildMode === 'floor') {
          const cost = buildSystem.placeFloors(tiles, pendingAvailableMatter());
          pendingBuildCost += cost;
        } else if (buildMode === 'wall') {
          const cost = buildSystem.placeWalls(tiles, pendingAvailableMatter());
          pendingBuildCost += cost;
        } else if (buildMode === 'demolish') {
          const refund = buildSystem.demolish(tiles);
          pendingVaporizeCost -= refund;
        } else if (buildMode === 'vaporize') {
          const refund = buildSystem.vaporize(tiles);
          pendingVaporizeCost -= refund;
          SoundManager.playSfx('vaporize');
        } else if (buildMode === 'erase') {
          const refund = buildSystem.erase(tiles);
          pendingCancelCost -= refund;
        } else if (buildMode === 'mine') {
          for (const t of tiles) {
            CommandQueue.addCommand('mine', t.x, t.y);
          }
        }
        onTilesChanged(tiles);
      }
    }

    // Hover ghost
    const noGhostModes = ['none', 'zone', 'object'];
    if (!inputManager.isLeftDown() && !buildCursor.isDragging && !noGhostModes.includes(buildMode)) {
      buildCursor.showHoverGhost(buildMode as 'room' | 'floor' | 'wall' | 'door' | 'demolish' | 'vaporize' | 'erase' | 'mine');
    }
  }

  function onTilesChanged(tiles: { x: number; y: number }[]) {
    roomManager.markDirty(tiles);
  }

  function renderO2Overlay() {
    for (const room of roomManager.getRooms()) {
      for (const t of room.tiles) {
        const tileO2 = grid.getO2(t.x, t.y);
        const o2ratio = tileO2 / 65535;
        const r = Math.floor((1 - o2ratio) * 255);
        const g = Math.floor(o2ratio * 255);
        const tint = (r << 16) | (g << 8) | 0x40;
        tileRenderer.setTileTint(t.x, t.y, tint);
      }
    }
  }

  /** Apply room-based lighting tints via the Lighting system.
   *  Normal rooms use per-tile ceiling light gradients (Lua LightPixelBuffer).
   *  Emergency rooms use uniform flashing tint. */
  const prevLitTiles = new Set<string>();
  function renderRoomLighting() {
    const currentLit = new Set<string>();
    for (const room of roomManager.getRooms()) {
      // Compute per-tile light map for gradient lighting
      const lightMap = lighting.computeTileLightMap(room);

      for (const t of room.tiles) {
        const key = `${t.x},${t.y}`;
        const tint = lightMap.size > 0
          ? lighting.getTileTint(room, t.x, t.y, lightMap)
          : lighting.getRoomTint(room.zone, room.nLightingScheme, room.nLightFadeTimer);
        if (tint !== 0xffffff) {
          currentLit.add(key);
          tileRenderer.setTileTint(t.x, t.y, tint);
        }
      }

      // Door lighting: tint door tiles to match facing room (Lua Lighting._updateDoorLights)
      if (room.tDoors && room.tDoors.size > 0) {
        for (const doorAddr of room.tDoors) {
          const key = doorAddr;
          const [dx, dy] = doorAddr.split(',').map(Number);
          const tint = lightMap.size > 0
            ? lighting.getTileTint(room, dx, dy, lightMap)
            : lighting.getRoomTint(room.zone, room.nLightingScheme, room.nLightFadeTimer);
          if (tint !== 0xffffff) {
            currentLit.add(key);
            tileRenderer.setTileTint(dx, dy, tint);
          }
        }
      }
    }
    // Clear tint from tiles no longer lit
    for (const key of prevLitTiles) {
      if (!currentLit.has(key)) {
        const [x, y] = key.split(',').map(Number);
        tileRenderer.clearTileTint(x, y);
      }
    }
    prevLitTiles.clear();
    for (const key of currentLit) prevLitTiles.add(key);
  }

  /** Render orange overlay on tiles with active fires. */
  const prevFireTiles = new Set<string>();
  function renderFireOverlays() {
    const currentFires = new Set<string>();
    for (const f of fire.getActiveFires()) {
      const key = `${f.x},${f.y}`;
      currentFires.add(key);
      // Orange-red tint scaled by intensity
      const intensity = f.intensity / 100;
      const r = Math.floor(255 * Math.min(1, 0.5 + intensity * 0.5));
      const g = Math.floor(255 * Math.max(0, 0.3 * intensity));
      const b = Math.floor(255 * Math.max(0, 0.05 * intensity));
      const tint = (r << 16) | (g << 8) | b;
      tileRenderer.setTileTint(f.x, f.y, tint);
    }
    // Clear tint from tiles where fire has been extinguished
    for (const key of prevFireTiles) {
      if (!currentFires.has(key)) {
        const [x, y] = key.split(',').map(Number);
        tileRenderer.clearTileTint(x, y);
      }
    }
    prevFireTiles.clear();
    for (const key of currentFires) prevFireTiles.add(key);
  }

  /** Apply room lighting tint to characters based on which room they're in (Lua room ambient → character shader). */
  /** Construction danger sparks: objects at ≤20 condition spark every 6s (Lua EnvObject.sSparkFX). */
  let sparkTimer = 0;
  function checkDangerSparks(dt: number) {
    sparkTimer += dt;
    if (sparkTimer < DANGER_SPARK_FREQUENCY) return;
    sparkTimer -= DANGER_SPARK_FREQUENCY;
    for (const obj of EnvObjectManager.getObjects()) {
      if (obj.bBuilt && obj.bHasPower && obj.nCondition > 0 && obj.nCondition <= DANGER_ZONE) {
        effectParticles.spawnSparks(obj.tileX, obj.tileY);
      }
    }
  }

  function applyCharacterRoomLighting() {
    for (const char of characterManager.getAllCharacters()) {
      const room = roomManager.getRoomAt(char.tileX, char.tileY);
      if (room) {
        const tint = lighting.getRoomTint(room.zone, room.nLightingScheme, room.nLightFadeTimer);
        characterRenderer.setCharacterTint(char.id, tint);
      } else {
        // In space — no tint
        characterRenderer.setCharacterTint(char.id, 0xffffff);
      }
    }
    // Env object lighting (Lua tPropLightColor)
    for (const obj of EnvObjectManager.getObjects()) {
      const room = roomManager.getRoomAt(obj.tileX, obj.tileY);
      if (room) {
        const tint = lighting.getRoomTint(room.zone, room.nLightingScheme, room.nLightFadeTimer);
        envObjRenderer.setObjectTint(String(obj.id), tint);
      } else {
        envObjRenderer.setObjectTint(String(obj.id), 0xffffff);
      }
    }
  }

  // ── Pickup → 3D model mapping ───────────────────────────────
  const PICKUP_MODELS: Record<string, string> = {
    Corpse: 'BodyBag',
    Food: 'FoodBar',
    Rock: 'AsteroidChunk',
    Debris: 'AsteroidChunk',
  };

  // ── Weapon/tool → 3D model mapping (for held items) ────────
  const WEAPON_MODELS: Record<string, string> = {
    LaserPistol: 'Pistol',
    Pistol: 'Pistol',
    Rifle: 'Rifle',
    SpaceGun: 'SpaceGun',
    PlasmaCannon: 'PlasmaCannon',
    Wand: 'Wand',
  };
  const TASK_MODELS: Record<string, string> = {
    BuildTile: 'Builder',
    BuildEnvObject: 'Builder',
    Mine: 'Weldammer',
    MaintainEnvObject: 'Weldammer',
    ExtinguishFire: 'FireExtinguisher',
  };

  const activePickupProps = new Set<string>();
  const activeHeldProps = new Set<string>();

  function syncProps() {
    // ── Pickup props ──
    const currentPickups = new Set<string>();
    for (const p of characterManager.getPickups()) {
      if (p.bPickedUp) continue;
      const propId = `pickup_${p.sName}_${p.tileX}_${p.tileY}`;
      currentPickups.add(propId);
      if (!activePickupProps.has(propId)) {
        const modelName = PICKUP_MODELS[p.sName];
        if (modelName) propRenderer.addProp(propId, modelName, p.tileX, p.tileY);
      }
    }
    // Remove picked-up props
    for (const id of activePickupProps) {
      if (!currentPickups.has(id)) propRenderer.removeProp(id);
    }
    activePickupProps.clear();
    for (const id of currentPickups) activePickupProps.add(id);

    // ── Held item props (weapons, tools) ──
    const currentHeld = new Set<string>();
    for (const char of characterManager.getCharacters()) {
      if (!char.isAlive()) continue;
      const taskName = char.currentTask?.name ?? '';
      const toolModel = TASK_MODELS[taskName];
      const weaponModel = char.weapon ? WEAPON_MODELS[char.weapon] : null;
      const modelName = toolModel ?? weaponModel;
      if (!modelName) continue;

      const propId = `held_${char.id}`;
      currentHeld.add(propId);
      if (!activeHeldProps.has(propId)) {
        propRenderer.addProp(propId, modelName, char.tileX, char.tileY, 20);
      }
      // Follow the character
      propRenderer.updatePropPosition(propId, char.screenX, char.screenY - 15);
    }
    for (const id of activeHeldProps) {
      if (!currentHeld.has(id)) propRenderer.removeProp(id);
    }
    activeHeldProps.clear();
    for (const id of currentHeld) activeHeldProps.add(id);
  }

  // ── Expose game state for E2E test assertions ─────────────
  (window as any).__df9 = {
    _charMgr: characterManager,
    _envMgr: EnvObjectManager,
    _roomMgr: roomManager,
    _gameRules: GameRules,
    _uiManager: uiManager,
    _cameraController: cameraController,
    _grid: grid,
    _buildSystem: buildSystem,
    _envObjectManager: EnvObjectManager,
    confirmBuild: () => confirmBuild(),
    cancelBuild: () => cancelBuild(),
    hasPendingBuild: () => hasPendingBuild(),
    getPendingBuildCost: () => pendingTotalCost(),
    getPopulation: () => characterManager.getPopulation(),
    getMatter: () => GameRules.nMatter,
    getRoomCount: () => roomManager.getRooms().length,
    getBuildMode: () => buildMode,
    getCharacters: () => characterManager.getCharacters().map(c => ({
      id: c.id, x: c.tileX, y: c.tileY, moving: c.moving, spacewalking: c.bSpacewalking,
      race: c.getRace(), job: c.getJob(), taskName: c.currentTask?.name ?? null,
      hunger: c.needs.hunger, energy: c.needs.energy,
      morale: c.nMorale, anger: c.nAnger, rampaging: c.bRampaging,
      team: c.tStats.nTeam, hp: c.getHP(), alive: c.isAlive(),
    })),
    getCommands: () => CommandQueue.getAllActive().map(c => ({
      id: c.id, type: c.type, tileX: c.tileX, tileY: c.tileY,
      status: c.status, assignedTo: c.assignedTo,
    })),
    getEnvObjects: () => EnvObjectManager.getObjects().map(o => ({
      name: o.sName, tileX: o.tileX, tileY: o.tileY,
      built: o.bBuilt, condition: o.nCondition, functioning: o.isFunctioning(),
    })),
    getRooms: () => roomManager.getRooms().map(r => ({
      id: r.id, zone: r.zone, tileCount: r.tiles.length, nTeam: r.nTeam,
      tiles: r.tiles.slice(0, 5).map(t => ({ x: t.x, y: t.y })),
    })),
    /** Find wall tiles adjacent to any room. */
    getWallTiles: () => {
      const walls: { x: number; y: number }[] = [];
      for (const room of roomManager.getRooms()) {
        for (const t of room.tiles) {
          // Check 4 cardinal neighbors for walls
          for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
            const nx = t.x + dx, ny = t.y + dy;
            if (grid.get(nx, ny) === TileType.WALL) {
              if (!walls.some(w => w.x === nx && w.y === ny)) {
                walls.push({ x: nx, y: ny });
              }
            }
          }
        }
      }
      return walls;
    },
    getTileType: (tileX: number, tileY: number) => grid.get(tileX, tileY),
    placeObject: (name: string, tileX: number, tileY: number) => {
      return objectPlacement.placeObject(name, tileX, tileY);
    },
    /** Create an already-built, powered object directly (bypasses placement validation). */
    createBuiltObject: (name: string, tileX: number, tileY: number) => {
      const data = tObjects[name];
      // For door objects, convert WALL→DOOR immediately since this skips the build process
      if (data?.door) {
        grid.set(tileX, tileY, TileType.DOOR);
      }
      const obj = EnvObjectManager.createObject(name, tileX, tileY);
      if (obj) { obj.markBuilt(); obj.bHasPower = true; return true; }
      return false;
    },
    getPickups: () => characterManager.getPickups().map(p => ({
      name: p.sName, tileX: p.tileX, tileY: p.tileY, pickedUp: p.bPickedUp,
    })),
    killCharacter: (charId: number, cause: number) => {
      const char = characterManager.getAllCharacters().find(c => c.id === charId);
      if (char) { char.kill(cause); return true; }
      return false;
    },
    killAllHostiles: () => {
      let count = 0;
      for (const char of characterManager.getAllCharacters()) {
        if (char.isAlive() && char.tStats.nTeam !== 1) { // TEAM_ID_PLAYER=1, FRIENDLY=4
          char.kill(0);
          count++;
        }
      }
      return count;
    },
    spawnCharacterAt: (tileX: number, tileY: number) => {
      const char = characterManager.spawnCharacterAt(tileX, tileY);
      return char.id;
    },
    triggerImmigration: () => {
      characterManager.spawnCharacter();
    },
    getResearch: () => ({
      active: researchSystem.getActiveResearch(),
      progress: researchSystem.getProgress(),
      completed: researchSystem.getCompletedList(),
      available: researchSystem.getAvailable().map(r => r.sName),
    }),
    startResearch: (id: string) => researchSystem.startResearch(id),
    setZone: (roomId: number, zone: string) => {
      const room = roomManager.getRooms().find(r => r.id === roomId);
      if (room) {
        room.zone = zone as ZoneType;
        roomManager.persistZone(room);
      }
    },
    addAlert: (type: string, msg: string) => Base.addAlert(type, msg),
    clearAlerts: () => Base.clearAlerts(),
    // ── Milestone 9: Combat & Events ─────────────────────────
    spawnHostiles: (count: number, hp?: number) => {
      characterManager.spawnHostiles(count, hp);
    },
    spawnHostileAt: (tileX: number, tileY: number, hp?: number) => {
      const char = characterManager.spawnCharacterAt(tileX, tileY);
      char.tStats.nTeam = -2; // TEAM_ID_DEBUG_ENEMYGROUP
      char.tStats.nJob = 6; // RAIDER
      char.tStats.sName = 'Raider';
      char.weapon = 'LaserPistol';
      if (hp) { char.tStats.nHP = hp; char.tStats.nMaxHP = hp; }
      return char.id;
    },
    getHostileCount: () => characterManager.getHostileCount(),
    getAllCharacters: () => characterManager.getAllCharacters().map(c => ({
      id: c.id, x: c.tileX, y: c.tileY, moving: c.moving,
      team: c.tStats.nTeam, job: c.getJob(), hp: c.getHP(),
      alive: c.isAlive(), taskName: c.currentTask?.name ?? null,
      weapon: c.weapon, rampaging: c.bRampaging,
    })),
    getCombatEngagements: () => characterManager.combatSystem.getEngagementCount(),
    getEventForecast: () => eventController.getForecast(),
    getActiveEvents: () => eventController.getActiveEvents().map(e => ({
      name: e.name, description: e.description, active: e.isActive(),
    })),
    getEventDifficulty: () => eventController.getDifficulty(),
    getGalaxyValues: () => eventController.getGalaxyValues(),
    getTimeBetweenEvents: () => eventController.getTimeBetweenEvents(),
    getFireCount: () => fire.getFireCount(),
    getActiveFires: () => fire.getActiveFires(),
    startFire: (x: number, y: number) => fire.startFire(x, y),
    infectCharacter: (charId: number, maladyType: string) => {
      const char = characterManager.getAllCharacters().find(c => c.id === charId);
      if (char) return char.infectWith(maladyType);
      return false;
    },
    getCharacterMaladies: (charId: number) => {
      const char = characterManager.getAllCharacters().find(c => c.id === charId);
      if (!char) return [];
      return char.maladies.map(m => ({
        name: m.sMaladyName,
        type: m.sMaladyType,
        symptomatic: m.bSymptomatic,
        contagious: m.bContagious,
        diagnosed: m.bDiagnosed,
        stage: m.nCurrentStage,
        severity: m.nSeverity,
        speed: m.nSpeed,
        special: m.sSpecial,
      }));
    },
    getDiseasedCount: () => {
      return characterManager.getAllCharacters().filter(c => c.isAlive() && c.maladies.length > 0).length;
    },
    // Disease system helpers
    getMaladyDefCount: () => Object.keys(MALADY_DEFS).length,
    getSpawnableDiseases: () => getSpawnableDiseases(),
    getMaladyByTier: (tier: number) => getMaladyByTier(tier),
    getMaladyResearch: () => Malady.getResearch(),
    getMaladyStrains: () => Malady.getAllStrains(),
    getMaladyElapsedTime: () => Malady.getElapsedTime(),
    advanceMaladyTime: (dt: number) => Malady.updateElapsedTime(dt),
    createMaladyInstance: (type: string) => {
      try { return Malady.createNewMaladyInstance(type); } catch { return null; }
    },
    isIncapacitated: (charId: number) => {
      const char = characterManager.getAllCharacters().find(c => c.id === charId);
      return char ? Malady.isIncapacitated(char) : false;
    },
    getMaladySpeedMod: (charId: number) => {
      const char = characterManager.getAllCharacters().find(c => c.id === charId);
      return char ? Malady.getSpeedModifier(char) : 1.0;
    },
    // ── Milestone 11: Goals, Hints, Save/Load ────────────────
    getGoals: () => ({
      completed: goalSystem.getCompleted(),
      completedCount: goalSystem.getCompletedCount(),
      totalGoals: goalSystem.getTotalGoals(),
    }),
    // ── Log/Journal System ───────────────────────────────────────
    getCharacterLog: (charId: number) => {
      const char = characterManager.getCharacters().find(c => c.id === charId);
      return char ? char.tLog : [];
    },
    addCharacterLog: (charId: number, logType: string) => {
      const char = characterManager.getCharacters().find(c => c.id === charId);
      if (char) addLog(logType, char);
    },
    getLogQueueLength: (charId: number) => {
      const char = characterManager.getCharacters().find(c => c.id === charId);
      return char ? char.tLogQueue.length : 0;
    },
    // ── Affinity & Familiarity ──────────────────────────────────
    getCharacterAffinity: (charId: number, topicKey: string) => {
      const char = characterManager.getCharacters().find(c => c.id === charId);
      return char ? char.getAffinity(topicKey) : 0;
    },
    addCharacterAffinity: (charId: number, topicKey: string, amount: number) => {
      const char = characterManager.getCharacters().find(c => c.id === charId);
      if (char) char.addAffinity(topicKey, amount);
    },
    getCharacterFamiliarity: (charId: number, otherId: number) => {
      const char = characterManager.getCharacters().find(c => c.id === charId);
      return char ? char.getFamiliarity(otherId) : 0;
    },
    addCharacterFamiliarity: (charId: number, otherId: number, amount: number) => {
      const char = characterManager.getCharacters().find(c => c.id === charId);
      if (char) char.addFamiliarity(otherId, amount);
    },
    getDeathMoraleLoss: (charId: number, deadId: number) => {
      const char = characterManager.getCharacters().find(c => c.id === charId);
      return char ? char.getDeathMoraleLoss(deadId) : 0;
    },
    // ── Topics System ──────────────────────────────────────────
    getTopicCount: () => Object.keys(getAllTopics()).length,
    getTopicCategories: () => Object.keys(getTopicsByCategory()),
    getTopicName: (id: string) => getTopicName(id),
    getStats: () => ({ ...Base.tStats }),
    incrementStat: (key: string, amount?: number) => Base.incrementStat(key as any, amount),
    // ── Inventory System ────────────────────────────────────────
    getItemTemplateCount: () => Object.keys(ITEM_TEMPLATES).length,
    getStuffNames: () => [...STUFF_NAMES],
    getTagCategories: () => Object.keys(TAGS),
    createItem: (sTemplate: string) => createItem(sTemplate),
    createRandomStuff: () => createRandomStartingStuff(),
    getWeaponData: (sTemplate: string) => getWeaponData({ sTemplate, sName: '', nCount: 1 }),
    getArmorData: (sTemplate: string) => getArmorData({ sTemplate, sName: '', nCount: 1 }),
    getAffinityDecay: (sTemplate: string) => getAffinityDecay({ sTemplate, sName: '', nCount: 1 }),
    canStack: (a: string, b: string) => canStack(
      { sTemplate: a, sName: '', nCount: 1 },
      { sTemplate: b, sName: '', nCount: 1 },
    ),
    getMaxStacks: (sTemplate: string) => getMaxStacks(sTemplate),
    isStuff: (sTemplate: string) => isStuff({ sTemplate, sName: '', nCount: 1 }),
    heldOnly: (sTemplate: string) => heldOnly({ sTemplate, sName: '', nCount: 1 }),
    disappearOnDrop: (sTemplate: string) => disappearOnDrop({ sTemplate, sName: '', nCount: 1 }),
    getPickupName: (sTemplate: string) => getPickupName({ sTemplate, sName: '', nCount: 1 }),
    getCharacterInventory: (charId: number) => {
      const char = characterManager.getAllCharacters().find(c => c.id === charId);
      if (!char) return [];
      return char.inventory.getAll().map(i => ({
        sTemplate: i.sTemplate, sName: i.sName, nCount: i.nCount,
      }));
    },
    giveCharacterItem: (charId: number, sTemplate: string) => {
      const char = characterManager.getAllCharacters().find(c => c.id === charId);
      if (!char) return false;
      const item = createItem(sTemplate);
      return char.inventory.addItem(item);
    },
    getHints: () => hintSystem.getShownHints(),
    saveGame: () => saveLoadSystem.saveToStorage('df9_test_save'),
    loadGame: () => saveLoadSystem.loadFromStorage('df9_test_save'),
    hasSave: () => saveLoadSystem.hasSave('df9_test_save'),
    deleteSave: () => saveLoadSystem.deleteSave('df9_test_save'),
    exportSave: () => saveLoadSystem.exportToFile(),
    importSave: () => saveLoadSystem.importFromFile(),
    // ── Milestone 12: Audio ──────────────────────────────────
    getAudioState: () => ({
      initialized: SoundManager.isInitialized(),
      muted: SoundManager.isMuted(),
      settings: SoundManager.getSettings(),
    }),
    toggleMute: () => SoundManager.toggleMute(),
    setMasterVolume: (v: number) => SoundManager.setMasterVolume(v),
    // ── Milestone 13: Music & Ambience ───────────────────────
    getMusicState: () => ({
      playing: musicSystem.isPlaying(),
      currentTrack: musicSystem.getCurrentTrack(),
      currentAmbience: musicSystem.getCurrentAmbience(),
    }),
    // ── Milestone 14: Spatial SFX ────────────────────────────
    getSpatialLoops: () => SpatialAudio.getActiveLoops(),
    triggerDoorSound: (tileX: number, tileY: number) => {
      SpatialAudio.doorOpen(tileX, tileY);
    },
    triggerJukebox: (objectId: string, tileX: number, tileY: number, start: boolean) => {
      if (start) SpatialAudio.jukeboxStart(objectId, tileX, tileY);
      else SpatialAudio.jukeboxStop(objectId);
    },
    // ── Character manipulation helpers ─────────────────────
    setCharacterHunger: (charId: number, value: number) => {
      const char = characterManager.getAllCharacters().find(c => c.id === charId);
      if (!char) return false;
      char.needs.hunger = value;
      return true;
    },
    // ── Batch 7 test helpers ─────────────────────────────────
    completeResearch: (id: string) => {
      // Force-complete a research for testing effects
      (researchSystem as any).completed.add(id);
    },
    getDeadCount: () => characterManager.getDeadCount(),
    isDead: (charId: number) => characterManager.isDead(charId),
    getRoomOxygen: (roomId: number) => {
      const room = roomManager.getRooms().find(r => r.id === roomId);
      return room ? room.oxygen : -1;
    },
    setRoomOxygen: (roomId: number, o2: number) => {
      const room = roomManager.getRooms().find(r => r.id === roomId);
      if (room) { oxygenSystem.setRoomO2(room, o2); }
    },
    /** Get per-tile O2 value (0-65535 Lua scale). */
    getTileO2: (x: number, y: number) => grid.getO2(x, y),
    /** Set per-tile O2 value. */
    setTileO2: (x: number, y: number, val: number) => grid.setO2(x, y, val),
    /** Get door state at tile. Returns { open, locked, operation } or null. */
    getDoorState: (x: number, y: number) => {
      const door = tDoorsByAddr.get(`${x},${y}`);
      if (!door) return null;
      return { open: door.isOpen(), locked: door.isLocked(), operation: door.getOperation(), state: door.state, hasPower: door.hasPower(), characterNearby: (door as any).characterNearby };
    },
    /** Force door rooms so hasPower() works in tests. */
    setDoorRooms: (x: number, y: number) => {
      const door = tDoorsByAddr.get(`${x},${y}`);
      if (!door) return false;
      const room = roomManager.getRoomAt(x, y);
      if (room) {
        door.updateSpaceStatus(room, room);
        return true;
      }
      return false;
    },
    /** Get object reservation info. */
    getObjectReservations: (name: string, x: number, y: number) => {
      const obj = EnvObjectManager.getObjects().find(
        (o: any) => o.sName === name && o.tileX === x && o.tileY === y
      );
      if (!obj) return null;
      return { reservedBy: Array.from(obj.reservedBy), nMaxReservations: obj.nMaxReservations, rUser: obj.rUser?.id ?? null };
    },
    getCharacterSuffocation: (charId: number) => {
      const char = characterManager.getAllCharacters().find(c => c.id === charId);
      return char ? { suffocationTime: char.suffocationTime, bLowOxygen: char.bLowOxygen } : null;
    },
    setCharacterJob: (charId: number, job: number) => {
      const char = characterManager.getAllCharacters().find(c => c.id === charId);
      if (char) char.setJob(job);
    },
    getCharacterWeapon: (charId: number) => {
      const char = characterManager.getAllCharacters().find(c => c.id === charId);
      return char ? char.weapon : null;
    },
    // ── Inspector helpers ────────────────────────────────────
    renameCharacter: (charId: number, newName: string) => {
      const char = characterManager.getAllCharacters().find(c => c.id === charId);
      if (!char) return false;
      char.tStats.sName = newName;
      return true;
    },
    getCharacterName: (charId: number) => {
      const char = characterManager.getAllCharacters().find(c => c.id === charId);
      return char ? char.getName() : null;
    },
    getCharacterPersonality: (charId: number) => {
      const char = characterManager.getAllCharacters().find(c => c.id === charId);
      if (!char) return null;
      return { ...char.tStats.personality };
    },
    // ── UI Panel helpers ──────────────────────────────────────
    getResearchPanelVisible: () => uiManager.isResearchPanelVisible(),
    getGoalsPanelVisible: () => uiManager.isGoalsPanelVisible(),
    toggleResearchPanel: () => uiManager.toggleResearchPanel(),
    toggleGoalsPanel: () => uiManager.toggleGoalsPanel(),
    demolishObject: (name: string, tileX: number, tileY: number) => {
      const obj = EnvObjectManager.getObjects().find(o =>
        o.sName === name && o.tileX === tileX && o.tileY === tileY
      );
      if (!obj) return false;
      const refund = obj.getVaporizeMatterYield();
      EnvObjectManager.removeObject(obj);
      GameRules.addMatter(refund);
      return refund;
    },
    cuffCharacter: (charId: number) => {
      const char = characterManager.getAllCharacters().find(c => c.id === charId);
      if (!char) return false;
      char.bCuffed = !char.bCuffed;
      return char.bCuffed;
    },
    /** Test helper: build a room directly (floors + walls, instantly built). */
    buildRoomAt: (cx: number, cy: number, radius = 2) => {
      let cost = 0;
      const tiles: { x: number; y: number }[] = [];
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const x = cx + dx, y = cy + dy;
          const t = grid.get(x, y);
          if (t === TileType.SPACE || t === TileType.FLOOR_PENDING || t === TileType.WALL_PENDING) {
            grid.set(x, y, TileType.FLOOR);
            cost++;
            tiles.push({ x, y });
          }
        }
      }
      if (tiles.length > 0) {
        wallAutoGen.update(tiles);
        roomManager.markDirty(tiles);
        roomManager.update();
      }
      return cost;
    },
    /** Test helper: build a sealed room with full oxygen. Returns room tiles. */
    buildSealedRoom: (cx: number, cy: number, radius = 2) => {
      // Build the room
      const tiles: { x: number; y: number }[] = [];
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const x = cx + dx, y = cy + dy;
          const t = grid.get(x, y);
          if (t === TileType.SPACE || t === TileType.FLOOR_PENDING || t === TileType.WALL_PENDING) {
            grid.set(x, y, TileType.FLOOR);
            tiles.push({ x, y });
          }
        }
      }
      if (tiles.length > 0) {
        wallAutoGen.update(tiles);
        roomManager.markDirty(tiles);
        roomManager.update();
      }
      // Set all detected rooms covering these tiles as sealed with full O2
      const seen = new Set<number>();
      for (const t of tiles) {
        const room = roomManager.getRoomAt(t.x, t.y);
        if (room && !seen.has(room.id)) {
          seen.add(room.id);
          room.sealed = true;
          oxygenSystem.setRoomO2(room, 255);
        }
      }
      return tiles;
    },
    // ── Animation helpers ──────────────────────────────────
    getAnimationInfo: () => ({
      citizenClips: characterRenderer.getCitizenClipCount(),
      spacesuitClips: characterRenderer.getSpacesuitClipCount(),
      hasSkeleton: characterRenderer.hasCitizenSkeleton(),
    }),
    debugCharMaterials: () => characterRenderer.debugMaterials(), // debug helper for character material inspection
    // ── Faction & Event System helpers ──────────────────────
    createNewTeamID: (behavior: number) => Base.createNewTeamID(behavior),
    getTeamFactionBehavior: (teamId: number) => Base.getTeamFactionBehavior(teamId),
    isFriendlyTeams: (teamA: number, teamB: number) => Base.isFriendly(teamA, teamB),
    isHostileInBase: () => Base.isHostileInBase(),
    getBaseEvents: () => ({ ...BASE_EVENT }),
    getEventPriority: (eventType: string) => EVENT_DATA[eventType]?.nPriority ?? null,
    getAllEventData: () => {
      const result: Record<string, { nPriority: number; nLogVisibleTime: number }> = {};
      for (const [key, val] of Object.entries(EVENT_DATA)) {
        result[key] = { ...val };
      }
      return result;
    },
    getFactionBehavior: () => ({ ...FACTION_BEHAVIOR }),
    // ── EnvObject property helpers ────────────────────────────
    getObjectDef: (name: string) => getObjectData(name),
    getObjectsByFunc: (func: string) => getObjsByFunc(func),
    resolveAlias: (name: string) => resolveAlias(name),
    /** Test helper: instantly complete all pending tile builds. */
    completePendingBuilds: () => {
      let count = 0;
      for (let y = 0; y < grid.height; y++) {
        for (let x = 0; x < grid.width; x++) {
          const t = grid.get(x, y);
          if (t === TileType.FLOOR_PENDING) {
            grid.set(x, y, TileType.FLOOR);
            count++;
          } else if (t === TileType.WALL_PENDING) {
            grid.set(x, y, TileType.WALL);
            count++;
          }
        }
      }
      // Clear build_tile commands
      for (const cmd of CommandQueue.getAllActive()) {
        if (cmd.type === 'build_tile') CommandQueue.complete(cmd.id);
      }
      // Force room re-detection
      roomManager.markDirty([]);
      roomManager.update();
      return count;
    },
    // ── Diamond Footprint & Asteroid helpers ─────────────────
    getDiamondFootprint: (tx: number, ty: number, w: number, h: number, flipX?: boolean, flipY?: boolean) =>
      getDiamondFootprint(tx, ty, w, h, flipX, flipY),
    getAsteroidCount: () => {
      let count = 0;
      for (let y = 0; y < grid.height; y++) {
        for (let x = 0; x < grid.width; x++) {
          if (isAsteroid(grid.get(x, y))) count++;
        }
      }
      return count;
    },
    /** Get tile value at position (for asteroid decay testing). */
    getTileValue: (x: number, y: number) => grid.get(x, y),
    /** Place an asteroid tile at position for testing. */
    placeAsteroid: (x: number, y: number) => {
      grid.set(x, y, 1024); // ASTEROID_VALUE_START
    },
    /** Demolish tiles and return refund (for testing). */
    demolishTiles: (tiles: { x: number; y: number }[]) => {
      return buildSystem.demolish(tiles);
    },
    vaporizeTiles: (tiles: { x: number; y: number }[]) => {
      return buildSystem.vaporize(tiles);
    },
    /** Check if wall can be placed at position (Lua: World.canBuildWall). */
    canBuildWall: (x: number, y: number) => buildSystem.canBuildWall(x, y),
    /** Get tile HP at position. */
    getTileHP: (x: number, y: number) => grid.getTileHP(x, y),
    /** Set tile HP directly for testing. */
    damageTile: (x: number, y: number, amount: number) => grid.damageTile(x, y, amount),
    /** Place a wall tile for testing. */
    placeWall: (x: number, y: number) => grid.set(x, y, 4), // TileType.WALL = 4
    /** Place walls via BuildSystem (returns cost). */
    buildWalls: (tiles: { x: number; y: number }[], matter: number) => buildSystem.placeWalls(tiles, matter),
    /** Get initial crew flags for testing. */
    getCrewFlags: () => {
      const chars = characterManager.getAllCharacters();
      return chars.map(c => ({
        name: c.getName(),
        bBaseFounder: c.bBaseFounder,
        bImmuneToParasite: c.bImmuneToParasite,
        nMorale: c.nMorale,
        energy: c.needs.energy,
        hunger: c.needs.hunger,
      }));
    },
    // ── Sprint 2 Visual Polish test helpers ──────────────────
    /** Camera shake test: trigger shake and return state. */
    triggerCameraShake: (mag: number, dur: number) => {
      cameraController.shake(mag, dur);
      return true;
    },
    /** Camera zoom test: return current zoom level. */
    getCameraZoom: () => cameraController.zoom,
    /** Fire particles: return count of active fire particle tiles. */
    getFireParticleTileCount: () => fireParticles ? (fireParticles as any).fires?.size ?? 0 : 0,
    /** Projectile renderer: return count of active beam meshes. */
    getProjectileBeamCount: () => projectileRenderer ? (projectileRenderer as any).beams?.size ?? 0 : 0,
    /** Get active projectile count. */
    getActiveProjectileCount: () => projectileManager.getActiveProjectiles().length,
    /** Room lighting tint for a specific room. */
    getRoomLightingTint: (roomId: number) => {
      const room = roomManager.getRooms().find(r => r.id === roomId);
      if (!room) return null;
      return lighting.getRoomTint(room.zone, room.nLightingScheme, room.nLightFadeTimer);
    },
    /** Per-tile light map for a room (ceiling light gradients). */
    getRoomLightMap: (roomId: number) => {
      const room = roomManager.getRooms().find(r => r.id === roomId);
      if (!room) return null;
      const map = lighting.computeTileLightMap(room);
      const result: Record<string, number> = {};
      for (const [key, val] of map) result[key] = val;
      return result;
    },
    /** Spawn meteor trail effect at tile. */
    spawnMeteorTrail: (x: number, y: number) => {
      effectParticles.spawnMeteorTrail(x, y);
      return true;
    },
    /** Spawn construction sparks at tile. */
    spawnSparks: (x: number, y: number) => {
      effectParticles.spawnSparks(x, y);
      return true;
    },
    /** Get effect particles count. */
    getEffectCount: () => (effectParticles as any).effects?.length ?? 0,
    // ── Localization helpers ──────────────────────────────────
    getLine: (code: string) => locLine(code),
    getLanguage: () => getLanguage(),
    getAvailableLanguages: () => getAvailableLanguages(),
    // ── Beacon system ────────────────────────────────────────
    placeBeacon: (tx: number, ty: number) => {
      const squads = SquadList.getAllSquads();
      let squad = squads[0];
      if (!squad) {
        squad = SquadList.createSquad('Alpha Squad');
        // Auto-add emergency chars
        for (const c of characterManager.getCharacters()) {
          if (c.tStats.nTeam === 1 && c.tStats.nJob === 5 && c.isAlive()) {
            squad.addMember(c.id);
          }
        }
      }
      EmergencyBeacon.placeAt(squad.name, tx, ty, squad.getSize());
      return { squadName: squad.name, tx, ty };
    },
    removeBeacon: (squadName: string) => EmergencyBeacon.removeBeacon(squadName),
    getBeacons: () => {
      const result: Array<{ squadName: string; tx: number; ty: number; eViolence: number; tMode: string }> = [];
      for (const [name, b] of EmergencyBeacon.getAllBeacons()) {
        result.push({ squadName: name, tx: b.tx, ty: b.ty, eViolence: b.eViolence, tMode: b.tMode });
      }
      return result;
    },
    getSquads: () => SquadList.getAllSquads().map(s => ({ id: s.id, name: s.name, size: s.getSize() })),
    createSquad: (name: string) => {
      const s = SquadList.createSquad(name);
      return { id: s.id, name: s.name };
    },
    addToSquad: (squadId: number, charId: number) => {
      const s = SquadList.getSquad(squadId);
      if (s) s.addMember(charId);
    },
    // ── Room danger state ────────────────────────────────────
    isRoomDangerous: (tx: number, ty: number) => {
      const room = roomManager.getRoomAt(tx, ty);
      return room ? room.isDangerous() : false;
    },
    roomHasHostiles: (tx: number, ty: number) => {
      const room = roomManager.getRoomAt(tx, ty);
      return room ? room.hasHostiles() : false;
    },
    // ── Room claim/unclaim ────────────────────────────────────
    claimRoom: (tx: number, ty: number) => {
      const room = roomManager.getRoomAt(tx, ty);
      if (room) room.claim();
    },
    unclaimRoom: (tx: number, ty: number) => {
      const room = roomManager.getRoomAt(tx, ty);
      if (room) room.unclaim();
    },
    // ── Emergency alarm ───────────────────────────────────────
    setEmergencyAlarm: (tx: number, ty: number, on: boolean) => {
      const room = roomManager.getRoomAt(tx, ty);
      if (room) room.setEmergencyAlarmOn(on);
      return room?.isEmergencyAlarmOn() ?? false;
    },
    getEmergencyAlarm: (tx: number, ty: number) => {
      const room = roomManager.getRoomAt(tx, ty);
      return room?.isEmergencyAlarmOn() ?? false;
    },
    // ── P4: Debug menu ──────────────────────────────────────
    isDebugMenuVisible: () => debugMenu.isVisible(),
    debugResearchOne: () => {
      const all = researchSystem.getAllResearch();
      for (const [id, r] of Object.entries(all)) {
        if (r.available && !r.completed) {
          researchSystem.startResearch(id);
          researchSystem.addProgress(r.nCost);
          return id;
        }
      }
      return null;
    },
    debugAddMatter: (amount: number) => GameRules.addMatter(amount),
    debugMakeAllHappy: () => {
      for (const c of characterManager.getCharacters()) c.addMorale(100);
    },
    debugMakeAllSad: () => {
      for (const c of characterManager.getCharacters()) c.addMorale(-100);
    },
    // ── P4: Tutorial system ─────────────────────────────────
    isTutorialActive: () => tutorialSystem.isActive(),
    getTutorialStage: () => tutorialSystem.getCurrentStage(),
    getTutorialStageCount: () => tutorialSystem.getTotalStages(),
    getTutorialConditions: () => tutorialSystem.getCompletedConditions(),
    // ── P4: PostFX ──────────────────────────────────────────
    isPostFXEnabled: () => threeRenderer.postfx?.enabled ?? false,
    setPostFXEnabled: (v: boolean) => { if (threeRenderer.postfx) threeRenderer.postfx.enabled = v; },
    // ── P4: Save slots ──────────────────────────────────────
    saveToSlot: (slotName: string) => {
      const ok = saveLoadSystem.saveToStorage(slotName);
      if (ok) SaveSlotPanel.saveMeta(slotName, characterManager.getPopulation(), GameRules.nMatter);
      return ok;
    },
    loadFromSlot: (slotName: string) => saveLoadSystem.loadFromStorage(slotName),
    listSaveSlots: () => {
      const slots: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('df9_save_')) slots.push(key);
      }
      return slots;
    },
    deleteSaveSlot: (slotName: string) => {
      localStorage.removeItem(slotName);
      localStorage.removeItem(slotName.replace('df9_save_', 'df9_meta_'));
    },
    // ── P4: Settings ────────────────────────────────────────
    isAutosaveEnabled: () => activeAutoSave?.isEnabled() ?? true,
    setAutosaveEnabled: (v: boolean) => activeAutoSave?.setEnabled(v),
    getDerelicts: () => derelictSystem.getDerelicts(),
    spawnDerelict: () => derelictSystem.spawnDerelict(),
    exploreDerelict: (shipId: string, charId: number) => {
      const char = characterManager.getAllCharacters().find(c => c.id === charId);
      if (!char) return null;
      return derelictSystem.exploreDerelict(shipId, char);
    },
    getDockedShips: () => dockingSystem.getDockedShips(),
    spawnTrader: () => dockingSystem.spawnTrader(),
    spawnImmigration: () => dockingSystem.spawnImmigrationShip(),
    buyCargo: (shipId: string, item: string, qty: number) => dockingSystem.buyCargo(shipId, item as any, qty),
    sellMatter: (shipId: string, amount: number) => dockingSystem.sellMatter(shipId, amount),
    showDialogue: (charId: number, text: string) => dialogueSystem.showBubble(charId, text),
    spawnExplosion: (x: number, y: number, intensity?: number) => explosionSystem.spawnExplosion(x, y, intensity ?? 1),
    spawnSparksEffect: (x: number, y: number, count?: number) => explosionSystem.spawnSparks(x, y, count ?? 10),
  };

  requestAnimationFrame(gameLoop);
}

function createSpaceBackground(threeRenderer: ThreeRenderer) {
  const tex = getTexture('space_bg');
  if (!tex || !tex.image) return;

  const bgW = tex.image.width || 512;
  const bgH = tex.image.height || 512;
  const worldW = GRID_W * TILE_W;
  const worldH = GRID_H * TILE_HALF_H;

  // Brighten the nebula tiles (original is very dark)
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    depthWrite: false,
    color: 0x333344, // Slight blue-purple tint to enhance nebula visibility
  });
  // Additive blend: brightens the underlying black scene
  mat.blending = THREE.AdditiveBlending;

  for (let y = -bgH; y < worldH + bgH; y += bgH) {
    for (let x = -bgW; x < worldW + bgW; x += bgW) {
      const geo = new THREE.PlaneGeometry(bgW, bgH);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x + bgW / 2, -(y + bgH / 2), -1);
      threeRenderer.scene.add(mesh);
    }
  }

  // Also render a non-additive base pass for the actual nebula detail
  const baseMat = new THREE.MeshBasicMaterial({
    map: tex,
    depthWrite: false,
  });
  for (let y = -bgH; y < worldH + bgH; y += bgH) {
    for (let x = -bgW; x < worldW + bgW; x += bgW) {
      const geo = new THREE.PlaneGeometry(bgW, bgH);
      const mesh = new THREE.Mesh(geo, baseMat);
      mesh.position.set(x + bgW / 2, -(y + bgH / 2), -2);
      threeRenderer.scene.add(mesh);
    }
  }

  // Scatter nebula cloud overlays from Elements.png (Lua: Backgrounds/Elements)
  const elemTex = getTexture('space_elements');
  if (elemTex) {
    const elemMat = new THREE.MeshBasicMaterial({
      map: elemTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
    });
    // Scatter a few large element quads at random positions
    const rng = (seed: number) => {
      let s = seed;
      return () => { s = (s * 1664525 + 1013904223) & 0x7fffffff; return s / 0x7fffffff; };
    };
    const rand = rng(42);
    const elemSize = 2048;
    for (let i = 0; i < 8; i++) {
      const ex = rand() * worldW - elemSize * 0.3;
      const ey = rand() * worldH - elemSize * 0.3;
      const scale = 1.5 + rand() * 2;
      const geo = new THREE.PlaneGeometry(elemSize * scale, elemSize * scale);
      const mesh = new THREE.Mesh(geo, elemMat);
      mesh.position.set(ex + elemSize * scale / 2, -(ey + elemSize * scale / 2), -0.5);
      // Random rotation for variety
      mesh.rotation.z = rand() * Math.PI * 2;
      threeRenderer.scene.add(mesh);
    }
  }
}

function createSeedPod(threeRenderer: ThreeRenderer, tileX: number, tileY: number) {
  const pos = tileToScreen(tileX, tileY);
  const tex = getTexture('seedpod01');

  if (tex && tex.image) {
    // Use the actual seed pod sprite
    const spriteW = tex.image.width || 128;
    const spriteH = tex.image.height || 128;
    const geo = new THREE.PlaneGeometry(spriteW, spriteH);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      alphaTest: 0.01,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(
      pos.x + TILE_HALF_W,
      -(pos.y + TILE_HALF_H),
      15000 + pos.y,
    );
    threeRenderer.scene.add(mesh);
  } else {
    // Fallback: octahedron placeholder
    const geo = new THREE.OctahedronGeometry(12, 0);
    const mat = new THREE.MeshBasicMaterial({ color: 0xdfa200 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(
      pos.x + TILE_HALF_W,
      -(pos.y + TILE_HALF_H),
      15000 + pos.y,
    );
    threeRenderer.scene.add(mesh);
  }

  // Glow ring around the pod
  const ringGeo = new THREE.RingGeometry(16, 20, 16);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xdfa200,
    transparent: true,
    opacity: 0.4,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.set(
    pos.x + TILE_HALF_W,
    -(pos.y + TILE_HALF_H),
    15000 + pos.y - 1,
  );
  threeRenderer.scene.add(ring);
}

function tileName(type: number): string {
  const names: Record<number, string> = {
    1: 'Space', 4: 'Wall', 5: 'Door', 6: 'Destroyed', 8: 'Floor',
    9: 'Floor (building)', 10: 'Wall (building)',
  };
  return names[type] || 'Unknown';
}
