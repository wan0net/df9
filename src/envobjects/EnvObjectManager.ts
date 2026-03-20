/**
 * EnvObjectManager.ts — Static manager for all environment objects.
 * Mirrors EnvObjects/EnvObject.lua staticTick and query functions.
 * Registered as GameRules tick slot 7 (EnvObject.staticTick).
 */

import { EnvObject } from './EnvObject';
import { Door } from './Door';
import { tObjects } from './EnvObjectData';
import { GameRules, type TickableSystem } from '../core/GameRules';
import { getDiamondFootprint } from '../world/IsometricUtils';
import type { Room } from '../rooms/Room';
import type { RoomManager } from '../rooms/RoomManager';
import { Pub } from '../zones/Pub';

export type EnvObjectCallback = (id: number, obj: EnvObject) => void;

class EnvObjectManagerClass implements TickableSystem {
  private objects: Map<number, EnvObject> = new Map();
  private nextId = 1;
  private roomManager: RoomManager | null = null;

  // Renderer callbacks
  onObjectCreated: EnvObjectCallback | null = null;
  onObjectRemoved: ((id: number) => void) | null = null;

  /** Initialize and register with GameRules tick pipeline. */
  init(roomManager: RoomManager) {
    this.roomManager = roomManager;
    // Register at slot 7 (EnvObject.staticTick position in Lua tick order)
    GameRules.registerSystem(7, this);
  }

  /** Create and register an environment object. Returns null if invalid.
   *  @param startBuilt — if false, object starts as a ghost (unbuilt). Default true.
   */
  createObject(sName: string, tileX: number, tileY: number, bFlipX = false, bFlipY = false, startBuilt = true): EnvObject | null {
    const data = tObjects[sName];
    if (!data) {
      console.warn(`EnvObjectManager: unknown object type '${sName}'`);
      return null;
    }

    let obj: EnvObject;
    if (data.door || data.customClass === 'Door') {
      obj = new Door(sName, tileX, tileY, bFlipX, bFlipY);
    } else {
      obj = new EnvObject(sName, tileX, tileY, bFlipX, bFlipY);
    }

    // Set build state BEFORE notifying renderer
    if (!startBuilt) {
      obj.bBuilt = false;
    }

    const id = this.nextId++;
    obj.id = id;
    this.objects.set(id, obj);

    // Assign room
    if (this.roomManager) {
      const room = this.roomManager.getRoomAt(tileX, tileY);
      if (room) {
        obj.setRoom(room);
      }
    }

    // G-7: Auto-set hasBar on Pub zones when a Bar object is placed
    if (sName === 'Bar' && obj.rRoom?.zoneObj instanceof Pub) {
      (obj.rRoom.zoneObj as Pub).setHasBar(true);
    }

    // Notify renderer (now with correct bBuilt state)
    this.onObjectCreated?.(id, obj);

    return obj;
  }

  /** Remove an object from management. */
  removeObject(obj: EnvObject) {
    for (const [id, o] of this.objects) {
      if (o === obj) {
        // G-7: Recheck hasBar when removing a Bar from Pub
        if (obj.sName === 'Bar' && obj.rRoom?.zoneObj instanceof Pub) {
          const pub = obj.rRoom.zoneObj as Pub;
          const room = obj.rRoom;
          let hasOtherBar = false;
          for (const [, other] of this.objects) {
            if (other !== obj && other.sName === 'Bar' && other.rRoom === room) {
              hasOtherBar = true;
              break;
            }
          }
          pub.setHasBar(hasOtherBar);
        }
        this.objects.delete(id);
        obj.remove();
        this.onObjectRemoved?.(id);
        return;
      }
    }
  }

  /** Find object ID by object reference. */
  getObjectId(obj: EnvObject): number {
    return obj.id;
  }

  /** Get all managed objects. */
  getObjects(): EnvObject[] {
    return Array.from(this.objects.values());
  }

  /** Get any EnvObject occupying a tile.
   * Mirrors Lua: ObjectList.getObjAtTile(tx, ty, ObjectList.ENVOBJECT) */
  getObjectAt(tileX: number, tileY: number): EnvObject | null {
    for (const obj of this.objects.values()) {
      if (obj.tileX === tileX && obj.tileY === tileY) return obj;
      // Multi-tile objects: check diamond footprint
      if (obj.tData.width > 1 || obj.tData.height > 1) {
        const fp = getDiamondFootprint(obj.tileX, obj.tileY, obj.tData.width, obj.tData.height, obj.bFlipX, obj.bFlipY);
        for (let i = 1; i < fp.length; i++) {
          if (fp[i].x === tileX && fp[i].y === tileY) return obj;
        }
      }
    }
    return null;
  }

