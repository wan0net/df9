/**
 * Inventory.ts — Item inventory system.
 * Mirrors Inventory.lua.
 */

export interface InventoryItem {
  sName: string;
  nCount: number;
  sSubtype?: string;
}

export class Inventory {
  private items: Map<string, InventoryItem> = new Map();

  addItem(sName: string, count = 1, sSubtype?: string) {
    const existing = this.items.get(sName);
    if (existing) {
      existing.nCount += count;
    } else {
      this.items.set(sName, { sName, nCount: count, sSubtype });
    }
  }

  removeItem(sName: string, count = 1): boolean {
    const item = this.items.get(sName);
    if (!item || item.nCount < count) return false;
    item.nCount -= count;
    if (item.nCount <= 0) this.items.delete(sName);
    return true;
  }

  hasItem(sName: string, count = 1): boolean {
    const item = this.items.get(sName);
    return !!item && item.nCount >= count;
  }

  getCount(sName: string): number {
    return this.items.get(sName)?.nCount ?? 0;
  }

  getAll(): InventoryItem[] {
    return Array.from(this.items.values());
  }

  clear() {
    this.items.clear();
  }

  isEmpty(): boolean {
    return this.items.size === 0;
  }
}
