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

import { TileGrid } from './world/TileGrid';
import { WallAutoGen } from './world/WallAutoGen';
import { BuildSystem, type BuildMode } from './building/BuildSystem';
import { BuildCursor } from './building/BuildCursor';
import { RoomManager } from './rooms/RoomManager';
import { OxygenSystem } from './oxygen/OxygenSystem';
import { CharacterManager } from './characters/CharacterManager';
import { GameRules, type TickableSystem } from './core/GameRules';
import { EnvObjectManager } from './envobjects/EnvObjectManager';
import { ObjectPlacement } from './building/ObjectPlacement';
import { Base } from './core/Base';
import { PowerSystem } from './power/PowerSystem';
import { Lighting } from './lighting/Lighting';
import { EventController } from './events/EventController';
import { Fire } from './hazards/Fire';
import { ProjectileManager } from './hazards/Projectile';
import { SaveLoadSystem } from './save/SaveLoad';
import { generateWorld } from './world/WorldGen';
import { ZoneType, ZONE_SPRITES } from './world/ZoneType';
import { GRID_W, GRID_H, TILE_W, TILE_HALF_W, TILE_HALF_H } from './config';
import { tileToScreen } from './world/IsometricUtils';
import { TileType } from './world/TileTypes';
import { isAsteroid, getMiningYield } from './world/Asteroid';

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
  Base.init();
  const powerSystem = new PowerSystem(grid, roomManager);
  const lighting = new Lighting(roomManager);
  lighting.init();
  const eventController = new EventController();
  eventController.init();
  const fire = new Fire();
  fire.init();
  const projectileManager = new ProjectileManager();
  projectileManager.init();
  const saveLoadSystem = new SaveLoadSystem(grid, roomManager);

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

  // Keyboard bindings
  inputManager.onKeyPress('KeyC', () => { buildMode = buildMode === 'room' ? 'none' : 'room'; });
  inputManager.onKeyPress('KeyB', () => { buildMode = buildMode === 'floor' ? 'none' : 'floor'; });
  inputManager.onKeyPress('KeyD', () => { buildMode = buildMode === 'door' ? 'none' : 'door'; });
  inputManager.onKeyPress('KeyX', () => { buildMode = buildMode === 'demolish' ? 'none' : 'demolish'; });
  inputManager.onKeyPress('KeyZ', () => { buildMode = buildMode === 'zone' ? 'none' : 'zone'; });
  inputManager.onKeyPress('KeyP', () => { buildMode = buildMode === 'object' ? 'none' : 'object'; });
  inputManager.onKeyPress('KeyM', () => { buildMode = buildMode === 'mine' ? 'none' : 'mine'; });
  inputManager.onKeyPress('Escape', () => { buildMode = 'none'; buildCursor.cancelDrag(); });
  inputManager.onKeyPress('KeyO', () => { showO2Overlay = !showO2Overlay; });
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
        info += `\nRoom #${room.id}  ${room.size} tiles`;
        info += `\nZone: ${ZONE_SPRITES[room.zone].name}`;
        info += `\nO2: ${room.oxygen}  ${room.sealed ? 'Sealed' : 'BREACHED'}`;
      }
      for (const char of characterManager.getCharacters()) {
        if (char.tileX === hovered.x && char.tileY === hovered.y) {
          info += `\n\n${char.getName()} [${char.getJobName()}]`;
          info += `\nHP: ${char.getHP()}  Morale: ${char.nMorale}`;
          break;
        }
      }
      return info;
    },
    onSave: () => saveLoadSystem.saveToStorage(),
    onLoad: () => saveLoadSystem.loadFromStorage(),
    onSpawn: () => characterManager.spawnCharacter(),
    onObjectSelected: (name) => { /* placeholder */ },
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

    // Event controller
    eventController.setPopulation(characterManager.getPopulation());

    // Master tick
    GameRules.onTick(delta / 1000);

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

  function handleBuildInput() {
    const worldPos = inputManager.getWorldPointer();
    buildCursor.updateHover(worldPos.x, worldPos.y);
    const tile = buildCursor.hoveredTile;
    if (!tile) return;

    const isDragMode = buildMode === 'room' || buildMode === 'floor' ||
                       buildMode === 'wall' || buildMode === 'demolish';

    // Left button just pressed
    if (inputManager.leftJustPressed) {
      if (buildMode === 'zone') {
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
          const yield_ = getMiningYield();
          GameRules.nMatter += yield_;
          grid.set(tile.x, tile.y, TileType.SPACE);
          onTilesChanged([tile]);
          Base.addAlert('mining', `Mined asteroid: +${yield_} matter`);
        }
      } else if (isDragMode) {
        buildCursor.startDrag(tile.x, tile.y);
        buildCursor.updateDrag(tile.x, tile.y, buildMode as 'floor' | 'demolish');
      }
    }

    // Left held — update drag
    if (inputManager.isLeftDown() && buildCursor.isDragging && isDragMode) {
      buildCursor.updateDrag(tile.x, tile.y, buildMode as 'floor' | 'demolish');
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
      buildCursor.showHoverGhost(buildMode as 'floor' | 'door' | 'demolish');
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

  // Seed pod: a bright octahedron at the landing spot (visible landmark)
  const geo = new THREE.OctahedronGeometry(12, 0);
  const mat = new THREE.MeshBasicMaterial({ color: 0xdfa200, wireframe: false });
  const mesh = new THREE.Mesh(geo, mat);
  // Position at tile center, negated Y, above tiles in depth
  mesh.position.set(
    pos.x + TILE_HALF_W,
    -(pos.y + TILE_HALF_H),
    15000 + pos.y,
  );
  threeRenderer.scene.add(mesh);

  // Pulsing glow ring around the pod
  const ringGeo = new THREE.RingGeometry(16, 20, 16);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xdfa200,
    transparent: true,
    opacity: 0.4,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.copy(mesh.position);
  ring.position.z -= 1; // slightly behind pod
  threeRenderer.scene.add(ring);
}

function tileName(type: number): string {
  const names: Record<number, string> = { 1: 'Space', 4: 'Wall', 5: 'Door', 6: 'Destroyed', 8: 'Floor' };
  return names[type] || 'Unknown';
}
