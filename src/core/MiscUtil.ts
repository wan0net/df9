/**
 * MiscUtil.ts — Utility functions.
 * Mirrors MiscUtil.lua: weighted random, iso math, deep copy, formatting.
 */

import { GRID_W } from '../config';

/**
 * Chebyshev distance in iso/offset coordinates.
 * Matches MiscUtil.isoDist.
 */
export function isoDist(x0: number, y0: number, x1: number, y1: number): number {
  return Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
}

/**
 * Convert iso offset coords to axis-aligned "square" coords.
 * Matches MiscUtil.isoToSquare (uses g_World.width as GRID_W).
 */
export function isoToSquare(tx: number, ty: number): { ns: number; we: number } {
  let ns: number;
  let we: number;
  if (ty % 2 === 0) {
    ns = tx + ty * 0.5;
    we = GRID_W * 0.5 - ty * 0.5 + tx;
  } else {
    ns = tx + ty * 0.5 - 0.5;
    we = GRID_W * 0.5 - ty * 0.5 + tx - 0.5;
  }
  return { ns, we };
}

/**
 * Euclidean distance between two iso offset coords via square-space transform.
 * Matches MiscUtil.isoSquareDist.
 */
export function isoSquareDist(x1: number, y1: number, x2: number, y2: number): number {
  const a = isoToSquare(x1, y1);
  const b = isoToSquare(x2, y2);
  const dx = b.ns - a.ns;
  const dy = b.we - a.we;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Deep copy a plain data object (no functions/class instances).
 * Matches MiscUtil.deepCopyData.
 */
export function deepCopyData<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => deepCopyData(item)) as unknown as T;
  }
  const copy = {} as Record<string, unknown>;
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    copy[key] = deepCopyData((obj as Record<string, unknown>)[key]);
  }
  return copy as T;
}

/**
 * Find index of element in array, or -1.
 * Matches MiscUtil.arrayIndexOf (Lua returns nil on miss; we return -1).
 */
export function arrayIndexOf<T>(arr: T[], elem: T): number {
  return arr.indexOf(elem);
}

/**
 * Weighted random selection from a map of choice→weight.
 * If nSeed provided, uses deterministic LCG (matches Lua's formula).
 * Matches MiscUtil.weightedRandom.
 */
export function weightedRandom<K extends string | number>(
  choices: Record<K, number | { weight: number }>,
  nSeed?: number,
): K {
  let total = 0;
  const entries: [K, number][] = [];
  for (const key of Object.keys(choices) as K[]) {
    const v = choices[key];
    const w = typeof v === 'object' && v !== null ? (v as { weight: number }).weight : (v as number);
    total += w;
    entries.push([key, w]);
  }

  let pick: number;
  if (nSeed !== undefined) {
    // Deterministic LCG matching Lua: (1103515245 * nSeed + 12345) % 2^32
    pick = ((1103515245 * nSeed + 12345) % 4294967296) / 4294967296 * total;
  } else {
    pick = Math.random() * total;
  }

  let lastChoice = entries[0]?.[0];
  for (const [choice, weight] of entries) {
    pick -= weight;
    if (pick <= 0) return choice;
    lastChoice = choice;
  }
  return lastChoice!;
}

/**
 * Return a random key from an object, optionally excluding some keys.
 * Matches MiscUtil.randomKey.
 */
export function randomKey<K extends string>(
  obj: Record<K, unknown>,
  exclude?: Set<K>,
): K | undefined {
  const keys = (Object.keys(obj) as K[]).filter((k) => !exclude || !exclude.has(k));
  if (keys.length === 0) return undefined;
  return keys[Math.floor(Math.random() * keys.length)];
}

/**
 * Return a random element from an array.
 * Matches MiscUtil.randomValue.
 */
export function randomValue<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Random point within a radius (iso-space).
 * Matches MiscUtil.randomPointWithinRadius.
 */
export function randomPointWithinRadius(
  wx: number,
  wy: number,
  maxRadius: number,
): { x: number; y: number } {
  const rad = Math.random() * maxRadius;
  const angle = Math.random() * 2 * Math.PI;
  return {
    x: wx + rad * Math.sin(angle),
    y: wy + rad * Math.cos(angle) * 0.66,
  };
}

/**
 * Pad a string to a given length.
 * Matches MiscUtil.padString.
 */
export function padString(
  input: string | number,
  amount: number,
  leftJustify = false,
  char = ' ',
): string {
  let s = String(input);
  while (s.length < amount) {
    s = leftJustify ? s + char : char + s;
  }
  return s;
}

/**
 * Convert integer to Roman numeral string (1-4999).
 * Matches MiscUtil.toRoman.
 */
const ROMAN_MAP: [string, number][] = [
  ['M', 1000], ['CM', 900], ['D', 500], ['CD', 400],
  ['C', 100], ['XC', 90], ['L', 50], ['XL', 40],
  ['X', 10], ['IX', 9], ['V', 5], ['IV', 4], ['I', 1],
];

export function toRoman(n: number): string {
  if (n > 4999 || n < 1) return 'MiscUtil.toRoman: out of range!';
  let result = '';
  for (const [numeral, value] of ROMAN_MAP) {
    while (n >= value) {
      result += numeral;
      n -= value;
    }
  }
  return result;
}

/**
 * Format seconds into H:MM:SS or MM:SS.
 * Matches MiscUtil.formatTime.
 */
export function formatTime(nSeconds: number): string {
  const hours = Math.floor(nSeconds / 3600);
  const minutes = Math.floor((nSeconds % 3600) / 60);
  const seconds = Math.floor(nSeconds % 60);
  let s = '';
  if (hours > 0) s += hours + ':';
  s += String(minutes).padStart(2, '0') + ':';
  s += String(seconds).padStart(2, '0');
  return s;
}

/**
 * Clamp a number between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Solve quadratic to lead a moving target.
 * Matches MiscUtil.leadTarget.
 */
export function leadTarget(
  wxSource: number,
  wySource: number,
  bulletSpeed: number,
  wxTarget: number,
  wyTarget: number,
  targetVelX: number,
  targetVelY: number,
): { x: number; y: number } {
  const a = bulletSpeed * bulletSpeed - (targetVelX * targetVelX + targetVelY * targetVelY);
  const dx = wxTarget - wxSource;
  const dy = wyTarget - wySource;
  const b = -2 * (targetVelX * dx + targetVelY * dy);
  const c = -(dx * dx + dy * dy);
  const discriminant = b * b - 4 * a * c;
  const t = (-b + Math.sqrt(Math.max(0, discriminant))) / (2 * a);
  return {
    x: wxTarget + t * targetVelX,
    y: wyTarget + t * targetVelY,
  };
}
