/**
 * Log.ts — Character thought/journal system.
 * Mirrors Lua Log.lua: tag-scored line selection, queue-based posting,
 * text replacement with /CODE/ delimiters.
 */

import { LOG_TYPES, type LogTypeDef, type LogLine } from './LogData';
import {
  MAX_LOG_ENTRIES, LOG_RECENT_HISTORY,
  LOG_RATE_MIN, LOG_RATE_MAX,
  LOG_DEFAULT_PRIORITY, LOG_PRIORITY_ALWAYS_POST,
  MEMORY_LOGGED_RECENTLY,
  MORALE_MAX, ANGER_MAX, STARTING_AFFINITY,
  RACE_HUMAN, RACE_TOBIAN, RACE_SHAMON, RACE_JELLY,
  RACE_CAT, RACE_CHICKEN, RACE_BIRDSHARK,
} from './CharacterConstants';
import type { Character } from './Character';
import {
  getRandomTopic, getTopicName,
  generateDrinkName, generateCreatureName,
  getRandomProvenance, getRandomGameName,
} from './Topics';

// ── Log entry (stored per character) ──────────────────────────────

export interface LogEntry {
  sLine: string;
  linecode: string;      // log type key (e.g. 'GENERIC')
  logType: string;        // same as linecode
  priority: number;
  nTagScore: number;
  nTime: number;          // GameRules.elapsedTime at creation
}

// ── Replacement data passed from callers ──────────────────────────

export interface LogReplacementData {
  sDutyTarget?: string;
  sChatPartner?: string;
  sTopic?: string;
  sDeceased?: string;
  sAttackTarget?: string;
  sThingKilled?: string;
  sTimesBurned?: string;
  sMealName?: string;
  sResearchData?: string;
  sPatient?: string;
  sDoctor?: string;
  sDisease?: string;
  sCharacter?: string;
  sObject?: string;
  sTradePartner?: string;
  sItemName?: string;
  sOtherItemName?: string;
  sFavTag?: string;
  sPickupItem?: string;
  sOpponent?: string;
  sSaboteur?: string;
  sRampager?: string;
  nPlayTime?: number;
}

// ── Random word helpers via Topics ────────────────────────────────

const JOB_NAMES_READABLE = [
  'Builder', 'Technician', 'Miner', 'Scientist', 'Doctor', 'Bartender',
  'Botanist', 'Security',
];

function arrayRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Random band name from Topics registry. Lua: Log.randomBand(). */
function randomBand(): string {
  const id = getRandomTopic('Bands');
  return getTopicName(id);
}

/** Random food name from Topics registry. Lua: Log.randomFood(). */
function randomFood(): string {
  const id = getRandomTopic('Foods');
  return getTopicName(id);
}

/** Favorite food for character. Lua: Log.getFavoriteFood(). */
function getFavoriteFood(char: Character): string {
  const faveFood = char.getFavorite('Foods');
  if (faveFood) return getTopicName(faveFood);
  return randomFood();
}

// ── Tag scoring (mirrors Lua Log.tTags) ───────────────────────────

type TagScoreFn = (c: Character) => number;

/** Map of tag name → score function.
 * Convention: g_ prefix = gated (score ≤ 0 rejects line with -10000).
 * n_ prefix = negative gated (score > 0 rejects line). */
