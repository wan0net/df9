/**
 * ObjectList.ts — Global object registry with tag system.
 * Mirrors ObjectList.lua: tags, spatial lookup, type tracking.
 */

import { GRID_W } from '../config';

// ── Object type strings ─────────────────────────────────────────────────
export const OBJ_CHARACTER = 'Character';
export const OBJ_ENVOBJECT = 'EnvObject';
export const OBJ_ROOM = 'Room';
export const OBJ_RESERVATION = 'Reservation';
export const OBJ_WORLDOBJECT = 'WorldObject';
export const OBJ_INVENTORYITEM = 'INVENTORYITEM';

export type ObjType =
  | typeof OBJ_CHARACTER
  | typeof OBJ_ENVOBJECT
  | typeof OBJ_ROOM
  | typeof OBJ_RESERVATION
  | typeof OBJ_WORLDOBJECT
  | typeof OBJ_INVENTORYITEM;

export const SAVE_TYPES: ObjType[] = [
  OBJ_ROOM,
  OBJ_ENVOBJECT,
  OBJ_CHARACTER,
  OBJ_RESERVATION,
  OBJ_WORLDOBJECT,
  OBJ_INVENTORYITEM,
];

// ── Tag interface ───────────────────────────────────────────────────────
export interface ObjectTag {
  objType: ObjType;
  objSubtype?: string;
  objID: number;
  bBlocksPathing: boolean;
  bBlocksOxygen: boolean;
  bInvalid: boolean;
  addr: number | null;
  tTiles: Set<number>;
  bFlipX?: boolean;
  bFlipY?: boolean;
}

// ── Taggable object interface ───────────────────────────────────────────
export interface TaggableObject {
  _ObjectList_ObjectMarker?: ObjectTag;
}

// ── Internal object data ────────────────────────────────────────────────
interface ObjData {
  tag: ObjectTag;
  obj: TaggableObject;
}

/**
 * Compute a cell address from tile coords (matching Lua World.pathGrid:getCellAddr).
 * Simple row-major encoding.
 */
function getCellAddr(tx: number, ty: number): number {
  return ty * GRID_W + tx;
}

/** Recover tile coords from a cell address. */
export function cellAddrToCoord(addr: number): { x: number; y: number } {
  const y = Math.floor(addr / GRID_W);
  const x = addr % GRID_W;
  return { x, y };
}

// ── ObjectList singleton ────────────────────────────────────────────────

class ObjectListClass {
  private objectCounter = 1;
  private tObjList: Map<number, ObjData> = new Map();
  private tObjByType: Map<ObjType, Map<number, ObjData>> = new Map();
  private tCountByType: Map<ObjType, number> = new Map();
  private tIDsAtAddr: Map<number, Set<number>> = new Map();

  constructor() {
    this.reset();
  }

  reset() {
    this.objectCounter = 1;
    this.tObjList = new Map();
    this.tObjByType = new Map();
    this.tCountByType = new Map();
    this.tIDsAtAddr = new Map();

    for (const sType of SAVE_TYPES) {
      this.tObjByType.set(sType, new Map());
      this.tCountByType.set(sType, 0);
    }
  }

  // ── Tag validation ──────────────────────────────────────────────────

  isTag(tag: unknown): tag is ObjectTag {
    if (!tag || typeof tag !== 'object') return false;
    const t = tag as ObjectTag;
    return t.objID !== undefined && !t.bInvalid;
  }

  isValidObject(obj: TaggableObject): boolean {
    return !!obj && this.isTag(obj._ObjectList_ObjectMarker);
  }

  // ── Core accessors ─────────────────────────────────────────────────

  getTag(obj: TaggableObject): ObjectTag | null {
    if (obj && this.isTag(obj._ObjectList_ObjectMarker)) {
      return obj._ObjectList_ObjectMarker!;
    }
    return null;
  }

  getObject(tag: ObjectTag): TaggableObject | null {
    if (!this.isTag(tag)) return null;
    const data = this.tObjList.get(tag.objID);
    return data?.obj ?? null;
  }

  getObjByID(id: number): TaggableObject | null {
    const data = this.tObjList.get(id);
    if (data && !data.tag.bInvalid) return data.obj;
    return null;
  }

  getCountOfType(type: ObjType): number {
    return this.tCountByType.get(type) ?? 0;
  }

  // ── Add / Remove ──────────────────────────────────────────────────

  addObject(
    objType: ObjType,
    objSubtype: string | undefined,
    obj: TaggableObject,
    bBlocksPathing = false,
    bBlocksOxygen = false,
    tx?: number,
    ty?: number,
    bFlipX?: boolean,
    bFlipY?: boolean,
  ): ObjectTag {
    // Assign unique ID
    while (this.tObjList.has(this.objectCounter)) {
      this.objectCounter++;
    }
    const objID = this.objectCounter;

    const tag: ObjectTag = {
      objType,
      objSubtype,
      objID,
      bBlocksPathing,
      bBlocksOxygen,
      bInvalid: false,
      addr: null,
      tTiles: new Set(),
      bFlipX,
      bFlipY,
    };

    const objData: ObjData = { tag, obj };
    this.tObjList.set(objID, objData);

    const typeMap = this.tObjByType.get(objType);
    if (typeMap) typeMap.set(objID, objData);
    this.tCountByType.set(objType, (this.tCountByType.get(objType) ?? 0) + 1);

    // Occupy tile if coordinates provided
    if (tx !== undefined && ty !== undefined) {
      this.occupyTile(tx, ty, tag);
    }

    // Back-reference from object to tag
    obj._ObjectList_ObjectMarker = tag;

    return tag;
  }

