/**
 * EnvObject.ts — Base class for placeable environment objects.
 * Mirrors EnvObjects/EnvObject.lua: condition, power, oxygen gen, decay, tick.
 */

import { EnvObjectDef, tObjects } from './EnvObjectData';
import { ObjectList, OBJ_ENVOBJECT, type ObjectTag, type TaggableObject } from '../core/ObjectList';
import { SpatialAudio } from '../audio/SpatialAudio';
import { GameRules } from '../core/GameRules';
import { SoundManager } from '../audio/SoundManager';
import type { Room } from '../rooms/Room';
import type { Character } from '../characters/Character';
import { researchSystem } from '../research/ResearchSystem';
import { RESEARCH_DEFS } from '../research/ResearchData';

// ── Constants matching EnvObject.lua ────────────────────────────────────
export const MIN_PCT_HEALED_PER_MAINTAIN = 2;
export const MAX_PCT_HEALED_PER_MAINTAIN = 25;
export const CONDITION_NEEDED_TO_MAINTAIN = 80;
export const DAMAGED_CONDITION = 50;
export const DANGER_ZONE = 20;
export const DESTROYED_FIRE_CHECK_DELAY = 30;
export const DESTROYED_FIRE_CHECK_INTERVAL = 60;
export const DESTROYED_FIRE_CHANCE = 0.05;
/** Fire chance on maintenance failure in danger zone (Lua: 0.2 = 20%). */
export const PROBABILITY_FIRE_ON_DANGER_ZONE_MAINTAIN_FAILURE = 0.2;
/** Spark visual frequency in danger zone (seconds between sparks). */
export const DANGER_SPARK_FREQUENCY = 6;

/** Static callback for renderer notifications. Set from main.ts. */
export type EnvObjectUpdateFn = (id: number, obj: EnvObject) => void;

export class EnvObject implements TaggableObject {
  /** Static callback set by the game loop to notify renderer of visual changes. */
  static onVisualUpdate: EnvObjectUpdateFn | null = null;
  /** Static callback for spontaneous fire from destroyed objects. */
  static onFireStart: ((tileX: number, tileY: number) => void) | null = null;

  // ObjectList integration
  _ObjectList_ObjectMarker?: ObjectTag;

  // Identity
  id = -1; // assigned by EnvObjectManager
  readonly sName: string;
  readonly tData: EnvObjectDef;
  sUniqueName = '';

  // Position
  tileX: number;
  tileY: number;
  bFlipX: boolean;
  bFlipY: boolean;

  /** For againstWall objects: the wall tile this object is mounted against (Lua getWallTile). */
  wallTileX = -1;
  wallTileY = -1;

  // Condition & wear
  nCondition = 100;
  private decayAccum = 0;

  // Power
  bActive = true;
  bHasPower = false;
  /** O-13: Sabotage timer — game time when power loss ends. -1 = no sabotage. */
  nTempPowerLossEnd = -1;

  // Room assignment
  rRoom: Room | null = null;

  // Oxygen generation
  bGeneratingOxygen = false;

  // Interact sprite state
  bUseInteractSprite = false;

  /** Current user interacting with this object (Lua EnvObject.rUser). */
  rUser: Character | null = null;

  // ── Reservation system (Lua EnvObject capacity gating) ──────────
  /** Max simultaneous reservations (from tData.nCapacity or default 1). */
  nMaxReservations = 1;
  /** Character IDs that have reserved this object. */
  reservedBy = new Set<number>();

  /** Attempt to reserve this object for a character. Returns true if successful. */
  reserve(charId: number): boolean {
    if (this.reservedBy.has(charId)) return true;
    if (this.reservedBy.size >= this.nMaxReservations) return false;
    this.reservedBy.add(charId);
    return true;
  }

  /** Release a character's reservation on this object. */
  unreserve(charId: number): void {
    this.reservedBy.delete(charId);
  }

  /** Whether this object is fully reserved. */
  isFullyReserved(): boolean {
    return this.reservedBy.size >= this.nMaxReservations;
  }

  // Construction state
  bBuilt = true;
  sBuilderName = '';
  sBuildTime = '';

  // Demolition
  bSlatedForVaporize = false;

  // Broken timer (for fire chance)
  private nBrokenTimer = 0;
  private nFireCheckTimer = 0;
  private bCaughtFire = false;

  constructor(sName: string, tileX: number, tileY: number, bFlipX = false, bFlipY = false) {
    this.sName = sName;
    this.tData = tObjects[sName];
    if (!this.tData) {
      throw new Error(`EnvObject: unknown object type '${sName}'`);
    }
    this.tileX = tileX;
    this.tileY = tileY;
    this.bFlipX = bFlipX;
    this.bFlipY = bFlipY;

    // Register with ObjectList
    ObjectList.addObject(
      OBJ_ENVOBJECT,
      sName,
      this,
      this.tData.bBlocksPathing,
      this.tData.bBlocksOxygen,
      tileX,
      tileY,
      bFlipX,
      bFlipY,
    );

    // Start O2 generation if applicable
    this._updateOxygenGeneration();
  }

