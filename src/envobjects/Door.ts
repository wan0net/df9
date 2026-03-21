/**
 * Door.ts — Door environment object subclass.
 * Mirrors EnvObjects/Door.lua: states, auto-open, oxygen blocking, vacuum locks.
 */

import { EnvObject } from './EnvObject';
import { SpatialAudio } from '../audio/SpatialAudio';
import { EMERGENCY, DOCTOR, TECHNICIAN, BUILDER } from '../characters/CharacterConstants';
import type { Room } from '../rooms/Room';

export const DOOR_STATE = {
  OPEN: 1,
  CLOSED: 2,
  LOCKED: 3,
  BROKEN_OPEN: 4,
  BROKEN_CLOSED: 5,
} as const;

export const DOOR_OPERATION = {
  FORCED_OPEN: 1,
  NORMAL: 2,
  LOCKED: 3,
} as const;

/** Stay-open duration after character leaves adjacency (Lua Door.STAY_OPEN_DURATION). */
export const STAY_OPEN_DURATION = 2;

/** Global door registry: tile key "x,y" → Door instance (Lua Door.tDoorsByAddr). */
export const tDoorsByAddr = new Map<string, Door>();

export class Door extends EnvObject {
  /** Optional tile obstruction check (Lua g_World._shouldObstructPathing). Set from main.ts. */
  static tileObstructionCheck: ((x: number, y: number) => boolean) | null = null;

  state: number = DOOR_STATE.CLOSED;
  operation: number = DOOR_OPERATION.NORMAL;

  /** Second tile for 2-wide doors (e.g. Airlock). -1 = unused. */
  secondTileX = -1;
  secondTileY = -1;

  /** Track if a character is adjacent (for auto-open). */
  private characterNearby = false;
  /** Stay-open timer (seconds remaining). */
  private stayOpenTimer = 0;

  /** Whether door was smashed open (destroyed while open). */
  bSmashedOpen = false;

  // ── Vacuum safety lock state (Lua Door._updateSpaceStatus) ──────────
  /** West side has vacuum. */
  bWestSideVacuum = false;
  /** East side has vacuum. */
  bEastSideVacuum = false;
  /** Either side touches vacuum. */
  bTouchesVacuum = false;
  /** Is between a brig room and a non-brig room. */
  bBrigDoor = false;
  /** Whether adjacent tiles are obstructed for pathfinding (Lua Door._updateSpaceStatus). */
  bWestSideObstructed = false;
  bEastSideObstructed = false;
  bIsObstructed = false;

  /** Rooms on either side (set by EnvObjectManager on room rebuild). */
  rWestRoom: Room | null = null;
  rEastRoom: Room | null = null;

  constructor(sName: string, tileX: number, tileY: number, bFlipX = false, bFlipY = false) {
    super(sName, tileX, tileY, bFlipX, bFlipY);
    this._updateDoorState(true);

    // Register in global door registry
    tDoorsByAddr.set(`${tileX},${tileY}`, this);
  }

  // ── State management ──────────────────────────────────────────

  open() {
    if (this.operation === DOOR_OPERATION.NORMAL) {
      this.state = DOOR_STATE.OPEN;
      this._updateBlockingFlags();
    }
  }

  close() {
    if (this.operation === DOOR_OPERATION.NORMAL) {
      this.state = DOOR_STATE.CLOSED;
      this._updateBlockingFlags();
    }
  }

  /** Cycle operation: NORMAL → LOCKED → FORCED_OPEN → NORMAL */
  cycle() {
    if (this.operation === DOOR_OPERATION.NORMAL) {
      this.setOperation(DOOR_OPERATION.LOCKED);
    } else if (this.operation === DOOR_OPERATION.LOCKED) {
      this.setOperation(DOOR_OPERATION.FORCED_OPEN);
    } else {
      this.setOperation(DOOR_OPERATION.NORMAL);
    }
  }

  setOperation(op: number) {
    this.operation = op;
    this._updateDoorState(true);
  }

