/**
 * CombatSystem.ts — Combat resolution for melee and ranged attacks.
 * Mirrors Combat logic from CharacterManager.lua + AttackEnemy.lua + GridUtil.lua.
 */

import { Character } from '../characters/Character';
import {
  TEAM_ID_PLAYER, TEAM_ID_DEBUG_ENEMYGROUP, TEAM_ID_PLAYER_ABANDONED,
  HUMAN_MELEE_DAMAGE, MELEE_RANGE, EMERGENCY,
  DAMAGE_TYPE, ATTACK_TYPE, CAUSE_OF_DEATH,
  STARTLE_CHANCE, MEMORY_STARTLED_RECENTLY, MEMORY_STARTLED_RECENTLY_DURATION,
  RACE_HUMAN, RACE_CAT, RACE_JELLY, RACE_TOBIAN, RACE_BIRDSHARK, RACE_CHICKEN, RACE_SHAMON,
  RACE_MONSTER, RACE_KILLBOT,
  FACTION_BEHAVIOR,
} from '../characters/CharacterConstants';
import { WEAPON_DEFS, type WeaponDef } from './WeaponData';
import type { ProjectileManager } from '../hazards/Projectile';
import { Base } from '../core/Base';
import type { TileGrid } from '../world/TileGrid';
import type { EnvObject } from '../envobjects/EnvObject';
import { EnvObjectManager } from '../envobjects/EnvObjectManager';
import { TileType } from '../world/TileTypes';
import { researchSystem } from '../research/ResearchSystem';

/** Grapple duration before melee damage is applied. */
const GRAPPLE_TIME = 3;
/** Cooldown between attacks. */
const ATTACK_COOLDOWN = 2;
/** Default aim time range if weapon has none. */
const DEFAULT_MIN_AIM = 0.35;
const DEFAULT_MAX_AIM = 0.65;
/** Default cooldown range if weapon has none. */
const DEFAULT_MIN_COOLDOWN = 0.1;
const DEFAULT_MAX_COOLDOWN = 0.4;