const TAG_SCORES: Record<string, TagScoreFn> = {
  // Personality sliders (0-1 mapped to -1..1)
  brave: c => (c.tStats.personality.nBravery - 0.5) * 2,
  coward: c => (0.5 - c.tStats.personality.nBravery) * 2,
  gregarious: c => (c.tStats.personality.nGregariousness - 0.5) * 2,
  shy: c => (0.5 - c.tStats.personality.nGregariousness) * 2,
  neat: c => (c.tStats.personality.nNeatness - 0.5) * 2,
  slob: c => (0.5 - c.tStats.personality.nNeatness) * 2,
  optimist: c => (c.tStats.personality.nPositivity - 0.5) * 2,
  pessimist: c => (0.5 - c.tStats.personality.nPositivity) * 2,
  angry: c => c.nAnger / ANGER_MAX,
  chill: c => -(c.tStats.personality.nTemper * 2 - 1),
  hardworking: c => (c.tStats.personality.nWorkEthic - 0.5) * 2,
  lazy: c => (0.5 - c.tStats.personality.nWorkEthic) * 2,
  authoritarian: c => (c.tStats.personality.nAuthoritarian - 0.5) * 2,

  // Morale
  happy: c => c.nMorale / MORALE_MAX,
  sad: c => -c.nMorale / MORALE_MAX,

  // Boolean quirks — Lua: random 0..0.5 if true, 0 if false
  emoticon: c => c.tStats.personality.bEmoticon ? Math.min(0.5, Math.random()) : 0,
  gourmand: c => c.tStats.personality.bGourmand ? Math.min(0.5, Math.random()) : 0,
  joker: c => c.tStats.personality.bJoker ? Math.min(0.5, Math.random()) : 0,
  sentimental: c => c.tStats.personality.bSentimental ? Math.min(0.5, Math.random()) : 0,
  competitive: c => c.tStats.personality.bCompetitive ? Math.min(0.5, Math.random()) : 0,
  hipster: c => c.tStats.personality.bHipster ? Math.min(0.5, Math.random()) : 0,
  xenophobe: c => c.tStats.personality.bXenophobe ? Math.min(0.5, Math.random()) : 0,
  anxious: c => c.tStats.personality.bAnxious ? Math.min(0.5, Math.random()) : 0,

  // Needs range -100..+100; negative need = deprived → positive tag score
  hungry: c => -(c.needs.hunger ?? 0) / 100,
  bored: c => -((c.needs.amusement ?? 0) + (c.needs.duty ?? 0)) / 200,
  lonely: c => -(c.needs.social ?? 0) / 100,
  tired: c => -(c.needs.energy ?? 0) / 100,

  // Jobs — Lua: 1 if match, 0 if not
  scientist: c => c.tStats.nJob === 4 ? 1 : 0,  // JOB_SCIENTIST=4
  technician: c => c.tStats.nJob === 2 ? 1 : 0,  // JOB_TECHNICIAN=2
  // Duty affinity — Lua: affinity/10
  lovesjob: c => c.getJobAffinity(c.tStats.nJob) / 10,
  hatesjob: c => -c.getJobAffinity(c.tStats.nJob) / 10,

  // Self affinity — Lua: affinity / STARTING_AFFINITY
  egoist: c => c.getAffinity(String(c.id)) / STARTING_AFFINITY,
  insecure: c => -c.getAffinity(String(c.id)) / STARTING_AFFINITY,

  // Race tags — Lua: 1 if match, 0 if not
  human: c => c.tStats.nRace === RACE_HUMAN ? 1 : 0,
  tobian: c => c.tStats.nRace === RACE_TOBIAN ? 1 : 0,
  shamon: c => c.tStats.nRace === RACE_SHAMON ? 1 : 0,
  jelly: c => c.tStats.nRace === RACE_JELLY ? 1 : 0,
  cat: c => c.tStats.nRace === RACE_CAT ? 1 : 0,
  chicken: c => c.tStats.nRace === RACE_CHICKEN ? 1 : 0,
  birdshark: c => c.tStats.nRace === RACE_BIRDSHARK ? 1 : 0,

  // Activity affinities — Lua: affinity / STARTING_AFFINITY
  boozer: c => c.getAffinity('Drinking') / STARTING_AFFINITY,
  jock: c => c.getAffinity('Exercise') / STARTING_AFFINITY,
  gamer: c => c.getAffinity('Gaming') / STARTING_AFFINITY,
};

function getTagScore(tag: string, char: Character): number {
  // Handle gated prefix
  const isGated = tag.startsWith('g_');
  const isNegGated = tag.startsWith('n_');
  const baseTag = (isGated || isNegGated) ? tag.slice(2) : tag;

  const fn = TAG_SCORES[baseTag];
  if (!fn) return 0;

  const score = fn(char);
  if (isGated && score <= 0) return -10000;
  if (isNegGated && score > 0) return -10000;
  return score;
}

