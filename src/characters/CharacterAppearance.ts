import {
  RACE_BIRDSHARK,
  RACE_CAT,
  RACE_CHICKEN,
  RACE_HUMAN,
  RACE_JELLY,
  RACE_KILLBOT,
  RACE_MONSTER,
  RACE_MURDERFACE,
  RACE_SHAMON,
  RACE_TOBIAN,
} from './CharacterConstants';

/** Lua Character.tStats appearance fields, persisted verbatim in save data. */
export interface CharacterAppearance {
  nBodyVariation: number;
  nHeadVariation: number;
  nFaceTopVariation: number;
  nFaceBottomVariation: number;
  nHairVariation: number;
  nBottomAccessoryVariation: number;
  nTopAccessoryVariation: number;
  sPortrait: string;
  sPortraitHair?: string;
  sPortraitFacialHair?: string;
}

export interface AppearanceStats extends CharacterAppearance {
  nRace: number;
}

export interface HairAppearance {
  subset: number;
  texture: string;
  portraitColor?: string;
}

export interface ModelAppearance {
  rig: 'base' | 'alien' | 'monster' | 'killbot';
  sex: 'M' | 'F';
  fat: boolean;
  bodySubset?: number;
  bodyTexture?: string;
  headSubset?: number;
  headTexture?: string;
  hair?: HairAppearance;
}

export interface FaceLayerTextures {
  top?: string;
  bottom?: string;
}

interface AccessoryDef {
  rig: 'base' | 'alien';
  subset: number;
  texture: string;
  conflicts: readonly number[];
}

interface AccessoryPool {
  bottom: readonly number[];
  top: readonly number[];
}

const NO_REPLACE = 1_000_001;
const STANDARD_ACCESSORY_CONFLICTS = [2, 3, 4, 5, 7, 8, 9, 12, 13, 14] as const;
const STANDARD_ACCESSORY_CONFLICTS_NO_JANITOR = [2, 3, 4, 5, 7, 8, 9, 12, 14] as const;
const ROBE_ACCESSORY_CONFLICTS = [4, 5, 7, 8, 9, 12, 13, 14] as const;
const GAUNTLET_ACCESSORY_CONFLICTS = [4, 5] as const;
const VISOR_ACCESSORY_CONFLICTS = [2, 3, 4, 5] as const;

