/**
 * Log.ts — Character thought/journal system.
 * Faithfully mirrors Data/Scripts/Log.lua
 *
 * Characters generate log entries based on game events. Each entry is
 * selected from a pool of linecodes, scored by personality tags, and
 * formatted with dynamic replacement codes.
 *
 * Algorithm (Log.lua lines 817-1110):
 *  1. Log.add() picks the best linecode for a log type
 *  2. getLogTagScore() scores personality/need/duty tags, with gating
 *  3. applyReplacements() resolves /CODE/ patterns in the line text
 */

import type { Character } from '../characters/Character';
import { LINE_CODES } from './LineCodes';
import {
  LOG_TYPES, REPLACEMENT_CODES, TAG_DEFINITIONS,
  DEFAULT_PRIORITY, PRIORITY_ALWAYS_POST,
  RANDOM_BANDS, RANDOM_FOODS, RANDOM_GAMES, RANDOM_CREATURES,
  RANDOM_DRINK_NAMES, RANDOM_PROVENANCES,
} from './LogData';
import {
  JOB_NAMES,
  ANGER_MAX, MORALE_MAX,
  SCIENTIST, TECHNICIAN,
  STARTING_AFFINITY,
} from '../characters/CharacterConstants';
import { GameRules } from '../core/GameRules';

// ── Constants (from Log.lua) ─────────────────────────────────────

/** Maximum number of log entries stored per character */
export const MAX_LOG_ENTRIES = 100;

/** Number of recent linecodes tracked to prevent repetition */
export const LOG_RECENT_HISTORY = 5;

/**
 * Log rate bounds (seconds between queued log posts).
 * Character:postLogFromQueue uses a random value in this range.
 */
export const LOG_RATE_MIN = 5;
export const LOG_RATE_MAX = 15;

// ── Types ────────────────────────────────────────────────────────

/** A single journal/thought entry for a character. */
export interface LogEntry {
  /** The fully resolved display text */
  sLine: string;
  /** The linecode key used (e.g. 'SFGNRC001CITZ') */
  linecode: string;
  /** The log type key (e.g. 'GENERIC', 'JOINED') */
  logType: string;
  /** Sum of personality tag scores for the chosen linecode */
  nTagScore: number;
  /** Log type priority (0 = low, 4 = always post) */
  priority: number;
  /** Game time (GameRules.elapsedTime) when entry was created */
  nTime: number;
}

// ── Helper Functions ─────────────────────────────────────────────

/**
 * Fisher-Yates shuffle (returns a new array).
 * Mirrors DFUtil.arrayShuffle used in Log.lua line 836.
 */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Pick a random element from an array. Mirrors DFUtil.arrayRandom. */
function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Get the display name for a character's current duty/job.
 * Mirrors Log.getDutyName (Log.lua line 747).
 */
function getDutyName(char: Character): string {
  return JOB_NAMES[char.tStats.nJob] ?? 'Unknown';
}

/**
 * Get a random duty name, excluding the given job.
 * Mirrors Log.randomDuty (Log.lua line 752).
 */
function randomDuty(excludeJob?: number): string {
  const names = Object.entries(JOB_NAMES)
    .filter(([k]) => Number(k) !== excludeJob)
    .map(([, v]) => v);
  return randomFrom(names);
}

/** Random food name from topics. Mirrors Log.randomFood (Log.lua line 757). */
function randomFood(): string { return randomFrom(RANDOM_FOODS); }

/** Random band name from topics. Mirrors Log.randomBand (Log.lua line 762). */
function randomBand(): string { return randomFrom(RANDOM_BANDS); }

/** Random game name from topics. Mirrors g_LM.randomLine(Topics.GameNames). */
function randomGame(): string { return randomFrom(RANDOM_GAMES); }

/** Random creature name. Mirrors Topics.generateCreatureName(). */
function randomCreature(): string { return randomFrom(RANDOM_CREATURES); }

/** Random drink name. Mirrors Topics.generateDrinkName(). */
function randomDrinkName(): string { return randomFrom(RANDOM_DRINK_NAMES); }

/** Random provenance. Mirrors Topics.getRandomProvenance(). */
function randomProvenance(): string { return randomFrom(RANDOM_PROVENANCES); }

/**
 * Get favorite food for a character.
 * Mirrors Log.getFavoriteFood (Log.lua line 767) — uses rChar:getFavorite('Foods').
 * Falls back to random food when favorites system is not yet implemented.
 */