  removeObject(tag: ObjectTag) {
    if (tag.bInvalid) {
      console.warn('ObjectList: removing object twice');
      return;
    }

    this.unoccupySpace(tag);
    this.tObjList.delete(tag.objID);

    const typeMap = this.tObjByType.get(tag.objType);
    if (typeMap) typeMap.delete(tag.objID);

    const count = this.tCountByType.get(tag.objType) ?? 0;
    this.tCountByType.set(tag.objType, Math.max(0, count - 1));

    tag.bInvalid = true;
  }

  // ── Spatial occupancy ─────────────────────────────────────────────

  /** Place tag at a single tile. For multi-tile objects, call occupyTile for each. */
  occupyTile(tx: number, ty: number, tag: ObjectTag) {
    const addr = getCellAddr(tx, ty);

    if (tag.addr === addr) return; // already there

    // Vacate old space if moving
    if (tag.addr !== null) {
      this.unoccupySpace(tag);
    }

    tag.addr = addr;
    this._setIDAtTile(tx, ty, tag, true);
  }

  unoccupySpace(tag: ObjectTag) {
    for (const addr of tag.tTiles) {
      const { x, y } = cellAddrToCoord(addr);
      this._setIDAtTile(x, y, tag, false);
    }
    tag.addr = null;
  }

  private _setIDAtTile(tx: number, ty: number, tag: ObjectTag, bSet: boolean) {
    const addr = getCellAddr(tx, ty);

    if (!this.tIDsAtAddr.has(addr)) {
      this.tIDsAtAddr.set(addr, new Set());
    }

    const ids = this.tIDsAtAddr.get(addr)!;
    if (bSet) {
      ids.add(tag.objID);
      tag.tTiles.add(addr);
    } else {
      ids.delete(tag.objID);
      tag.tTiles.delete(addr);
    }
  }

  // ── Spatial queries ───────────────────────────────────────────────

  pathBlockedByObject(tx: number, ty: number): TaggableObject | null {
    const addr = getCellAddr(tx, ty);
    const ids = this.tIDsAtAddr.get(addr);
    if (!ids) return null;

    for (const objID of ids) {
      const data = this.tObjList.get(objID);
      if (data && data.tag.bBlocksPathing) return data.obj;
    }
    return null;
  }

  oxygenBlockedByObject(tx: number, ty: number): TaggableObject | null {
    const addr = getCellAddr(tx, ty);
    const ids = this.tIDsAtAddr.get(addr);
    if (!ids) return null;

    for (const objID of ids) {
      const data = this.tObjList.get(objID);
      if (data && data.tag.bBlocksOxygen) return data.obj;
    }
    return null;
  }

  getObjAtTile(tx: number, ty: number, objType: ObjType, objSubtype?: string): TaggableObject | null {
    const addr = getCellAddr(tx, ty);
    const ids = this.tIDsAtAddr.get(addr);
    if (!ids) return null;

    for (const objID of ids) {
      const data = this.tObjList.get(objID);
      if (!data || data.tag.bInvalid) continue;
      if (data.tag.objType === objType) {
        if (!objSubtype || data.tag.objSubtype === objSubtype) {
          return data.obj;
        }
      }
    }
    return null;
  }

  getTagAtTile(tx: number, ty: number, objType: ObjType, objSubtype?: string): ObjectTag | null {
    const addr = getCellAddr(tx, ty);
    const ids = this.tIDsAtAddr.get(addr);
    if (!ids) return null;

    for (const objID of ids) {
      const data = this.tObjList.get(objID);
      if (!data || data.tag.bInvalid) continue;
      if (data.tag.objType === objType) {
        if (!objSubtype || data.tag.objSubtype === objSubtype) {
          return data.tag;
        }
      }
    }
    return null;
  }

  getTagsOfType(typeName: ObjType): Map<number, ObjData> {
    return this.tObjByType.get(typeName) ?? new Map();
  }

  /** Iterate objects of a given type and subtype. */
  *iterateType(typeName: ObjType, subtype?: string): IterableIterator<TaggableObject> {
    const map = this.tObjByType.get(typeName);
    if (!map) return;
    for (const [, data] of map) {
      if (data.tag.bInvalid) continue;
      if (subtype && data.tag.objSubtype !== subtype) continue;
      yield data.obj;
    }
  }

  getDoorAtTile(tx: number, ty: number): TaggableObject | null {
    let door = this.getObjAtTile(tx, ty, OBJ_ENVOBJECT, 'Door');
    if (!door) door = this.getObjAtTile(tx, ty, OBJ_ENVOBJECT, 'Airlock');
    if (!door) door = this.getObjAtTile(tx, ty, OBJ_ENVOBJECT, 'HeavyDoor');
    return door;
  }
}

/** Global singleton, mirrors Lua's `ObjectList` module. */
export const ObjectList = new ObjectListClass();
