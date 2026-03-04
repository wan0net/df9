/**
 * Inventory.ts — Item inventory system.
 * Mirrors Inventory.lua exactly.
 */

import {
  ITEM_TEMPLATES, TAGS, STUFF_NAMES, DEFAULT_AFFINITY_DECAY,
  DEFAULT_PICKUP, DEFAULT_MAX_STACKS,
  type ItemTemplate, type TagCategory,
} from './InventoryData';
import { GameRules } from '../core/GameRules';

// ── Item Instance ───────────────────────────────────────────────────────

/** Runtime item instance (mirrors Lua tItem tables). */
export interface InventoryItem {
  sTemplate: string;
  sName: string;
  nCount: number;
  tag?: number;            // Unique object ID for non-stackable items

  // Procedural tags applied to this instance
  Color?: string;
  Material?: string;
  Texture?: string;
  Shape?: string;
  Style?: string;

  // Container contents
  tContents?: Record<string, InventoryItem>;

  // Owner tracking
  tOwnerTag?: number;

  // Incineration
  nTimeUnwanted?: number;
  bEligibleForIncinerate?: boolean;

  // Research datacube payload
  sResearchData?: string;

  // Description override
  sDesc?: string;
}

// ── Incineration Constants ──────────────────────────────────────────────

const TIME_UNWANTED_BEFORE_INCINERATE_MIN = 60 * 5;   // 5 minutes
const TIME_UNWANTED_BEFORE_INCINERATE_MAX = 60 * 20;  // 20 minutes
const JOB_ITEM_NO_INCINERATE_MULT = 4;

// ── Unique ID Counter ───────────────────────────────────────────────────

let nextItemTag = 1;

// ── Inventory Module (static functions matching Lua Inventory) ──────────

/** Create an item instance from a template name. Mirrors Lua Inventory.createItem(). */
export function createItem(sTemplate: string, tOverrides?: Partial<InventoryItem>): InventoryItem {
  const tItemTemplate = ITEM_TEMPLATES[sTemplate];
  if (!tItemTemplate) throw new Error(`Unknown item template: ${sTemplate}`);

  const tItem: InventoryItem = {
    sTemplate,
    sName: '',
    nCount: 1,
  };

  if (tItemTemplate.bContainer) {
    tItem.tContents = {};
  }

  // Apply overrides
  if (tOverrides) {
    Object.assign(tItem, tOverrides);
  }

  if (tItemTemplate.bStackable) {
    // Stackable items are defined entirely by combo of tItem + tItemTemplate
  } else {
    // Unique items get a unique tag and procedural tags
    tItem.tag = nextItemTag++;

    if (tItemTemplate.tPossibleTags) {
      // Pick 0-2 random tags (capped for name readability)
      const nTotalTags = tItemTemplate.tPossibleTags.length;
      const nTags = Math.min(Math.floor(Math.random() * (nTotalTags + 1)), 2);
      const tPossible = [...Array(nTotalTags).keys()];

      for (let i = 0; i < nTags; i++) {
        const idx = Math.floor(Math.random() * tPossible.length);
        const nTag = tPossible[idx];
        tPossible.splice(idx, 1);
        const sTag = tItemTemplate.tPossibleTags[nTag];
        const tagCategory = TAGS[sTag];
        const keys = Object.keys(tagCategory);
        ((tItem as unknown) as Record<string, unknown>)[sTag] = keys[Math.floor(Math.random() * keys.length)];
      }
    }

    // Populate forced tags
    if (tItemTemplate.tForcedTags) {
      for (const [k, v] of Object.entries(tItemTemplate.tForcedTags)) {
        ((tItem as unknown) as Record<string, unknown>)[k] = v;
      }
    }
  }

  // Generate name
  if (!tItem.sName || tItem.sName === '') {
    if (tItemTemplate.sName) {
      tItem.sName = tItemTemplate.sName; // Localization key (we use as-is)
    } else if (tItemTemplate.sSuffix) {
      tItem.sName = generateName(tItem);
    }
  }

  // Assign random tint color for tintable items
  if (tItemTemplate.sTintSprite && !tItem.Color) {
    const colorKeys = Object.keys(TAGS.Color);
    tItem.Color = colorKeys[Math.floor(Math.random() * colorKeys.length)];
  }

  if (!tItem.sName) tItem.sName = sTemplate;

  return tItem;
}

