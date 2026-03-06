/**
 * AttackEnemy.ts — Full combat task matching Lua AttackEnemy.lua.
 *
 * State machine:
 *   1. Validate target (alive, reachable)
 *   2. If grappling/shooting → continue attack
 *   3. If in range → attempt attack (grapple or ranged)
 *   4. Else → follow/pathfind to target
 *   5. If stuck → interrupt
 */

import { Task, type NeedAdvertisement } from '../Task';
import type { Character } from '../../characters/Character';
import { ATTACK_TYPE, MELEE_RANGE } from '../../characters/CharacterConstants';
import { WEAPON_DEFS, type WeaponDef } from '../../combat/WeaponData';
import { checkLineOfSight } from '../../combat/CombatSystem';
import type { TileGrid } from '../../world/TileGrid';

// ── Constants (Lua AttackEnemy.lua) ─────────────────────────────────────
const GRAPPLE_DURATION = 3;
const DEFAULT_MIN_AIM = 0.35;
const DEFAULT_MAX_AIM = 0.65;
const DEFAULT_MIN_COOLDOWN = 0.1;
const DEFAULT_MAX_COOLDOWN = 0.4;
/** Max time to spend on this task before re-evaluating. */
const MAX_COMBAT_TIME = 60;
/** Max time trying to reach target before giving up. */
const MAX_APPROACH_TIME = 15;