/** Lua BOTTOM_ACCESSORY_TYPE, mapped to Citizen_Base/Citizen_Alien .brig subset order. */
const BOTTOM_ACCESSORIES: Record<number, AccessoryDef> = {
  1: { rig: 'base', subset: 33, texture: 'straps_pouches', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  2: { rig: 'base', subset: 26, texture: 'straps_pouches', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  3: { rig: 'base', subset: 28, texture: 'straps_pouches', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  4: { rig: 'base', subset: 26, texture: 'straps_pouches', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  5: { rig: 'alien', subset: 23, texture: 'straps_pouches', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  6: { rig: 'alien', subset: 22, texture: 'straps_pouches', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  7: { rig: 'base', subset: 37, texture: 'Tourist_Shorts_Male_01', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  8: { rig: 'base', subset: 36, texture: 'Tourist_Shorts_Female_01', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  9: { rig: 'base', subset: 31, texture: 'Tourist_Shorts_Male_01', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  10: { rig: 'base', subset: 32, texture: 'straps_pouches', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  11: { rig: 'base', subset: 27, texture: 'straps_pouches', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  12: { rig: 'base', subset: 30, texture: 'straps_pouches', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  13: { rig: 'base', subset: 29, texture: 'straps_pouches', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  // The source intentionally omits JANITOR from this one conflict list.
  14: { rig: 'alien', subset: 24, texture: 'Tourist_Shorts_Male_01', conflicts: STANDARD_ACCESSORY_CONFLICTS_NO_JANITOR },
  15: { rig: 'base', subset: 34, texture: 'straps_pouches', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  16: { rig: 'base', subset: 35, texture: 'straps_pouches', conflicts: STANDARD_ACCESSORY_CONFLICTS },
};

/** Lua TOP_ACCESSORY_TYPE, mapped to Citizen_Base/Citizen_Alien .brig subset order. */
const TOP_ACCESSORIES: Record<number, AccessoryDef> = {
  1: { rig: 'base', subset: 52, texture: 'Collar01', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  2: { rig: 'base', subset: 63, texture: 'AC_UpBody01', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  3: { rig: 'base', subset: 44, texture: 'Collar01', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  4: { rig: 'base', subset: 63, texture: 'AC_UpBody01', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  5: { rig: 'alien', subset: 14, texture: 'Collar01', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  6: { rig: 'alien', subset: 21, texture: 'AC_UpBody01', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  7: { rig: 'base', subset: 54, texture: 'AC_UpBody03', conflicts: ROBE_ACCESSORY_CONFLICTS },
  8: { rig: 'base', subset: 38, texture: 'straps_pouches', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  9: { rig: 'base', subset: 45, texture: 'straps_pouches', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  10: { rig: 'base', subset: 39, texture: 'straps_pouches', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  11: { rig: 'base', subset: 46, texture: 'straps_pouches', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  12: { rig: 'base', subset: 40, texture: 'straps_pouches', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  13: { rig: 'base', subset: 47, texture: 'straps_pouches', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  14: { rig: 'base', subset: 41, texture: 'straps_pouches', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  15: { rig: 'base', subset: 48, texture: 'straps_pouches', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  19: { rig: 'base', subset: 53, texture: 'Collar01', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  20: { rig: 'base', subset: 55, texture: 'Arm_Gauntlet', conflicts: GAUNTLET_ACCESSORY_CONFLICTS },
  21: { rig: 'base', subset: 56, texture: 'Arm_Gauntlet', conflicts: GAUNTLET_ACCESSORY_CONFLICTS },
  22: { rig: 'alien', subset: 19, texture: 'AC_UpBody03', conflicts: ROBE_ACCESSORY_CONFLICTS },
  26: { rig: 'base', subset: 50, texture: 'Tourist_Shirt_Male_02', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  27: { rig: 'base', subset: 50, texture: 'Tourist_Shirt_Male_03', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  28: { rig: 'base', subset: 63, texture: 'AC_UpBody02', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  29: { rig: 'base', subset: 63, texture: 'AC_UpBody02', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  30: { rig: 'alien', subset: 21, texture: 'AC_UpBody02', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  31: { rig: 'base', subset: 57, texture: 'AC_UpBody03', conflicts: ROBE_ACCESSORY_CONFLICTS },
  33: { rig: 'base', subset: 58, texture: 'Tourist_Shirt_Female_02', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  34: { rig: 'base', subset: 58, texture: 'Tourist_Shirt_Female_03', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  35: { rig: 'base', subset: 59, texture: 'AC_UpBody01', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  36: { rig: 'base', subset: 59, texture: 'AC_UpBody02', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  37: { rig: 'base', subset: 51, texture: 'Visor01', conflicts: VISOR_ACCESSORY_CONFLICTS },
  38: { rig: 'base', subset: 42, texture: 'Visor01', conflicts: VISOR_ACCESSORY_CONFLICTS },
  39: { rig: 'base', subset: 43, texture: 'Visor01', conflicts: VISOR_ACCESSORY_CONFLICTS },
  40: { rig: 'base', subset: 60, texture: 'Visor01', conflicts: VISOR_ACCESSORY_CONFLICTS },
  41: { rig: 'base', subset: 62, texture: 'Tourist_Shirt_Male_02', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  42: { rig: 'base', subset: 62, texture: 'Tourist_Shirt_Male_03', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  43: { rig: 'base', subset: 62, texture: 'Tourist_Shirt_Male_04', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  // Lua intentionally points variation 05 at the Male02 texture.
  44: { rig: 'base', subset: 62, texture: 'Tourist_Shirt_Male_02', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  45: { rig: 'base', subset: 61, texture: 'Tourist_Shirt_Female_02', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  46: { rig: 'base', subset: 61, texture: 'Tourist_Shirt_Female_03', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  47: { rig: 'base', subset: 61, texture: 'Tourist_Shirt_Female_04', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  48: { rig: 'base', subset: 61, texture: 'Tourist_Shirt_Female_05', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  49: { rig: 'base', subset: 49, texture: 'Tourist_Shirt_Female_02', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  50: { rig: 'base', subset: 49, texture: 'Tourist_Shirt_Female_03', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  51: { rig: 'base', subset: 49, texture: 'Tourist_Shirt_Female_04', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  52: { rig: 'base', subset: 49, texture: 'Tourist_Shirt_Female_05', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  53: { rig: 'base', subset: 58, texture: 'Tourist_Shirt_Female_04', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  54: { rig: 'base', subset: 58, texture: 'Tourist_Shirt_Female_05', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  55: { rig: 'base', subset: 50, texture: 'Tourist_Shirt_Male_04', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  // Lua intentionally points variation 05 at the Male02 texture.
  56: { rig: 'base', subset: 50, texture: 'Tourist_Shirt_Male_02', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  57: { rig: 'alien', subset: 20, texture: 'Tourist_Shirt_Male_03', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  58: { rig: 'alien', subset: 20, texture: 'Tourist_Shirt_Male_04', conflicts: STANDARD_ACCESSORY_CONFLICTS },
  59: { rig: 'alien', subset: 20, texture: 'Tourist_Shirt_Male_02', conflicts: STANDARD_ACCESSORY_CONFLICTS },
};

function accessoryPoolForBody(body: number): AccessoryPool {
  if (body >= 1 && body <= 5) return { bottom: [1, 2, 7], top: [2, 28, 7, 10, 14, 41, 42, 43, 44, 20, 21, 37] };
  if (body >= 6 && body <= 10) return { bottom: [3, 4, 8], top: [4, 29, 8, 12, 45, 46, 47, 48, 20, 21, 37] };
  if (body >= 11 && body <= 14) return { bottom: [3, 4, 8], top: [4, 29, 8, 12, 45, 46, 47, 48, 20, 21] };
  if (body >= 15 && body <= 19) return { bottom: [6, 5, 14], top: [6, 30, 22, 57, 58, 59] };
  if (body >= 20 && body <= 21) return { bottom: [1, 2, 7], top: [2, 28, 10, 14, 41, 42, 43, 44, 20, 21, 39] };
  if (body >= 22 && body <= 23) return { bottom: [3, 4, 8], top: [4, 29, 8, 12, 45, 46, 47, 48, 20, 21, 39] };
  if (body >= 24 && body <= 25) return { bottom: [1, 2, 7], top: [2, 28, 10, 14, 41, 42, 43, 44, 20, 21, 38] };
  if (body >= 26 && body <= 27) return { bottom: [3, 4], top: [4, 29, 8, 12, 45, 46, 47, 48, 20, 21, 38] };
  if (body >= 28 && body <= 31) return { bottom: [6, 5, 14], top: [6, 30, 22, 57, 58, 59] };
  if (body >= 32 && body <= 36) return { bottom: [10, 12, 9], top: [2, 28, 11, 15, 26, 27, 55, 56, 20, 21, 37] };
  if (body >= 37 && body <= 41) return { bottom: [11, 13], top: [4, 29, 9, 13, 20, 21, 37] };
  if (body >= 42 && body <= 45) return { bottom: [3, 4, 8], top: [4, 29, 9, 13, 20, 21] };
  if (body >= 46 && body <= 47) return { bottom: [10, 12, 9], top: [2, 28, 11, 15, 26, 27, 55, 56, 20, 21, 39] };
  if (body >= 48 && body <= 49) return { bottom: [11, 13], top: [4, 29, 9, 13, 20, 21, 39] };
  if (body >= 50 && body <= 51) return { bottom: [10, 12, 9], top: [2, 28, 11, 15, 26, 27, 55, 56, 20, 21, 38] };
  if (body >= 52 && body <= 53) return { bottom: [3, 4], top: [4, 29, 9, 13, 20, 21, 38] };
  if (body === 55) return { bottom: [16, 15], top: [35, 36, 31, 10, 33, 34, 53, 54, 20, 21, 40] };
  if (body === 56) return { bottom: [6, 5, 14], top: [6, 30, 22] };
  return { bottom: [], top: [] };
}
const BODY_BY_RACE: Record<number, readonly number[]> = {
  [RACE_HUMAN]: [...range(1, 10), ...range(32, 41)],
  [RACE_JELLY]: [...range(11, 14), ...range(42, 45)],
  [RACE_TOBIAN]: range(15, 19),
  [RACE_CAT]: [...range(20, 23), ...range(46, 49)],
  [RACE_BIRDSHARK]: [...range(24, 27), ...range(50, 53)],
  [RACE_CHICKEN]: range(28, 31),
  [RACE_MONSTER]: [54],
  [RACE_SHAMON]: [55],
  [RACE_MURDERFACE]: [56],
  [RACE_KILLBOT]: [57],
};

const MALE_HAIR = [
  0,
  1, 40, 41, 42, 53, 54, 76,
  2, 43, 44, 45, 55, 56, 77,
  3, 46, 47, 48, 57, 58, 78,
  64, 65, 66, 67, 68, 69, 79,
  70, 71, 72, 73, 74, 75, 80,
] as const;
const FEMALE_HAIR = [
  0,
  4, 28, 29, 30, 49, 50, 81,
  5, 25, 26, 27, 82,
  6, 31, 32, 33, 59, 60, 83,
  7, 34, 35, 36, 61, 62, 84,
  8, 37, 38, 39, 51, 52, 85,
] as const;

function range(first: number, last: number): number[] {
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
}

function pick<T>(values: readonly T[], random: () => number): T {
  return values[Math.min(values.length - 1, Math.floor(random() * values.length))];
}

function suffix(value: number): string {
  return String(value).padStart(2, '0');
}

function bodySex(body: number): 'M' | 'F' {
  if ((body >= 6 && body <= 14) || (body >= 22 && body <= 23) ||
      (body >= 26 && body <= 27) || (body >= 30 && body <= 31) ||
      (body >= 37 && body <= 45) || (body >= 48 && body <= 49) ||
      (body >= 52 && body <= 53)) return 'F';
  return 'M';
}

function bodyIsFat(body: number): boolean {
  return body >= 32 && body <= 53;
}

function bodyTone(body: number): number {
  if (body >= 1 && body <= 5) return body;
  if (body >= 6 && body <= 10) return body - 5;
  if (body >= 11 && body <= 14) return body - 10;
  if (body >= 15 && body <= 19) return body - 14;
  if (body >= 20 && body <= 23) return ((body - 20) % 2) + 1;
  if (body >= 24 && body <= 27) return ((body - 24) % 2) + 1;
  if (body >= 28 && body <= 31) return body - 27;
  if (body >= 32 && body <= 36) return body - 31;
  if (body >= 37 && body <= 41) return body - 36;
  if (body >= 42 && body <= 45) return body - 41;
  if (body >= 46 && body <= 49) return ((body - 46) % 2) + 1;
  if (body >= 50 && body <= 53) return ((body - 50) % 2) + 1;
  return 1;
}

function headForBody(body: number): number {
  if (body >= 42 && body <= 45) return body - 31;
  if (body >= 46 && body <= 53) return body - 26;
  if (body === 54 || body === 57) return 44;
  if (body === 55) return 42;
  if (body === 56) return 43;
  return body;
}

function tobianHair(body: number, random: () => number): number {
  const tone = bodyTone(body);
  return pick([
    [9, 11, 12, 13, 14][tone - 1],
    [10, 15, 16, 17, 18][tone - 1],
    [19, 20, 21, 22, 23][tone - 1],
  ], random);
}

function hairFor(body: number, random: () => number): number {
  const sex = bodySex(body);
  if ((body >= 1 && body <= 10) || (body >= 32 && body <= 41)) {
    return pick(sex === 'M' ? MALE_HAIR : FEMALE_HAIR, random);
  }
  if (body >= 15 && body <= 19) return tobianHair(body, random);
  if ([20, 21, 46, 47].includes(body)) return bodyTone(body) === 1 ? 24 : 63;
  return 0;
}

function faceLayersFor(race: number, body: number, hair: number, random: () => number): { top: number; bottom: number } {
  if (race === RACE_CHICKEN) {
    const variant = bodyTone(body);
    return { top: variant, bottom: variant };
  }
  if (race !== RACE_HUMAN || bodySex(body) !== 'M' || random() > 0.4) {
    return { top: 0, bottom: 0 };
  }
  const color = humanHairAppearance(hair)?.portraitColor;
  const beardIds = color === 'Brown' ? [7, 11, 15, 19, 23]
    : color === 'Red' ? [6, 10, 14, 18, 22]
      : color === 'Gray' ? [25, 26, 27, 28, 29]
        : [8, 12, 16, 20, 24];
  return { top: 0, bottom: pick(beardIds, random) };
}

function humanHairAppearance(id: number): HairAppearance | undefined {
  if (id === 0) return undefined;
  const groups: Array<{ ids: readonly number[]; subset: number; texture: string; colors: readonly string[] }> = [
    { ids: [1, 40, 41, 42, 53, 54, 76], subset: 23, texture: 'Hair_Short03_Color', colors: ['Yellow', 'Orange', 'Brown', 'Black', 'Red', 'Blue', 'Gray'] },
    { ids: [2, 43, 44, 45, 55, 56, 77], subset: 20, texture: 'Hair_Short03_Color', colors: ['Yellow', 'Orange', 'Brown', 'Black', 'Red', 'Blue', 'Gray'] },
    { ids: [3, 46, 47, 48, 57, 58, 78], subset: 22, texture: 'Hair_Short03_Color', colors: ['Yellow', 'Orange', 'Brown', 'Black', 'Red', 'Blue', 'Gray'] },
    { ids: [64, 65, 66, 67, 68, 69, 79], subset: 24, texture: 'Hair_Short03_Color', colors: ['Yellow', 'Orange', 'Brown', 'Black', 'Red', 'Blue', 'Gray'] },
    { ids: [70, 71, 72, 73, 74, 75, 80], subset: 25, texture: 'Hair_Short03_Color', colors: ['Yellow', 'Red', 'Brown', 'Black', 'Red', 'Blue', 'Gray'] },
    { ids: [4, 28, 29, 30, 49, 50, 81], subset: 18, texture: 'Hair_Long01_Color', colors: ['Yellow', 'Orange', 'Brown', 'Black', 'Pink', 'Green', 'Gray'] },
    { ids: [5, 25, 26, 27, 82], subset: 19, texture: 'Hair_Short02_Color', colors: ['Yellow', 'Orange', 'Brown', 'Black', 'Gray'] },
    { ids: [6, 31, 32, 33, 59, 60, 83], subset: 23, texture: 'Hair_Short03_Color', colors: ['Yellow', 'Orange', 'Brown', 'Black', 'Red', 'Blue', 'Gray'] },
    { ids: [7, 34, 35, 36, 61, 62, 84], subset: 21, texture: 'Hair_Short03_Color', colors: ['Yellow', 'Orange', 'Brown', 'Black', 'Red', 'Blue', 'Gray'] },
    { ids: [8, 37, 38, 39, 51, 52, 85], subset: 17, texture: 'Hair_Long01_Color', colors: ['Yellow', 'Orange', 'Brown', 'Black', 'Pink', 'Green', 'Gray'] },
  ];
  for (const group of groups) {
    const color = group.ids.indexOf(id);
    if (color >= 0) return {
      subset: group.subset,
      texture: `${group.texture}_0${color + 1}`,
      portraitColor: group.colors[color],
    };
  }
  if (id === 24 || id === 63) return {
    subset: 16,
    texture: `Cat_Head_Male01_base_0${id === 24 ? 1 : 2}`,
  };
  return undefined;
}

function alienHairAppearance(id: number): HairAppearance | undefined {
  const dong = [9, 11, 12, 13, 14].indexOf(id);
  if (dong >= 0) return { subset: 1, texture: `Alien_Head01_base_0${dong + 1}` };
  const moustache = [10, 15, 16, 17, 18].indexOf(id);
  if (moustache >= 0) return { subset: 3, texture: `Moustache01_Hair01_base_0${moustache + 1}` };
  const elephant = [19, 20, 21, 22, 23].indexOf(id);
  if (elephant >= 0) return { subset: 2, texture: `Elephant01_Hair01_base_0${elephant + 1}` };
  return undefined;
}

function getFaceLayerTextures(stats: AppearanceStats): FaceLayerTextures {
  const layers: FaceLayerTextures = {};
  if (stats.nFaceTopVariation >= 1 && stats.nFaceTopVariation <= 4) {
    layers.top = `Chicken_Head01_top_0${stats.nFaceTopVariation}`;
  }
  const bottom = stats.nFaceBottomVariation;
  if (bottom >= 1 && bottom <= 4) {
    layers.bottom = `Chicken_Head01_bottom_0${bottom}`;
  } else if (bottom >= 5 && bottom <= 24) {
    const offset = bottom - 5;
    layers.bottom = `Human_Head_Male01_bottom_0${Math.floor(offset / 4) + 1}_Color_0${(offset % 4) + 1}`;
  } else if (bottom >= 25 && bottom <= 29) {
    layers.bottom = `Human_Head_Male01_bottom_0${bottom - 24}_Color_05`;
  }
  return layers;
}

export function getModelAppearance(stats: AppearanceStats): ModelAppearance {
  const body = stats.nBodyVariation;
  const tone = bodyTone(body);
  const sex = bodySex(body);
  const fat = bodyIsFat(body);
  if (body === 54) return { rig: 'monster', sex, fat: false };
  if (body === 57) return { rig: 'killbot', sex, fat: false };
  if (body >= 15 && body <= 19) return {
    rig: 'alien', sex, fat,
    bodySubset: 0, bodyTexture: `Alien_Body01_base_0${tone}`,
    headSubset: 4, headTexture: `Alien_Head01_base_0${tone}`,
    hair: alienHairAppearance(stats.nHairVariation),
  };
  if (body >= 28 && body <= 31) return {
    rig: 'alien', sex, fat,
    bodySubset: 0, bodyTexture: `Chicken_Body01_base_0${tone}`,
    headSubset: 5, headTexture: `Chicken_Head01_base_0${tone}`,
  };
  if (body === 56) return {
    rig: 'alien', sex, fat: false,
    bodySubset: 0, bodyTexture: 'Murder_Body01',
    headSubset: 6, headTexture: 'Murder_Head01',
  };

  let bodySubset = sex === 'M' ? (fat ? 13 : 12) : (fat ? 11 : 10);
  let headSubset = sex === 'M' ? (fat ? 8 : 7) : (fat ? 3 : 4);
  let bodyTexture = `Human_Body_${sex === 'M' ? 'Male' : 'Female'}01_base_0${tone}`;
  let headTexture = `Human_Head_${sex === 'M' ? 'Male' : 'Female'}01_base_0${tone}`;
  if ((body >= 11 && body <= 14) || (body >= 42 && body <= 45)) {
    bodySubset = fat ? 11 : 10;
    headSubset = 5;
    bodyTexture = `Jelly_Body_Female01_base_0${tone}`;
    headTexture = `Jelly_Head_Female01_base_0${tone}`;
  } else if ((body >= 20 && body <= 23) || (body >= 46 && body <= 49)) {
    headSubset = 2;
    bodyTexture = `Cat_Body_${sex === 'M' ? 'Male' : 'Female'}01_base_0${tone}`;
    headTexture = `Cat_Head_${sex === 'M' ? 'Male' : 'Female'}01_base_0${tone}`;
  } else if ((body >= 24 && body <= 27) || (body >= 50 && body <= 53)) {
    headSubset = 1;
    bodyTexture = `Bird_Body_${sex === 'M' ? 'Male' : 'Female'}01_base_0${tone}`;
    headTexture = `Bird_Head_${sex === 'M' ? 'Male' : 'Female'}01_base_0${tone}`;
  } else if (body === 55) {
    bodySubset = 14;
    headSubset = 9;
    bodyTexture = 'Shamon_Body';
    headTexture = 'Shamon_Head01';
  }
  return {
    rig: 'base', sex, fat, bodySubset, bodyTexture, headSubset, headTexture,
    hair: humanHairAppearance(stats.nHairVariation),
  };
}

function portraitFor(stats: Omit<AppearanceStats, 'sPortrait'>, random: () => number): Pick<CharacterAppearance, 'sPortrait' | 'sPortraitHair' | 'sPortraitFacialHair'> {
  const body = stats.nBodyVariation;
  const sex = bodySex(body);
  const fat = bodyIsFat(body);
  let sPortrait: string;
  if (stats.nRace === RACE_HUMAN) {
    const tones = ['Brown', 'Yellowish', 'Reddish', 'White', 'Black'];
    const tone = tones[bodyTone(body) - 1];
    const face = pick(range(1, fat ? 2 : sex === 'M' ? 10 : 8), random);
    sPortrait = `Human_${fat ? 'Large_' : ''}${sex === 'M' ? 'Male' : 'Female'}_${tone}_${suffix(face)}`;
  } else if (stats.nRace === RACE_JELLY) {
    const colors = ['Mauve', 'Purple', 'Pink', 'Blue'];
    // Lua only special-cases the four normal bodies; fat Jelly portraits fall
    // through to the Mauve default.
    const color = body >= 42 ? 'Mauve' : colors[(bodyTone(body) - 1) % 4];
    sPortrait = `Jelly_Female_${color}_${suffix(pick([1, 2], random))}`;
  } else if (stats.nRace === RACE_TOBIAN) {
    const colors = ['Blue', 'Light_Teal', 'Light_Blue', 'Teal', 'Purple'];
    const hair = alienHairAppearance(stats.nHairVariation);
    const prefix = hair?.subset === 2 ? 'TobianElephantHead' : hair?.subset === 3 ? 'TobianEyestalkMustacheHead' : 'TobianDongHead';
    sPortrait = `${prefix}_Male_${colors[bodyTone(body) - 1]}_${suffix(pick([1, 2], random))}`;
  } else if (stats.nRace === RACE_CAT) {
    sPortrait = sex === 'M' ? 'Cat_male_black_01' : 'Cat_female_yellow_01';
  } else if (stats.nRace === RACE_BIRDSHARK) {
    const face = fat ? 1 : pick([1, 2], random);
    const sexName = sex === 'M' ? 'Male' : (!fat && face === 1 ? 'female' : 'Female');
    sPortrait = `Birdshark_${fat ? 'Large_' : ''}${sexName}_White_${suffix(face)}`;
  } else if (stats.nRace === RACE_CHICKEN) {
    const face = sex === 'M' ? 1 : pick([1, 2], random);
    sPortrait = sex === 'M' ? 'Chicken_Male_White_01' : `Chicken_${face === 1 ? 'female' : 'Female'}_White_${suffix(face)}`;
  } else if (stats.nRace === RACE_SHAMON) {
    sPortrait = `Shamon_Male_White_${suffix(pick([1, 2, 3], random))}`;
  } else if (stats.nRace === RACE_MURDERFACE) {
    sPortrait = `MurderFace_Male_Green_${suffix(pick([1, 2, 3], random))}`;
  } else if (stats.nRace === RACE_KILLBOT) {
    sPortrait = `Murder_Robot_${suffix(pick([1, 2], random))}`;
  } else {
    sPortrait = 'Monster_01';
  }

  const result: Pick<CharacterAppearance, 'sPortrait' | 'sPortraitHair' | 'sPortraitFacialHair'> = { sPortrait };
  if (stats.nRace === RACE_HUMAN) {
    const hair = humanHairAppearance(stats.nHairVariation);
    const face = sPortrait.match(/_(\d\d)$/)?.[1] ?? '01';
    const size = fat ? 'Large_' : '';
    const sexName = sex === 'M' ? 'Male' : 'Female';
    if (hair?.portraitColor) result.sPortraitHair = `Human_${size}${sexName}_${face}_Hair_${hair.portraitColor}_01`;
    if (sex === 'M' && stats.nFaceBottomVariation !== 0) {
      const beardId = stats.nFaceBottomVariation;
      const colorIndex = beardId >= 25 ? 5 : ((beardId - 5) % 4) + 1;
      const color = ['Brown', 'Red', 'Yellow', 'Black', 'Gray'][colorIndex - 1];
      const style = pick(['Mustache', 'Beard'], random);
      result.sPortraitFacialHair = `Human_${size}Male_${face}_${style}_${color}_01`;
    }
  }
  return result;
}

export function generateCharacterAppearance(race: number, random: () => number = Math.random): CharacterAppearance {
  const bodies = BODY_BY_RACE[race] ?? BODY_BY_RACE[RACE_HUMAN];
  const nBodyVariation = pick(bodies, random);
  const nHeadVariation = headForBody(nBodyVariation);
  const nHairVariation = hairFor(nBodyVariation, random);
  const face = faceLayersFor(race, nBodyVariation, nHairVariation, random);
  const accessoryPool = accessoryPoolForBody(nBodyVariation);
  // Lua math.random(0, 100) is inclusive: values 0..59 select an accessory.
  const selectAccessory = (pool: readonly number[]) =>
    pool.length > 0 && Math.floor(random() * 101) < 60 ? pick(pool, random) : NO_REPLACE;
  const base = {
    nBodyVariation,
    nHeadVariation,
    nFaceTopVariation: face.top,
    nFaceBottomVariation: face.bottom,
    nHairVariation,
    nBottomAccessoryVariation: selectAccessory(accessoryPool.bottom),
    nTopAccessoryVariation: selectAccessory(accessoryPool.top),
  };
  return { ...base, ...portraitFor({ nRace: race, ...base }, random) };
}

export function isAppearanceValidForRace(stats: Partial<AppearanceStats>): stats is AppearanceStats {
  const bodies = stats.nRace === undefined ? undefined : BODY_BY_RACE[stats.nRace];
  const accessoryPool = typeof stats.nBodyVariation === 'number' ? accessoryPoolForBody(stats.nBodyVariation) : undefined;
  return !!bodies && typeof stats.nBodyVariation === 'number' && bodies.includes(stats.nBodyVariation) &&
    typeof stats.nHeadVariation === 'number' && typeof stats.nFaceTopVariation === 'number' &&
    typeof stats.nFaceBottomVariation === 'number' && typeof stats.nHairVariation === 'number' &&
    typeof stats.nBottomAccessoryVariation === 'number' &&
    (stats.nBottomAccessoryVariation === NO_REPLACE || !!accessoryPool?.bottom.includes(stats.nBottomAccessoryVariation)) &&
    typeof stats.nTopAccessoryVariation === 'number' &&
    (stats.nTopAccessoryVariation === NO_REPLACE || !!accessoryPool?.top.includes(stats.nTopAccessoryVariation)) &&
    typeof stats.sPortrait === 'string' && stats.sPortrait.length > 0;
}

export function ensureCharacterAppearance<T extends { nRace: number }>(stats: T): T & CharacterAppearance {
  if (!isAppearanceValidForRace(stats)) Object.assign(stats, generateCharacterAppearance(stats.nRace));
  return stats as T & CharacterAppearance;
}

export function getPortraitLayers(stats: AppearanceStats): string[] {
  return [stats.sPortrait, stats.sPortraitFacialHair, stats.sPortraitHair]
    .filter((layer): layer is string => !!layer)
    .map(layer => `${layer}.png`);
}

export function getVisibleSubsets(stats: AppearanceStats, job: number): {
  indices: Set<number>;
  textures: Map<number, string>;
  faceLayers: Map<number, FaceLayerTextures>;
} {
  const appearance = getModelAppearance(stats);
  const indices = new Set<number>();
  const textures = new Map<number, string>();
  const faceLayers = new Map<number, FaceLayerTextures>();
  const add = (subset: number | undefined, texture?: string) => {
    if (subset === undefined) return;
    indices.add(subset);
    if (texture) textures.set(subset, texture);
  };
  add(appearance.bodySubset, appearance.bodyTexture);
  add(appearance.headSubset, appearance.headTexture);
  if (appearance.headSubset !== undefined) {
    const layers = getFaceLayerTextures(stats);
    if (layers.top || layers.bottom) faceLayers.set(appearance.headSubset, layers);
  }
  add(appearance.hair?.subset, appearance.hair?.texture);

  if (appearance.rig === 'base') {
    const outfit = appearance.fat
      ? ({ 2: 0, 3: 81, 4: 76, 5: 73, 6: 79, 9: 71, 12: 71 } as Record<number, number>)[job]
      : ({ 2: 68, 3: 82, 4: 77, 5: 74, 6: 80, 9: 72, 12: 72 } as Record<number, number>)[job];
    if (outfit !== undefined) {
      add(outfit, job === 9 ? 'Scientist01' : undefined);
      // HEAD_TYPE only assigns base helmets to Builder, Miner, and Emergency.
      // Shamon explicitly suppresses the Builder helmet; Raider has an unused
      // helmet asset but no HEAD_TYPE job mapping in Lua.
      const helmet = job === 2 && stats.nBodyVariation !== 55 ? 83
        : job === 4 ? 87
          : job === 5 ? 86
            : undefined;
      add(helmet);
      if (helmet !== undefined && appearance.hair) indices.delete(appearance.hair.subset);
    } else if (job === 7) {
      add(appearance.fat ? (appearance.sex === 'M' ? 65 : 64) : (appearance.sex === 'M' ? 67 : 66));
    }
  } else if (appearance.rig === 'alien') {
    const outfit = ({ 2: 8, 3: 13, 4: 11, 5: 10, 6: 12, 7: 7, 9: 9, 12: 9 } as Record<number, number>)[job];
    add(outfit, job === 9 ? 'Scientist01' : undefined);
    const helmet = ({ 4: 27, 5: 26 } as Record<number, number>)[job];
    add(helmet);
    if (helmet !== undefined && appearance.hair) indices.delete(appearance.hair.subset);
  }
  const addAccessory = (id: number, definitions: Record<number, AccessoryDef>) => {
    if (id === NO_REPLACE) return;
    const accessory = definitions[id];
    if (!accessory || accessory.rig !== appearance.rig || accessory.conflicts.includes(job)) return;
    add(accessory.subset, accessory.texture);
  };
  addAccessory(stats.nBottomAccessoryVariation, BOTTOM_ACCESSORIES);
  addAccessory(stats.nTopAccessoryVariation, TOP_ACCESSORIES);
  return { indices, textures, faceLayers };
}
