import type { CharacterManager } from '../characters/CharacterManager';
import { RAIDER, TEAM_ID_DEBUG_ENEMYGROUP, TEAM_ID_PLAYER } from '../characters/CharacterConstants';
import { CHARACTER_SAFETY_TOLERANCE } from '../config';
import { EnvObjectManager } from '../envobjects/EnvObjectManager';
import type { Room } from '../rooms/Room';
import type { RoomManager } from '../rooms/RoomManager';
import {
  Direction,
  getAdjacentTile,
  getOppositeDirection,
  getPerpindicularDirection,
  type DirectionType,
  type TileGrid,
} from '../world/TileGrid';
import { isoToOffset, offsetToIso } from '../world/IsometricUtils';
import { TileType } from '../world/TileTypes';

export const DOCKING_STATE = {
  IDLE: 0,
  APPROACHING: 1,
  DOCKED: 2,
  DEPARTING: 3,
} as const;

const DERELICT_FREQ = 0.67;
const MAX_EVENTS_PER_ATTEMPT = 2;
const BRIDGE_LENGTH = 5;
const MAX_TEST_TILES_PER_ROOM = 3;
const DERELICT_SPAWN_RANGE: [number, number] = [15, 20];

export interface ModuleData {
  id: string;
  name: string;
  size: 'small' | 'medium' | 'large';
  hostile: boolean;
  derelict: boolean;
  difficulty: number;
  width: number;
  height: number;
  crewMin: number;
  crewMax: number;
}

export interface CandidateTile {
  x: number;
  y: number;
  nRoomDirection: DirectionType;
  tWallDirections: DirectionType[];
  roomId: number;
}

interface ModulePlacement {
  moduleTiles: { x: number; y: number }[];
  doorTile: { x: number; y: number };
  crewTiles: { x: number; y: number }[];
}

export interface DockingData {
  module: ModuleData;
  isHostile: boolean;
  isDerelict: boolean;
  tDockingTile: CandidateTile | null;
  nBridgeDirection: DirectionType | null;
  placement: ModulePlacement;
}

const FRIENDLY_DOCKING_MODULES: ModuleData[] = [
  { id: 'planeBoardingFriendly', name: 'Small Boarding Shuttle', size: 'small', hostile: false, derelict: false, difficulty: 0, width: 5, height: 5, crewMin: 2, crewMax: 3 },
  { id: 'tinycross2BoardingFriendly', name: 'Medium Boarding Shuttle', size: 'medium', hostile: false, derelict: false, difficulty: 0.25, width: 7, height: 7, crewMin: 5, crewMax: 7 },
  { id: 'dualdomeBoardingFriendly', name: 'Large Boarding Vessel', size: 'large', hostile: false, derelict: false, difficulty: 0.5, width: 10, height: 10, crewMin: 10, crewMax: 17 },
];

const HOSTILE_DOCKING_MODULES: ModuleData[] = [
  { id: 'planeBoardingHostile', name: 'Hostile Skiff', size: 'small', hostile: true, derelict: false, difficulty: 0, width: 5, height: 5, crewMin: 2, crewMax: 3 },
  { id: 'tinycross2BoardingHostile', name: 'Hostile Raider Shuttle', size: 'medium', hostile: true, derelict: false, difficulty: 0.2, width: 7, height: 7, crewMin: 5, crewMax: 7 },
  { id: 'dualdomeBoardingHostile', name: 'Hostile Assault Ship', size: 'large', hostile: true, derelict: false, difficulty: 0.45, width: 10, height: 10, crewMin: 10, crewMax: 17 },
];

const DERELICT_MODULES: ModuleData[] = [
  { id: 'tinycross1Friendly', name: 'Small Derelict', size: 'small', hostile: false, derelict: true, difficulty: 0, width: 5, height: 5, crewMin: 0, crewMax: 3 },
  { id: 'donutFriendlies', name: 'Medium Derelict', size: 'medium', hostile: false, derelict: true, difficulty: 0.2, width: 7, height: 7, crewMin: 1, crewMax: 7 },
  { id: 'monsterFreighter', name: 'Large Derelict', size: 'large', hostile: true, derelict: true, difficulty: 0.35, width: 10, height: 10, crewMin: 4, crewMax: 12 },
];

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = copy[i];
    copy[i] = copy[j];
    copy[j] = t;
  }
  return copy;
}