function scoreLineForCharacter(line: LogLine, char: Character): number {
  if (!line.tTags || line.tTags.length === 0) return 0;
  let total = 0;
  for (const tag of line.tTags) {
    total += getTagScore(tag, char);
  }
  return total;
}

// ── Text replacement ──────────────────────────────────────────────

function applyReplacements(text: string, char: Character, data?: LogReplacementData): string {
  return text.replace(/\/([A-Z_]+)\//g, (_match, code: string) => {
    switch (code) {
      case 'MYNAME': return char.getName();
      case 'RANDOMBAND': return randomBand();
      case 'RANDOMFOOD': return randomFood();
      case 'FAVORITEFOOD': return getFavoriteFood(char);
      case 'RANDOMGAME': return getRandomGameName();
      case 'PLAYTIME': return data?.nPlayTime?.toString() ?? '0';
      case 'RANDOMDUTY': return arrayRandom(JOB_NAMES_READABLE);
      case 'MYDUTY': return char.getJobName();
      case 'DUTYTARGET': return data?.sDutyTarget ?? 'something';
      case 'CHATPARTNER': return data?.sChatPartner ?? 'someone';
      case 'CHATTOPIC': return data?.sTopic ?? 'stuff';
      case 'DECEASED': return data?.sDeceased ?? 'someone';
      case 'ATTACKTARGET': return data?.sAttackTarget ?? 'the hostile';
      case 'THINGKILLED': return data?.sThingKilled ?? 'something';
      case 'TIMESBURNED': return data?.sTimesBurned ?? '1';
      case 'RANDOMDRINKNAME': return generateDrinkName();
      case 'CURRENTROOM': return 'this room';
      case 'MYMEAL': return data?.sMealName ?? 'a meal';
      case 'RANDOMPROVENANCE': return getRandomProvenance();
      case 'RANDOMCREATURE': return generateCreatureName();
      case 'RANDOMCITIZENINROOM': return 'a crewmate';
      case 'CARRIEDRESEARCH':
      case 'RESEARCHSUBJECT': return data?.sResearchData ?? 'research';
      case 'RANDOMDISEASE': return 'a disease';
      case 'PATIENT': return data?.sPatient ?? 'the patient';
      case 'DOCTOR': return data?.sDoctor ?? 'the doctor';
      case 'DISEASE': return data?.sDisease ?? 'an illness';
      case 'RANDOMPUB': return 'the pub';
      case 'NEARBYPERSON': return data?.sCharacter ?? 'someone nearby';
      case 'NEARBYOBJECT': return data?.sObject ?? 'something';
      case 'TRADEPARTNER': return data?.sTradePartner ?? 'a trader';
      case 'TRADEITEM': return data?.sItemName ?? 'an item';
      case 'TRADEOTHERITEM': return data?.sOtherItemName ?? 'another item';
      case 'TRADETAG':
      case 'ITEMTAG': return data?.sFavTag ?? 'interesting';
      case 'ITEM': return data?.sPickupItem ?? 'something';
      case 'OPPONENT': return data?.sOpponent ?? 'an opponent';
      case 'SABOTEUR': return data?.sSaboteur ?? 'someone';
      case 'RAMPAGER': return data?.sRampager ?? 'someone';
      case 'BESTFRIEND': return 'my best friend';
      default: return `/${code}/`;
    }
  });
}

// ── Core Log module ───────────────────────────────────────────────

/** Elapsed game time provider — set from main.ts */
let getElapsedTime: () => number = () => 0;

export function setElapsedTimeProvider(fn: () => number): void {
  getElapsedTime = fn;
}

/**
 * Add a log entry to a character.
 * Selects best-scoring line from the log type, applies replacements,
 * and queues it for posting.
 */
