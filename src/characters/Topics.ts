/**
 * Topics.ts — Global topic registry and procedural name generators.
 * Mirrors Lua Topics.lua: categories, topic lists, name generators, affinity wiring.
 */

import type { Character } from './Character';
import { JOB_NAMES, tJobs } from './CharacterConstants';

// ── Constants ────────────────────────────────────────────────────────

export const DEFAULT_INITIAL_TOPICS = 10;
export const IMMIGRATION_ADD_TOPIC_CHANCE = 0.1;

// ── Topic data ───────────────────────────────────────────────────────

export interface TopicEntry {
  name: string;
  category: string;
}

/** Activity-to-topic mapping (Lua Topics.tActivities) */
export const ACTIVITY_WALKING = 'Walking';
export const ACTIVITY_DRINKING = 'Drinking';
export const ACTIVITY_EXERCISE = 'Exercise';
export const ACTIVITY_GAMING = 'Gaming';

interface ActivityDef {
  sNameLC: string;
  tActivities: string[];
}

const tActivities: Record<string, ActivityDef> = {
  [ACTIVITY_WALKING]: { sNameLC: 'Walking', tActivities: ['WanderAround'] },
  [ACTIVITY_DRINKING]: { sNameLC: 'Drinking', tActivities: ['GetDrink'] },
  [ACTIVITY_EXERCISE]: { sNameLC: 'Working Out', tActivities: ['WorkOut', 'LiftAtWeightBench'] },
  [ACTIVITY_GAMING]: { sNameLC: 'Gaming', tActivities: ['PlayGameSystem'] },
};

// ── Name generator word lists (from Lua localization strings) ────────

const BandNameAdjectives = [
  'Velvet', 'Screaming', 'Purple', 'Twisting', 'Inky', 'Tragic', 'Edible',
  'Viridian', 'Poisonous', 'Space', 'Actual', 'Lords of', 'Black', 'Silver',
  'Electric', 'Festering', 'Luscious', 'Skeletal', 'Action', 'Custom',
  'Brutal', 'Neo', 'Rural',
];
const BandNameNouns = [
  'Star', 'Slimes', 'Void', 'Knuckles', 'Mountain', 'Platypus', 'Satellites',
  'Philanthropists', 'Trout', 'Capsules', 'Greeble', 'Destroyers', 'Motherboards',
  'Hipsters', 'Power', 'Legends', 'Tardigrades', 'Skeletons', 'Warriors', 'Draculas',
];

const FoodPrepMethods = [
  'Grilled', 'Scrambled', 'Poached', 'Vaporized', 'Cloned', 'Burnt', 'Deconstructed',
  'Glazed', 'Buttered', 'Sugar Crusted', 'Carmelized', 'Spiced', 'Peppered',
  'Pounded', 'Tenderized', 'Pureed', 'Smoked', 'Freeze-Dried', 'Deep Fried',
];
const FoodAdjectives = [
  'Monstrose', 'Green', 'Neon', 'Brackish', 'Fetid', 'Flaky', 'Free-Range',
  'Greasy', 'Organic', 'Pungent', 'Rancid',
];
const FoodProvenance = [
  'Centauri', 'Terran', 'Tralfamadorian', 'Jojoban', 'Thalrasshan', 'Veloxi',
  'Brebulan', 'Venusian', 'Gargattaraxan', 'Texan', 'Betelgeusean', 'Spathi',
  'Neo-Australian',
];
const FoodKeyIngredients = [
  'Metachicken', 'Honeybat', 'Fruitwasp', 'Spacewolf', 'Eel Nose', 'Fluffalo',
  'Birdfoot', 'Grub', 'Nutrient Paste', 'Spikefruit', 'Broccoli', 'Bug Knee',
  'Marrow', 'Slug', 'Hump', 'Turtle Face', 'Curd', 'Beetle', 'Moon Beef',
  'Breadbug', 'Beefalo',
];
const FoodDishes = [
  'Sliders', 'Sandwich', 'Salad', 'Soup', 'Pie', 'Cakes', 'Stir-Fry', 'Stew',
  'Burrito', 'Dumplings', 'Noodles', 'Pasta', 'Ramen', 'Casserole', 'Bread',
  'Pot Pie', 'Brioche', 'Crunch', 'Filets', 'Jelly', 'Medallions', 'Cutlets', 'MREs',
];