export class DockingSystem {
  state: number = DOCKING_STATE.IDLE;
  progress = 0;
  payload = 0;

  readonly nDerelictFreq = DERELICT_FREQ;
  readonly nMaxEventsPerAttempt = MAX_EVENTS_PER_ATTEMPT;
  readonly nBridgeLength = BRIDGE_LENGTH;
  readonly nMaxTestTilesPerRoom = MAX_TEST_TILES_PER_ROOM;

  private readonly grid: TileGrid;
  private readonly roomManager: RoomManager;
  private readonly characterManager: CharacterManager;

  private pendingDock: DockingData | null = null;

  constructor(grid: TileGrid, roomManager: RoomManager, characterManager: CharacterManager) {
    this.grid = grid;
    this.roomManager = roomManager;
    this.characterManager = characterManager;
  }

  approach(payload: number): void {
    this.state = DOCKING_STATE.APPROACHING;
    this.progress = 0;
    this.payload = payload;
  }

  update(dt: number): void {
    if (this.state === DOCKING_STATE.APPROACHING) {
      this.progress += dt * 0.1;
      if (this.progress >= 1) {
        this.state = DOCKING_STATE.DOCKED;
        this.progress = 1;
      }
    } else if (this.state === DOCKING_STATE.DEPARTING) {
      this.progress -= dt * 0.1;
      if (this.progress <= 0) {
        this.state = DOCKING_STATE.IDLE;
        this.progress = 0;
      }
    }
  }

  depart(): void {
    this.state = DOCKING_STATE.DEPARTING;
  }

  isDocked(): boolean {
    return this.state === DOCKING_STATE.DOCKED;
  }

  attemptDock(isHostile: boolean, isDerelict: boolean): DockingData | null {
    this.state = DOCKING_STATE.APPROACHING;
    this.progress = 0;

    const modules = this._getCandidateModules(isHostile, isDerelict);
    if (modules.length === 0) {
      this.state = DOCKING_STATE.IDLE;
      return null;
    }

    for (let attempt = 0; attempt < this.nMaxEventsPerAttempt; attempt++) {
      const module = modules[attempt % modules.length];

      if (isDerelict) {
        const placement = this._findDerelictPlacement(module);
        if (placement) {
          const data: DockingData = {
            module,
            isHostile: isHostile || module.hostile,
            isDerelict: true,
            tDockingTile: null,
            nBridgeDirection: null,
            placement,
          };
          this.pendingDock = data;
          this.payload = randomInt(module.crewMin, module.crewMax);
          return data;
        }
        continue;
      }

      const candidate = this._testCandidateRoom(this._getExteriorRooms());
      if (!candidate) continue;
      if (!this._testModuleFit(candidate, module)) continue;

      const direction = getOppositeDirection(candidate.nRoomDirection) as DirectionType;
      const placement = this._buildModulePlacement(candidate, module);
      if (!placement) continue;

      const data: DockingData = {
        module,
        isHostile,
        isDerelict: false,
        tDockingTile: candidate,
        nBridgeDirection: direction,
        placement,
      };

      this.pendingDock = data;
      this.payload = randomInt(module.crewMin, module.crewMax);
      return data;
    }

    this.state = DOCKING_STATE.IDLE;
    return null;
  }

  spawnModule(dockData: DockingData): number {
    const teamId = dockData.isHostile ? TEAM_ID_DEBUG_ENEMYGROUP : TEAM_ID_PLAYER;

    this._paintModule(dockData.placement);

    if (!dockData.isDerelict && dockData.tDockingTile && dockData.nBridgeDirection) {
      this._createBridge(
        { x: dockData.tDockingTile.x, y: dockData.tDockingTile.y },
        dockData.nBridgeDirection,
        this.nBridgeLength,
      );
    }

    this._spawnCrew(dockData.module, teamId);

    this.pendingDock = dockData;
    this.state = DOCKING_STATE.DOCKED;
    this.progress = 1;
    return teamId;
  }

  _testCandidateRoom(rooms: Room[]): CandidateTile | null {
    for (const room of shuffle(rooms)) {
      const candidates = shuffle(this._collectRoomCandidates(room));
      const maxTests = Math.min(this.nMaxTestTilesPerRoom, candidates.length);

      for (let i = 0; i < maxTests; i++) {
        const candidate = candidates[i];
        if (candidate.tWallDirections.length !== 3) continue;
        if (candidate.nRoomDirection < Direction.NW || candidate.nRoomDirection > Direction.SE) continue;
        if (!this._testBridgeClear(candidate)) continue;
        return candidate;
      }
    }
    return null;
  }