/** Chebyshev distance between two tiles. */
function tileDist(ax: number, ay: number, bx: number, by: number): number {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

function randomFloat(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export class AttackEnemy extends Task {
  readonly name = 'AttackEnemy';
  private targetCharId: number;

  // ── Attack state ────────────────────────────────────────
  private bGrappling = false;
  private grappleTimer = 0;
  private grappleDuration = GRAPPLE_DURATION;

  private bShooting = false;
  private shootTimer = 0;
  private aimTarget = 0;
  private cooldownTarget = 0;
  private bCoolingDown = false;

  /** Time spent approaching without being in range. */
  private approachTimer = 0;

  /** Resolved weapon for this engagement. */
  private weapon: WeaponDef | null = null;

  /** Grid reference for LoS checks (set externally). */
  static grid: TileGrid | null = null;

  /** Callback to resolve character by ID (set externally). */
  static getCharById: ((id: number) => Character | undefined) | null = null;

  constructor(targetCharId: number) {
    super();
    this.targetCharId = targetCharId;
  }

  getAdvertisedNeeds(): NeedAdvertisement[] {
    return [{ need: 'duty', amount: 40 }];
  }

  getTargetCharId(): number {
    return this.targetCharId;
  }

  protected onStart() {
    this.duration = 0; // continuous
    if (this.character) {
      this.weapon = this.resolveWeapon(this.character);
    }
  }

  protected onUpdate(dt: number) {
    if (!this.character) { this.fail(); return; }

    // Overall timeout
    if (this.elapsedTime >= MAX_COMBAT_TIME) {
      this.complete();
      return;
    }

    // ── Step 1: Validate target ────────────────────────────
    const target = AttackEnemy.getCharById?.(this.targetCharId);
    if (!target || !target.isAlive()) {
      this.complete(); // Target dead or gone
      return;
    }

    // ── Step 2: Continue active attack ─────────────────────
    if (this.bGrappling) {
      this.updateGrapple(dt, target);
      return;
    }
    if (this.bShooting) {
      this.updateShoot(dt, target);
      return;
    }

    // ── Step 3: Attempt new attack if in range ─────────────
    if (this.attemptAttack(target)) {
      this.approachTimer = 0;
      return;
    }

    // ── Step 4: Follow target ──────────────────────────────
    this.approachTimer += dt;
    if (this.approachTimer > MAX_APPROACH_TIME) {
      this.fail(); // Can't reach target
      return;
    }

    // Update target position for pathfinding
    this.targetX = target.tileX;
    this.targetY = target.tileY;
  }

  // ── Weapon resolution ─────────────────────────────────────

  private resolveWeapon(char: Character): WeaponDef {
    if (char.weapon && WEAPON_DEFS[char.weapon]) {
      return WEAPON_DEFS[char.weapon];
    }
    const fists = WEAPON_DEFS['Fists'];
    const raceDamage = char.getMeleeDamage();
    if (raceDamage !== fists.nDamage) {
      return { ...fists, nDamage: raceDamage };
    }
    return fists;
  }

  // ── Attack attempt ────────────────────────────────────────

  private attemptAttack(target: Character): boolean {
    if (!this.character || !this.weapon) return false;

    const dist = tileDist(
      this.character.tileX, this.character.tileY,
      target.tileX, target.tileY,
    );

    if (this.weapon.nAttackType === ATTACK_TYPE.Grapple) {
      // Melee: must be adjacent
      if (dist <= MELEE_RANGE) {
        this.startGrapple();
        return true;
      }
    } else {
      // Ranged/Stunner: must be in range with LoS
      if (dist <= this.weapon.nRange && dist > 0) {
        if (this.hasLineOfSight(target)) {
          this.startShoot();
          return true;
        }
      }
    }

    return false;
  }

  // ── Grapple (melee) ───────────────────────────────────────

  private startGrapple() {
    this.bGrappling = true;
    this.grappleTimer = 0;
    this.grappleDuration = this.weapon?.nMeleeCoolDown ?? GRAPPLE_DURATION;
  }

  private updateGrapple(dt: number, target: Character) {
    if (!this.character || !this.weapon) { this.bGrappling = false; return; }

    const dist = tileDist(
      this.character.tileX, this.character.tileY,
      target.tileX, target.tileY,
    );

    // Out of melee range — stop grapple
    if (dist > MELEE_RANGE) {
      this.bGrappling = false;
      return;
    }

    this.grappleTimer += dt;
    if (this.grappleTimer >= this.grappleDuration) {
      this.grappleTimer = 0;
      // Deal damage — CombatSystem.processHit handles armor/dodge
      // (The actual hit is dispatched by CombatSystem.update via the engagement)
      // Mark target so CharacterManager knows we're still fighting
      if (!target.isAlive()) {
        this.bGrappling = false;
        this.complete();
      }
    }
  }

  // ── Shoot (ranged) ────────────────────────────────────────

  private startShoot() {
    this.bShooting = true;
    this.shootTimer = 0;
    this.bCoolingDown = false;
    const minAim = this.weapon?.nMinAimTime ?? DEFAULT_MIN_AIM;
    const maxAim = this.weapon?.nMaxAimTime ?? DEFAULT_MAX_AIM;
    this.aimTarget = randomFloat(minAim, maxAim);
  }

  private updateShoot(dt: number, target: Character) {
    if (!this.character || !this.weapon) { this.bShooting = false; return; }

    const dist = tileDist(
      this.character.tileX, this.character.tileY,
      target.tileX, target.tileY,
    );

    // Out of range — stop shooting
    if (dist > this.weapon.nRange || dist === 0) {
      this.bShooting = false;
      return;
    }

    this.shootTimer += dt;

    if (this.bCoolingDown) {
      // Cooldown phase — wait before next aim
      if (this.shootTimer >= this.cooldownTarget) {
        this.bCoolingDown = false;
        this.shootTimer = 0;
        const minAim = this.weapon.nMinAimTime ?? DEFAULT_MIN_AIM;
        const maxAim = this.weapon.nMaxAimTime ?? DEFAULT_MAX_AIM;
        this.aimTarget = randomFloat(minAim, maxAim);
      }
    } else {
      // Aim phase — fire when timer complete
      if (this.shootTimer >= this.aimTarget) {
        // Re-check LoS before firing
        if (this.hasLineOfSight(target)) {
          // Fire! (damage dispatched by CombatSystem engagement)
          // Enter cooldown
          this.bCoolingDown = true;
          this.shootTimer = 0;
          const minCool = this.weapon.nMinCoolDown ?? DEFAULT_MIN_COOLDOWN;
          const maxCool = this.weapon.nMaxCoolDown ?? DEFAULT_MAX_COOLDOWN;
          this.cooldownTarget = randomFloat(minCool, maxCool);

          if (!target.isAlive()) {
            this.bShooting = false;
            this.complete();
          }
        } else {
          // Lost LoS — stop shooting, approach
          this.bShooting = false;
        }
      }
    }
  }

  // ── Line of sight ─────────────────────────────────────────

  private hasLineOfSight(target: Character): boolean {
    if (!this.character || !AttackEnemy.grid) return true; // No grid = assume LoS
    return checkLineOfSight(
      AttackEnemy.grid,
      this.character.tileX, this.character.tileY,
      target.tileX, target.tileY,
    );
  }
}
