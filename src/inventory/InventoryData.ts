/**
 * InventoryData.ts — Item definitions & tag system.
 * Mirrors InventoryData.lua + WeaponData.lua exactly.
 */

import {
  MINER, JANITOR, SCIENTIST, BARTENDER, EMERGENCY, TECHNICIAN, BUILDER, BOTANIST, DOCTOR,
  DAMAGE_TYPE,
  SPRITE_NAME_FRIENDLY_RIFLE, SPRITE_NAME_ENEMY_RIFLE,
  SPRITE_NAME_FRIENDLY_PISTOL, SPRITE_NAME_ENEMY_PISTOL,
} from '../characters/CharacterConstants';

// ── Tag System ──────────────────────────────────────────────────────────

export interface TagValue {
  lc: string;
  color?: [number, number, number];
}

export type TagCategory = 'Color' | 'Material' | 'Texture' | 'Shape' | 'Style';

export const TAGS: Record<TagCategory, Record<string, TagValue>> = {
  Color: {
    Red:     { lc: 'TAGSXX001TEXT', color: [220/255, 20/255, 60/255] },
    Orange:  { lc: 'TAGSXX002TEXT', color: [255/255, 153/255, 18/255] },
    Yellow:  { lc: 'TAGSXX003TEXT', color: [255/255, 255/255, 0/255] },
    Green:   { lc: 'TAGSXX004TEXT', color: [0, 205/255, 0] },
    Cyan:    { lc: 'TAGSXX005TEXT', color: [0, 238/255, 238/255] },
    Blue:    { lc: 'TAGSXX006TEXT', color: [24/255, 116/255, 205/255] },
    Purple:  { lc: 'TAGSXX007TEXT', color: [186/255, 85/255, 211/255] },
    Magenta: { lc: 'TAGSXX008TEXT', color: [1, 0, 1] },
    Black:   { lc: 'TAGSXX009TEXT', color: [0, 0, 0] },
    White:   { lc: 'TAGSXX010TEXT', color: [1, 1, 1] },
    Grey:    { lc: 'TAGSXX011TEXT', color: [0.5, 0.5, 0.5] },
    Brown:   { lc: 'TAGSXX012TEXT', color: [139/255, 69/255, 19/255] },
    Beige:   { lc: 'TAGSXX032TEXT', color: [216/255, 176/255, 150/255] },
    Gold:    { lc: 'TAGSXX033TEXT', color: [255/255, 200/255, 10/255] },
  },
  Material: {
    Stone:  { lc: 'TAGSXX013TEXT' },
    Steel:  { lc: 'TAGSXX014TEXT' },
    Wood:   { lc: 'TAGSXX015TEXT' },
    Rubber: { lc: 'TAGSXX029TEXT' },
    Velvet: { lc: 'TAGSXX030TEXT' },
  },
  Texture: {
    Fuzzy:  { lc: 'TAGSXX016TEXT' },
    Bumpy:  { lc: 'TAGSXX017TEXT' },
    Sticky: { lc: 'TAGSXX018TEXT' },
    Spiky:  { lc: 'TAGSXX019TEXT' },
    Smooth: { lc: 'TAGSXX031TEXT' },
  },
  Shape: {
    Round:   { lc: 'TAGSXX020TEXT' },
    Flat:    { lc: 'TAGSXX021TEXT' },
    Square:  { lc: 'TAGSXX022TEXT' },
    Conical: { lc: 'TAGSXX023TEXT' },
  },
  Style: {
    Elegant: { lc: 'TAGSXX024TEXT' },
    Bizarre: { lc: 'TAGSXX025TEXT' },
    Gaudy:   { lc: 'TAGSXX026TEXT' },
    Punk:    { lc: 'TAGSXX027TEXT' },
    Hip:     { lc: 'TAGSXX028TEXT' },
  },
};

// ── Item Template Interface ─────────────────────────────────────────────

export interface ItemTemplate {
  // Identity
  sName?: string;      // Localization key for base name
  sSuffix?: string;    // Localization key for suffix (used with procedural naming)
  sDesc?: string;      // Localization key for description
  sFlavorText?: string;

  // Behavior flags
  bHeldOnly?: boolean;         // Can't go into backpack; must stay in hands
  bDisappearOnDrop?: boolean;  // Item vanishes if dropped
  bSatisfier?: boolean;        // Advertises for HeldItem prereq purposes
  bStuff?: boolean;            // Innately desirable; characters collect/display
  bDisplayable?: boolean;      // Can be placed on shelves
  bSingleton?: boolean;        // Don't collect more than one
  bContainer?: boolean;        // Item is a container (holds items)
  bJobTool?: boolean;          // Job-related tool
  bStackable?: boolean;        // Can stack multiple counts
  nMaxStacks?: number;         // Max count per stack (default: 20)

