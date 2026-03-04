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
import { OxygenSystem } from './oxygen/OxygenSystem';
import { CharacterManager } from './characters/CharacterManager';
import { Character } from './characters/Character';
import { GameRules, type TickableSystem, MAT_BUILD_FLOOR, MAT_VAPE_FLOOR } from './core/GameRules';
import { EnvObjectManager } from './envobjects/EnvObjectManager';
import { EnvObject } from './envobjects/EnvObject';
import { tObjects, resolveAlias, getObjectData, getObjectsByFunctionality as getObjsByFunc } from './envobjects/EnvObjectData';
import { ObjectPlacement } from './building/ObjectPlacement';
import { Base } from './core/Base';
import { PowerSystem } from './power/PowerSystem';
import { Lighting } from './lighting/Lighting';
import { EventController } from './events/EventController';
import { Fire } from './hazards/Fire';
import { ProjectileManager } from './hazards/Projectile';
import { SaveLoadSystem } from './save/SaveLoad';
import { researchSystem } from './research/ResearchSystem';
import { RESEARCH_DEFS } from './research/ResearchData';
import { GoalSystem } from './goals/GoalSystem';
import { HintSystem } from './hints/HintSystem';
import { SoundManager } from './audio/SoundManager';
import { MusicSystem } from './audio/MusicSystem';
import { SpatialAudio } from './audio/SpatialAudio';
import { generateWorld } from './world/WorldGen';
import { ZoneType, ZONE_SPRITES } from './world/ZoneType';
import { GRID_W, GRID_H, TILE_W, TILE_HALF_W, TILE_HALF_H } from './config';
import { tileToScreen } from './world/IsometricUtils';
import { TileType } from './world/TileTypes';
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
import { MALADY_DEFS, getSpawnableDiseases, getMaladyByTier } from './malady/MaladyData';
import {
  CAUSE_OF_DEATH, FACTION_BEHAVIOR, TEAM_ID_PLAYER,
  BUILDER, MINER, TECHNICIAN, DOCTOR, BOTANIST, SCIENTIST,
  STATUS_SICK, STATUS_ILL, STATUS_INCAPACITATED,
  NEEDS_HUNGER_STARVATION,
} from './characters/CharacterConstants';
import { BASE_EVENT, EVENT_DATA } from './core/Base';
import { Log } from './log/Log';
import { LOG_TYPES } from './log/LogData';
import { LINE_CODES } from './log/LineCodes';

// ── Tick adapters (same as GameScene) ─────────────────────────

class OxygenTickAdapter implements TickableSystem {
  constructor(private system: OxygenSystem) {}
  onTick(dt: number) { this.system.update(dt * 1000); }
}

class CharacterTickAdapter implements TickableSystem {
  constructor(private manager: CharacterManager) {}
  onTick(dt: number) { this.manager.update(dt * 1000); }
}

// ── Main ──────────────────────────────────────────────────────

const container = document.body;