function getFavoriteFood(_char: Character): string {
  // TODO: Implement character favorites system (Topics.tTopics)
  return randomFood();
}

/**
 * Get best friend name.
 * Mirrors Log.bestFriend (Log.lua line 774) — uses rChar:getFavorite('People')
 * and looks up the friend's name via CharacterManager.
 */
function getBestFriend(char: Character): string {
  // Find highest affinity person (mirrors rChar:getFavorite('People'))
  let bestId = -1;
  let bestAff = -Infinity;
  for (const [id, aff] of char.tAffinity) {
    if (id !== char.id && aff > bestAff) {
      bestAff = aff;
      bestId = id;
    }
  }
  if (bestId >= 0) {
    // Would need CharacterManager ref to get name — use generic fallback.
    // Original Lua falls back to 'SFSECU027CITZ' ("my best friend").
    return 'my best friend';
  }
  return 'my best friend';
}

/**
 * Get name of a random person in the same room (who isn't the speaker).
 * Mirrors Log.randomPersonInRoom (Log.lua line 786).
 * Falls back to "that guy" (original: 'SFBART007CITZ') when alone.
 */
function randomPersonInRoom(_char: Character): string {
  // TODO: Integrate with Room.getCharactersInRoom() when available
  return 'that guy';
}

/**
 * Get random pub room name.
 * Mirrors Log.randomPub (Log.lua line 803).
 * Falls back to "the pub" (original: 'SFBART008CITZ') when no pubs exist.
 */
function randomPub(): string {
  // TODO: Integrate with Room.getRoomsOfTeam() to find actual pub names
  return 'the pub';
}

// ── Tag Scoring Functions ────────────────────────────────────────
// Lines 949-1011 of Log.lua

/**
 * normalizedScore: maps a 0-1 personality trait value to -1..1 score range.
 * Log.lua line 949: `return (nValue * 2) - 1`
 */
function normalizedScore(val: number): number {
  return (val * 2) - 1;
}

/**
 * Inverted normalizedScore: high trait value -> negative score.
 * Used for opposite-trait tags (e.g. "coward" = inverted bravery).
 */
function normalizedScoreInverted(val: number): number {
  return -((val * 2) - 1);
}

/**
 * needsScore: map need values onto -1 to 1 tag score range.
 * Log.lua line 955: `rChar.tNeeds[sNeed] / Needs.MAX_VALUE`
 * Original needs range from -100 to +100, MAX_VALUE = 100.
 * Our TS Needs also range from -100 to 100.
 */
function needsScore(char: Character, need: string): number {
  const needs = char.needs;
  switch (need) {
    case 'Hunger': return needs.hunger / 100;
    case 'Energy': return needs.energy / 100;
    case 'Amusement': return needs.amusement / 100;
    case 'Social': return needs.social / 100;
    case 'Duty': return needs.duty / 100;
    default: return 0;
  }
}

/**
 * dutyScore: return 1 if citizen matches specified duty, 0 otherwise.
 * Log.lua line 962.
 */
function dutyScore(char: Character, nDuty: number): number {
  return char.tStats.nJob === nDuty ? 1 : 0;
}

/**
 * currentDutyAffScore: map job affinity to -1..1 tag score range.
 * Log.lua line 971: `rChar:getJobAffinity(rChar.tStats.nJob) / 10`
 */
function currentDutyAffScore(_char: Character): number {
  // TODO: Implement job affinity system (Character:getJobAffinity)
  return 0;
}

/**
 * raceScore: return 1 if citizen matches specified race, 0 otherwise.
 * Log.lua line 976. Race system not yet implemented in TS.
 */
function raceScore(_char: Character, _nRace: number): number {
  // TODO: Implement race system
  return 0;
}

/**
 * angerScore: character's anger as a 0..1 score.
 * Log.lua line 985: `rChar.tStatus.nAnger / Character.ANGER_MAX`
 */
function angerScore(char: Character): number {
  return char.nAnger / ANGER_MAX;
}

/**
 * moraleScore: character's morale as a -1..1 score.
 * Log.lua line 999: `rChar.tStats.nMorale / Character.MORALE_MAX`
 */
function moraleScore(char: Character): number {
  return char.nMorale / MORALE_MAX;
}

/**
 * selfEsteemScore: "affinity for self" as a -1..1 score.
 * Log.lua line 994: `rChar:getAffinity(rChar.tStats.sUniqueID) / Character.STARTING_AFFINITY`
 */