/** Chebyshev distance between two tiles. */
function tileDist(ax: number, ay: number, bx: number, by: number): number {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

/** Random float in [min, max]. */
function randomFloat(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Check if two teams are hostile to each other (delegates to Base alliance matrix). */
export function isHostile(teamA: number, teamB: number): boolean {
  if (teamA === teamB) return false;
  return !Base.isFriendly(teamA, teamB);
}

/** Check if two teams are friendly (delegates to Base alliance matrix). */
export function isFriendly(teamA: number, teamB: number): boolean {
  return Base.isFriendly(teamA, teamB);
}

// ── Line-of-sight (mirrors GridUtil.CheckLineOfSight) ────────────────

/**
 * Get tiles along a line from (x0,y0) to (x1,y1) using Bresenham.
 * Returns array of [x, y] tile coordinates.
 */
function getTilesForLine(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  const tiles: [number, number][] = [];
  let dx = Math.abs(x1 - x0);
  let dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let cx = x0, cy = y0;

  while (true) {
    tiles.push([cx, cy]);
    if (cx === x1 && cy === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; cx += sx; }
    if (e2 < dx) { err += dx; cy += sy; }
  }
  return tiles;
}

/**
 * Check line of sight between two tiles (Lua GridUtil.CheckLineOfSight).
 * Returns true if path is clear. Walls, closed doors, and asteroids block LoS.
 * @param bWallsOnly — if true, only walls block (not doors/asteroids).
 */
export function checkLineOfSight(
  grid: TileGrid,
  tx0: number, ty0: number, tx1: number, ty1: number,
  bWallsOnly = false,
): boolean {
  const tiles = getTilesForLine(tx0, ty0, tx1, ty1);
  for (const [x, y] of tiles) {
    // Skip endpoints (Lua: two walls facing each other technically have LoS)
    if (x === tx0 && y === ty0) continue;
    if (x === tx1 && y === ty1) continue;

    const tileValue = grid.get(x, y);
    if (bWallsOnly) {
      if (tileValue === TileType.WALL) return false;
    } else {
      if (tileValue === TileType.WALL) return false;
      // C-38: SPACE tiles do NOT block LoS in Lua — only walls and closed doors
      if (tileValue === TileType.DOOR) {
        const door = EnvObjectManager.getDoorAt(x, y);
        if (door && !door.isOpen()) return false;
      }
    }
  }
  return true;
}

// ── Combat engagement ────────────────────────────────────────────────

/** Active combat engagement between two characters. */
interface CombatEngagement {
  attackerId: number;
  defenderId: number;
  grappleTimer: number;
  /** Aim phase timer — must complete before shooting (Lua nNextShootAimTime). */
  aimTimer: number;
  /** Target aim time for this shot. */
  aimTarget: number;
  /** Cooldown timer after each shot (Lua nNextShootCooldownTime). */
  cooldownTimer: number;
  /** Target cooldown for this shot. */
  cooldownTarget: number;
  /** Whether currently in cooldown (vs aiming). */
  bCoolingDown: boolean;
  weapon: WeaponDef;
}

export class CombatSystem {
  private engagements: CombatEngagement[] = [];
  private projectileManager: ProjectileManager | null = null;
  /** Optional grid reference for LoS checks. */
  grid: TileGrid | null = null;

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
    if (dist > weapon.nRange && weapon.nAttackType !== ATTACK_TYPE.Grapple) return false;

    // LoS check for ranged weapons
    if (weapon.nAttackType === ATTACK_TYPE.Ranged || weapon.nAttackType === ATTACK_TYPE.Stunner) {
      if (this.grid && !checkLineOfSight(this.grid, attacker.tileX, attacker.tileY, defender.tileX, defender.tileY)) {
        return false;
      }
    }

    // Compute initial aim/cooldown times from weapon data
    const minAim = weapon.nMinAimTime ?? DEFAULT_MIN_AIM;
    const maxAim = weapon.nMaxAimTime ?? DEFAULT_MAX_AIM;
    const minCool = weapon.nMinCoolDown ?? DEFAULT_MIN_COOLDOWN;
    const maxCool = weapon.nMaxCoolDown ?? DEFAULT_MAX_COOLDOWN;

    this.engagements.push({
      attackerId: attacker.id,
      defenderId: defender.id,
      grappleTimer: 0,
      aimTimer: 0,
      aimTarget: randomFloat(minAim, maxAim),
      cooldownTimer: 0,
      cooldownTarget: randomFloat(minCool, maxCool),
      bCoolingDown: false,
      weapon,
    });

    // Startle animation check (Lua AttackEnemy.lua:62-72)
    // Emergency on duty and raiders/monsters don't startle
    const bBrawling = attacker.tBrawlingWith.size > 0;
    const isEmergencyOnDuty = attacker.getJob() === EMERGENCY &&
      (attacker.nRemainingDutyTime > 0);
    const race = attacker.tStats.nRace;
    if (!isEmergencyOnDuty && !bBrawling &&
        race !== RACE_MONSTER && race !== RACE_KILLBOT &&
        Math.random() < STARTLE_CHANCE) {
      if (!attacker.retrieveMemory(MEMORY_STARTLED_RECENTLY)) {
        // Would play startle anim here — store memory to prevent re-startling
        attacker.storeMemory(MEMORY_STARTLED_RECENTLY, true, MEMORY_STARTLED_RECENTLY_DURATION);
      }
    }

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

  /** Update all combat engagements. Returns array of hits for damage processing. */
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
        const meleeCooldown = eng.weapon.nMeleeCoolDown ?? GRAPPLE_TIME;
        if (eng.grappleTimer >= meleeCooldown) {
          eng.grappleTimer = 0;
          hits.push({
            attackerId: eng.attackerId,
            defenderId: eng.defenderId,
            damage: eng.weapon.nDamage,
            damageType: eng.weapon.nDamageType,
          });
        }
      } else {
        // Ranged/Stunner: aim phase → shoot → cooldown → aim → shoot...
        if (dist > eng.weapon.nRange) {
          toRemove.push(i);
          continue;
        }

        if (eng.bCoolingDown) {
          // Cooldown phase
          eng.cooldownTimer += dt;
          if (eng.cooldownTimer >= eng.cooldownTarget) {
            eng.bCoolingDown = false;
            eng.aimTimer = 0;
            const minAim = eng.weapon.nMinAimTime ?? DEFAULT_MIN_AIM;
            const maxAim = eng.weapon.nMaxAimTime ?? DEFAULT_MAX_AIM;
            eng.aimTarget = randomFloat(minAim, maxAim);
          }
        } else {
          // Aim phase
          eng.aimTimer += dt;
          if (eng.aimTimer >= eng.aimTarget) {
            // Re-check LoS before firing
            let hasLoS = true;
            if (this.grid) {
              hasLoS = checkLineOfSight(this.grid, attacker.tileX, attacker.tileY, defender.tileX, defender.tileY);
            }

            if (hasLoS) {
              // Fire projectile visual
              if (this.projectileManager) {
                this.projectileManager.fire(
                  attacker.tileX, attacker.tileY,
                  defender.tileX, defender.tileY,
                  eng.weapon.nProjectileSpeed,
                  eng.weapon.nDamage,
                  eng.weapon.nDamageType,
                );
              }

              // Dodge check (Lua Projectile:_attemptToHitTarget)
              const dodgeChance = defender.dodgeAttackChance();
              if (Math.random() > dodgeChance) {
                // Hit!
                hits.push({
                  attackerId: eng.attackerId,
                  defenderId: eng.defenderId,
                  damage: eng.weapon.nDamage,
                  damageType: eng.weapon.nDamageType,
                });
              }
              // Miss — projectile continues but no damage applied

              // Enter cooldown
              eng.bCoolingDown = true;
              eng.cooldownTimer = 0;
              const minCool = eng.weapon.nMinCoolDown ?? DEFAULT_MIN_COOLDOWN;
              const maxCool = eng.weapon.nMaxCoolDown ?? DEFAULT_MAX_COOLDOWN;
              eng.cooldownTarget = randomFloat(minCool, maxCool);
            } else {
              // No LoS — disengage
              toRemove.push(i);
            }
          }
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
    // Use race melee damage for unarmed combat (Lua: MONSTER=40, HUMAN=20)
    const raceDamage = char.getMeleeDamage();
    const fists = WEAPON_DEFS['Fists'];
    if (raceDamage !== fists.nDamage) {
      return { ...fists, nDamage: raceDamage };
    }
    return fists;
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

  /** Get damage cause from damage type. Stunner → STUNNER cause. */
  static getCauseFromDamageType(damageType: number): number {
    switch (damageType) {
      case DAMAGE_TYPE.Melee: return CAUSE_OF_DEATH.COMBAT_MELEE;
      case DAMAGE_TYPE.Laser: return CAUSE_OF_DEATH.COMBAT_RANGED;
      case DAMAGE_TYPE.Fire: return CAUSE_OF_DEATH.FIRE;
      case DAMAGE_TYPE.Stunner: return CAUSE_OF_DEATH.STUNNER;
      default: return CAUSE_OF_DEATH.UNSPECIFIED;
    }
  }

  /**
   * Get damage reduction for a character.
   * Lua Character.lua:5468-5484 — ArmorLevel2 (0.5) + TeamTactics (+0.75 if nearby security).
   * @param allChars — all characters for team tactics proximity check.
   */
  static getDamageReduction(defender: Character, allChars?: Character[]): number {
    let reduction = 0;
    // ArmorLevel2: security officers get 0.5 damage reduction
    if (defender.tStats.nJob === EMERGENCY && researchSystem.isCompleted('ArmorLevel2')) {
      reduction += 0.5;
    }
    // TeamTactics: +0.75 if 1-5 other security officers within ~20 tiles
    if (defender.tStats.nJob === EMERGENCY && defender.tStats.nTeam === TEAM_ID_PLAYER
        && researchSystem.isCompleted('TeamTactics') && allChars) {
      let nearbyCount = 0;
      for (const other of allChars) {
        if (other === defender || !other.isAlive()) continue;
        if (other.tStats.nJob !== EMERGENCY || other.tStats.nTeam !== TEAM_ID_PLAYER) continue;
        const dist = tileDist(defender.tileX, defender.tileY, other.tileX, other.tileY);
        if (dist <= 20) {
          nearbyCount++;
          if (nearbyCount >= 5) break;
        }
      }
      if (nearbyCount > 0) reduction += 0.75;
    }
    return Math.min(reduction, 0.95); // cap at 95%
  }

  /**
   * Process a hit: applies damage, handles stunner incapacitation.
   * Lua: stunner damage type knocks out instead of killing (creates KnockedOut malady).
   * Returns true if character died, false if incapacitated.
   * @param allChars — all characters for team tactics damage reduction.
   */
  static processHit(
    defender: Character, damage: number, damageType: number,
    _attacker?: Character, allChars?: Character[],
  ): boolean {
    // Apply damage reduction (armor + team tactics)
    const reduction = CombatSystem.getDamageReduction(defender, allChars);
    const effectiveDamage = Math.max(1, Math.round(damage * (1 - reduction)));
    // C-40: Removed separate ArmorLevel2 dodge — Lua only uses damage reduction (0.5)
    defender.takeDamage(effectiveDamage);
    if (!defender.isAlive()) {
      // Stunner damage type → incapacitate instead of kill (Lua Character.lua:5592-5617)
      if (damageType === DAMAGE_TYPE.Stunner) {
        defender.setHP(10);
        defender.bIncapacitated = true;
        return false;
      }
      // C-39: Removed invented 50% melee stun — not in Lua
      return true; // Actually dead
    }
    return false;
  }

  /**
   * Attack an environment object (door, machine, etc.), reducing nCondition.
   * Lua AttackEnemy.lua — rampaging characters attack objects; raiders smash doors.
   */
  static attackObject(obj: EnvObject, damage: number): void {
    obj.damageCondition(damage);
  }

  getEngagementCount(): number {
    return this.engagements.length;
  }
}