const GameNames = [
  'Horror Puzzle Time', 'Killbot Adventures', 'Psychonauts 4', 'Terrans vs. Animals',
  'Last Possible Quest XII', 'Horse Mechs', 'Alien Friendmaker', 'Super Unicorn Pwnies',
  'Wizard Battles', 'Fisticuffs Turbo Plus Extra Turbo', 'Pseudo-Hawk',
  'Button Masher Master', 'Fisticuffs Classic Edition', 'Fisticuffs 4D XDT Theta',
  'Words & Guns', 'Endless Ladder Climbing', 'Richochet 2', 'Pretend Battle Beests',
  'Giga Funlicker', 'Legend of Frogmancer', 'Soul Stapler 9', 'Pumalords',
  'Melancholy Writer III',
];

const BeerTypes = ['Ale', 'Stout', 'Porter', 'IPA', 'Beer', 'Lager'];
const CocktailAdjectives = ['Pan-Galactic', 'Smashy', 'Rude', 'Red', 'Sticky'];
const CocktailNouns = ['Gargle Blaster', 'Nail', 'Scumm', 'Space Mule', 'Frobnabulator'];

const CreatureAdjectives = [
  'Venomous', 'Spitting', 'Eyeless', 'Spiny', 'Greater', 'Lesser', 'Spiked',
  'Glowing', 'Fuzzy',
];
const CreatureDescriptors = [
  'Bread', 'Land', 'Mud', 'Terror', 'Spore', 'Sky', 'Sand', 'Blood', 'Plague', 'Jelly',
];
const CreatureNouns = [
  'Worm', 'Mollusk', 'Beast', 'Hound', 'Hen', 'Bird', 'Hawk', 'Bat',
  'Beefalo', 'Puff', 'Whale', 'Bee',
];

// ── Helper ───────────────────────────────────────────────────────────

function arrayRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Procedural name generators (Lua-exact) ───────────────────────────

export function generateBandName(): string {
  let name = '';
  if (Math.random() < 0.25) name = 'The ';
  if (Math.random() < 0.5) name += arrayRandom(BandNameAdjectives) + ' ';
  name += arrayRandom(BandNameNouns);
  return name;
}

export function generateFoodName(): string {
  let name = '';
  let nFoodDescriptors = 0;
  if (Math.random() < 0.25) {
    name = arrayRandom(FoodProvenance) + ' ';
    nFoodDescriptors++;
  }
  if (Math.random() < 0.4) {
    name += arrayRandom(FoodPrepMethods) + ' ';
    nFoodDescriptors++;
  }
  if (nFoodDescriptors < 2 && Math.random() < 0.2) {
    name += arrayRandom(FoodAdjectives) + ' ';
    nFoodDescriptors++;
  }
  // Always have a key ingredient
  name += arrayRandom(FoodKeyIngredients) + ' ';
  if (nFoodDescriptors === 0) {
    name += arrayRandom(FoodDishes);
  } else if (nFoodDescriptors < 2 && Math.random() < 0.5) {
    name += arrayRandom(FoodDishes);
  }
  // Trim trailing space
  return name.trimEnd();
}

export function generateDrinkName(): string {
  const BEER_CHANCE = 0.5;
  if (Math.random() < BEER_CHANCE) {
    return getRandomProvenance() + ' ' + arrayRandom(BeerTypes);
  } else {
    let adj = arrayRandom(CocktailAdjectives);
    if (Math.random() < 0.1) adj += ' ' + arrayRandom(CocktailAdjectives);
    return adj + ' ' + arrayRandom(CocktailNouns);
  }
}