function selfEsteemScore(char: Character): number {
  const selfAff = char.tAffinity.get(char.id) ?? STARTING_AFFINITY;
  return selfAff / STARTING_AFFINITY;
}

/**
 * activityScore: return activity affinity as a -1..1 score.
 * Log.lua line 989: `rChar:getAffinity(sActivity) / Character.STARTING_AFFINITY`
 */
function activityScore(_char: Character, _sActivity: string): number {
  // TODO: Implement activity affinity system (Character:getAffinity)
  return 0;
}

/**
 * quirkScore: for boolean personality traits.
 * Log.lua line 1004: `if bHasQuirk then return math.min(0.5, math.random()) else return 0 end`
 * Varies score to create more variation in log choice.
 */
function quirkScore(bHasQuirk: boolean): number {
  if (bHasQuirk) {
    return Math.min(0.5, Math.random());
  }
  return 0;
}

/**
 * Score a character on a specific tag.
 * Dispatches to the appropriate scoring function based on TAG_DEFINITIONS.
 * Returns -1..1, or special values for gating.
 *
 * This mirrors the inline scoreFn closures in Log.tTags (Log.lua lines 689-741).
 */
function getTagScore(char: Character, tag: string): number {
  const def = TAG_DEFINITIONS[tag];
  if (!def) return 0;

  const p = char.tStats.personality;

  switch (def.scoreFn) {
    // ── Personality traits (normalizedScore / inverted) ──
    case 'normalizedScore': {
      const val = (p as any)[def.param as string] ?? 0.5;
      return normalizedScore(val);
    }
    case 'normalizedScoreInverted': {
      const val = (p as any)[def.param as string] ?? 0.5;
      return normalizedScoreInverted(val);
    }

    // ── Anger ──
    // Log.lua line 700: angry = angerScore(rChar)
    case 'angerScore':
      return angerScore(char);
    // Log.lua line 701: chill = -normalizedScore(nTemper)
    case 'angerScoreInverted':
      return -normalizedScore(p.nTemper);

    // ── Morale ──
    // Log.lua line 706: happy = moraleScore(rChar)
    case 'moraleScore':
      return moraleScore(char);
    // Log.lua line 707: sad = -moraleScore(rChar)
    case 'moraleScoreInverted':
      return -moraleScore(char);

    // ── Self-esteem ──
    // Log.lua line 709: egoist = selfEsteemScore(rChar)
    case 'selfEsteemScore':
      return selfEsteemScore(char);
    // Log.lua line 710: insecure = -selfEsteemScore(rChar)
    case 'selfEsteemScoreInverted':
      return -selfEsteemScore(char);

    // ── Needs ──
    // Log.lua lines 719-722: hungry/bored/lonely/tired
    case 'needsScore': {
      const need = def.param as string;
      return -needsScore(char, need);  // Negated: low need = high score
    }
    // Special case: bored = -(Amusement + Duty) / 2
    case 'boredScore':
      return -(needsScore(char, 'Amusement') + needsScore(char, 'Duty')) / 2;

    // ── Duty/job match ──
    // Log.lua lines 724-725: scientist/technician
    case 'dutyScore': {
      const jobId = def.param as number;
      return dutyScore(char, jobId);
    }

    // ── Job affinity ──
    // Log.lua lines 727-728: lovesjob/hatesjob
    case 'currentDutyAffScore':
      return currentDutyAffScore(char);
    case 'currentDutyAffScoreInverted':
      return -currentDutyAffScore(char);

    // ── Race ──
    // Log.lua lines 730-736
    case 'raceScore': {
      const nRace = def.param as number;
      return raceScore(char, nRace);
    }

    // ── Quirks (boolean personality flags) ──
    // Log.lua lines 712-717
    case 'quirkScore': {
      const has = (p as any)[def.param as string] ?? false;
      return quirkScore(has);
    }

    // ── Activity affinities ──
    // Log.lua lines 738-740: boozer/jock/gamer
    case 'activityScore': {
      const activity = def.param as string;
      return activityScore(char, activity);
    }

    default:
      return 0;
  }
}

/**
 * Score a single tag for a character, with gating support.
 * Mirrors Log.getLogTagScore (Log.lua lines 919-943).
 *
 * Handles tag prefixes:
 *  - g_  = "gated": reject (return -10000) if score <= 0
 *  - n_  = "negative gated": reject (return -10000) if score > 0
 *
 * @param sTag - A single tag string, possibly prefixed with g_ or n_
 * @param char - The character to score against
 * @returns Tag score, or -10000 for gated rejection
 */
