/**
 * WeaponData.ts — Weapon definitions.
 * Mirrors WeaponData.lua.
 */

import { DAMAGE_TYPE, ATTACK_TYPE } from '../characters/CharacterConstants';

export interface WeaponDef {
  sName: string;
  friendlyName: string;
  nDamage: number;
  nDamageType: number;
  nAttackType: number;
  nRange: number;
  nFireRate: number; // shots per second
  nProjectileSpeed: number;
}

export const WEAPON_DEFS: Record<string, WeaponDef> = {
  Fists: {
    sName: 'Fists',
    friendlyName: 'Fists',
    nDamage: 10,
    nDamageType: DAMAGE_TYPE.Melee,
    nAttackType: ATTACK_TYPE.Grapple,
    nRange: 1,
    nFireRate: 1,
    nProjectileSpeed: 0,
  },
  LaserPistol: {
    sName: 'LaserPistol',
    friendlyName: 'Laser Pistol',
    nDamage: 15,
    nDamageType: DAMAGE_TYPE.Laser,
    nAttackType: ATTACK_TYPE.Ranged,
    nRange: 8,
    nFireRate: 0.5,
    nProjectileSpeed: 10,
  },
  LaserRifle: {
    sName: 'LaserRifle',
    friendlyName: 'Laser Rifle',
    nDamage: 25,
    nDamageType: DAMAGE_TYPE.Laser,
    nAttackType: ATTACK_TYPE.Ranged,
    nRange: 12,
    nFireRate: 0.3,
    nProjectileSpeed: 12,
  },
  Stunner: {
    sName: 'Stunner',
    friendlyName: 'Stunner',
    nDamage: 5,
    nDamageType: DAMAGE_TYPE.Stunner,
    nAttackType: ATTACK_TYPE.Stunner,
    nRange: 6,
    nFireRate: 0.7,
    nProjectileSpeed: 8,
  },
  TurretLaser: {
    sName: 'TurretLaser',
    friendlyName: 'Turret Laser',
    nDamage: 20,
    nDamageType: DAMAGE_TYPE.Laser,
    nAttackType: ATTACK_TYPE.Ranged,
    nRange: 10,
    nFireRate: 0.4,
    nProjectileSpeed: 15,
  },
};