export function generateCreatureName(): string {
  let s = '';
  while (s.length === 0) {
    if (Math.random() > 0.4) s += getRandomProvenance() + ' ';
    if (Math.random() > 0.5) s += arrayRandom(CreatureAdjectives) + ' ';
    if (Math.random() > 0.6) s += arrayRandom(CreatureDescriptors) + ' ';
  }
  s += arrayRandom(CreatureNouns);
  return s;
}

export function getRandomProvenance(): string {
  return arrayRandom(FoodProvenance);
}

export function getRandomGameName(): string {
  return arrayRandom(GameNames);
}

// ── Topic Category Definitions (Lua Topics.TopicList) ────────────────

interface TopicCategory {
  initialNumber?: number;
  nameGeneratorFn?: () => string;
  listGeneratorFn?: () => void;
  emoticon: string;
  bCanGenerateOnImmigration?: boolean;
}

// ── Global topic state ───────────────────────────────────────────────

let tTopics: Record<string, TopicEntry> = {};
let tTopicsByCategory: Record<string, string[]> = {};
let counter = 0;

function getUniqueID(name: string): string {
  counter++;
  return name + counter;
}

function alreadyInList(name: string): boolean {
  for (const entry of Object.values(tTopics)) {
    if (entry.name === name) return true;
  }
  return false;
}

/** Character manager reference — set from main.ts */
let getCharacters: () => Character[] = () => [];
let getCharacterByUniqueID: (id: string) => Character | undefined = () => undefined;

export function setCharacterProvider(
  getFn: () => Character[],
  getByIdFn: (id: string) => Character | undefined,
): void {
  getCharacters = getFn;
  getCharacterByUniqueID = getByIdFn;
}

// ── Core functions ───────────────────────────────────────────────────

function generateGenericList(quota: number, category: string): void {
  for (let i = 0; i < quota; i++) {
    addTopic(category);
  }
}

function generatePeopleList(): void {
  const chars = getCharacters();
  for (const char of chars) {
    if (!tTopics[String(char.id)]) {
      addTopic('People', String(char.id));
    }
  }
}

function generateActivityList(): void {
  for (const id of Object.keys(tActivities)) {
    if (!tTopics[id]) {
      addTopic('Activities', id);
    }
  }
}

function generateDutyList(): void {
  for (const nJob of tJobs) {
    const jobName = JOB_NAMES[nJob] ?? 'Unknown';
    if (!tTopics[jobName]) {
      addTopic('Duties', jobName);
    }
  }
}

const TopicList: Record<string, TopicCategory> = {
  People: {
    listGeneratorFn: generatePeopleList,
    emoticon: 'topic_person',
  },
  Bands: {
    initialNumber: 12,
    nameGeneratorFn: generateBandName,
    emoticon: 'topic_band',
    bCanGenerateOnImmigration: true,
  },
  Foods: {
    nameGeneratorFn: generateFoodName,
    emoticon: 'topic_food',
    bCanGenerateOnImmigration: true,
  },
  Activities: {
    listGeneratorFn: generateActivityList,
    emoticon: 'topic_person',
  },
  Duties: {
    listGeneratorFn: generateDutyList,
    emoticon: 'topic_person',
  },
};

// ── Public API ────────────────────────────────────────────────────────

export function initializeTopicList(): void {
  tTopics = {};
  tTopicsByCategory = {};
  counter = 0;
  for (const [category, tData] of Object.entries(TopicList)) {
    tTopicsByCategory[category] = [];
    if (tData.listGeneratorFn) {
      tData.listGeneratorFn();
    } else {
      const quota = tData.initialNumber ?? DEFAULT_INITIAL_TOPICS;
      generateGenericList(quota, category);
    }
  }
}

