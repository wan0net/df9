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
import { GameRules, type TickableSystem } from './core/GameRules';
import { EnvObjectManager } from './envobjects/EnvObjectManager';
import { EnvObject } from './envobjects/EnvObject';
import { ObjectPlacement } from './building/ObjectPlacement';
import { Base } from './core/Base';
import { PowerSystem } from './power/PowerSystem';
import { Lighting } from './lighting/Lighting';
import { EventController } from './events/EventController';
import { Fire } from './hazards/Fire';
import { ProjectileManager } from './hazards/Projectile';
import { SaveLoadSystem } from './save/SaveLoad';
import { researchSystem } from './research/ResearchSystem';
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
  let _hostilesDefeated = 0;
  let _siegeSurvived = 0;
  const goalSystem: GoalSystem = new GoalSystem({
    getRoomCount: () => roomManager.getRooms().length,
    getPopulation: () => characterManager.getPopulation(),
    getResearchCompleted: () => researchSystem.getCompletedList().length,
    getHostilesDefeated: () => _hostilesDefeated,
    getMatter: () => GameRules.nMatter,
    getUniqueZones: () => {
      const zones = new Set(roomManager.getRooms().map(r => r.zone));
      return zones.size;
    },
    getSiegeSurvived: () => _siegeSurvived,
    getAllMoraleAbove: (threshold: number) => {
      const chars = characterManager.getCharacters();
      return chars.length > 0 && chars.every(c => c.nMorale > threshold);
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

  // Wire save/load data providers
  saveLoadSystem.getCharacterData = () => characterManager.getCharacters().map(c => ({
    id: c.id, tileX: c.tileX, tileY: c.tileY,
    name: c.getName(), job: c.getJob(), team: c.tStats.nTeam,
    hp: c.getHP(), maxHP: c.tStats.nMaxHP, status: c.tStats.nStatus,
    xp: c.tStats.nXP, competency: { ...c.tStats.tCompetency },
    morale: c.nMorale, anger: c.nAnger, bOnShift: c.bOnShift,
    weapon: c.weapon, bSpacesuit: c.bSpacesuit, nSuitOxygen: c.nSuitOxygen,
    maladies: c.maladies.map(m => ({ name: m.def.sName, elapsed: m.elapsedTime })),
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
  });

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

    // Goal, hint, and music systems
    const gameDt = (delta / 1000) * GameRules.playerTimeScale;
    goalSystem.update(gameDt);
    hintSystem.update(gameDt);
    musicSystem.update(delta / 1000); // Music uses real time, not game time

    // Update audio listener position from camera
    SoundManager.setListenerPosition(cameraController.scrollX, cameraController.scrollY);
    SoundManager.setZoomDepth(Math.min(1, Math.max(0, (cameraController.zoom - 0.5) / 1.5)));

    // O2 overlay
    if (showO2Overlay) {
      renderO2Overlay();
    }

    // UI
    uiManager.update();

    // End-of-frame input state
    inputManager.endFrame();

    // Render
    threeRenderer.render();

    requestAnimationFrame(gameLoop);
  }

  /** Render amber tint on tiles with pending commands. */
  function renderCommandOverlays() {
    const currentTiles = new Set<string>();
    for (const cmd of CommandQueue.getAllActive()) {
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

    // Left button just pressed
    if (inputManager.leftJustPressed) {
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
        if (objName) objectPlacement.placeObject(objName, tile.x, tile.y);
      } else if (buildMode === 'mine') {
        const tileVal = grid.get(tile.x, tile.y);
        if (isAsteroid(tileVal)) {
          CommandQueue.addCommand('mine', tile.x, tile.y);
          Base.addAlert('mining', `Queued asteroid for mining at (${tile.x},${tile.y})`);
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
    infectCharacter: (charId: number, maladyName: string) => {
      const char = characterManager.getAllCharacters().find(c => c.id === charId);
      if (char) return char.infectWith(maladyName);
      return false;
    },
    getCharacterMaladies: (charId: number) => {
      const char = characterManager.getAllCharacters().find(c => c.id === charId);
      if (!char) return [];
      return char.maladies.map(m => ({ name: m.def.sName, cured: m.bCured, elapsed: m.elapsedTime }));
    },
    getDiseasedCount: () => {
      return characterManager.getAllCharacters().filter(c => c.isAlive() && c.maladies.length > 0).length;
    },
    // ── Milestone 11: Goals, Hints, Save/Load ────────────────
    getGoals: () => ({
      completed: goalSystem.getCompleted(),
      completedCount: goalSystem.getCompletedCount(),
      totalGoals: goalSystem.getTotalGoals(),
    }),
    getHints: () => hintSystem.getShownHints(),
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
  const names: Record<number, string> = { 1: 'Space', 4: 'Wall', 5: 'Door', 6: 'Destroyed', 8: 'Floor' };
  return names[type] || 'Unknown';
}