  // Job association
  Job?: number;                // Associated job ID

  // Pickup / display
  Pickup?: string;             // 3D pickup template name
  sPortraitSprite?: string;    // 2D sprite for UI portrait
  sTintSprite?: string;        // Overlay sprite for color tinting
  tPortraitSprites?: string[]; // Array of portrait sprites (randomized)
  sDisplaySprite?: string;     // Sprite for shelf display
  sSpriteSheet?: string;       // Sprite sheet (default: 'Environments/Objects')
  nPortraitScl?: number;       // Portrait scale factor
  nPortraitOffX?: number;      // Portrait X offset
  nPortraitOffY?: number;      // Portrait Y offset
  bUsePortraitOffsetHack?: boolean;

  // Procedural naming tags
  tPossibleTags?: TagCategory[];
  tForcedTags?: Partial<Record<TagCategory, string>>;

  // Outfit override (armor)
  sOutfit?: string;

  // Weapon stats
  nDamage?: number;
  nDamageType?: number;
  nRange?: number;
  sStance?: string;            // 'melee' | 'pistol' | 'rifle' | 'stunner'
  sBulletSprite?: string;
  nMaxCoolDown?: number;
  nMinCoolDown?: number;
  nMinAimTime?: number;
  nMaxAimTime?: number;
  nMeleeCoolDown?: number;
  nPoints?: number;            // Weapon point value (power rating)

  // Armor stats
  nDamageReduction?: number;
  nDodgeChance?: number;

  // Affinity
  nAffinityDecay?: number;     // Custom affinity decay rate
}

// ── Constants ───────────────────────────────────────────────────────────

export const MINE_PICKUP_NAME = 'Rock';
export const DEFAULT_SPRITE_SHEET = 'Environments/Objects';
export const DEFAULT_AFFINITY_DECAY = 0.016;
export const DEFAULT_PICKUP = 'TransientCrate';
export const DEFAULT_MAX_STACKS = 20;

// ── Item Templates ──────────────────────────────────────────────────────