  _testModuleFit(candidateTile: CandidateTile, module: ModuleData): boolean {
    const placement = this._buildModulePlacement(candidateTile, module);
    if (!placement) return false;

    const isoBounds = this._computeIsoBounds(placement.moduleTiles);
    for (let a = isoBounds.minA; a <= isoBounds.maxA; a++) {
      for (let b = isoBounds.minB; b <= isoBounds.maxB; b++) {
        const t = isoToOffset(a, b);
        if (!this._isClearSpace(t.x, t.y)) return false;
      }
    }

    return true;
  }

  _createBridge(fromTile: { x: number; y: number }, direction: DirectionType, length: number): void {
    const roomDirection = getOppositeDirection(direction) as DirectionType;
    const leftDirection = getPerpindicularDirection(direction) as DirectionType;
    const rightDirection = getOppositeDirection(leftDirection) as DirectionType;

    const [baseDoorX, baseDoorY] = getAdjacentTile(fromTile.x, fromTile.y, roomDirection);
    this._setDoor(baseDoorX, baseDoorY);

    let tx = fromTile.x;
    let ty = fromTile.y;
    let placed = 0;

    while (this.grid.inBounds(tx, ty) && this.grid.get(tx, ty) === TileType.SPACE && placed < length * 4) {
      this.grid.set(tx, ty, TileType.FLOOR);

      const [leftX, leftY] = getAdjacentTile(tx, ty, leftDirection);
      if (this._isClearSpace(leftX, leftY)) this.grid.set(leftX, leftY, TileType.WALL);

      const [rightX, rightY] = getAdjacentTile(tx, ty, rightDirection);
      if (this._isClearSpace(rightX, rightY)) this.grid.set(rightX, rightY, TileType.WALL);

      [tx, ty] = getAdjacentTile(tx, ty, direction);
      placed++;
    }

    if (this.grid.inBounds(tx, ty)) {
      this._setDoor(tx, ty);
    }
  }

  _spawnCrew(module: ModuleData, teamId: number): void {
    if (!this.pendingDock) return;

    const count = randomInt(module.crewMin, module.crewMax);
    const spawnTiles = this.pendingDock.placement.crewTiles.length > 0
      ? [...this.pendingDock.placement.crewTiles]
      : [...this.pendingDock.placement.moduleTiles];

    for (let i = 0; i < count; i++) {
      if (spawnTiles.length === 0) break;
      const idx = Math.floor(Math.random() * spawnTiles.length);
      const tile = spawnTiles[idx];

      const char = this.characterManager.spawnCharacterAt(tile.x, tile.y, false, !module.hostile);
      if (teamId === TEAM_ID_DEBUG_ENEMYGROUP) {
        char.tStats.nTeam = TEAM_ID_DEBUG_ENEMYGROUP;
        char.tStats.nJob = RAIDER;
        char.tStats.sName = `Raider ${i + 1}`;
      }
    }
  }

  private _getCandidateModules(isHostile: boolean, isDerelict: boolean): ModuleData[] {
    let source: ModuleData[];
    if (isDerelict) {
      source = DERELICT_MODULES.filter(m => !isHostile || m.hostile);
    } else {
      source = isHostile ? HOSTILE_DOCKING_MODULES : FRIENDLY_DOCKING_MODULES;
    }
    return shuffle(source);
  }

  private _getExteriorRooms(): Room[] {
    const rooms = this.roomManager.getRooms();
    return rooms.filter((room) => room.tiles.some((tile) => {
      for (let d = Direction.NW; d <= Direction.SE; d++) {
        const [nx, ny] = getAdjacentTile(tile.x, tile.y, d);
        if (this.grid.get(nx, ny) === TileType.SPACE) return true;
      }
      return false;
    }));
  }