/** Generate a procedural name from tags. Mirrors Lua Inventory._generateName(). */
function generateName(tItem: InventoryItem): string {
  const tItemTemplate = ITEM_TEMPLATES[tItem.sTemplate];
  let sName = tItemTemplate?.sSuffix ?? tItem.sTemplate;

  const tTags: { tagName: string; tagValue: string }[] = [];
  for (const k of Object.keys(TAGS) as TagCategory[]) {
    const val = ((tItem as unknown) as Record<string, unknown>)[k] as string | undefined;
    // Exclude tag if it's a forced (intrinsic) tag
    if (val && (!tItemTemplate?.tForcedTags || !(k in tItemTemplate.tForcedTags))) {
      tTags.push({ tagName: k, tagValue: val });
    }
  }

  for (const tTag of tTags) {
    // In original this uses localization; we just use the tag value as the adjective
    const sTagStr = tTag.tagValue;
    sName = sTagStr + ' ' + sName;
  }
  return sName;
}

/** Duplicate an item (deep copy with new unique tag). Mirrors Lua Inventory.dupeItem(). */
export function dupeItem(tItem: InventoryItem): InventoryItem {
  const tItemTemplate = ITEM_TEMPLATES[tItem.sTemplate];
  const tNew: InventoryItem = { ...tItem };

  if (tItemTemplate?.bStackable) {
    delete tNew.tag;
  } else {
    tNew.tag = nextItemTag++;
  }
  return tNew;
}

/** Create a random starting stuff item. Mirrors Lua Inventory.createRandomStartingStuff(). */
export function createRandomStartingStuff(): InventoryItem {
  const idx = Math.floor(Math.random() * STUFF_NAMES.length);
  return createItem(STUFF_NAMES[idx]);
}

// ── Weapon / Armor Accessors ────────────────────────────────────────────

export function getWeaponData(tItem: InventoryItem) {
  const t = ITEM_TEMPLATES[tItem.sTemplate];
  if (!t) return undefined;
  if (t.nDamage === undefined) return undefined;
  return {
    nDamage: t.nDamage,
    nDamageType: t.nDamageType ?? 0,
    nRange: t.nRange ?? 0,
    sStance: t.sStance,
    sBulletSprite: t.sBulletSprite,
  };
}

export function getWeaponCooldown(tItem: InventoryItem) {
  const t = ITEM_TEMPLATES[tItem.sTemplate];
  if (!t) return undefined;
  return {
    nMaxCoolDown: t.nMaxCoolDown,
    nMinCoolDown: t.nMinCoolDown,
    nMinAimTime: t.nMinAimTime,
    nMaxAimTime: t.nMaxAimTime,
  };
}

export function getMeleeCooldown(tItem: InventoryItem): number | undefined {
  return ITEM_TEMPLATES[tItem.sTemplate]?.nMeleeCoolDown;
}

export function getWeaponPoints(tItem: InventoryItem): number | undefined {
  return ITEM_TEMPLATES[tItem.sTemplate]?.nPoints;
}

export function getArmorData(tItem: InventoryItem) {
  const t = ITEM_TEMPLATES[tItem.sTemplate];
  if (!t || t.nDamageReduction === undefined) return undefined;
  return {
    nDamageReduction: t.nDamageReduction,
    nDodgeChance: t.nDodgeChance ?? 0,
  };
}

// ── Job / Outfit ────────────────────────────────────────────────────────

export function getItemJob(tItem: InventoryItem): { Job?: number; bJobTool?: boolean } {
  const t = ITEM_TEMPLATES[tItem.sTemplate];
  return { Job: t?.Job, bJobTool: t?.bJobTool };
}

export function getOutfitOverride(tItem: InventoryItem): { sOutfit?: string; Job?: number } | undefined {
  const t = ITEM_TEMPLATES[tItem.sTemplate];
  if (t?.sOutfit) return { sOutfit: t.sOutfit, Job: t.Job };
  return undefined;
}