export function addLog(
  logTypeKey: string,
  char: Character,
  data?: LogReplacementData,
): void {
  const typeDef = LOG_TYPES[logTypeKey];
  if (!typeDef || typeDef.lines.length === 0) return;

  // Select best line via tag scoring
  const lines = typeDef.lines;
  let bestLine = lines[0];
  let bestScore = -Infinity;

  // Shuffle to break ties randomly
  const shuffled = [...lines].sort(() => Math.random() - 0.5);

  for (const line of shuffled) {
    // Skip recently used lines
    if (lineCodeUsedRecently(char, logTypeKey, line.sLine)) continue;

    const score = scoreLineForCharacter(line, char);
    if (score > bestScore) {
      bestScore = score;
      bestLine = line;
    }
  }

  // Skip if gated tag rejected all lines
  if (bestScore <= -5000) return;

  const sLine = applyReplacements(bestLine.sLine, char, data);
  const priority = typeDef.priority ?? LOG_DEFAULT_PRIORITY;

  const entry: LogEntry = {
    sLine,
    linecode: logTypeKey,
    logType: logTypeKey,
    priority,
    nTagScore: bestScore === -Infinity ? 0 : bestScore,
    nTime: getElapsedTime(),
  };

  // Priority >= ALWAYS_POST → immediate post
  if (priority >= LOG_PRIORITY_ALWAYS_POST) {
    characterAddLog(char, entry);
    return;
  }

  // Queue for next log tick
  characterQueueLog(char, entry);
}

/**
 * Check if a linecode was used in the last LOG_RECENT_HISTORY posted entries.
 */
function lineCodeUsedRecently(char: Character, logType: string, lineText: string): boolean {
  const log = char.tLog;
  const start = Math.max(0, log.length - LOG_RECENT_HISTORY);
  for (let i = log.length - 1; i >= start; i--) {
    if (log[i].logType === logType && log[i].sLine === lineText) return true;
  }
  return false;
}

/**
 * Check if a log type was posted recently (in last N entries).
 */
export function logTypePostedRecently(char: Character, logType: string, nCount = 10): boolean {
  const log = char.tLog;
  const start = Math.max(0, log.length - nCount);
  for (let i = log.length - 1; i >= start; i--) {
    if (log[i].logType === logType) return true;
  }
  // Also check queue
  for (const entry of char.tLogQueue) {
    if (entry.logType === logType) return true;
  }
  return false;
}

/**
 * Directly add a log entry (bypasses queue). Used for priority-4 entries.
 */
function characterAddLog(char: Character, entry: LogEntry): void {
  char.tLog.push(entry);
  capLogSize(char.tLog);
}

/**
 * Queue a log entry for posting on next log tick.
 */
function characterQueueLog(char: Character, entry: LogEntry): void {
  // Deduplicate by linecode
  for (const existing of char.tLogQueue) {
    if (existing.linecode === entry.linecode) return;
  }
  char.tLogQueue.push(entry);
  capLogSize(char.tLogQueue);
}

/**
 * Post best queued log entry. Called from Character.update() on cooldown.
 * Returns true if a log was posted.
 */
export function postLogFromQueue(char: Character): boolean {
  if (char.tLogQueue.length === 0) return false;

  // Sort by priority desc, then tag score desc
  char.tLogQueue.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return b.nTagScore - a.nTagScore;
  });

  // Post the best entry
  const best = char.tLogQueue[0];
  characterAddLog(char, best);

  // Flush entire queue (Lua behavior)
  char.tLogQueue.length = 0;

  return true;
}

/**
 * Get log cooldown duration based on chattiness.
 * Chatty characters (1.0) log every LOG_RATE_MIN seconds,
 * quiet characters (0.0) log every LOG_RATE_MAX seconds.
 */
export function getLogCooldown(char: Character): number {
  const chattiness = char.tStats.personality.nChattiness;
  return LOG_RATE_MAX + (LOG_RATE_MIN - LOG_RATE_MAX) * chattiness;
}

function capLogSize(arr: LogEntry[]): void {
  while (arr.length > MAX_LOG_ENTRIES) arr.shift();
}