  // ── Condition ────────────────────────────────────────────────

  getCondition(): number {
    return this.nCondition;
  }

  setCondition(c: number) {
    this.nCondition = Math.max(0, Math.min(100, c));
    this._updateOxygenGeneration();
    this._notifyRenderer();
  }

  /** Damage condition. If bMaintainFailure and in danger zone with explodeOnFailure,
   *  20% chance to start a fire (Lua EnvObject:damageCondition). Returns true if fire started. */
  damageCondition(amount: number, bMaintainFailure = false): boolean {
    this.setCondition(this.nCondition - amount);
    if (bMaintainFailure && this.nCondition > 0 && this.nCondition <= DANGER_ZONE && this.tData.explodeOnFailure) {
      if (Math.random() < PROBABILITY_FIRE_ON_DANGER_ZONE_MAINTAIN_FAILURE) {
        EnvObject.onFireStart?.(this.tileX, this.tileY);
        return true;
      }
    }
    return false;
  }

  /** Repair object during maintenance task. Returns new condition.
   *  If task fails (competence too low), damages instead with fire risk. */
  maintain(startCondition: number, competence: number, bFailed = false): number {
    if (bFailed) {
      this.damageCondition(0, true); // 0 damage but triggers fire check in danger zone
      return this.nCondition;
    }
    let healPct = MIN_PCT_HEALED_PER_MAINTAIN +
      competence * (MAX_PCT_HEALED_PER_MAINTAIN - MIN_PCT_HEALED_PER_MAINTAIN);
    // Lua EnvObject.lua:1397-1399 — MaintenanceLevel2 multiplier
    if (researchSystem.isCompleted('MaintenanceLevel2')) {
      healPct *= RESEARCH_DEFS['MaintenanceLevel2'].nConditionMultiplier ?? 1;
    }
    this.setCondition(Math.min(100, startCondition + healPct));
    return this.nCondition;
  }

  isDestroyed(): boolean {
    return this.nCondition <= 0;
  }

  isDamaged(): boolean {
    return this.nCondition < DAMAGED_CONDITION;
  }

  /** Localized condition string (Lua EnvObject:getConditionUIString). */
  getConditionUIString(): string {
    if (this.nCondition <= 0) return 'Destroyed';
    if (this.nCondition <= 25) return 'Critical';
    if (this.nCondition <= 50) return 'Damaged';
    if (this.nCondition <= 75) return 'Worn';
    return 'Good';
  }

  /** Emergency status string for inspector overlay (Lua EnvObject:getEmergencyString). */
  getEmergencyString(): string | null {
    if (this.isDestroyed()) return 'DESTROYED';
    if (!this.bHasPower && this.tData.nPowerDraw > 0) return 'NO POWER';
    if (this.nCondition <= 20) return 'CRITICAL';
    if (!this.bBuilt) return 'BUILDING';
    return null;
  }

  needsMaintenance(): boolean {
    return this.nCondition < CONDITION_NEEDED_TO_MAINTAIN;
  }

  // ── Power ────────────────────────────────────────────────────

  hasPower(): boolean {
    if (!this.bActive) return false;
    if (this.tData.nPowerDraw <= 0 && this.tData.nPowerOutput <= 0) return true;
    // O-12: Lua g_PowerHoliday bypasses all power checks
    if (GameRules.bPowerHoliday) return true;
    // O-13: Sabotage temporarily disables power
    if (this.nTempPowerLossEnd > 0 && GameRules.elapsedTime < this.nTempPowerLossEnd) return false;
    return this.bHasPower;
  }

  getPowerDraw(): number {
    if (!this.bBuilt || !this.bActive || this.nCondition <= 0) return 0;
    return this.tData.nPowerDraw;
  }

  getPowerOutput(): number {
    if (!this.bBuilt || !this.bActive || this.nCondition <= 0) return 0;
    return this.tData.nPowerOutput;
  }

  isFunctioning(): boolean {
    return this.bBuilt && this.hasPower() && this.nCondition > 0;
  }

  /** O-13: Temporarily disable power for duration seconds (Lua sabotagePowerLoss). */
  sabotagePowerLoss(duration = 30) {
    this.nTempPowerLossEnd = GameRules.elapsedTime + duration;
  }

  /** Lua EnvObject:_isSabotaged — true while sabotage power-loss timer is active. */
  _isSabotaged(): boolean {
    if (this.nTempPowerLossEnd > 0) {
      if (this.nTempPowerLossEnd < GameRules.elapsedTime) {
        this.nTempPowerLossEnd = -1;
        return false;
      }
      return true;
    }
    return false;
  }

  // ── Oxygen generation ────────────────────────────────────────

  private _updateOxygenGeneration() {
    const shouldGenerate = this.tData.oxygenLevel > 0 &&
      !this.isDestroyed() &&
      this.isFunctioning();
    this.bGeneratingOxygen = shouldGenerate;
  }