// ── Template Flag Accessors ─────────────────────────────────────────────

export function isStuff(tItem: InventoryItem): boolean {
  return !!ITEM_TEMPLATES[tItem.sTemplate]?.bStuff;
}

export function isDisplayable(tItem: InventoryItem): boolean {
  return !!ITEM_TEMPLATES[tItem.sTemplate]?.bDisplayable;
}

export function heldOnly(tItem: InventoryItem): boolean {
  return !!ITEM_TEMPLATES[tItem.sTemplate]?.bHeldOnly;
}

export function disappearOnDrop(tItem: InventoryItem): boolean {
  return !!ITEM_TEMPLATES[tItem.sTemplate]?.bDisappearOnDrop;
}

export function isSingleton(tItem: InventoryItem): boolean {
  return !!ITEM_TEMPLATES[tItem.sTemplate]?.bSingleton;
}

export function isContainer(tItem: InventoryItem): boolean {
  return !!ITEM_TEMPLATES[tItem.sTemplate]?.bContainer;
}

export function canStack(tItemA: InventoryItem, tItemB: InventoryItem): boolean {
  return tItemA.sTemplate === tItemB.sTemplate && !!ITEM_TEMPLATES[tItemA.sTemplate]?.bStackable;
}

export function getMaxStacks(itemOrTemplate: InventoryItem | string): number {
  const sTemplate = typeof itemOrTemplate === 'string' ? itemOrTemplate : itemOrTemplate.sTemplate;
  const t = ITEM_TEMPLATES[sTemplate];
  if (!t?.bStackable) return 1;
  return t.nMaxStacks ?? DEFAULT_MAX_STACKS;
}

export function getHeldItemSatisfier(tItem: InventoryItem): { sTemplate: string; Job?: number } | undefined {
  const t = ITEM_TEMPLATES[tItem.sTemplate];
  if (t?.bSatisfier) return { sTemplate: tItem.sTemplate, Job: t.Job };
  return undefined;
}

// ── Pickup ──────────────────────────────────────────────────────────────

export function getPickupName(tItem: InventoryItem): string {
  return ITEM_TEMPLATES[tItem.sTemplate]?.Pickup ?? DEFAULT_PICKUP;
}

// ── Portrait / Display ──────────────────────────────────────────────────

export function getPortrait(tItem: InventoryItem) {
  const t = ITEM_TEMPLATES[tItem.sTemplate];
  if (!t) return undefined;

  let sSprite = t.sPortraitSprite;
  if (!sSprite && t.tPortraitSprites) {
    sSprite = t.tPortraitSprites[Math.floor(Math.random() * t.tPortraitSprites.length)];
  }

  const sTintSprite = t.sTintSprite;
  const tColor = tItem.Color ? TAGS.Color[tItem.Color]?.color : undefined;

  const nPortraitScl = t.nPortraitScl ?? 2;
  const nPortraitOffX = t.nPortraitOffX ?? -200;
  const nPortraitOffY = t.nPortraitOffY ?? -240;
  const bUsePortraitOffsetHack = t.bUsePortraitOffsetHack ?? true;

  return {
    sSprite, sSpriteSheet: t.sSpriteSheet ?? 'Environments/Objects',
    sTintSprite, tColor,
    nPortraitScl, nPortraitOffX, nPortraitOffY, bUsePortraitOffsetHack,
  };
}

export function getDisplaySprite(tItem: InventoryItem) {
  const t = ITEM_TEMPLATES[tItem.sTemplate];
  if (!t?.bDisplayable) return undefined;

  let sSprite = t.sDisplaySprite ?? t.sPortraitSprite;
  if (!sSprite && t.tPortraitSprites) {
    sSprite = t.tPortraitSprites[Math.floor(Math.random() * t.tPortraitSprites.length)];
  }
  return { sSprite, sSpriteSheet: t.sSpriteSheet ?? 'Environments/Objects', tScl: undefined };
}

// ── Affinity Decay ──────────────────────────────────────────────────────