export function addTopic(sCategoryName: string, sID?: string): void {
  const category = TopicList[sCategoryName];
  if (!category) return;

  let sName: string;

  if (sCategoryName === 'People' && sID) {
    // People: derive name from character
    const rChar = getCharacterByUniqueID(sID);
    if (!rChar) return;
    sName = rChar.getName();
  } else if (sCategoryName === 'Activities' && sID) {
    const actDef = tActivities[sID];
    sName = actDef ? actDef.sNameLC : sID;
  } else if (sCategoryName === 'Duties' && sID) {
    sName = sID + ' duty';
    sID = 'DUTY_' + sID;
  } else if (category.nameGeneratorFn) {
    sName = category.nameGeneratorFn();
    // Ensure unique name
    while (alreadyInList(sName)) {
      sName = category.nameGeneratorFn();
    }
    sID = getUniqueID(sName);
  } else {
    return;
  }

  tTopics[sID!] = { name: sName, category: sCategoryName };
  if (!tTopicsByCategory[sCategoryName]) tTopicsByCategory[sCategoryName] = [];
  tTopicsByCategory[sCategoryName].push(sID!);

  // Generate affinities for all existing characters
  generateAffinitiesFor(sID!);
}

/** Generate affinities for a new topic across all characters. */
function generateAffinitiesFor(topicID: string): void {
  const chars = getCharacters();
  for (const char of chars) {
    char.generateAffinityFor(topicID);
  }
}

/** Generate affinities for all topics for a new character. */
export function generateCharacterAffinities(char: Character): void {
  for (const topic of Object.keys(tTopics)) {
    if (!char.hasAffinity(topic)) {
      char.generateAffinityFor(topic);
    }
  }
}

/** Get the topic ID for a given activity task name. */
export function getTopicForActivity(sActivityName: string): string | undefined {
  for (const [id, tData] of Object.entries(tActivities)) {
    for (const activity of tData.tActivities) {
      if (sActivityName === activity) return id;
    }
  }
  return undefined;
}

/** Get a random category name. */
export function getRandomCategory(): string {
  const keys = Object.keys(tTopicsByCategory);
  return keys[Math.floor(Math.random() * keys.length)];
}

/** Get a random topic from a category (or any category if none given). */
export function getRandomTopic(sCategory?: string): string {
  if (sCategory && tTopicsByCategory[sCategory]?.length) {
    const list = tTopicsByCategory[sCategory];
    return list[Math.floor(Math.random() * list.length)];
  }
  const allTopicIds = Object.keys(tTopics);
  return allTopicIds[Math.floor(Math.random() * allTopicIds.length)];
}

/** Get the display name of a topic. */
export function getTopicName(topicID: string): string {
  return tTopics[topicID]?.name ?? topicID;
}

/** Get all topics. */
export function getAllTopics(): Record<string, TopicEntry> {
  return tTopics;
}

/** Get topics by category. */
export function getTopicsByCategory(): Record<string, string[]> {
  return tTopicsByCategory;
}

/** Get number of categories. */
export function numberOfCategories(): number {
  return Object.keys(TopicList).length;
}

/** Get a random category that allows immigration generation. */
export function getRandomImmigrationCategory(): string | null {
  const eligible = Object.entries(TopicList)
    .filter(([_, v]) => v.bCanGenerateOnImmigration)
    .map(([k]) => k);
  if (eligible.length === 0) return null;
  return eligible[Math.floor(Math.random() * eligible.length)];
}

// ── Save/Load ────────────────────────────────────────────────────────

export function getSaveData(): { tTopics: Record<string, TopicEntry>; counter: number } {
  return { tTopics: { ...tTopics }, counter };
}

export function fromSaveData(data: { tTopics?: Record<string, TopicEntry>; counter?: number }): void {
  tTopics = data.tTopics ?? {};
  counter = data.counter ?? 0;
  // Rebuild category index
  tTopicsByCategory = {};
  for (const [sID, tData] of Object.entries(tTopics)) {
    if (!tTopicsByCategory[tData.category]) tTopicsByCategory[tData.category] = [];
    tTopicsByCategory[tData.category].push(sID);
  }
}
