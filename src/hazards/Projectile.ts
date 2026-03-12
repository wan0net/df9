/**
 * Projectile.ts — Weapon projectiles.
 * Mirrors Projectile.lua.
 */

import { GameRules, type TickableSystem } from '../core/GameRules';
import { Direction, getAdjacentTile, getCardinalOrOrdinalDirectionToVector } from '../world/TileGrid';

const CHANCE_TO_CAUSE_FIRE = 0.1;

type FireCallback = (tx: number, ty: number) => void;
type WallCheckCallback = (tx: number, ty: number) => boolean;

export interface ProjectileManagerOptions {
  fireCallback?: FireCallback;
  wallCheck?: WallCheckCallback;
}

export interface ProjectileData {
  id: number;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  speed: number;
  damage: number;
  damageType: number;
  progress: number;
  impactX?: number;
  impactY?: number;
  impactDirX?: number;
  impactDirY?: number;
}

export class ProjectileManager implements TickableSystem {
  private projectiles: ProjectileData[] = [];
  private nextId = 1;
  private fireCallback: FireCallback | null;
  private wallCheck: WallCheckCallback | null;

  constructor(options: ProjectileManagerOptions = {}) {
    this.fireCallback = options.fireCallback ?? null;
    this.wallCheck = options.wallCheck ?? null;
  }

  init() {
    // Register at slot 4 (Projectile.onTick in Lua tick order)
    GameRules.registerSystem(4, this);
  }

  /** Fire a projectile from source to target. */
  fire(sourceX: number, sourceY: number, targetX: number, targetY: number, speed: number, damage: number, damageType = 2): number {
    const id = this.nextId++;
    this.projectiles.push({
      id,
      sourceX, sourceY,
      targetX, targetY,
      speed, damage, damageType,
      progress: 0,
    });
    return id;
  }

  onTick(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      const prevProgress = Math.min(proj.progress, 1);
      const nextProgress = Math.min(proj.progress + dt * proj.speed, 1);

      if (this.wallCheck) {
        const prevTile = this.getTileAtProgress(proj, prevProgress);
        const nextTile = this.getTileAtProgress(proj, nextProgress);
        const lineTiles = this.getLineTiles(prevTile.x, prevTile.y, nextTile.x, nextTile.y);

        for (let t = 1; t < lineTiles.length; t++) {
          const tile = lineTiles[t];
          if (this.wallCheck(tile.x, tile.y)) {
            proj.impactX = tile.x;
            proj.impactY = tile.y;
            proj.impactDirX = tile.x - prevTile.x;
            proj.impactDirY = tile.y - prevTile.y;
            proj.progress = 1;
            break;
          }
        }
      }

      if (proj.progress < 1) {
        proj.progress = nextProgress;
      }

      if (proj.progress >= 1) {
        const impactX = proj.impactX ?? proj.targetX;
        const impactY = proj.impactY ?? proj.targetY;
        const impactDirX = proj.impactDirX ?? (proj.targetX - proj.sourceX);
        const impactDirY = proj.impactDirY ?? (proj.targetY - proj.sourceY);
        this.maybeCauseFire(impactX, impactY, impactDirX, impactDirY);
        this.projectiles.splice(i, 1);
      }
    }
  }

  private maybeCauseFire(tx: number, ty: number, dirX: number, dirY: number): void {
    if (!this.fireCallback) return;
    if (Math.random() >= CHANCE_TO_CAUSE_FIRE) return;

    const direction = getCardinalOrOrdinalDirectionToVector(dirX, dirY);
    if (direction === Direction.SAME) return;

    const [adjX, adjY] = getAdjacentTile(tx, ty, direction);
    this.fireCallback(adjX, adjY);
  }

  private getTileAtProgress(proj: ProjectileData, progress: number): { x: number; y: number } {
    const x = proj.sourceX + (proj.targetX - proj.sourceX) * progress;
    const y = proj.sourceY + (proj.targetY - proj.sourceY) * progress;
    return { x: Math.round(x), y: Math.round(y) };
  }

  private getLineTiles(x0: number, y0: number, x1: number, y1: number): { x: number; y: number }[] {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    if (steps === 0) {
      return [{ x: x0, y: y0 }];
    }

    const tiles: { x: number; y: number }[] = [];
    const seen = new Set<string>();
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = Math.round(x0 + dx * t);
      const y = Math.round(y0 + dy * t);
      const key = `${x},${y}`;
      if (!seen.has(key)) {
        seen.add(key);
        tiles.push({ x, y });
      }
    }
    return tiles;
  }

  getActiveProjectiles(): ProjectileData[] {
    return this.projectiles;
  }
}