// Loading screen
const loadingEl = document.createElement('div');
loadingEl.style.cssText = `
  position:fixed;top:0;left:0;width:100%;height:100%;
  background:#000;color:#dfa200;font-family:monospace;
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

function startGame() {
  const sceneManager = new SceneManager(container);

  // Define scene transitions
  const startMenu = new StartMenuState({
    onNewGame: () => sceneManager.switchTo(newGameScreen),
    onTutorial: () => enterGameState(sceneManager, { tutorial: true }),
    onLoadBase: () => enterGameState(sceneManager, { loadSave: true }),
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
  const musicSystem = new MusicSystem();
  musicSystem.startGame();

  // ── Initialize Three.js renderer ──────────────────────────
  const threeRenderer = new ThreeRenderer(container);
  const cameraController = new CameraController3D(threeRenderer);

  // ── Initialize game systems (unchanged logic) ─────────────
  GameRules.init();
  const grid = new TileGrid();
  const tileRenderer = new TileRenderer3D(threeRenderer.scene, grid);
  const wallAutoGen = new WallAutoGen(grid);
  const buildSystem = new BuildSystem(grid, wallAutoGen);
  const buildCursor = new BuildCursor(threeRenderer.scene, grid);
  const roomManager = new RoomManager(grid);
  tileRenderer.setRoomManager(roomManager);
  const oxygenSystem = new OxygenSystem(roomManager);
  const characterManager = new CharacterManager(grid, roomManager);
  const objectPlacement = new ObjectPlacement(grid, roomManager);

  // Character renderer
  const characterRenderer = new CharacterRenderer(threeRenderer.scene, threeRenderer.overlayScene);
  characterManager.setRenderer(characterRenderer);

  // Env object renderer
  const envObjRenderer = new EnvObjectRenderer(threeRenderer.scene);

  // Prop renderer for 3D pickup/held-item models
  const propRenderer = new PropRenderer(threeRenderer.scene);
  propRenderer.preload([
    'BodyBag', 'FoodBar', 'FoodCrate', 'AsteroidChunk',
    'Pistol', 'Rifle', 'SpaceGun', 'Builder', 'Weldammer',
    'FireExtinguisher', 'Datapad', 'FoodTray', 'Mug01',
  ]);

  Malady.reset();
  EnvObjectManager.init(roomManager);

  // Wire EnvObjectManager lifecycle → EnvObjectRenderer
  EnvObjectManager.onObjectCreated = (id, obj) => {
    envObjRenderer.addObject(String(id), obj.tileX, obj.tileY, obj.sName, obj.bBuilt);
  };
  EnvObjectManager.onObjectRemoved = (id) => {
    envObjRenderer.removeObject(String(id));
  };
  // Wire EnvObject visual updates (condition change, ghost→built) → renderer
  EnvObject.onVisualUpdate = (id, obj) => {
    envObjRenderer.updateObject(String(id), obj.bBuilt, obj.nCondition, obj.getSpriteKey());
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
        })),
    }));
  });

  const powerSystem = new PowerSystem(grid, roomManager);
  const lighting = new Lighting(roomManager);
  lighting.init();
  const eventController = new EventController();
  eventController.init();

  // Wire event callbacks
  eventController.onImmigration = (count) => {
    for (let i = 0; i < count; i++) {
      characterManager.spawnCharacter();
    }
  };
  eventController.onMeteorLand = () => {
    // Pick a random floor tile in a random room
    const rooms = roomManager.getRooms();
    if (rooms.length === 0) return;
    const room = rooms[Math.floor(Math.random() * rooms.length)];
    if (room.tiles.length === 0) return;
    const tile = room.tiles[Math.floor(Math.random() * room.tiles.length)];

    // Destroy the tile — becomes a breach point (set() auto-marks dirty)
    grid.set(tile.x, tile.y, TileType.WALL_DESTROYED);

    // Start a fire at the impact site
    fire.startFire(tile.x, tile.y);

    // Force room re-detection (breach)
    roomManager.markDirty([tile]);
  };
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
  const fire = new Fire();
  fire.init();
  characterManager.setFire(fire);
  fire.tileCheck = (x, y) => grid.get(x, y);
  const projectileManager = new ProjectileManager();
  projectileManager.init();
  characterManager.setProjectileManager(projectileManager);
  const saveLoadSystem = new SaveLoadSystem(grid, roomManager);

  // Goal system
  const goalSystem: GoalSystem = new GoalSystem({
    getPopulation: () => characterManager.getPopulation(),
    getMatter: () => GameRules.nMatter,
    getBaseTileCount: () => {
      return roomManager.getRooms().reduce((sum, r) => sum + r.size, 0);
    },
    getBuiltEverything: () => {
      const builtable = Object.keys(tObjects).filter(k => tObjects[k].showInObjectMenu);
      const builtNames = new Set(
        EnvObjectManager.getObjects().filter(o => o.bBuilt).map(o => o.sName),
      );
      const built = builtable.filter(k => builtNames.has(k)).length;
      return { done: built >= builtable.length, built, total: builtable.length };
    },
    getAllTechs: () => {
      const all = Object.entries(RESEARCH_DEFS).filter(([, d]) => !d.bDiscoverOnly);
      const completedSet = new Set(researchSystem.getCompletedList());
      const completed = all.filter(([id]) => completedSet.has(id)).length;
      return { done: completed >= all.length, completed, total: all.length };
    },
    getHappyCitizenCount: () => {
      return characterManager.getCharacters().filter(c => c.nMorale > 90).length;
    },
    getAllPossessions: () => {
      const possTypes = Object.entries(ITEM_TEMPLATES)
        .filter(([, t]) => t.bStuff && t.bDisplayable)
        .map(([name]) => name);
      const ownedNames = new Set<string>();
      for (const char of characterManager.getCharacters()) {
        for (const item of char.inventory.getAll()) {
          ownedNames.add(item.sTemplate);
        }
      }
      const collected = possTypes.filter(n => ownedNames.has(n)).length;
      return { done: collected >= possTypes.length, collected, total: possTypes.length };
    },
    getFinalSiegeStatus: () => {
      const { fired, startTime } = eventController.getCompoundEventState();
      if (!fired || startTime < 0) return false;
      if (GameRules.simTime < startTime + 120) return false;
      // At least one alive, non-incapacitated citizen
      const chars = characterManager.getAllCharacters();
      const hasFriendly = chars.some(
        c => c.tStats.nTeam === TEAM_ID_PLAYER && c.isAlive() && !Malady.isIncapacitated(c),
      );
      if (!hasFriendly) return false;
      // All hostiles dead or incapacitated
      const allHostilesDead = chars
        .filter(c => c.tStats.nTeam !== TEAM_ID_PLAYER && c.tStats.nTeam !== 0)
        .every(c => !c.isAlive() || Malady.isIncapacitated(c));
      return allHostilesDead;
    },
  });

  // Hint system
  const hintSystem = new HintSystem({
    // ── Basics ──────────────────────────────────────────────────
    hasEnclosedRooms: () => roomManager.getRooms().length > 0,
    hasZonedRoom: () => roomManager.getRooms().some(r => r.zone !== ZoneType.PLAIN),
    hasStartedResearch: () =>
      researchSystem.getActiveResearch() !== null || researchSystem.getCompletedList().length > 0,
    hasBuiltObject: () => EnvObjectManager.getObjects().some(o => o.bBuilt),
    getPopulation: () => characterManager.getPopulation(),
    hasHostiles: () => characterManager.getHostileCount() > 0,
    // ── Resources ───────────────────────────────────────────────
    getMatter: () => GameRules.nMatter,
    // ── Jobs ────────────────────────────────────────────────────
    getJobCount: (job: number) =>
      characterManager.getCharacters().filter(
        c => c.isAlive() && c.tStats.nStatus !== STATUS_INCAPACITATED && c.getJob() === job,
      ).length,
    // ── Construction ────────────────────────────────────────────
    hasPendingBuildOrders: () =>
      CommandQueue.getAllActive().some(c => c.type === 'build_tile' || c.type === 'build_object'),
    hasPendingMineOrders: () =>
      CommandQueue.getAllActive().some(c => c.type === 'mine'),
    getDamagedObjectCount: () =>
      EnvObjectManager.getObjects().filter(o => o.bBuilt && o.isDamaged()).length,
    // ── Objects ─────────────────────────────────────────────────
    hasBuiltObjectType: (sName: string) =>
      EnvObjectManager.getObjects().some(o => o.sName === sName && o.bBuilt),
    hasBuiltObjectFunc: (func: string) => {
      const names = new Set(getObjsByFunc(func));
      return EnvObjectManager.getObjects().some(o => o.bBuilt && names.has(o.sName));
    },
    // ── Environment ─────────────────────────────────────────────
    getLowOxygenFraction: () => {
      const pop = characterManager.getPopulation();
      if (pop === 0) return 0;
      // Count living player chars in rooms with oxygen < 400 (OXYGEN_LOW)
      const low = characterManager.getCharacters().filter(c => {
        if (!c.isAlive()) return false;
        const room = roomManager.getRoomAt(c.tileX, c.tileY);
        return !room || room.oxygen < 400;
      }).length;
      return low / pop;
    },
    hasRoomsWithPowerDeficit: () =>
      roomManager.getRooms().some(r => r.nPowerOutput > 0 && r.nPowerSupply < 0),
    allRoomsLackPower: () => {
      const rooms = roomManager.getRooms();
      return rooms.length > 0 && rooms.every(r => r.nPowerOutput === 0);
    },
    // ── Characters ──────────────────────────────────────────────
    hasSickCharacter: () =>
      characterManager.getCharacters().some(
        c => c.isAlive() && (c.tStats.nStatus === STATUS_SICK || c.tStats.nStatus === STATUS_ILL),
      ),
    hasIncapacitatedCharacter: () =>
      characterManager.getCharacters().some(
        c => c.isAlive() && c.tStats.nStatus === STATUS_INCAPACITATED,
      ),
    hasStarvingCitizen: () =>
      characterManager.getCharacters().some(
        c => c.isAlive() && c.needs.hunger < NEEDS_HUNGER_STARVATION,
      ),
    hasMinerWithRocks: () =>
      characterManager.getCharacters().some(
        c => c.isAlive() && c.getJob() === MINER && c.heldItem === 'Rock',
      ),
    // ── Pickups / Zones ─────────────────────────────────────────
    hasCorpse: () =>
      characterManager.getPickups().some(p => p.sName === 'Corpse' && !p.bPickedUp),
    hasHospitalZone: () =>
      roomManager.getRooms().some(r => r.zone === ZoneType.INFIRMARY),
    hasGardenZone: () =>
      roomManager.getRooms().some(r => r.zone === ZoneType.GARDEN),
    hasGardenPlants: () =>
      EnvObjectManager.getObjects().some(
        o => o.bBuilt && (o.sName === 'HydroPlant' || o.sName === 'space_tree'),
      ),
    hasActiveResearch: () => researchSystem.getActiveResearch() !== null,
  });

  // Wire save/load data providers
  saveLoadSystem.getCharacterData = () => characterManager.getCharacters().map(c => ({
    id: c.id, tileX: c.tileX, tileY: c.tileY,
    name: c.getName(), job: c.getJob(), team: c.tStats.nTeam,
    hp: c.getHP(), maxHP: c.tStats.nMaxHP, status: c.tStats.nStatus,
    xp: c.tStats.nXP, competency: { ...c.tStats.tCompetency },
    morale: c.nMorale, anger: c.nAnger, bOnShift: c.bOnShift,
    weapon: c.weapon, bSpacesuit: c.bSpacesuit, nSuitOxygen: c.nSuitOxygen,
    maladies: c.maladies.map(m => ({ ...m })),
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
  saveLoadSystem.getGoalData = () => goalSystem.getSaveData();
  saveLoadSystem.getHintData = () => hintSystem.getSaveData();
  saveLoadSystem.loadGoalData = (data) => goalSystem.loadSaveData(data);
  saveLoadSystem.loadHintData = (data) => hintSystem.loadSaveData(data);

  // Register subsystems
  GameRules.registerSystem(2, new OxygenTickAdapter(oxygenSystem));
  GameRules.registerSystem(11, new CharacterTickAdapter(characterManager));

  // ── Create space background ───────────────────────────────
  createSpaceBackground(threeRenderer);

  // ── Generate world ────────────────────────────────────────
  const landingZone = initData.landingZone as { x: number; y: number; density: number } | undefined;
  const worldResult = generateWorld(grid, wallAutoGen, landingZone);

  roomManager.markDirty([]);
  roomManager.update();

  // Spawn the initial 3 spacewalking settlers
  characterManager.spawnInitialCrew(worldResult.crewSpawns);

  const cx = Math.floor(grid.width / 2);
  const cy = Math.floor(grid.height / 2);
  tileRenderer.renderRegion(cx - 20, cy - 20, cx + 20, cy + 20);

  // Place the seed pod (BaseSeed) at center — a visible marker
  createSeedPod(threeRenderer, worldResult.seedPodX, worldResult.seedPodY);

  // ── Input system ──────────────────────────────────────────
  const inputManager = new InputManager(threeRenderer.getCanvas(), cameraController);

  let buildMode: BuildMode = 'none';
  let showO2Overlay = false;
  let selectedZone: ZoneType = ZoneType.GARDEN;
  let selectedEntity: SelectedEntity = null;
  const prevCommandTiles = new Set<string>();

  // Keyboard bindings
  inputManager.onKeyPress('KeyC', () => { buildMode = buildMode === 'room' ? 'none' : 'room'; });
  inputManager.onKeyPress('KeyB', () => { buildMode = buildMode === 'floor' ? 'none' : 'floor'; });
  inputManager.onKeyPress('KeyD', () => { buildMode = buildMode === 'door' ? 'none' : 'door'; });
  inputManager.onKeyPress('KeyX', () => { buildMode = buildMode === 'demolish' ? 'none' : 'demolish'; });
  inputManager.onKeyPress('KeyZ', () => { buildMode = buildMode === 'zone' ? 'none' : 'zone'; });
  inputManager.onKeyPress('KeyP', () => { buildMode = buildMode === 'object' ? 'none' : 'object'; });
  inputManager.onKeyPress('KeyM', () => { buildMode = buildMode === 'mine' ? 'none' : 'mine'; });
  inputManager.onKeyPress('Escape', () => {
    buildMode = 'none';
    buildCursor.cancelDrag();
    selectedEntity = null;
    uiManager.setSelectedEntity(null);
  });
  inputManager.onKeyPress('KeyO', () => { showO2Overlay = !showO2Overlay; });
  inputManager.onKeyPress('KeyI', () => { buildMode = 'none'; });
  inputManager.onKeyPress('KeyR', () => { uiManager.toggleJobRoster(); });
  inputManager.onKeyPress('Digit1', () => { GameRules.setTimeScale(1); });
  inputManager.onKeyPress('Digit2', () => { GameRules.setTimeScale(2); });
  inputManager.onKeyPress('Digit3', () => { GameRules.setTimeScale(4); });

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
      // Env objects at tile
      for (const obj of EnvObjectManager.getObjects()) {
        if (obj.tileX === hovered.x && obj.tileY === hovered.y) {
          const status = obj.bBuilt ? 'Built' : 'Building';
          info += `\n\n${obj.tData.friendlyName} [${status}]  Condition: ${Math.round(obj.nCondition)}%`;
        }
      }
      // Characters at tile
      for (const char of characterManager.getCharacters()) {
        if (char.tileX === hovered.x && char.tileY === hovered.y) {
          info += `\n\n${char.getName()} [${char.getJobName()}]  HP: ${char.getHP()}`;
          info += `\n  Task: ${char.currentTask?.name ?? 'Idle'}  Morale: ${char.nMorale}`;
          info += `\n  Energy: ${Math.round(char.needs.energy)}  Hunger: ${Math.round(char.needs.hunger)}`;
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
    onSave: () => saveLoadSystem.saveToStorage(),
    onLoad: () => saveLoadSystem.loadFromStorage(),
    onSpawn: () => characterManager.spawnCharacter(),
    onObjectSelected: (name) => { /* placeholder */ },
    getCharacters: () => characterManager.getCharacters(),
    getEnvObjects: () => EnvObjectManager.getObjects(),
    toggleO2Overlay: () => { showO2Overlay = !showO2Overlay; },
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
      if (!buildCursor.isDragging) return null;
      const count = buildCursor.dragTileCount;
      if (count === 0) return null;
      if (buildMode === 'demolish') {
        return { cost: count * MAT_VAPE_FLOOR, tileCount: count, mode: buildMode };
      }
      if (buildMode === 'room' || buildMode === 'floor' || buildMode === 'wall') {
        return { cost: count * MAT_BUILD_FLOOR, tileCount: count, mode: buildMode };
      }
      return null;
    },
    onDemolishObject: (obj) => {
      const refund = obj.getVaporizeMatterYield();
      EnvObjectManager.removeObject(obj);
      GameRules.nMatter += refund;
      Base.addAlert('build', `Demolished ${obj.tData.friendlyName}, refunded ${refund} matter`);
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
    roomManager.update();

    // Power distribution
    powerSystem.update();

    // Pending command overlays
    renderCommandOverlays();

    // Event controller
    eventController.setPopulation(characterManager.getPopulation());

    // Master tick
    GameRules.onTick(delta / 1000);

    // Sync 3D prop models for pickups and held items
    syncProps();

    // Goal, hint, disease, and music systems
    const gameDt = (delta / 1000) * GameRules.playerTimeScale;
    Malady.updateElapsedTime(gameDt);
    goalSystem.update(gameDt);
    hintSystem.update(gameDt);
    musicSystem.update(delta / 1000); // Music uses real time, not game time

    // Update audio listener position from camera
    SoundManager.setListenerPosition(cameraController.scrollX, cameraController.scrollY);
    SoundManager.setZoomDepth(Math.min(1, Math.max(0, (cameraController.zoom - 0.5) / 1.5)));

    // Room lighting tints (skip when O2 overlay is active — it has its own tinting)
    if (!showO2Overlay) {
      renderRoomLighting();
    }

    // Fire tile overlays
    renderFireOverlays();

    // O2 overlay (overrides room lighting tints)
    if (showO2Overlay) {
      renderO2Overlay();
    }

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

  function handleBuildInput() {
    const worldPos = inputManager.getWorldPointer();
    buildCursor.updateHover(worldPos.x, worldPos.y);
    const tile = buildCursor.hoveredTile;
    if (!tile) return;

    const isDragMode = buildMode === 'room' || buildMode === 'floor' ||
                       buildMode === 'wall' || buildMode === 'demolish';

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
      } else if (buildMode === 'zone') {
        const room = roomManager.getRoomAt(tile.x, tile.y);
        if (room) {
          room.zone = selectedZone;
          roomManager.persistZone(room);
          tileRenderer.rerenderRoom(room);
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
          if (cost > 0) onTilesChanged([tile]); // Re-detect rooms for door placement
        } else {
          Base.addAlert('build', 'No object selected — pick one from the list');
        }
      } else if (buildMode === 'mine') {
        const tileVal = grid.get(tile.x, tile.y);
        if (isAsteroid(tileVal)) {
          CommandQueue.addCommand('mine', tile.x, tile.y);
          Base.addAlert('mining', `Queued asteroid for mining at (${tile.x},${tile.y})`);
        } else {
          Base.addAlert('mining', `Not an asteroid at (${tile.x},${tile.y}) — tile type: ${tileVal}`);
        }
      } else if (isDragMode) {
        buildCursor.startDrag(tile.x, tile.y);
        buildCursor.updateDrag(tile.x, tile.y, buildMode as 'room' | 'floor' | 'wall' | 'demolish');
      }
    }

    // Left held — update drag
    if (inputManager.isLeftDown() && buildCursor.isDragging && isDragMode) {
      buildCursor.updateDrag(tile.x, tile.y, buildMode as 'room' | 'floor' | 'wall' | 'demolish');
    }

    // Left released — commit drag
    if (inputManager.leftJustReleased && buildCursor.isDragging) {
      const tiles = buildCursor.endDrag();
      if (tiles.length > 0) {
        if (buildMode === 'room') {
          const cost = buildSystem.buildRoom(tiles, GameRules.nMatter);
          GameRules.nMatter -= cost;
        } else if (buildMode === 'floor') {
          const cost = buildSystem.placeFloors(tiles, GameRules.nMatter);
          GameRules.nMatter -= cost;
        } else if (buildMode === 'wall') {
          const cost = buildSystem.placeWalls(tiles, GameRules.nMatter);
          GameRules.nMatter -= cost;
        } else if (buildMode === 'demolish') {
          const refund = buildSystem.demolish(tiles);
          GameRules.nMatter += refund;
        }
        onTilesChanged(tiles);
      }
    }

    // Hover ghost
    const noGhostModes = ['none', 'zone', 'object', 'mine'];
    if (!inputManager.isLeftDown() && !buildCursor.isDragging && !noGhostModes.includes(buildMode)) {
      buildCursor.showHoverGhost(buildMode as 'room' | 'floor' | 'wall' | 'door' | 'demolish');
    }
  }

  function onTilesChanged(tiles: { x: number; y: number }[]) {
    roomManager.markDirty(tiles);
  }

  function renderO2Overlay() {
    for (const room of roomManager.getRooms()) {
      const o2ratio = room.oxygen / 255;
      const r = Math.floor((1 - o2ratio) * 255);
      const g = Math.floor(o2ratio * 255);
      const tint = (r << 16) | (g << 8) | 0x40;
      for (const t of room.tiles) {
        tileRenderer.setTileTint(t.x, t.y, tint);
      }
    }
  }

  /** Apply room-based lighting tints via the Lighting system. */
  const prevLitTiles = new Set<string>();
  function renderRoomLighting() {
    const currentLit = new Set<string>();
    for (const room of roomManager.getRooms()) {
      const scheme = lighting.getRoomLightingScheme(room);
      const tint = lighting.getRoomTint(room.zone, scheme);
      // Only apply tint if not full white (normal lit)
      if (tint !== 0xffffff) {
        for (const t of room.tiles) {
          const key = `${t.x},${t.y}`;
          currentLit.add(key);
          tileRenderer.setTileTint(t.x, t.y, tint);
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
    getPopulation: () => characterManager.getPopulation(),
    getMatter: () => GameRules.nMatter,
    getRoomCount: () => roomManager.getRooms().length,
    getBuildMode: () => buildMode,
    getCharacters: () => characterManager.getCharacters().map(c => ({
      id: c.id, x: c.tileX, y: c.tileY, moving: c.moving, spacewalking: c.bSpacewalking,
      job: c.getJob(), taskName: c.currentTask?.name ?? null,
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
      id: r.id, zone: r.zone, tileCount: r.tiles.length,
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
    placeObject: (name: string, tileX: number, tileY: number) => {
      return objectPlacement.placeObject(name, tileX, tileY);
    },
    /** Create an already-built, powered object directly (bypasses placement validation). */
    createBuiltObject: (name: string, tileX: number, tileY: number) => {
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
    getGoalProgress: (goalName: string) => goalSystem.getProgress(goalName),
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
    getHintCount: () => hintSystem.getTotalHints(),
    saveGame: () => saveLoadSystem.saveToStorage('df9_test_save'),
    loadGame: () => saveLoadSystem.loadFromStorage('df9_test_save'),
    hasSave: () => saveLoadSystem.hasSave('df9_test_save'),
    deleteSave: () => saveLoadSystem.deleteSave('df9_test_save'),
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
    // ── Log / Journal System helpers ───────────────────────────
    addCharacterLog: (charId: number, logType: string, tData?: Record<string, any>) => {
      const char = characterManager.getAllCharacters().find(c => c.id === charId);
      if (!char) return null;
      const entry = Log.add(char, logType, tData ?? {}, false);
      return entry;
    },
    getCharacterLog: (charId: number) => {
      const char = characterManager.getAllCharacters().find(c => c.id === charId);
      if (!char) return [];
      return char.getLog().map(e => ({
        sLine: e.sLine,
        linecode: e.linecode,
        logType: e.logType,
        priority: e.priority,
        nTagScore: e.nTagScore,
      }));
    },
    getLogTypeCount: () => Object.keys(LOG_TYPES).length,
    getLineCodeCount: () => Object.keys(LINE_CODES).length,
    // ── Affinity & Familiarity helpers ────────────────────────
    getCharacterAffinity: (charId: number, topic: string) => {
      const char = characterManager.getAllCharacters().find(c => c.id === charId);
      if (!char) return null;
      return char.getAffinity(topic);
    },
    setCharacterAffinity: (charId: number, topic: string, value: number) => {
      const char = characterManager.getAllCharacters().find(c => c.id === charId);
      if (!char) return false;
      char.setAffinity(topic, value);
      return true;
    },
    getCharacterFamiliarity: (charId: number, otherId: number) => {
      const char = characterManager.getAllCharacters().find(c => c.id === charId);
      if (!char) return null;
      return char.getFamiliarity(otherId);
    },
    addCharacterFamiliarity: (charId: number, otherId: number, amount: number) => {
      const char = characterManager.getAllCharacters().find(c => c.id === charId);
      if (!char) return false;
      char.addFamiliarity(otherId, amount);
      return true;
    },
    getCharacterJobAffinity: (charId: number) => {
      const char = characterManager.getAllCharacters().find(c => c.id === charId);
      if (!char) return null;
      return char.getJobAffinity();
    },
    getAffinityIconAndColor: (aff: number) => {
      return Character.getAffinityIconAndColor(aff);
    },
    getCharacterRace: (charId: number) => {
      const char = characterManager.getAllCharacters().find(c => c.id === charId);
      if (!char) return null;
      return { raceId: char.getRace(), raceName: char.getRaceName(), bDoesNotBreathe: char.bDoesNotBreathe };
    },
    rollRace: () => Character.rollRace(),
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
      GameRules.nMatter += refund;
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
          room.oxygen = 255;
        }
      }
      return tiles;
    },
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

  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    depthWrite: false,
  });

  for (let y = -bgH; y < worldH + bgH; y += bgH) {
    for (let x = -bgW; x < worldW + bgW; x += bgW) {
      const geo = new THREE.PlaneGeometry(bgW, bgH);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x + bgW / 2, -(y + bgH / 2), -1);
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