  private _collectRoomCandidates(room: Room): CandidateTile[] {
    const map = new Map<string, CandidateTile>();

    for (const tile of room.tiles) {
      for (let d = Direction.NW; d <= Direction.SE; d++) {
        const [sx, sy] = getAdjacentTile(tile.x, tile.y, d);
        if (this.grid.get(sx, sy) !== TileType.SPACE) continue;

        const roomDirection = getOppositeDirection(d) as DirectionType;
        const key = `${sx},${sy},${roomDirection}`;
        if (map.has(key)) continue;

        map.set(key, {
          x: sx,
          y: sy,
          nRoomDirection: roomDirection,
          tWallDirections: this._getWallDirections(sx, sy),
          roomId: room.id,
        });
      }
    }

    return Array.from(map.values());
  }

  private _getWallDirections(tx: number, ty: number): DirectionType[] {
    const dirs: DirectionType[] = [];
    for (let d = Direction.NW; d <= Direction.SE; d++) {
      const [nx, ny] = getAdjacentTile(tx, ty, d);
      const t = this.grid.get(nx, ny);
      if (t === TileType.WALL || t === TileType.DOOR) {
        dirs.push(d as DirectionType);
      }
    }
    return dirs;
  }

  private _testBridgeClear(candidate: CandidateTile): boolean {
    const direction = getOppositeDirection(candidate.nRoomDirection) as DirectionType;
    const leftDirection = getPerpindicularDirection(direction) as DirectionType;
    const rightDirection = getOppositeDirection(leftDirection) as DirectionType;

    let tx = candidate.x;
    let ty = candidate.y;

    for (let i = 0; i < this.nBridgeLength; i++) {
      const [lx, ly] = getAdjacentTile(tx, ty, leftDirection);
      const [rx, ry] = getAdjacentTile(tx, ty, rightDirection);

      if (!this._isClearSpace(tx, ty) || !this._isClearSpace(lx, ly) || !this._isClearSpace(rx, ry)) {
        return false;
      }

      if (i < this.nBridgeLength - 1) {
        [tx, ty] = getAdjacentTile(tx, ty, direction);
      }
    }

    return true;
  }

  private _buildModulePlacement(candidateTile: CandidateTile, module: ModuleData): ModulePlacement | null {
    const bridgeDirection = getOppositeDirection(candidateTile.nRoomDirection) as DirectionType;
    const [bridgeEndX, bridgeEndY] = this._walk(candidateTile.x, candidateTile.y, bridgeDirection, this.nBridgeLength - 1);
    const [doorX, doorY] = getAdjacentTile(bridgeEndX, bridgeEndY, bridgeDirection);
    const placement = this._buildPlacementFromDoor(doorX, doorY, bridgeDirection, module);
    if (!placement) return null;
    return placement;
  }

  private _findDerelictPlacement(module: ModuleData): ModulePlacement | null {
    const inwardDirections: DirectionType[] = [Direction.NW, Direction.NE, Direction.SW, Direction.SE];

    for (let attempts = 0; attempts < 24; attempts++) {
      const side = randomInt(0, 3);
      const dist = randomInt(DERELICT_SPAWN_RANGE[0], DERELICT_SPAWN_RANGE[1]);
      const margin = CHARACTER_SAFETY_TOLERANCE + 1;

      let sx = randomInt(margin, this.grid.width - margin - 1);
      let sy = randomInt(margin, this.grid.height - margin - 1);

      if (side === 0) sy = margin;
      else if (side === 1) sx = this.grid.width - margin - 1;
      else if (side === 2) sy = this.grid.height - margin - 1;
      else sx = margin;

      const direction = inwardDirections[randomInt(0, inwardDirections.length - 1)];
      const [dx, dy] = this._walk(sx, sy, direction, dist);

      const placement = this._buildPlacementFromDoor(dx, dy, direction, module);
      if (placement && this._isPlacementClear(placement.moduleTiles)) {
        return placement;
      }
    }

    return null;
  }