  getOperation(): number {
    return this.operation;
  }

  isOpen(): boolean {
    return this.state === DOOR_STATE.OPEN || this.state === DOOR_STATE.BROKEN_OPEN;
  }

  isClosed(): boolean {
    return this.state === DOOR_STATE.CLOSED || this.state === DOOR_STATE.LOCKED || this.state === DOOR_STATE.BROKEN_CLOSED;
  }

  isLocked(): boolean {
    return this.state === DOOR_STATE.LOCKED || this.state === DOOR_STATE.BROKEN_CLOSED;
  }

  /**
   * DR-4: Per-character lock check for brig doors (Lua Door:locked(rChar)).
   * Brig doors allow EMERGENCY, DOCTOR, TECHNICIAN, BUILDER through.
   * Other characters are blocked from entering the brig.
   */
  isLockedForCharacter(charJob: number): boolean {
    if (this.bBrigDoor && this.operation === DOOR_OPERATION.NORMAL) {
      if (this.state === DOOR_STATE.BROKEN_OPEN) return false;
      if (this.state === DOOR_STATE.LOCKED || this.state === DOOR_STATE.BROKEN_CLOSED) return true;
      if (!this.hasPower()) return false;
      // Allow security, medical, technical, and builder staff through brig doors
      if (charJob === EMERGENCY || charJob === DOCTOR || charJob === TECHNICIAN || charJob === BUILDER) {
        return false;
      }
      // Block other jobs from entering brig
      return true;
    }
    return this.state === DOOR_STATE.LOCKED || this.state === DOOR_STATE.BROKEN_CLOSED;
  }

  // ── Auto-open proximity ───────────────────────────────────────

  setCharacterNearby(nearby: boolean) {
    const wasNearby = this.characterNearby;
    this.characterNearby = nearby;
    if (nearby && !wasNearby) {
      this.stayOpenTimer = 0;
      this._updateDoorState(false);
    } else if (!nearby && wasNearby) {
      // Start stay-open timer
      this.stayOpenTimer = STAY_OPEN_DURATION;
    }
  }

  // ── Vacuum safety (Lua Door:_updateSpaceStatus) ───────────────

  /** Update vacuum status from adjacent rooms. Called when rooms change. */
  updateSpaceStatus(westRoom: Room | null, eastRoom: Room | null): void {
    this.rWestRoom = westRoom;
    this.rEastRoom = eastRoom;

    // Lua parity: treat rooms with O2 below OXYGEN_SUFFOCATING as vacuum
    // OXYGEN_SUFFOCATING = 100 on Lua 0-65535 scale ≈ 0 on 0-255 scale
    const OXYGEN_SUFFOCATING_255 = 1; // 100 * 255 / 65535 ≈ 0.39, round up to 1
    this.bWestSideVacuum = !westRoom || westRoom.isBreached() || westRoom.oxygen < OXYGEN_SUFFOCATING_255;
    this.bEastSideVacuum = !eastRoom || eastRoom.isBreached() || eastRoom.oxygen < OXYGEN_SUFFOCATING_255;
    this.bTouchesVacuum = this.bWestSideVacuum || this.bEastSideVacuum;

    // Check for brig door
    this.bBrigDoor = false;
    if (westRoom?.zone === 'BRIG' || eastRoom?.zone === 'BRIG') {
      this.bBrigDoor = true;
    }

    // DR-3: Check obstruction on adjacent tiles (Lua Door:_updateSpaceStatus lines 459-474)
    this.bWestSideObstructed = false;
    this.bEastSideObstructed = false;
    if (Door.tileObstructionCheck) {
      const xLeft = (this.tileY & 1) === 0 ? -1 : 0;
      // West side = NW neighbor, East side = SE neighbor (simplified from Lua wall-direction logic)
      const westTileX = this.tileX + xLeft;
      const westTileY = this.tileY - 1;
      const eastTileX = this.tileX + xLeft + 1;
      const eastTileY = this.tileY + 1;
      this.bWestSideObstructed = Door.tileObstructionCheck(westTileX, westTileY);
      this.bEastSideObstructed = Door.tileObstructionCheck(eastTileX, eastTileY);
    }
    this.bIsObstructed = this.bWestSideObstructed || this.bEastSideObstructed;

    this._updateDoorState(false);
  }

