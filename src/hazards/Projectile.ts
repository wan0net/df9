/**
 * Projectile.ts — Weapon projectiles.
 * Mirrors Projectile.lua.
 */

import { GameRules, type TickableSystem } from '../core/GameRules';

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
}

export class ProjectileManager implements TickableSystem {
  private projectiles: ProjectileData[] = [];
  private nextId = 1;

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
      proj.progress += dt * proj.speed;

      if (proj.progress >= 1) {
        // Hit target — damage will be applied by combat system
        this.projectiles.splice(i, 1);
      }
    }
  }

  getActiveProjectiles(): ProjectileData[] {
    return this.projectiles;
  }
}