function getLogTagScore(sTag: string, char: Character): number {
  let actualTag = sTag;
  let bGated = false;
  let bNegativeGated = false;

  // Log.lua line 923: tags starting with 'g_' are gated
  if (sTag.startsWith('g_')) {
    bGated = true;
    actualTag = sTag.slice(2);
  // Log.lua line 928: tags starting with 'n_' are negative gated
  } else if (sTag.startsWith('n_')) {
    bNegativeGated = true;
    actualTag = sTag.slice(2);
  }

  // Log.lua line 932: valid tag?
  const nScore = getTagScore(char, actualTag);

  // Log.lua line 936: gated + score <= 0 => reject
  if (bGated && nScore <= 0) return -10000;
  // Log.lua line 938: negative gated + score > 0 => reject
  if (bNegativeGated && nScore > 0) return -10000;

  return nScore;
}

// ── Replacement Processing ───────────────────────────────────────
// Log.lua lines 1013-1110

/**
 * Resolve a single replacement code to its text value.
 * Mirrors Log.getReplacement (Log.lua lines 1013-1024).
 *
 * @param code - The replacement code name (e.g. 'MYNAME', 'RANDOMBAND')
 * @param char - The character generating the log
 * @param tData - Context data passed to Log.add
 * @returns The resolved replacement text
 */
function resolveReplacement(
  code: string,
  char: Character,
  tData: Record<string, any>,
): string {
  const def = REPLACEMENT_CODES[code];
  if (!def) return code;

  // Log.lua line 1014: if tSub.evalFn, call the function
  if (def.evalFn) {
    switch (def.evalFn) {
      case 'myName': return char.getName();
      case 'randomBand': return randomBand();
      case 'randomFood': return randomFood();
      case 'favoriteFood': return getFavoriteFood(char);
      case 'randomGame': return randomGame();
      case 'randomDuty': return randomDuty(char.tStats.nJob);
      case 'myDuty': return getDutyName(char);
      case 'randomDrinkName': return randomDrinkName();
      case 'currentRoom': {
        // Log.lua line 659-662: get room name, fallback if space or nil
        return tData.sCurrentRoom ?? 'this room';
      }
      case 'randomProvenance': return randomProvenance();
      case 'randomCreature': return randomCreature();
      case 'randomCitizenInRoom': return randomPersonInRoom(char);
      case 'randomDisease': return tData.sDisease ?? 'a disease';
      case 'randomPub': return randomPub();
      case 'bestFriend': return getBestFriend(char);
      default: return code;
    }
  }

  // Log.lua line 1017: if tSub.keyName, look up in tData
  if (def.keyName) {
    return tData[def.keyName] ?? code;
  }

  return code;
}

/**
 * Process all /CODE/ replacement patterns in a line.
 * Mirrors Log.getReplacements (Log.lua lines 1026-1110).
 *
 * The original Lua iterates character-by-character, finding /CODES/
 * and building a tLines array of strings and link objects. We simplify
 * to a regex replacement since our UI doesn't need the tLines segmentation
 * yet, but produce the same final sLine string.
 *
 * Double slashes (//) are escaped to a single slash in the original.
 */
function applyReplacements(
  line: string,
  char: Character,
  tData: Record<string, any>,
): string {
  // Handle double-slash escape: // -> / (Log.lua line 1047)
  let processed = line.replace(/\/\//g, '\x00ESCAPED_SLASH\x00');

  // Replace /CODE/ patterns (Log.lua lines 1050-1093)
  processed = processed.replace(/\/([A-Z][A-Z0-9]*)\//g, (_match, code) => {
    return resolveReplacement(code, char, tData);
  });

  // Restore escaped slashes
  processed = processed.replace(/\x00ESCAPED_SLASH\x00/g, '/');

  return processed;
}

// ── Core Log System ──────────────────────────────────────────────

export class Log {
  /**
   * Whether to filter logs through the character's queue (true) or post
   * directly (false, useful for debugging). Mirrors Log.bFilter (Log.lua line 13).
   */
  static bFilter = true;

