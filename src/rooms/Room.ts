import { ZoneType } from '../world/ZoneType';
import type { ObjectTag } from '../core/ObjectList';
import type { Zone } from '../zones/Zone';

export class Room {
  id: number;
  tiles: { x: number; y: number }[] = [];
  oxygen = 0;
  sealed = false;
  zone: ZoneType = ZoneType.PLAIN;

  /** ObjectList tag for this room (set when registered with ObjectList). */
  tag: ObjectTag | null = null;

  /** Zone subclass instance managing zone-specific state. */
  zoneObj: Zone | null = null;

  /** Rooms contiguous through doors (populated in Phase 6). */
  tContiguousRooms: Room[] = [];

  /** Power fields (populated in Phase 6). */
  nPowerOutput = 0;
  nPowerDraw = 0;
  nPowerSupply = 0;

  constructor(id: number) {
    this.id = id;
  }

  addTile(x: number, y: number) {
    this.tiles.push({ x, y });
  }

  get size(): number {
    return this.tiles.length;
  }
}