  getOxygenOutput(): number {
    if (!this.bBuilt || !this.bGeneratingOxygen) return 0;
    return this.tData.oxygenLevel;
  }

  // ── Tick ─────────────────────────────────────────────────────

  onTick(dt: number) {
    // Apply decay
    if (this.nCondition > 0 && this.tData.decayPerSecond > 0) {
      this.decayAccum += dt;
      if (this.decayAccum >= 1) {
        const damage = this.tData.decayPerSecond * this.decayAccum;
        this.decayAccum = 0;
        this.damageCondition(damage);
      }
    }

    // Broken timer → spontaneous fire for explodeOnFailure objects
    if (this.nCondition <= 0 && this.tData.explodeOnFailure && !this.bCaughtFire) {
      this.nBrokenTimer += dt;
      if (this.nBrokenTimer >= DESTROYED_FIRE_CHECK_DELAY) {
        // Every DESTROYED_FIRE_CHECK_INTERVAL, roll DESTROYED_FIRE_CHANCE
        this.nFireCheckTimer = (this.nFireCheckTimer ?? 0) + dt;
        if (this.nFireCheckTimer >= DESTROYED_FIRE_CHECK_INTERVAL) {
          this.nFireCheckTimer = 0;
          if (Math.random() < DESTROYED_FIRE_CHANCE) {
            this.bCaughtFire = true;
            EnvObject.onFireStart?.(this.tileX, this.tileY);
          }
        }
      }
    } else if (this.nCondition > 0) {
      this.nBrokenTimer = 0;
      this.nFireCheckTimer = 0;
    }

    // Update O2 generation state
    this._updateOxygenGeneration();
  }

  // ── Room ─────────────────────────────────────────────────────

  setRoom(room: Room | null) {
    this.rRoom = room;
  }

  // ── Lifecycle ────────────────────────────────────────────────

  remove() {
    const tag = this._ObjectList_ObjectMarker;
    if (tag) {
      ObjectList.removeObject(tag);
    }
  }

  /** Get matter refund for vaporizing this object */
  getVaporizeMatterYield(): number {
    return Math.floor(this.tData.matterCost * 0.75);
  }

  /** Mark object as built (ghost→solid transition). */
  markBuilt() {
    this.bBuilt = true;
    this._notifyRenderer();
    // Lua EnvObject.lua: play per-object placeSound on build, fallback to generic BuildObject
    if (this.tData.placeSound) {
      SoundManager.playSfx(this.tData.placeSound);
    } else {
      SpatialAudio.playAtTile('BuildObject', this.tileX, this.tileY);
    }
  }

  /** Notify the renderer of visual state changes. */
  protected _notifyRenderer() {
    if (this.id >= 0) {
      EnvObject.onVisualUpdate?.(this.id, this);
    }
  }

  // ── Interact sprite ─────────────────────────────────────────

  /** Toggle the interact sprite and track user (Lua EnvObject:onInteract). */
  onInteract(bStart: boolean, rChar?: Character) {
    if (this.tData.interactSprite) {
      this.bUseInteractSprite = bStart;
      this._notifyRenderer();
    }
    this.rUser = (bStart && rChar) ? rChar : null;
  }

  /** Get the character currently using this object (Lua EnvObject:getUser). */
  getUser(): Character | null {
    return this.rUser;
  }

  /** Logical functionality grouping. Falls back to object name. */
  get sFunctionality(): string {
    return this.tData.sFunctionality ?? this.sName;
  }

  // ── Sprite suffix for condition-based rendering ──────────────

  getConditionSuffix(): string {
    if (this.nCondition < 1) return '_destroyed';
    if (this.nCondition < DAMAGED_CONDITION) return '_damaged';
    return '';
  }

  /** Get the full sprite key for current condition */
  getSpriteKey(): string {
    const base = (this.bUseInteractSprite && this.tData.interactSprite)
      ? this.tData.interactSprite
      : this.tData.spriteName;
    return base + this.getConditionSuffix();
  }

  // ── Save data ────────────────────────────────────────────────

  getSaveData(): Record<string, unknown> {
    return {
      sName: this.sName,
      tileX: this.tileX,
      tileY: this.tileY,
      bFlipX: this.bFlipX,
      bFlipY: this.bFlipY,
      nCondition: this.nCondition,
      bActive: this.bActive,
      sUniqueName: this.sUniqueName,
      sBuilderName: this.sBuilderName,
      sBuildTime: this.sBuildTime,
    };
  }

  static fromSaveData(data: Record<string, unknown>): EnvObject {
    const obj = new EnvObject(
      data.sName as string,
      data.tileX as number,
      data.tileY as number,
      data.bFlipX as boolean,
      data.bFlipY as boolean,
    );
    obj.nCondition = (data.nCondition as number) ?? 100;
    obj.bActive = (data.bActive as boolean) ?? true;
    obj.sUniqueName = (data.sUniqueName as string) ?? '';
    obj.sBuilderName = (data.sBuilderName as string) ?? '';
    obj.sBuildTime = (data.sBuildTime as string) ?? '';
    return obj;
  }
}