/** Per needs-reduce tick (14.4s). Mirrors Lua Inventory.getAffinityDecay(). */
export function getAffinityDecay(tItem: InventoryItem): number {
  const t = ITEM_TEMPLATES[tItem.sTemplate];
  if (!t) return DEFAULT_AFFINITY_DECAY;
  if (t.nAffinityDecay !== undefined) return t.nAffinityDecay;
  if (t.bJobTool) return 0;
  if (t.nDamage !== undefined) return DEFAULT_AFFINITY_DECAY * 0.75;
  return DEFAULT_AFFINITY_DECAY;
}

// ── Incineration ────────────────────────────────────────────────────────

/** Get 0-1 bias for how "ready" an item is for incineration. */
export function getIncinerateBias(tItem: InventoryItem): number {
  if (tItem.nTimeUnwanted === undefined) return 0;
  let nDiff = GameRules.elapsedTime - tItem.nTimeUnwanted;
  let nMin = TIME_UNWANTED_BEFORE_INCINERATE_MIN;
  let nMax = TIME_UNWANTED_BEFORE_INCINERATE_MAX;

  const { bJobTool } = getItemJob(tItem);
  if (bJobTool) {
    nMin *= JOB_ITEM_NO_INCINERATE_MULT;
    nMax *= JOB_ITEM_NO_INCINERATE_MULT;
  }

  if (nDiff < nMin) return 0;
  nDiff = Math.min(nDiff, nMax) - nMin;
  return nDiff / (nMax - nMin);
}

/** Check if item is eligible for incineration. */
export function allowIncinerate(tItem: InventoryItem): boolean {
  if (tItem.bEligibleForIncinerate) return true;

  const { bJobTool } = getItemJob(tItem);
  let nTimeToIncinerate = TIME_UNWANTED_BEFORE_INCINERATE_MIN;
  if (bJobTool) nTimeToIncinerate *= JOB_ITEM_NO_INCINERATE_MULT;

  if (tItem.nTimeUnwanted !== undefined && GameRules.elapsedTime - tItem.nTimeUnwanted > nTimeToIncinerate) {
    tItem.bEligibleForIncinerate = true;
    return true;
  }
  return false;
}

// ── Container Operations ────────────────────────────────────────────────

export function putItemIntoContainer(tContainer: InventoryItem, tItem: InventoryItem) {
  const tContainerTemplate = ITEM_TEMPLATES[tContainer.sTemplate];
  if (!tContainerTemplate?.bContainer || !tContainer.tContents) return;

  tItem.tOwnerTag = tContainer.tag;

  if (tContainer.tContents[tItem.sName]) {
    const tItemTemplate = ITEM_TEMPLATES[tItem.sTemplate];
    if (tItemTemplate?.bStackable) {
      const nMaxStacks = tItemTemplate.nMaxStacks ?? DEFAULT_MAX_STACKS;
      tContainer.tContents[tItem.sName].nCount =
        Math.min(nMaxStacks, tContainer.tContents[tItem.sName].nCount + tItem.nCount);
    }
  } else {
    tContainer.tContents[tItem.sName] = tItem;
  }
}

export function removeItemFromContainer(
  tContents: Record<string, InventoryItem>,
  sObjectKey: string,
  nCount?: number,
): InventoryItem | undefined {
  const tData = tContents[sObjectKey];
  if (!tData) return undefined;

  if (!nCount || tData.nCount <= nCount) {
    delete tContents[sObjectKey];
    delete tData.tOwnerTag;
    return tData;
  } else {
    const tNewItem = dupeItem(tData);
    tData.nCount -= nCount;
    tNewItem.nCount = nCount;
    return tNewItem;
  }
}

export function putItemListIntoContainer(tContainer: InventoryItem, tList: InventoryItem[]) {
  for (const item of tList) {
    putItemIntoContainer(tContainer, item);
  }
}

// ── Owner ───────────────────────────────────────────────────────────────

export function assignOwner(tItem: InventoryItem, ownerTag: number) {
  tItem.tOwnerTag = ownerTag;
}

export function getOwner(tItem: InventoryItem): number | undefined {
  return tItem.tOwnerTag;
}

// ── Description / Flavor Text ───────────────────────────────────────────