  /** Refresh lockdown state (Lua Door:refreshLockdown). */
  refreshLockdown(): void {
    let bShouldLockdown = false;

    // DR-5: Sabotage check first — sabotaged doors stay locked (Lua Door.lua:113)
    if (this._isSabotaged()) {
      bShouldLockdown = true;
    } else if (
      (this.rWestRoom && this.rWestRoom.bUserBlockOxygen) ||
      (this.rEastRoom && this.rEastRoom.bUserBlockOxygen)
    ) {
      bShouldLockdown = true;
    }

    if (bShouldLockdown) {
      this.setOperation(DOOR_OPERATION.LOCKED);
    } else {
      this.setOperation(DOOR_OPERATION.NORMAL);
    }
  }

  // ── Power override (Lua Door:hasPower — checks EITHER adjacent room) ──

  override hasPower(): boolean {
    return (this.rEastRoom?.hasPowerFlag ?? false) || (this.rWestRoom?.hasPowerFlag ?? false);
  }

  /** Sabotage power loss — immediately recalculate door state (Lua Door:sabotagePowerLoss). */
  sabotagePowerLoss(): void {
    this.bHasPower = false;
    this._updateDoorState(false);
  }

  // ── Damage override (Lua Door:takeDamage) ─────────────────────

  /** Override damage to track bSmashedOpen. */
  takeDamage(amount: number): void {
    this.damageCondition(amount);
    if (this.nCondition <= 0 && this.isOpen()) {
      this.bSmashedOpen = true;
    }
    this._updateDoorState(false);
  }

  // ── State update logic (mirrors Door.lua _updateDoorState) ────

  private _updateDoorState(bForce: boolean) {
    let newState = this.state;

    if (this.isDestroyed()) {
      // Broken doors: smashed open or broken closed
      if (this.bSmashedOpen || this.state === DOOR_STATE.OPEN || this.state === DOOR_STATE.BROKEN_OPEN) {
        newState = DOOR_STATE.BROKEN_OPEN;
      } else {
        newState = DOOR_STATE.BROKEN_CLOSED;
      }
    } else if (this.operation === DOOR_OPERATION.FORCED_OPEN) {
      newState = DOOR_STATE.OPEN;
    } else if (
      this._isSabotaged() ||
      this.operation === DOOR_OPERATION.LOCKED ||
      (this.bTouchesVacuum && this.bEastSideVacuum !== this.bWestSideVacuum) ||
      this.bIsObstructed
    ) {
      // Lua Door.lua:593 — sabotaged, locked, vacuum-one-side, or obstructed → LOCKED
      newState = DOOR_STATE.LOCKED;
    } else if (bForce) {
      if (this.operation === DOOR_OPERATION.NORMAL) {
        newState = DOOR_STATE.CLOSED;
      }
    } else {
      // NORMAL operation (Lua Door.lua:600-648)
      if (!this.hasPower()) {
        // No power: seal if one side vacuum or obstructed, otherwise fail-open
        if ((this.bTouchesVacuum && this.bEastSideVacuum !== this.bWestSideVacuum) || this.bIsObstructed) {
          newState = DOOR_STATE.LOCKED;
        } else {
          newState = DOOR_STATE.OPEN;
        }
      } else if (this.characterNearby || this.stayOpenTimer > 0) {
        newState = DOOR_STATE.OPEN;
      } else {
        newState = DOOR_STATE.CLOSED;
      }
    }

    if (newState !== this.state || bForce) {
      const oldState = this.state;
      this.state = newState;
      this._updateBlockingFlags();
      this._notifyRenderer();
      // Door audio: detect open/close transitions
      if (!bForce && oldState !== newState) {
        const wasOpen = oldState === DOOR_STATE.OPEN || oldState === DOOR_STATE.BROKEN_OPEN;
        const isNowOpen = newState === DOOR_STATE.OPEN || newState === DOOR_STATE.BROKEN_OPEN;
        if (!wasOpen && isNowOpen) {
          SpatialAudio.doorOpen(this.tileX, this.tileY);
        } else if (wasOpen && !isNowOpen) {
          SpatialAudio.doorClose(this.tileX, this.tileY);
        }
      }
    } else {
      this.state = newState;
      this._updateBlockingFlags();
    }
  }