  private _buildPlacementFromDoor(doorX: number, doorY: number, forward: DirectionType, module: ModuleData): ModulePlacement | null {
    const sideA = getPerpindicularDirection(forward) as DirectionType;
    const sideB = getOppositeDirection(sideA) as DirectionType;

    const halfSpan = Math.floor(module.width / 2);
    const moduleTiles: { x: number; y: number }[] = [];
    const tileSet = new Set<string>();

    for (let depth = 0; depth < module.height; depth++) {
      const [rowX, rowY] = this._walk(doorX, doorY, forward, depth);

      const [leftAnchorX, leftAnchorY] = this._walk(rowX, rowY, sideA, halfSpan);
      const [rightAnchorX, rightAnchorY] = this._walk(rowX, rowY, sideB, halfSpan);

      this._addLineTiles(leftAnchorX, leftAnchorY, sideB, module.width, moduleTiles, tileSet);
      this._addLineTiles(rightAnchorX, rightAnchorY, sideA, module.width, moduleTiles, tileSet);
    }

    if (moduleTiles.length === 0) return null;
    if (!this._isPlacementClear(moduleTiles)) return null;

    const roomSet = new Set(moduleTiles.map((t) => `${t.x},${t.y}`));
    const crewTiles = moduleTiles.filter((tile) => {
      if (tile.x === doorX && tile.y === doorY) return false;
      for (let d = Direction.NW; d <= Direction.SE; d++) {
        const [nx, ny] = getAdjacentTile(tile.x, tile.y, d);
        if (!roomSet.has(`${nx},${ny}`)) return false;
      }
      return true;
    });

    return {
      moduleTiles,
      doorTile: { x: doorX, y: doorY },
      crewTiles,
    };
  }

  private _addLineTiles(
    startX: number,
    startY: number,
    direction: DirectionType,
    count: number,
    out: { x: number; y: number }[],
    set: Set<string>,
  ): void {
    let tx = startX;
    let ty = startY;
    for (let i = 0; i < count; i++) {
      const key = `${tx},${ty}`;
      if (!set.has(key)) {
        out.push({ x: tx, y: ty });
        set.add(key);
      }
      [tx, ty] = getAdjacentTile(tx, ty, direction);
    }
  }

  private _computeIsoBounds(tiles: { x: number; y: number }[]): { minA: number; maxA: number; minB: number; maxB: number } {
    let minA = Infinity;
    let maxA = -Infinity;
    let minB = Infinity;
    let maxB = -Infinity;

    for (const tile of tiles) {
      const { a, b } = offsetToIso(tile.x, tile.y);
      minA = Math.min(minA, a);
      maxA = Math.max(maxA, a);
      minB = Math.min(minB, b);
      maxB = Math.max(maxB, b);
    }

    return { minA, maxA, minB, maxB };
  }

  private _isPlacementClear(tiles: { x: number; y: number }[]): boolean {
    for (const tile of tiles) {
      if (!this._isClearSpace(tile.x, tile.y)) return false;
    }
    return true;
  }

  private _isClearSpace(tx: number, ty: number): boolean {
    if (!this.grid.inBounds(tx, ty)) return false;
    if (tx < CHARACTER_SAFETY_TOLERANCE || ty < CHARACTER_SAFETY_TOLERANCE) return false;
    if (tx >= this.grid.width - CHARACTER_SAFETY_TOLERANCE) return false;
    if (ty >= this.grid.height - CHARACTER_SAFETY_TOLERANCE) return false;
    return this.grid.get(tx, ty) === TileType.SPACE;
  }

  private _paintModule(placement: ModulePlacement): void {
    const set = new Set(placement.moduleTiles.map((t) => `${t.x},${t.y}`));

    for (const tile of placement.moduleTiles) {
      if (tile.x === placement.doorTile.x && tile.y === placement.doorTile.y) {
        this._setDoor(tile.x, tile.y);
        continue;
      }

      let boundary = false;
      for (let d = Direction.NW; d <= Direction.SE; d++) {
        const [nx, ny] = getAdjacentTile(tile.x, tile.y, d);
        if (!set.has(`${nx},${ny}`)) {
          boundary = true;
          break;
        }
      }

      this.grid.set(tile.x, tile.y, boundary ? TileType.WALL : TileType.FLOOR);
    }
  }

  private _setDoor(tx: number, ty: number): void {
    if (!this.grid.inBounds(tx, ty)) return;
    this.grid.set(tx, ty, TileType.DOOR);
    if (!EnvObjectManager.getDoorAt(tx, ty)) {
      EnvObjectManager.createObject('Door', tx, ty);
    }
  }

  private _walk(tx: number, ty: number, direction: DirectionType, steps: number): [number, number] {
    let cx = tx;
    let cy = ty;
    for (let i = 0; i < steps; i++) {
      [cx, cy] = getAdjacentTile(cx, cy, direction);
    }
    return [cx, cy];
  }
}

export default DockingSystem;
