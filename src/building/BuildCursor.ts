import * as THREE from 'three';
import { TileGrid } from '../world/TileGrid';
import { TileType } from '../world/TileTypes';
import { tileToScreen, screenToTile, offsetToIso, isoToOffset } from '../world/IsometricUtils';
import { getTexture } from '../renderer/AssetLoader';

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

  updateHover(worldX: number, worldY: number) {
    this._hoveredTile = screenToTile(worldX, worldY);
  }

  startDrag(tileX: number, tileY: number) {
    this.dragStartTile = { x: tileX, y: tileY };
    this.dragTiles = [];
  }

  updateDrag(endTileX: number, endTileY: number, buildMode: 'floor' | 'door' | 'demolish') {
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

  canPlace(x: number, y: number, mode: 'floor' | 'door' | 'demolish'): boolean {
    if (!this.grid.inBounds(x, y)) return false;
    const current = this.grid.get(x, y);
    switch (mode) {
      case 'floor':
        return current === TileType.SPACE;
      case 'door':
        return current === TileType.WALL;
      case 'demolish':
        return current === TileType.FLOOR || current === TileType.WALL || current === TileType.DOOR;
      default:
        return false;
    }
  }

  private renderGhosts(buildMode: 'floor' | 'door' | 'demolish') {
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

  showHoverGhost(mode: 'floor' | 'door' | 'demolish') {
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