  private _updateBlockingFlags() {
    const tag = this._ObjectList_ObjectMarker;
    if (!tag) return;

    // Oxygen blocking: closed/locked doors block oxygen
    tag.bBlocksOxygen = this.isClosed();

    // Path blocking: only locked doors block pathing
    tag.bBlocksPathing = this.isLocked();
  }

  // ── Tick override ─────────────────────────────────────────────

  onTick(dt: number) {
    super.onTick(dt);

    // Tick stay-open timer
    if (this.stayOpenTimer > 0) {
      this.stayOpenTimer -= dt;
      if (this.stayOpenTimer <= 0) {
        this.stayOpenTimer = 0;
      }
    }

    this._updateDoorState(false);
  }

  // ── Lifecycle ─────────────────────────────────────────────────

  remove() {
    // Remove from global registry
    const key = `${this.tileX},${this.tileY}`;
    if (tDoorsByAddr.get(key) === this) {
      tDoorsByAddr.delete(key);
    }
    super.remove();
  }

  // ── Sprite ────────────────────────────────────────────────────

  getSpriteKey(): string {
    const broken = this.state === DOOR_STATE.BROKEN_OPEN || this.state === DOOR_STATE.BROKEN_CLOSED;
    if (this.sName === 'Airlock') {
      if (broken) return 'tile_airlock_door_broken';
      if (this.isOpen()) return 'tile_airlock_door_open';
      return 'tile_airlock_door_closed';
    }
    if (this.sName === 'HeavyDoor') {
      if (this.isLocked()) return 'tile_heavy_door_locked';
      return 'tile_heavy_door_closed';
    }
    // Regular Door
    if (broken) return 'tile_door_broken';
    if (this.isLocked()) return 'tile_door_locked';
    if (this.isOpen()) return 'tile_door_open';
    return 'tile_door_closed';
  }

  // ── Save data ─────────────────────────────────────────────────

  getSaveData(): Record<string, unknown> {
    const data = super.getSaveData();
    data.operation = this.operation;
    data.bSmashedOpen = this.bSmashedOpen;
    if (this.secondTileX >= 0) {
      data.secondTileX = this.secondTileX;
      data.secondTileY = this.secondTileY;
    }
    return data;
  }

  static fromDoorSaveData(data: Record<string, unknown>): Door {
    const d = new Door(
      data.sName as string,
      data.tileX as number,
      data.tileY as number,
      data.bFlipX as boolean,
      data.bFlipY as boolean,
    );
    d.nCondition    = (data.nCondition  as number)  ?? 100;
    d.bActive       = (data.bActive     as boolean) ?? true;
    d.sBuilderName  = (data.sBuilderName as string) ?? '';
    d.operation     = (data.operation   as number)  ?? DOOR_OPERATION.NORMAL;
    d.bSmashedOpen  = (data.bSmashedOpen as boolean) ?? false;
    if (typeof data.secondTileX === 'number') d.secondTileX = data.secondTileX;
    if (typeof data.secondTileY === 'number') d.secondTileY = data.secondTileY;
    return d;
  }

  /** Reset global door registry (call on new game / load). */
  static resetRegistry(): void {
    tDoorsByAddr.clear();
  }
}
