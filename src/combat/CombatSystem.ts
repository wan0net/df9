/**
 * CombatSystem.ts — Combat resolution for melee and ranged attacks.
 * Mirrors Combat logic from CharacterManager.lua + Projectile.lua.
 */

import { Character } from '../characters/Character';
import {
  TEAM_ID_PLAYER, TEAM_ID_DEBUG_ENEMYGROUP, TEAM_ID_PLAYER_ABANDONED,
  HUMAN_MELEE_DAMAGE, MELEE_RANGE,
  DAMAGE_TYPE, ATTACK_TYPE, CAUSE_OF_DEATH,
} from '../characters/CharacterConstants';
import { WEAPON_DEFS, type WeaponDef } from './WeaponData';
import type { ProjectileManager } from '../hazards/Projectile';

/** Grapple duration before melee damage is applied. */
const GRAPPLE_TIME = 3;
/** Cooldown between attacks. */
const ATTACK_COOLDOWN = 2;

/** Manhattan distance between two tiles. */
function tileDist(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

/** Check if two teams are hostile to each other. */
export function isHostile(teamA: number, teamB: number): boolean {
  if (teamA === teamB) return false;
  // Player team vs enemy groups
  if (teamA === TEAM_ID_PLAYER && teamB === TEAM_ID_DEBUG_ENEMYGROUP) return true;
  if (teamA === TEAM_ID_DEBUG_ENEMYGROUP && teamB === TEAM_ID_PLAYER) return true;
  // Abandoned citizens vs everyone
  if (teamA === TEAM_ID_PLAYER_ABANDONED || teamB === TEAM_ID_PLAYER_ABANDONED) return true;
  // All negative teams are hostile to player
  if ((teamA === TEAM_ID_PLAYER && teamB < 0) || (teamB === TEAM_ID_PLAYER && teamA < 0)) return true;
  return false;
}

/** Check if two teams are friendly. */
export function isFriendly(teamA: number, teamB: number): boolean {
  return teamA === teamB;
}

/** Active combat engagement between two characters. */
interface CombatEngagement {
  attackerId: number;
  defenderId: number;
  grappleTimer: number;
  attackCooldown: number;
  weapon: WeaponDef;
}

export class CombatSystem {
  private engagements: CombatEngagement[] = [];
  private projectileManager: ProjectileManager | null = null;

  setProjectileManager(pm: ProjectileManager) {
    this.projectileManager = pm;
  }

  /** Start a combat engagement between attacker and defender. */
  engage(attacker: Character, defender: Character): boolean {
    // Don't duplicate engagements
    if (this.isEngaged(attacker.id)) return false;

    const weapon = this.getWeapon(attacker);
    const dist = tileDist(attacker.tileX, attacker.tileY, defender.tileX, defender.tileY);

    // Range check
    if (dist > weapon.nRange) return false;

    this.engagements.push({
      attackerId: attacker.id,
      defenderId: defender.id,
      grappleTimer: 0,
      attackCooldown: 0,
      weapon,
    });
    return true;
  }

  /** Disengage an attacker from combat. */
  disengage(attackerId: number) {
    this.engagements = this.engagements.filter(e => e.attackerId !== attackerId);
  }

  /** Check if a character is currently engaged in combat. */
  isEngaged(charId: number): boolean {
    return this.engagements.some(e => e.attackerId === charId || e.defenderId === charId);
  }

  /** Update all combat engagements. Returns array of [attackerId, defenderId, damage, damageType] for hits. */
  update(dt: number, getCharById: (id: number) => Character | undefined): {
    attackerId: number; defenderId: number; damage: number; damageType: number;
  }[] {
    const hits: { attackerId: number; defenderId: number; damage: number; damageType: number }[] = [];
    const toRemove: number[] = [];

    for (let i = 0; i < this.engagements.length; i++) {
      const eng = this.engagements[i];
      const attacker = getCharById(eng.attackerId);
      const defender = getCharById(eng.defenderId);

      // Remove if either is dead or missing
      if (!attacker || !defender || !attacker.isAlive() || !defender.isAlive()) {
        toRemove.push(i);
        continue;
      }

      const dist = tileDist(attacker.tileX, attacker.tileY, defender.tileX, defender.tileY);

      if (eng.weapon.nAttackType === ATTACK_TYPE.Grapple) {
        // Melee: grapple then damage
        if (dist > MELEE_RANGE) {
          toRemove.push(i);
          continue;
        }

        eng.grappleTimer += dt;
        if (eng.grappleTimer >= GRAPPLE_TIME) {
          eng.grappleTimer = 0;
          hits.push({
            attackerId: eng.attackerId,
            defenderId: eng.defenderId,
            damage: eng.weapon.nDamage,
            damageType: eng.weapon.nDamageType,
          });
        }
      } else {
        // Ranged: fire rate cooldown, then fire projectile
        if (dist > eng.weapon.nRange) {
          toRemove.push(i);
          continue;
        }

        eng.attackCooldown += dt;
        const fireInterval = 1 / eng.weapon.nFireRate;
        if (eng.attackCooldown >= fireInterval) {
          eng.attackCooldown = 0;

          if (this.projectileManager) {
            // Fire a projectile
            this.projectileManager.fire(
              attacker.tileX, attacker.tileY,
              defender.tileX, defender.tileY,
              eng.weapon.nProjectileSpeed,
              eng.weapon.nDamage,
              eng.weapon.nDamageType,
            );
          }

          // For simplicity, register hit immediately (projectile travel is visual only)
          hits.push({
            attackerId: eng.attackerId,
            defenderId: eng.defenderId,
            damage: eng.weapon.nDamage,
            damageType: eng.weapon.nDamageType,
          });
        }
      }
    }

    // Remove finished engagements (in reverse order)
    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.engagements.splice(toRemove[i], 1);
    }

    return hits;
  }

  /** Get the weapon for a character. */
  private getWeapon(char: Character): WeaponDef {
    if (char.weapon && WEAPON_DEFS[char.weapon]) {
      return WEAPON_DEFS[char.weapon];
    }
    return WEAPON_DEFS['Fists'];
  }

  /** Find the nearest hostile character to the given character. */
  findNearestHostile(char: Character, allChars: Character[]): Character | null {
    let nearest: Character | null = null;
    let nearestDist = Infinity;

    for (const other of allChars) {
      if (other === char || !other.isAlive()) continue;
      if (!isHostile(char.tStats.nTeam, other.tStats.nTeam)) continue;

      const dist = tileDist(char.tileX, char.tileY, other.tileX, other.tileY);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = other;
      }
    }

    return nearest;
  }

  /** Get damage cause from damage type. */
  static getCauseFromDamageType(damageType: number): number {
    switch (damageType) {
      case DAMAGE_TYPE.Melee: return CAUSE_OF_DEATH.COMBAT_MELEE;
      case DAMAGE_TYPE.Laser: return CAUSE_OF_DEATH.COMBAT_RANGED;
      case DAMAGE_TYPE.Fire: return CAUSE_OF_DEATH.FIRE;
      default: return CAUSE_OF_DEATH.UNSPECIFIED;
    }
  }

  getEngagementCount(): number {
    return this.engagements.length;
  }
}