export const ITEM_TEMPLATES: Record<string, ItemTemplate> = {

  // ── Disappear on drop + held-only ─────────────────────────────────────
  FryingPan: {
    bHeldOnly: true,
    bDisappearOnDrop: true,
    Pickup: 'FryingPan',
    sName: 'PROPSX035TEXT',
    sDesc: 'PROPSX036TEXT',
  },
  FoodBar: {
    bHeldOnly: true,
    bDisappearOnDrop: true,
    Pickup: 'FoodBar',
    sName: 'PROPSX035TEXT',
    sDesc: 'PROPSX036TEXT',
  },
  CookedMeal: {
    bHeldOnly: true,
    bDisappearOnDrop: true,
    Pickup: 'CookedMeal',
    sName: 'PROPSX044TEXT',
    sDesc: 'PROPSX045TEXT',
  },

  // ── Held-only ─────────────────────────────────────────────────────────
  Rock: {
    sName: 'PROPSX023TEXT',
    sDesc: 'PROPSX024TEXT',
    bHeldOnly: true,
    Pickup: 'Rock',
    Job: MINER,
    bStackable: true,
    nMaxStacks: 6,
    bSatisfier: true,
    tForcedTags: { Texture: 'Bumpy', Color: 'Brown', Material: 'Stone' },
  },
  Corpse: {
    bHeldOnly: true,
    Pickup: 'Corpse',
    Job: JANITOR,
    bSatisfier: true,
    sName: 'PROPSX082TEXT',
    sDesc: 'PROPSX083TEXT',
    tForcedTags: { Color: 'Blue' },
  },
  ResearchDatacube: {
    sName: 'PROPSX070TEXT',
    sDesc: 'PROPSX071TEXT',
    Pickup: 'TransientCrate',
    bHeldOnly: true,
    bDisplayable: true,
    sPortraitSprite: 'Env_Datacube',
    Job: SCIENTIST,
    bSatisfier: true,
    nPortraitScl: 1.2,
    nPortraitOffX: -100,
    nPortraitOffY: -200,
  },
  FoodCrate: {
    sName: 'PROPSX035TEXT',
    sDesc: 'PROPSX036TEXT',
    bContainer: true,
    bHeldOnly: true,
    Job: BARTENDER,
    Pickup: 'TransientCrate',
    tForcedTags: { Shape: 'Square', Material: 'Steel' },
  },

  // ── Food ──────────────────────────────────────────────────────────────
  Corn: {
    bStackable: true,
    sName: 'FOODSX001TEXT',
    tForcedTags: { Color: 'Yellow', Texture: 'Bumpy' },
  },
  Pod: {
    bStackable: true,
    sName: 'FOODSX002TEXT',
    tForcedTags: { Shape: 'Round', Color: 'Brown', Texture: 'Sticky' },
  },
  Glowfruit: {
    bStackable: true,
    sName: 'FOODSX003TEXT',
    tForcedTags: { Color: 'Cyan', Texture: 'Fuzzy' },
  },
  CandyCane: {
    sName: 'FOODSX004TEXT',
    bStackable: true,
    tForcedTags: { Style: 'Gaudy' },
  },

  // ── Armor ─────────────────────────────────────────────────────────────
  ArmorLevel0: {
    sName: 'INVOBJ019TEXT',
    sDesc: 'INVOBJ020TEXT',
    Job: EMERGENCY,
    sOutfit: 'Level1',
    bDisappearOnDrop: true,
    nDodgeChance: 0.1,
    nDamageReduction: 0.15,
    bJobTool: true,
  },
  ArmorLevel1: {
    sName: 'INVOBJ018TEXT',
    sDesc: 'INVOBJ021TEXT',
    Job: EMERGENCY,
    sOutfit: 'Level1',
    bDisappearOnDrop: true,
    nDodgeChance: 0.15,
    nDamageReduction: 0.35,
    bJobTool: true,
  },
  ArmorLevel2: {
    sName: 'INVOBJ015TEXT',
    sDesc: 'INVOBJ016TEXT',
    Job: EMERGENCY,
    sOutfit: 'Level2',
    bDisappearOnDrop: true,
    nDodgeChance: 0.2,
    nDamageReduction: 0.5,
    bJobTool: true,
  },
  ArmorLevel3: {
    sName: 'INVOBJ014TEXT',
    sDesc: 'INVOBJ017TEXT',
    bStuff: true,
    Job: EMERGENCY,
    sOutfit: 'Level3',
    nDodgeChance: 0.25,
    nDamageReduction: 0.65,
    bJobTool: true,
  },

  // ── Job Tools ─────────────────────────────────────────────────────────
  SuperMaintainer: {
    sName: 'INVOBJ031TEXT',
    sDesc: 'INVOBJ057TEXT',
    bStuff: true,
    Job: TECHNICIAN,
    tPossibleTags: ['Color', 'Style', 'Texture', 'Shape'],
    bJobTool: true,
  },
  SuperBuilder: {
    sName: 'INVOBJ032TEXT',
    sDesc: 'INVOBJ058TEXT',
    bStuff: true,
    Job: BUILDER,
    tPossibleTags: ['Color', 'Style', 'Texture', 'Shape'],
    bJobTool: true,
  },
  EfficientMiner: {
    sName: 'INVOBJ033TEXT',
    sDesc: 'INVOBJ059TEXT',
    bStuff: true,
    Job: MINER,
    tPossibleTags: ['Color', 'Style', 'Texture', 'Shape'],
    bJobTool: true,
  },
  SuperGreenThumb: {
    sName: 'INVOBJ034TEXT',
    sDesc: 'INVOBJ060TEXT',
    bStuff: true,
    Job: BOTANIST,
    tPossibleTags: ['Color', 'Style', 'Texture', 'Shape'],
    bJobTool: true,
  },
  SuperDoctorTool: {
    sName: 'INVOBJ035TEXT',
    sDesc: 'INVOBJ061TEXT',
    bStuff: true,
    Job: DOCTOR,
    tPossibleTags: ['Color', 'Style', 'Texture', 'Shape'],
    bJobTool: true,
  },

  // ── Decorations (Stuff / Displayable) ─────────────────────────────────
  AlarmClock: {
    bStuff: true,
    bDisplayable: true,
    sPortraitSprite: 'StuffAlarmClock',
    sSuffix: 'INVOBJ041TEXT',
    sDesc: 'INVOBJ062TEXT',
    tPossibleTags: ['Style', 'Texture', 'Material'],
    tForcedTags: { Color: 'Red', Shape: 'Square' },
  },
  Baseball: {
    bStuff: true,
    bDisplayable: true,
    sPortraitSprite: 'StuffBaseball',
    sSuffix: 'INVOBJ042TEXT',
    sDesc: 'INVOBJ063TEXT',
    tPossibleTags: ['Style', 'Texture', 'Material'],
    tForcedTags: { Color: 'White', Shape: 'Round' },
  },
  Basketball: {
    bStuff: true,
    bDisplayable: true,
    sPortraitSprite: 'StuffBasketball',
    sSuffix: 'INVOBJ043TEXT',
    sDesc: 'INVOBJ064TEXT',
    tPossibleTags: ['Style', 'Texture', 'Material'],
    tForcedTags: { Color: 'Orange', Shape: 'Round' },
  },
  CandyBucket: {
    bStuff: true,
    bDisplayable: true,
    sPortraitSprite: 'StuffCandyBucket',
    sSuffix: 'INVOBJ044TEXT',
    sDesc: 'INVOBJ065TEXT',
    tPossibleTags: ['Style', 'Texture', 'Material'],
    tForcedTags: { Color: 'Orange', Shape: 'Round' },
  },
  CowSkull: {
    bStuff: true,
    bDisplayable: true,
    sPortraitSprite: 'StuffCowSkull',
    sSuffix: 'INVOBJ012TEXT',
    sDesc: 'INVOBJ066TEXT',
    tPossibleTags: ['Style', 'Texture', 'Material'],
    tForcedTags: { Color: 'White' },
  },
  DeadGlobe: {
    bStuff: true,
    bDisplayable: true,
    sPortraitSprite: 'StuffDeadEarthGlobe',
    sSuffix: 'INVOBJ037TEXT',
    sDesc: 'INVOBJ067TEXT',
    tPossibleTags: ['Style', 'Texture', 'Material'],
    tForcedTags: { Color: 'Brown', Shape: 'Round' },
  },
  Ducky: {
    bStuff: true,
    bDisplayable: true,
    sPortraitSprite: 'StuffDucky',
    sSuffix: 'INVOBJ009TEXT',
    sDesc: 'INVOBJ069TEXT',
    tPossibleTags: ['Style', 'Texture', 'Material'],
    tForcedTags: { Color: 'Yellow' },
  },
  Globe: {
    bStuff: true,
    bDisplayable: true,
    sPortraitSprite: 'StuffEarthGlobe',
    sSuffix: 'INVOBJ046TEXT',
    sDesc: 'INVOBJ068TEXT',
    tPossibleTags: ['Style', 'Texture', 'Material'],
    tForcedTags: { Color: 'Green', Shape: 'Round' },
  },
  GardenGnome: {
    bStuff: true,
    bDisplayable: true,
    sPortraitSprite: 'StuffGnome',
    sTintSprite: 'StuffGnome_tint',
    sSuffix: 'INVOBJ038TEXT',
    sDesc: 'INVOBJ070TEXT',
    tPossibleTags: ['Color', 'Style', 'Texture', 'Material'],
    tForcedTags: { Shape: 'Conical' },
  },
  HumanSkull: {
    bStuff: true,
    bDisplayable: true,
    sPortraitSprite: 'StuffHumanSkull',
    sSuffix: 'INVOBJ012TEXT',
    sDesc: 'INVOBJ071TEXT',
    tPossibleTags: ['Style', 'Texture', 'Material'],
    tForcedTags: { Color: 'Beige' },
  },
  Kitty: {
    bStuff: true,
    bDisplayable: true,
    sPortraitSprite: 'StuffKitty',
    sTintSprite: 'StuffKitty_tint',
    sSuffix: 'INVOBJ003TEXT',
    sDesc: 'INVOBJ072TEXT',
    tPossibleTags: ['Color', 'Style', 'Texture', 'Material'],
  },
  LavaLamp: {
    bStuff: true,
    bDisplayable: true,
    sPortraitSprite: 'StuffLavalamp',
    sSuffix: 'INVOBJ039TEXT',
    sDesc: 'INVOBJ073TEXT',
    tPossibleTags: ['Style', 'Texture', 'Material'],
    tForcedTags: { Color: 'Magenta' },
  },
  Cactus: {
    bStuff: true,
    bDisplayable: true,
    sPortraitSprite: 'StuffLittleCactus',
    sSuffix: 'INVOBJ040TEXT',
    sDesc: 'INVOBJ074TEXT',
    tPossibleTags: ['Style', 'Material'],
    tForcedTags: { Color: 'Green', Texture: 'Spiky' },
  },
  MoaiHead: {
    bStuff: true,
    bDisplayable: true,
    sPortraitSprite: 'StuffMoaiHead',
    sSuffix: 'INVOBJ047TEXT',
    sDesc: 'INVOBJ075TEXT',
    tPossibleTags: ['Style', 'Texture', 'Material'],
    tForcedTags: { Color: 'Grey' },
  },
  ToySpacebus: {
    bStuff: true,
    bDisplayable: true,
    sPortraitSprite: 'StuffModelSpacebus',
    sSuffix: 'INVOBJ048TEXT',
    sDesc: 'INVOBJ076TEXT',
    tPossibleTags: ['Style', 'Texture', 'Material'],
    tForcedTags: { Color: 'Grey' },
  },
  Mug: {
    bStuff: true,
    bDisplayable: true,
    sPortraitSprite: 'StuffMug',
    sTintSprite: 'StuffMug_tint',
    sSuffix: 'INVOBJ002TEXT',
    sDesc: 'INVOBJ077TEXT',
    tPossibleTags: ['Color', 'Style', 'Texture', 'Material'],
  },
  MusicBox: {
    bStuff: true,
    bDisplayable: true,
    sPortraitSprite: 'StuffMusicBox',
    sSuffix: 'INVOBJ049TEXT',
    sDesc: 'INVOBJ078TEXT',
    tPossibleTags: ['Style', 'Texture', 'Material'],
  },
  OldComputer: {
    bStuff: true,
    bDisplayable: true,
    sPortraitSprite: 'StuffOldComputer',
    sSuffix: 'INVOBJ010TEXT',
    sDesc: 'INVOBJ079TEXT',
    tPossibleTags: ['Style', 'Texture', 'Material'],
    tForcedTags: { Color: 'Beige' },
  },
  PictureFrame: {
    bStuff: true,
    bDisplayable: true,
    tPortraitSprites: ['StuffPictureFrame01', 'StuffPictureFrame02', 'StuffPictureFrame03'],
    sSuffix: 'INVOBJ050TEXT',
    sDesc: 'INVOBJ080TEXT',
    tPossibleTags: ['Style', 'Material'],
    tForcedTags: { Shape: 'Flat' },
  },
  PocketWatch: {
    bStuff: true,
    bDisplayable: true,
    sPortraitSprite: 'StuffPocketWatch',
    sSuffix: 'INVOBJ011TEXT',
    sDesc: 'INVOBJ081TEXT',
    tPossibleTags: ['Style', 'Texture', 'Material'],
    tForcedTags: { Color: 'Gold', Shape: 'Round' },
  },
  PuzzleCube: {
    bStuff: true,
    bDisplayable: true,
    sPortraitSprite: 'StuffPuzzleCube',
    sSuffix: 'INVOBJ007TEXT',
    sDesc: 'INVOBJ082TEXT',
    tPossibleTags: ['Style', 'Texture', 'Material'],
    tForcedTags: { Color: 'Gold', Shape: 'Square' },
  },
  Radio: {
    bStuff: true,
    bDisplayable: true,
    sPortraitSprite: 'StuffRadio',
    sSuffix: 'INVOBJ004TEXT',
    sDesc: 'INVOBJ083TEXT',
    tPossibleTags: ['Style', 'Texture', 'Material'],
    tForcedTags: { Color: 'Brown' },
  },
  TeddyBear: {
    bStuff: true,
    bDisplayable: true,
    sPortraitSprite: 'StuffTeddyBear',
    sTintSprite: 'StuffTeddyBear_tint',
    sSuffix: 'INVOBJ005TEXT',
    sDesc: 'INVOBJ084TEXT',
    tPossibleTags: ['Color', 'Style', 'Texture', 'Material'],
  },
  TentacleMonster: {
    bStuff: true,
    bDisplayable: true,
    sPortraitSprite: 'StuffTentacleMonster',
    sSuffix: 'INVOBJ006TEXT',
    sDesc: 'INVOBJ085TEXT',
    tPossibleTags: ['Style', 'Texture', 'Material'],
    tForcedTags: { Color: 'Blue' },
  },
  ToyBall: {
    bStuff: true,
    bDisplayable: true,
    sPortraitSprite: 'StuffToyBall',
    sTintSprite: 'StuffToyBall_tint',
    sSuffix: 'INVOBJ001TEXT',
    sDesc: 'INVOBJ086TEXT',
    tPossibleTags: ['Color', 'Style', 'Texture', 'Material'],
  },
  ParasiteActionFigure: {
    bStuff: true,
    bDisplayable: true,
    sPortraitSprite: 'StuffToyParasite',
    sSuffix: 'INVOBJ051TEXT',
    sDesc: 'INVOBJ087TEXT',
    tPossibleTags: ['Style', 'Texture', 'Material'],
  },
  LadyActionFigure: {
    bStuff: true,
    bDisplayable: true,
    sPortraitSprite: 'StuffToySpacelady',
    sSuffix: 'INVOBJ052TEXT',
    sDesc: 'INVOBJ088TEXT',
    tPossibleTags: ['Style', 'Texture', 'Material'],
    tForcedTags: { Color: 'Purple' },
  },
  GuyActionFigure: {
    bStuff: true,
    bDisplayable: true,
    sPortraitSprite: 'StuffToySpaceman',
    sSuffix: 'INVOBJ052TEXT',
    sDesc: 'INVOBJ089TEXT',
    tPossibleTags: ['Style', 'Texture', 'Material'],
  },
  WizardActionFigure: {
    bStuff: true,
    bDisplayable: true,
    sPortraitSprite: 'StuffToyWizard',
    sSuffix: 'INVOBJ053TEXT',
    sDesc: 'INVOBJ091TEXT',
    tPossibleTags: ['Style', 'Texture', 'Material'],
    tForcedTags: { Color: 'Grey' },
  },
  Fossil: {
    bStuff: true,
    bDisplayable: true,
    sPortraitSprite: 'StuffTrilobiteFossil',
    sSuffix: 'INVOBJ013TEXT',
    sDesc: 'INVOBJ090TEXT',
    tPossibleTags: ['Style', 'Texture', 'Material'],
    tForcedTags: { Color: 'Beige' },
  },

  // ── Weapons (from WeaponData.lua) ─────────────────────────────────────
  PunchingGloves: {
    sName: 'WEP01TEXT',
    sDesc: 'WEP02TEXT',
    Job: EMERGENCY,
    bJobTool: true,
    bStuff: true,
    sStance: 'melee',
    nDamage: 30,
    nRange: 0,
    nPoints: 4,
    nDamageType: DAMAGE_TYPE.Stunner,
    tPossibleTags: ['Color', 'Style', 'Texture', 'Material'],
  },
  VibroKnife: {
    sName: 'WEP03TEXT',
    sDesc: 'WEP04TEXT',
    Job: EMERGENCY,
    bJobTool: true,
    bStuff: true,
    sStance: 'melee',
    nDamage: 40,
    nRange: 0,
    nPoints: 4,
    nDamageType: DAMAGE_TYPE.Melee,
    nMeleeCoolDown: 1,
    tPossibleTags: ['Style', 'Texture', 'Material'],
  },
  Pistol: {
    sName: 'WEP33TEXT',
    sDesc: 'WEP34TEXT',
    Job: EMERGENCY,
    bJobTool: true,
    sStance: 'pistol',
    bStuff: true,
    nDamage: 15,
    nRange: 18,
    nPoints: 1,
    nDamageType: DAMAGE_TYPE.Laser,
    sBulletSprite: SPRITE_NAME_FRIENDLY_PISTOL,
    tPossibleTags: ['Style', 'Texture', 'Material'],
    tForcedTags: { Color: 'Blue' },
  },
  AutoPistol: {
    sName: 'WEP11TEXT',
    sDesc: 'WEP12TEXT',
    Job: EMERGENCY,
    bJobTool: true,
    sStance: 'pistol',
    bStuff: true,
    nDamage: 5,
    nRange: 8,
    nPoints: 2,
    nMaxCoolDown: 0.1,
    nMinCoolDown: 0.01,
    nMinAimTime: 0.05,
    nMaxAimTime: 0.1,
    nDamageType: DAMAGE_TYPE.Laser,
    sBulletSprite: SPRITE_NAME_FRIENDLY_PISTOL,
    tPossibleTags: ['Style', 'Texture', 'Material'],
    tForcedTags: { Color: 'Red' },
  },
  RedPistol: {
    sName: 'WEP05TEXT',
    sDesc: 'WEP06TEXT',
    bStuff: true,
    Job: EMERGENCY,
    bJobTool: true,
    sStance: 'pistol',
    nDamage: 20,
    nRange: 15,
    nPoints: 1,
    nDamageType: DAMAGE_TYPE.Laser,
    sBulletSprite: SPRITE_NAME_ENEMY_PISTOL,
    tPossibleTags: ['Style', 'Texture', 'Material'],
    tForcedTags: { Color: 'Red' },
  },
  KillbotRifle: {
    sName: 'WEP35TEXT',
    sDesc: 'WEP36TEXT',
    nPoints: 4,
    bDisappearOnDrop: true,
    nDamage: 20,
    nRange: 18,
    nDamageType: DAMAGE_TYPE.Laser,
    sBulletSprite: SPRITE_NAME_ENEMY_RIFLE,
  },
  LaserRifle: {
    sName: 'WEP37TEXT',
    sDesc: 'WEP38TEXT',
    bStuff: true,
    Job: EMERGENCY,
    bJobTool: true,
    sStance: 'rifle',
    nDamage: 30,
    nRange: 18,
    nPoints: 3,
    nDamageType: DAMAGE_TYPE.Laser,
    sBulletSprite: SPRITE_NAME_FRIENDLY_RIFLE,
    tPossibleTags: ['Style', 'Texture', 'Material'],
    tForcedTags: { Color: 'Blue' },
  },
  RedLaserRifle: {
    sName: 'WEP07TEXT',
    sDesc: 'WEP08TEXT',
    bStuff: true,
    Job: EMERGENCY,
    bJobTool: true,
    sStance: 'rifle',
    nDamage: 30,
    nRange: 18,
    nPoints: 3,
    nDamageType: DAMAGE_TYPE.Laser,
    sBulletSprite: SPRITE_NAME_ENEMY_RIFLE,
    tPossibleTags: ['Color', 'Style', 'Texture', 'Material'],
    tForcedTags: { Color: 'Red' },
  },
  PlasmaRifle: {
    sName: 'WEP39TEXT',
    sDesc: 'WEP40TEXT',
    bStuff: true,
    Job: EMERGENCY,
    tPossibleTags: ['Color', 'Style', 'Texture', 'Material'],
    bJobTool: true,
    sStance: 'rifle',
    nDamage: 45,
    nRange: 18,
    nPoints: 4,
    nDamageType: DAMAGE_TYPE.Laser,
    sBulletSprite: SPRITE_NAME_FRIENDLY_RIFLE,
  },
  SniperRifle: {
    sName: 'WEP09TEXT',
    sDesc: 'WEP10TEXT',
    tPossibleTags: ['Color', 'Style', 'Texture', 'Material'],
    bStuff: true,
    Job: EMERGENCY,
    bJobTool: true,
    sStance: 'rifle',
    nDamage: 50,
    nRange: 30,
    nPoints: 4,
    nDamageType: DAMAGE_TYPE.Laser,
    sBulletSprite: SPRITE_NAME_ENEMY_RIFLE,
  },
  Stunner: {
    sName: 'WEP41TEXT',
    sDesc: 'WEP42TEXT',
    tPossibleTags: ['Color', 'Style', 'Texture', 'Material'],
    bStuff: true,
    Job: EMERGENCY,
    bJobTool: true,
    sStance: 'stunner',
    nDamage: 15,
    nRange: 3,
    nPoints: 1,
    nDamageType: DAMAGE_TYPE.Stunner,
    sBulletSprite: SPRITE_NAME_FRIENDLY_PISTOL,
  },
  SuperStunner: {
    sName: 'WEP43TEXT',
    sDesc: 'WEP44TEXT',
    tPossibleTags: ['Color', 'Style', 'Texture', 'Material'],
    bStuff: true,
    Job: EMERGENCY,
    bJobTool: true,
    sStance: 'stunner',
    nDamage: 30,
    nRange: 6,
    nPoints: 3,
    nDamageType: DAMAGE_TYPE.Stunner,
    sBulletSprite: SPRITE_NAME_FRIENDLY_RIFLE,
  },
  Nebuliser: {
    sName: 'WEP13TEXT',
    sDesc: 'WEP14TEXT',
    tPossibleTags: ['Color', 'Style', 'Texture', 'Material'],
    bStuff: true,
    Job: EMERGENCY,
    bJobTool: true,
    sStance: 'pistol',
    nDamage: 30,
    nRange: 15,
    nPoints: 3,
    nDamageType: DAMAGE_TYPE.Fire,
    sBulletSprite: SPRITE_NAME_FRIENDLY_RIFLE,
  },
  Sling_of_Truth: {
    sName: 'WEP15TEXT',
    sDesc: 'WEP16TEXT',
    tPossibleTags: ['Color', 'Style', 'Texture', 'Material'],
    bStuff: true,
    Job: EMERGENCY,
    bJobTool: true,
    sStance: 'pistol',
    nDamage: 40,
    nRange: 15,
    nMaxCoolDown: 5,
    nMinCoolDown: 1,
    nMinAimTime: 1,
    nMaxAimTime: 3,
    nPoints: 4,
    nDamageType: DAMAGE_TYPE.Stunner,
    sBulletSprite: SPRITE_NAME_FRIENDLY_RIFLE,
  },
  Plasmatron: {
    sName: 'WEP17TEXT',
    sDesc: 'WEP18TEXT',
    tPossibleTags: ['Color', 'Style', 'Texture', 'Material'],
    bStuff: true,
    Job: EMERGENCY,
    bJobTool: true,
    sStance: 'rifle',
    nDamage: 30,
    nRange: 10,
    nMaxCoolDown: 3,
    nMinCoolDown: 1,
    nMinAimTime: 1,
    nMaxAimTime: 3,
    nPoints: 3,
    nDamageType: DAMAGE_TYPE.Laser,
    sBulletSprite: SPRITE_NAME_FRIENDLY_RIFLE,
  },
  Derezzer: {
    sName: 'WEP19TEXT',
    sDesc: 'WEP20TEXT',
    tPossibleTags: ['Color', 'Style', 'Texture', 'Material'],
    bStuff: true,
    Job: EMERGENCY,
    bJobTool: true,
    sStance: 'rifle',
    nDamage: 25,
    nRange: 12,
    nPoints: 2,
    nDamageType: DAMAGE_TYPE.Laser,
    sBulletSprite: SPRITE_NAME_FRIENDLY_RIFLE,
  },
  CryoVise: {
    sName: 'WEP21TEXT',
    sDesc: 'WEP22TEXT',
    tPossibleTags: ['Color', 'Style', 'Texture', 'Material'],
    bStuff: true,
    Job: EMERGENCY,
    bJobTool: true,
    sStance: 'melee',
    nDamage: 25,
    nPoints: 2,
    nRange: 0,
    nDamageType: DAMAGE_TYPE.Melee,
    sBulletSprite: SPRITE_NAME_FRIENDLY_RIFLE,
  },
  Rey5w0rd: {
    sName: 'WEP23TEXT',
    sDesc: 'WEP24TEXT',
    tPossibleTags: ['Color', 'Style', 'Texture', 'Material'],
    bStuff: true,
    Job: EMERGENCY,
    bJobTool: true,
    sStance: 'melee',
    nDamage: 40,
    nRange: 3,
    nPoints: 4,
    nDamageType: DAMAGE_TYPE.Impact,
    sBulletSprite: SPRITE_NAME_FRIENDLY_RIFLE,
  },
  TeleMag44: {
    sName: 'WEP25TEXT',
    sDesc: 'WEP26TEXT',
    tPossibleTags: ['Color', 'Style', 'Texture', 'Material'],
    bStuff: true,
    Job: EMERGENCY,
    bJobTool: true,
    sStance: 'pistol',
    nDamage: 25,
    nRange: 20,
    nMaxCoolDown: 5,
    nMinCoolDown: 1,
    nMinAimTime: 0.5,
    nMaxAimTime: 1,
    nPoints: 2,
    nDamageType: DAMAGE_TYPE.Laser,
    sBulletSprite: SPRITE_NAME_FRIENDLY_RIFLE,
  },
  Uberfist: {
    sName: 'WEP27TEXT',
    sDesc: 'WEP28TEXT',
    tPossibleTags: ['Color', 'Style', 'Texture', 'Material'],
    bStuff: true,
    Job: EMERGENCY,
    bJobTool: true,
    sStance: 'melee',
    nDamage: 15,
    nRange: 0,
    nPoints: 1,
    nDamageType: DAMAGE_TYPE.Impact,
    sBulletSprite: SPRITE_NAME_FRIENDLY_RIFLE,
  },
  Schizodestroyer: {
    sName: 'WEP29TEXT',
    sDesc: 'WEP30TEXT',
    tPossibleTags: ['Color', 'Style', 'Texture', 'Material'],
    bStuff: true,
    Job: EMERGENCY,
    bJobTool: true,
    sStance: 'rifle',
    nDamage: 20,
    nRange: 10,
    nPoints: 2,
    nDamageType: DAMAGE_TYPE.Stunner,
    sBulletSprite: SPRITE_NAME_FRIENDLY_RIFLE,
  },
  Sonicdirk: {
    sName: 'WEP31TEXT',
    sDesc: 'WEP32TEXT',
    tPossibleTags: ['Color', 'Style', 'Texture', 'Material'],
    bStuff: true,
    Job: EMERGENCY,
    bJobTool: true,
    sStance: 'melee',
    nDamage: 30,
    nRange: 4,
    nPoints: 4,
    nDamageType: DAMAGE_TYPE.Laser,
    sBulletSprite: SPRITE_NAME_FRIENDLY_RIFLE,
  },
};

// ── Stuff Names (templates with bStuff=true) ────────────────────────────

export const STUFF_NAMES: string[] = [];
for (const [k, v] of Object.entries(ITEM_TEMPLATES)) {
  if (v.bStuff) STUFF_NAMES.push(k);
}