  /**
   * Add a log entry to a character.
   * Faithfully mirrors Log.add() from Log.lua lines 817-908.
   *
   * Algorithm:
   *  1. Skip if character is dead (Log.lua line 818: assert(rChar.bInitialized))
   *  2. Get lineCodes array from LOG_TYPES[logType] (Log.lua line 827)
   *  3. Shuffle the lineCodes for variety (Log.lua line 836)
   *  4. For each linecode:
   *     - Skip if recently used (Log.lua line 839)
   *     - If first non-recently-used, set as fallback (Log.lua line 841)
   *     - Score by tags, track highest scoring (Log.lua lines 844-855)
   *  5. If all recently used, pick random (Log.lua line 859)
   *  6. Apply replacement codes to get final text (Log.lua line 864)
   *  7. Build LogEntry with sLine, linecode, logType, nTagScore, priority, nTime
   *  8. If bFilter and priority < PRIORITY_ALWAYS_POST(4), queue it;
   *     otherwise add directly (Log.lua lines 904-908)
   *
   * @param char - The character generating the log
   * @param logType - The log type key (e.g. 'GENERIC', 'JOINED', 'DEATH_REACT_CITIZEN')
   * @param tData - Optional data for replacement codes
   * @param bFilter - If provided, overrides the static Log.bFilter
   */
  static add(
    char: Character,
    logType: string,
    tData: Record<string, any> = {},
    bFilter?: boolean,
  ): LogEntry | null {
    // Log.lua line 818: assert(rChar.bInitialized)
    if (!char.isAlive()) return null;

    const typeDef = LOG_TYPES[logType];
    if (!typeDef) {
      console.warn(`[Log] Unknown log type: ${logType}`);
      return null;
    }

    const { lineCodes, priority } = typeDef;
    // Log.lua line 827: if not tLogType.lineCodes or #tLogType.lineCodes == 0
    if (!lineCodes || lineCodes.length === 0) return null;

    // Log.lua line 836: DFUtil.arrayShuffle(tLogType.lineCodes)
    // Randomize so if we have to grab one at random, we won't always get first
    const shuffled = shuffle(lineCodes);

    // Log.lua line 832-833: nBestTagScore starts at 0, sBestLine starts nil
    let nBestTagScore = 0;
    let sBestLine: string | null = null;

    // Log.lua lines 837-857: iterate shuffled linecodes
    for (const lc of shuffled) {
      const lcDef = LINE_CODES[lc];
      if (!lcDef) continue;

      // Log.lua line 839: skip recently used linecodes
      if (char.lineCodeUsedRecently(lc)) continue;

      // Log.lua line 841: if no valid best line yet, grab first non-recently-used
      if (!sBestLine) {
        sBestLine = lc;
      }

      // Log.lua lines 844-855: score by tags
      const tags = lcDef.tTags ?? [];
      if (tags.length > 0) {
        let nTotalScore = 0;
        for (const tag of tags) {
          // Log.lua line 849: per-tag scoring with gating
          nTotalScore += getLogTagScore(tag, char);
        }
        if (nTotalScore > nBestTagScore) {
          nBestTagScore = nTotalScore;
          sBestLine = lc;
        }
      }
    }

    // Log.lua line 859: if all logs are recently used, pick a random one
    if (!sBestLine) {
      sBestLine = randomFrom(shuffled);
    }

    const lcDef = LINE_CODES[sBestLine];
    if (!lcDef) return null;

    // Log.lua line 864: do replacements
    const sLine = applyReplacements(lcDef.sLine, char, tData);
    if (!sLine) {
      console.warn(`[Log] Couldn't parse replacements for linecode ${sBestLine}`);
      return null;
    }

    // Log.lua lines 870-880: compile entry data
    const entry: LogEntry = {
      sLine,
      linecode: sBestLine,
      logType,
      nTagScore: nBestTagScore,
      priority: priority ?? DEFAULT_PRIORITY,
      nTime: GameRules.elapsedTime,
    };

    // Mark linecode as recently used (prevents repetition)
    char.markLineCodeUsed(sBestLine);

    // Log.lua lines 903-908: queue or add directly
    const useFilter = bFilter !== undefined ? bFilter : Log.bFilter;
    if (useFilter && entry.priority < PRIORITY_ALWAYS_POST) {
      // Log.lua line 905: rChar:queueLog(tEntry)
      char.queueLog(entry);
    } else {
      // Log.lua line 907: rChar:addLog(tEntry)
      char.addLogEntry(entry);
    }

    return entry;
  }
}
