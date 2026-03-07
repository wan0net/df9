import * as THREE from 'three';
import { TileGrid } from '../world/TileGrid';
import { TileType } from '../world/TileTypes';
import { isAsteroid } from '../world/Asteroid';
import { tileToScreen, screenToTile, offsetToIso, isoToOffset } from '../world/IsometricUtils';
import { getTexture } from '../renderer/AssetLoader';
import { CHARACTER_SAFETY_TOLERANCE } from '../config';

export class BuildCursor {
  private scene: THREE.Scene;
  private grid: TileGrid;
  private ghosts: THREE.Mesh[] = [];
  private _hoveredTile: { x: number; y: number } | null = null;

  // Drag in tile coords
  private dragStartTile: { x: number; y: number } | null = null;
  private dragTiles: { x: number; y: number }[] = [];

  constructor(scene: THREE.Scene, grid: TileGrid) {
    this.scene = scene;
    this.grid = grid;
  }

  get hoveredTile() {
    return this._hoveredTile;
  }

  get isDragging() {
    return this.dragStartTile !== null;
  }

  get dragTileCount() {
    return this.dragTiles.length;
  }

  /** Get drag rectangle dimensions in iso-axial space (Lua "Floor Area: W x H"). */
  get dragDimensions(): { w: number; h: number } {
    if (!this.dragStartTile || this.dragTiles.length === 0) return { w: 0, h: 0 };
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const t of this.dragTiles) {
      if (t.x < minX) minX = t.x;
      if (t.x > maxX) maxX = t.x;
      if (t.y < minY) minY = t.y;
      if (t.y > maxY) maxY = t.y;
    }
    return { w: maxX - minX + 1, h: maxY - minY + 1 };
  }

  updateHover(worldX: number, worldY: number) {
    this._hoveredTile = screenToTile(worldX, worldY);
  }

  startDrag(tileX: number, tileY: number) {
    this.dragStartTile = { x: tileX, y: tileY };
    this.dragTiles = [];
  }

  updateDrag(endTileX: number, endTileY: number, buildMode: 'room' | 'floor' | 'wall' | 'door' | 'demolish' | 'vaporize' | 'erase' | 'mine') {
    if (!this.dragStartTile) return;

    const startIso = offsetToIso(this.dragStartTile.x, this.dragStartTile.y);
    const endIso = offsetToIso(endTileX, endTileY);

    const minA = Math.min(startIso.a, endIso.a);
    const maxA = Math.max(startIso.a, endIso.a);
    const minB = Math.min(startIso.b, endIso.b);
    const maxB = Math.max(startIso.b, endIso.b);

    this.dragTiles = [];
    for (let a = minA; a <= maxA; a++) {
      for (let b = minB; b <= maxB; b++) {
        const { x, y } = isoToOffset(a, b);
        if (this.grid.inBounds(x, y) && this.canPlace(x, y, buildMode)) {
          this.dragTiles.push({ x, y });
        }
      }
    }

    this.renderGhosts(buildMode);
  }

  endDrag(): { x: number; y: number }[] {
    const tiles = [...this.dragTiles];
    this.dragStartTile = null;
    this.dragTiles = [];
    this.clearGhosts();
    return tiles;
  }

  cancelDrag() {
    this.dragStartTile = null;
    this.dragTiles = [];
    this.clearGhosts();
  }

  canPlace(x: number, y: number, mode: 'room' | 'floor' | 'wall' | 'door' | 'demolish' | 'vaporize' | 'erase' | 'mine'): boolean {
    if (!this.grid.inBounds(x, y)) return false;
    // Mirrors WorldConstants.CHARACTER_SAFETY_TOLERANCE = 2: no building within 2 tiles of world edge
    const tol = CHARACTER_SAFETY_TOLERANCE;
    if (x < tol || y < tol || x >= this.grid.width - tol || y >= this.grid.height - tol) return false;
    const current = this.grid.get(x, y);
    switch (mode) {
      case 'room':
        return current === TileType.SPACE || current === TileType.WALL || current === TileType.WALL_DESTROYED;
      case 'floor':
        return current === TileType.SPACE;
      case 'wall':
        return current === TileType.SPACE;
      case 'door':
        return current === TileType.WALL;
      case 'demolish':
        return current === TileType.FLOOR || current === TileType.WALL || current === TileType.DOOR;
      case 'vaporize':
        return current !== TileType.SPACE;
      case 'erase':
        return current === TileType.FLOOR_PENDING || current === TileType.WALL_PENDING;
      case 'mine':
        return isAsteroid(current);
      default:
        return false;
    }
  }

  private renderGhosts(buildMode: 'room' | 'floor' | 'wall' | 'door' | 'demolish' | 'vaporize' | 'erase' | 'mine') {
    this.clearGhosts();

    for (const t of this.dragTiles) {
      const pos = tileToScreen(t.x, t.y);
      const valid = this.canPlace(t.x, t.y, buildMode);

      const gridKey = valid ? 'cursor_grid_bright' : 'cursor_grid';
      this.addGhostQuad(gridKey, pos.x, pos.y, 9000, 0.6);

      const indicatorKey = valid ? 'cursor_yes' : 'cursor_no';
      this.addGhostQuad(indicatorKey, pos.x, pos.y, 9001, 0.7);
    }
  }

  private addGhostQuad(textureKey: string, x: number, y: number, depth: number, alpha: number) {
    const tex = getTexture(textureKey);
    if (!tex) return;

    const w = tex.image?.width ?? 128;
    const h = tex.image?.height ?? 64;

    const geo = new THREE.PlaneGeometry(w, h);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: alpha,
      alphaTest: 0.01,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x + w / 2, -(y + h / 2), depth);
    this.scene.add(mesh);
    this.ghosts.push(mesh);
  }

  private clearGhosts() {
    for (const g of this.ghosts) {
      this.scene.remove(g);
      g.geometry.dispose();
    }
    this.ghosts = [];
  }

  showHoverGhost(mode: 'room' | 'floor' | 'wall' | 'door' | 'demolish' | 'vaporize' | 'erase' | 'mine') {
    if (!this._hoveredTile || this.dragStartTile) return;
    this.clearGhosts();
    const { x, y } = this._hoveredTile;
    if (!this.grid.inBounds(x, y)) return;

    const pos = tileToScreen(x, y);
    const valid = this.canPlace(x, y, mode);

    this.addGhostQuad('cursor_grid_bright', pos.x, pos.y, 9000, 0.5);
    this.addGhostQuad(valid ? 'cursor_yes' : 'cursor_no', pos.x, pos.y, 9001, 0.6);
  }
}