export function getDesc(tItem: InventoryItem): string {
  if (tItem.sDesc) return tItem.sDesc;
  const t = ITEM_TEMPLATES[tItem.sTemplate];
  return t?.sDesc ?? '';
}

export function getFlavorText(tItem: InventoryItem): string | undefined {
  return ITEM_TEMPLATES[tItem.sTemplate]?.sFlavorText;
}

// ── Singleton Check ─────────────────────────────────────────────────────

export function alreadyHasSingleton(tItem: InventoryItem, tInventory: InventoryItem[]): boolean {
  const t = ITEM_TEMPLATES[tItem.sTemplate];
  if (!t?.bSingleton) return false;
  return tInventory.some(held => held.sTemplate === tItem.sTemplate);
}

// ── Save / Load ─────────────────────────────────────────────────────────

export function getSaveTable(tItem: InventoryItem): InventoryItem {
  return { ...tItem };
}

/** Validate and restore an item from save data. Mirrors Lua Inventory.portFromSave(). */
export function portFromSave(sKey: string, tItem: InventoryItem | null): InventoryItem | null {
  if (!tItem) return null;
  if (!tItem.sTemplate) return null;

  const tItemTemplate = ITEM_TEMPLATES[tItem.sTemplate];
  if (!tItemTemplate) return null;
  if (tItemTemplate.bDisappearOnDrop) return null;

  // ResearchDatacube must have sResearchData
  if (tItem.sTemplate === 'ResearchDatacube' && !tItem.sResearchData) return null;

  if (!tItem.nCount) tItem.nCount = 1;

  // Validate tint color
  if (tItemTemplate.sTintSprite && (!tItem.Color || !TAGS.Color[tItem.Color])) {
    const colorKeys = Object.keys(TAGS.Color);
    tItem.Color = colorKeys[Math.floor(Math.random() * colorKeys.length)];
  }

  // Restore unique tag for non-stackable items
  if (!tItemTemplate.bStackable && !tItem.tag) {
    tItem.tag = nextItemTag++;
  }

  return tItem;
}

// ── Character Inventory (instance-based, wraps the old simple map) ──────

export class CharacterInventory {
  private items: InventoryItem[] = [];

  addItem(tItem: InventoryItem): boolean {
    // Check for stacking
    if (ITEM_TEMPLATES[tItem.sTemplate]?.bStackable) {
      const existing = this.items.find(i => i.sTemplate === tItem.sTemplate);
      if (existing) {
        const max = getMaxStacks(tItem);
        existing.nCount = Math.min(max, existing.nCount + tItem.nCount);
        return true;
      }
    }
    this.items.push(tItem);
    return true;
  }

  removeItem(sTemplate: string, nCount = 1): InventoryItem | undefined {
    const idx = this.items.findIndex(i => i.sTemplate === sTemplate);
    if (idx === -1) return undefined;

    const item = this.items[idx];
    if (item.nCount <= nCount) {
      this.items.splice(idx, 1);
      return item;
    } else {
      const removed = dupeItem(item);
      item.nCount -= nCount;
      removed.nCount = nCount;
      return removed;
    }
  }

  hasItem(sTemplate: string, nCount = 1): boolean {
    const item = this.items.find(i => i.sTemplate === sTemplate);
    return !!item && item.nCount >= nCount;
  }

  getCount(sTemplate: string): number {
    return this.items.find(i => i.sTemplate === sTemplate)?.nCount ?? 0;
  }

  getAll(): InventoryItem[] {
    return this.items;
  }

  getTotalCount(): number {
    return this.items.reduce((sum, i) => sum + i.nCount, 0);
  }

  clear() {
    this.items = [];
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  /** Check if a singleton of this template is already held. */
  hasSingleton(sTemplate: string): boolean {
    return alreadyHasSingleton({ sTemplate, sName: '', nCount: 1 }, this.items);
  }

  /** Get save-ready array. */
  toSaveData(): InventoryItem[] {
    return this.items.map(getSaveTable);
  }

  /** Restore from save data. */
  fromSaveData(data: InventoryItem[]) {
    this.items = [];
    for (const raw of data) {
      const restored = portFromSave(raw.sTemplate, raw);
      if (restored) this.items.push(restored);
    }
  }
}