  /** Get the Door at a tile position, or null if none. */
  getDoorAt(tileX: number, tileY: number): Door | null {
    for (const obj of this.objects.values()) {
      if (obj instanceof Door) {
        if (obj.tileX === tileX && obj.tileY === tileY) return obj;
        if (obj.secondTileX === tileX && obj.secondTileY === tileY) return obj;
      }
    }
    return null;
  }

  /** Get objects in a specific room. */
  getObjectsInRoom(room: Room): EnvObject[] {
    const result: EnvObject[] = [];
    for (const obj of this.objects.values()) {
      if (obj.rRoom === room) result.push(obj);
    }
    return result;
  }

  /** Get objects of a specific type. */
  getObjectsByType(sName: string): EnvObject[] {
    const result: EnvObject[] = [];
    for (const obj of this.objects.values()) {
      if (obj.sName === sName) result.push(obj);
    }
    return result;
  }

  /** Get placed objects matching a functionality grouping. */
  getObjectsByFunctionality(sFunctionality: string, bOnlyWorking = false): EnvObject[] {
    const result: EnvObject[] = [];
    for (const obj of this.objects.values()) {
      if (obj.sFunctionality === sFunctionality) {
        if (!bOnlyWorking || obj.isFunctioning()) {
          result.push(obj);
        }
      }
    }
    return result;
  }

  /** Get total power output from objects in a room. */
  getRoomPowerOutput(room: Room): number {
    let total = 0;
    for (const obj of this.objects.values()) {
      if (obj.rRoom === room) {
        total += obj.getPowerOutput();
      }
    }
    return total;
  }

  /** Get total power draw from objects in a room. */
  getRoomPowerDraw(room: Room): number {
    let total = 0;
    for (const obj of this.objects.values()) {
      if (obj.rRoom === room) {
        total += obj.getPowerDraw();
      }
    }
    return total;
  }

  /** Get total oxygen output from objects in a room. */
  getRoomOxygenOutput(room: Room): number {
    let total = 0;
    for (const obj of this.objects.values()) {
      if (obj.rRoom === room) {
        total += obj.getOxygenOutput();
      }
    }
    return total;
  }

  /** Tick all objects (GameRules slot 7). */
  onTick(dt: number) {
    for (const obj of this.objects.values()) {
      obj.onTick(dt);
    }
    this.updateRoomMoraleScores();
  }

  /** Recalculate morale score for each room based on its objects. */
  private updateRoomMoraleScores() {
    if (!this.roomManager) return;
    // Reset all room morale scores
    for (const room of this.roomManager.getRooms()) {
      room.nMoraleScore = 0;
    }
    // Sum morale from built objects
    for (const obj of this.objects.values()) {
      if (!obj.bBuilt || !obj.rRoom) continue;
      obj.rRoom.nMoraleScore += obj.tData.nMoraleScore;
    }
    // Normalize by room size
    for (const room of this.roomManager.getRooms()) {
      if (room.size > 0) {
        room.nMoraleScore = room.nMoraleScore / room.size;
      }
    }
  }

  /** Get total morale score from objects in a room (raw sum). */
  getRoomMoraleScore(room: Room): number {
    let total = 0;
    for (const obj of this.objects.values()) {
      if (obj.rRoom === room && obj.bBuilt) {
        total += obj.tData.nMoraleScore;
      }
    }
    return total;
  }

  /** Get count of objects */
  getCount(): number {
    return this.objects.size;
  }

  /** Clear all objects (for load). */
  clearAll() {
    for (const [id, obj] of this.objects) {
      obj.remove();
      this.onObjectRemoved?.(id);
    }
    this.objects.clear();
    this.nextId = 1;
  }

  /** Update room assignments after room re-detection. */
  updateRoomAssignments() {
    if (!this.roomManager) return;
    for (const obj of this.objects.values()) {
      const room = this.roomManager.getRoomAt(obj.tileX, obj.tileY);
      obj.setRoom(room ?? null);
    }
  }
}

/** Global singleton */
export const EnvObjectManager = new EnvObjectManagerClass();
