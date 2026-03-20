/**
 * CharacterConstants.ts — All character mechanics constants.
 * Mirrors CharacterConstants.lua: teams, jobs, personality, morale, anger, combat, O2.
 */

import { line } from '../localization/Localization';

// ── Team / Faction IDs ──────────────────────────────────────────────────
export const TEAM_ID_NONE = 0;
export const TEAM_ID_PLAYER = 1;
export const TEAM_ID_DEBUG_ENEMYGROUP = -2;
export const TEAM_ID_PLAYER_ABANDONED = 3;
export const TEAM_ID_DEBUG_MONSTER = -3;
export const TEAM_ID_DEBUG_FRIENDLY = -4;
export const TEAM_ID_FIRST_USABLE = 100;

export const FACTION_BEHAVIOR = {
  Citizen: 1,
  Monster: 2,
  Friendly: 3,
  EnemyGroup: 4,
  KillBot: 5,
  Trader: 6,
} as const;

export const THREAT_LEVEL = {
  None: 0,
  NormalCitizen: 1,
  BadCitizen: 3,
  Raider: 3,
  Turret: 3,
  Monster: 4,
} as const;

// ── Races (Lua CharacterConstants.RACE_*) ───────────────────────────────
export const RACE_HUMAN = 1;
export const RACE_JELLY = 2;
export const RACE_TOBIAN = 3;
export const RACE_CAT = 4;
export const RACE_BIRDSHARK = 5;
export const RACE_CHICKEN = 6;
export const RACE_MONSTER = 7;
export const RACE_SHAMON = 8;
export const RACE_MURDERFACE = 9;
export const RACE_KILLBOT = 10;

/** Spawn rate: 60% human, 2% cat, rest split among others */
export const HUMAN_RACE_PCT = 60;
export const CAT_RACE_PCT = 2;

/** Rig types (for rendering) */
export const RIG_BASE = 1;
export const RIG_ALIEN = 2;
export const RIG_CUBE = 3;
export const RIG_MONSTER = 4;
export const RIG_KILLBOT = 5;
export const RIG_SPHERE = 6;

/** Melee damage by race */
export const HUMAN_MELEE_DAMAGE = 20;
export const MONSTER_MELEE_DAMAGE = 40;

/** Race type definitions (Lua CharacterConstants.RACE_TYPE) */
export interface RaceTypeDef {
  sName: string;
  nRig: number;
  /** Non-breathing races (MONSTER, KILLBOT) don't consume O2 */
  bBreathes: boolean;
  /** Can be cuffed/imprisoned */
  bCanBeCuffed: boolean;
  /** Can receive medical treatment */
  bCanBeTreated: boolean;
  /** Melee damage */
  nMeleeDamage: number;
}

export const RACE_TYPE: Record<number, RaceTypeDef> = {
  [RACE_HUMAN]:     { sName: 'human',      nRig: RIG_BASE,    bBreathes: true,  bCanBeCuffed: true,  bCanBeTreated: true,  nMeleeDamage: HUMAN_MELEE_DAMAGE },
  [RACE_JELLY]:     { sName: 'jelly',      nRig: RIG_BASE,    bBreathes: true,  bCanBeCuffed: true,  bCanBeTreated: true,  nMeleeDamage: HUMAN_MELEE_DAMAGE },
  [RACE_TOBIAN]:    { sName: 'tobian',     nRig: RIG_ALIEN,   bBreathes: true,  bCanBeCuffed: true,  bCanBeTreated: true,  nMeleeDamage: HUMAN_MELEE_DAMAGE },
  [RACE_CAT]:       { sName: 'cat',        nRig: RIG_BASE,    bBreathes: true,  bCanBeCuffed: true,  bCanBeTreated: true,  nMeleeDamage: HUMAN_MELEE_DAMAGE },
  [RACE_BIRDSHARK]: { sName: 'birdshark',  nRig: RIG_BASE,    bBreathes: true,  bCanBeCuffed: true,  bCanBeTreated: true,  nMeleeDamage: HUMAN_MELEE_DAMAGE },
  [RACE_CHICKEN]:   { sName: 'chicken',    nRig: RIG_ALIEN,   bBreathes: true,  bCanBeCuffed: true,  bCanBeTreated: true,  nMeleeDamage: HUMAN_MELEE_DAMAGE },
  [RACE_MONSTER]:   { sName: 'badalien',   nRig: RIG_MONSTER,  bBreathes: false, bCanBeCuffed: false, bCanBeTreated: false, nMeleeDamage: MONSTER_MELEE_DAMAGE },
  [RACE_SHAMON]:    { sName: 'shamon',     nRig: RIG_BASE,    bBreathes: true,  bCanBeCuffed: true,  bCanBeTreated: true,  nMeleeDamage: HUMAN_MELEE_DAMAGE },
  [RACE_MURDERFACE]:{ sName: 'murderface', nRig: RIG_ALIEN,   bBreathes: true,  bCanBeCuffed: true,  bCanBeTreated: true,  nMeleeDamage: HUMAN_MELEE_DAMAGE },
  [RACE_KILLBOT]:   { sName: 'killbot',    nRig: RIG_KILLBOT, bBreathes: false, bCanBeCuffed: false, bCanBeTreated: false, nMeleeDamage: HUMAN_MELEE_DAMAGE },
};

/** Race name strings (Lua CharacterConstants.tRaceNames) */
export const RACE_NAMES: Record<number, string> = {
  [RACE_HUMAN]: 'Human',
  [RACE_JELLY]: 'Jelly',
  [RACE_TOBIAN]: 'Tobian',
  [RACE_CAT]: 'Cat',
  [RACE_BIRDSHARK]: 'Birdshark',
  [RACE_CHICKEN]: 'Chicken',
  [RACE_MONSTER]: 'Monster',
  [RACE_SHAMON]: 'Shamon',
  [RACE_MURDERFACE]: 'Murderface',
  [RACE_KILLBOT]: 'Killbot',
};

// ── Jobs ────────────────────────────────────────────────────────────────
export const UNEMPLOYED = 1;
export const BUILDER = 2;
export const TECHNICIAN = 3;
export const MINER = 4;
export const EMERGENCY = 5;
export const RAIDER = 6;
export const BARTENDER = 7;
export const BOTANIST = 8;
export const SCIENTIST = 9;
export const EMERGENCY2 = 10;
export const EMERGENCY3 = 11;
export const DOCTOR = 12;
export const JANITOR = 13;
export const TRADER = 14;

/** Player-assignable jobs */
export const tJobs = [
  BUILDER, TECHNICIAN, MINER, EMERGENCY,
  BARTENDER, BOTANIST, SCIENTIST, DOCTOR, JANITOR,
];

export const JOB_NAMES: Record<number, string> = {
  [UNEMPLOYED]: line('DUTIES001TEXT'),
  [BUILDER]: line('DUTIES003TEXT'),
  [TECHNICIAN]: line('DUTIES005TEXT'),
  [MINER]: line('DUTIES007TEXT'),
  [EMERGENCY]: line('DUTIES009TEXT'),
  [RAIDER]: line('DUTIES011TEXT'),
  [BARTENDER]: line('DUTIES013TEXT'),
  [BOTANIST]: line('DUTIES016TEXT'),
  [SCIENTIST]: line('DUTIES018TEXT'),
  [EMERGENCY2]: line('DUTIES009TEXT'),
  [EMERGENCY3]: line('DUTIES009TEXT'),
  [DOCTOR]: line('DUTIES020TEXT'),
  [JANITOR]: line('DUTIES022TEXT'),
  [TRADER]: line('DUTIES024TEXT'),
};

// ── Competency / XP ─────────────────────────────────────────────────────
export const MAX_COMPETENCY = 10;
export const MAX_STARTING_COMPETENCY = 2;
export const STARTING_SKILL_POINTS = 8;
export const MAX_CHANCE_TO_FAIL = 0.1;
export const MIN_CHANCE_TO_FAIL = 0;
export const NO_FAIL_COMPETENCY_THRESHOLD = 0.9;
export const FAILURE_XP_PENALTY = 0.5;
export const EXPERIENCE_PER_LEVEL = 200;
export const JOB_EXPERIENCE_RATE = 25.0 / 60.0;

export const tJobLevels = [
  { nLevel: 1, nMinCompetency: 0 },
  { nLevel: 2, nMinCompetency: 0.16 },
  { nLevel: 3, nMinCompetency: 0.28 },
  { nLevel: 4, nMinCompetency: 0.60 },
  { nLevel: 5, nMinCompetency: 0.90 },
];

// ── Health / Status ─────────────────────────────────────────────────────
export const STARTING_HIT_POINTS = 100;
export const HURT_THRESHOLD = 30;
export const SCUFFED_UP_THRESHOLD = 80;
export const HEAL_RATE = 0.05;
export const SELF_HEAL_COOLDOWN = 15;
export const FIRE_DAMAGE_RATE = 5;

export const STATUS_HEALTHY = 1;
export const STATUS_HURT = 2;
export const STATUS_SICK = 3;
export const STATUS_DEAD = 4;
export const STATUS_INCAPACITATED = 5;
export const STATUS_ILL = 6;
export const STATUS_SCUFFED_UP = 7;
export const STATUS_INJURED = 8;
export const STATUS_DRUGGED = 9;

export const CAUSE_OF_DEATH = {
  UNSPECIFIED: 1,
  DEBUG: 2,
  SUFFOCATION: 3,
  FIRE: 4,
  DISEASE: 5,
  COMBAT_RANGED: 6,
  SUCKED_INTO_SPACE: 7,
  PARASITE: 8,
  STARVATION: 9,
  COMBAT_MELEE: 10,
  THING: 11,
  STUNNER: 12,
} as const;

// ── Needs ───────────────────────────────────────────────────────────────
export const NEEDS_REDUCE_TICK = 14.4;
export const NEEDS_HUNGER_STARVATION = -90;
export const TIME_BEFORE_STARVATION = 60 * 10;
export const NEEDS_ENERGY_TIRED = -50;
export const NEEDS_STUFF_LOW = -50;

// ── Morale ──────────────────────────────────────────────────────────────
export const MORALE_TICK = 15;
export const MORALE_MAX = 100;
export const MORALE_MIN = -100;
export const MORALE_COMPETENCY_THRESHOLD = 33;
export const MORALE_COMPETENCY_MODIFIER = 0.5;
export const MORALE_SPEED_THRESHOLD = 50;
export const MORALE_LOW_SPEED_MODIFIER = -0.3;
export const MORALE_HIGH_SPEED_MODIFIER = 0.1;

export const MORALE_NEEDS_LOW = -20;
export const MORALE_NEEDS_DECREASE = -0.1;
export const MORALE_NEEDS_HIGH = 25;
export const MORALE_NEEDS_INCREASE = 0.1;

export const MAX_ROOM_MORALE_SCORE = 0.5;
export const ROOM_MORALE_FALLOFF_START = 30;
export const ROOM_MORALE_FALLOFF_END = 60;
export const MAX_ROOM_MORALE_BOOST = 0.4;
export const ROOM_MORALE_TICK = 3;
export const CORPSE_ROOM_MORALE_SCORE = -20;

// Morale events (positive)
export const MORALE_MET_NEW_CITIZEN = 6;
export const MORALE_WOKE_UP_BED = 4;
export const MORALE_SERVED_MEAL = 1;
export const MORALE_DRANK_BASE = 3;
export const MORALE_DRANK_MAX = 6;
export const MORALE_ATE_MEAL_BASE = 1;
export const MORALE_ATE_MEAL_MAX = 10;
export const MORALE_HAPPY_CHAT_BASE = 1;
export const MORALE_HAPPY_CHAT_MAX = 10;

// Morale task events — mirrors CharacterConstants.lua (most are 0 in original)
export const MORALE_NICE_CHAT = 0;
export const MORALE_MINE_ASTEROID = 0;
export const MORALE_MAINTAIN_OBJECT = 0;
export const MORALE_MAINTAIN_PLANT = 0;
export const MORALE_REPAIR_OBJECT = 0;
export const MORALE_BUILD_BASE = 0;
export const MORALE_DID_HOBBY = 0;
export const MORALE_DELIVERED_FOOD = 0;
export const MORALE_BAD_CHAT = 0;

// Non-zero morale modifiers from CharacterConstants.lua
export const MORALE_NEEDS_MET_BONUS = 0.5;
export const MORALE_LOW_OXYGEN = -0.1;
/** Lua nAverageOxygen threshold (0–65535 tile scale) below which low-O2 morale fires */
export const MORALE_LOW_OXYGEN_THRESHOLD = 550;

// Morale events (negative)
export const MORALE_SLEPT_ON_FLOOR = -1;
export const MORALE_CITIZEN_DIES_MIN = -4;
export const MORALE_CITIZEN_DIES_MAX = -60;
export const MORALE_MAX_FAMILIARITY_DEATH = 100;
export const MORALE_MAX_AFFINITY_DEATH = 10;

// ── Anger ───────────────────────────────────────────────────────────────
export const ANGER_BAD_CONVO_WITH_NORMAL = 1;
export const ANGER_BAD_CONVO_WITH_JERK = 5;
export const ANGER_NEARBY_BRAWL = 15;
export const ANGER_NEARBY_RAMPAGE = 25;
export const ANGER_JOB_FAIL_TINY = 5;
export const ANGER_JOB_FAIL_MINOR = 15;
export const ANGER_JOB_FAIL_MAJOR = 25;
export const ANGER_BAD_FOOD = 10;
export const ANGER_MAX = 100;
export const ANGER_REDUCTION_PER_MORALE_TICK = 1;
export const ANGER_REDUCTION_PER_MORALE_TICK_BRIG = 2;

export const STATUS_RAMPAGE = 1;
export const STATUS_RAMPAGE_NONVIOLENT = 2;
export const STATUS_RAMPAGE_VIOLENT = 3;
export const VIOLENT_RAMPAGE_CHANCE = 0.25;
export const REPLICATOR_FOOD = 3;

// ── Oxygen / Survival ───────────────────────────────────────────────────
export const OXYGEN_PER_SECOND = 200;
export const OXYGEN_LOW = 400;
export const OXYGEN_SUFFOCATING = 100;
export const OXYGEN_SUFFOCATION_UNTIL_DEATH = 60;
export const OXYGEN_AVERAGE_SAMPLE = 5;
export const SIGHT_RADIUS = 18;
export const SPACESUIT_MAX_OXYGEN = 480 * OXYGEN_PER_SECOND;
export const SPACESUIT_OXYGEN_SUFFOCATING = OXYGEN_SUFFOCATION_UNTIL_DEATH * OXYGEN_PER_SECOND;
export const UNNECESSARY_SPACESUIT_REMOVE = 10;
/** Lua Oxygen.lua VACUUM_THRESHOLD=50 — O2 score below which suffocation starts (squared=2500). */
export const VACUUM_THRESHOLD = 50;
/** Lua Oxygen.lua VACUUM_THRESHOLD_END=40 — O2 score below which suffocation recovers (squared=1600). */
export const VACUUM_THRESHOLD_END = 40;

// ── Movement / Combat ───────────────────────────────────────────────────
export const BASE_SPEED = 1.5;
export const RUN_SPEED = 2.2;
export const MELEE_RANGE = 2;
// HUMAN_MELEE_DAMAGE and MONSTER_MELEE_DAMAGE defined above in Race section

export const ATTACK_TYPE = {
  Grapple: 1,
  Ranged: 2,
  Stunner: 3,
} as const;

export const DAMAGE_TYPE = {
  None: 0,
  Melee: 1,
  Laser: 2,
  Fire: 3,
  Acid: 4,
  Impact: 6,
  Stunner: 7,
} as const;

// ── Bullet / Projectile Sprite Names ────────────────────────────────────
export const SPRITE_NAME_FRIENDLY_RIFLE = 'temp_laser_blue';
export const SPRITE_NAME_ENEMY_RIFLE = 'temp_laser';
export const SPRITE_NAME_FRIENDLY_PISTOL = 'pistol_laser_blue';
export const SPRITE_NAME_ENEMY_PISTOL = 'pistol_laser';

// ── Social / Affinity ───────────────────────────────────────────────────
export const MAX_AFFINITY = 20;
export const STARTING_AFFINITY = 10;
export const ACTIVITY_AFFINITY_CHANGE_PCT = 0.2;
export const AFFINITY_CHANGE_MINOR = 1;
export const AFFINITY_CHANGE_MEDIUM = 4;
export const FRIEND_AFFINITY = 5;
export const ENEMY_AFFINITY = -5;
export const DUTY_AFFINITY_LIKE = 2.5;
export const DUTY_AFFINITY_DISLIKE = -2.5;
export const DUTY_AFFINITY_XP_MAX_RATE = 0.5;
export const DUTY_AFFINITY_MORALE_MAX = 0.4;
export const CHAT_COOLDOWN = 10;
export const CHAT_PUB_BONUS = 100;
export const FAMILIARITY_TICK_RATE = 5;
export const FAMILIARITY_TICK_INCREASE = 0.1;
export const FAMILIARITY_CHAT = 4;
export const FAMILIARITY_SERVE_MEAL = 0.5;
export const PUB_CAPACITY = 3;
export const PUB_CITIZENS_PER_BARTENDER = 5; // Lua CharacterConstants.lua:455

// ── Personality Traits ──────────────────────────────────────────────────
export const PERSONALITY_TRAITS = {
  nBravery: 1,
  nGregariousness: 2,
  nChattiness: 3,
  nNeatness: 4,
  bEmoticon: 5,
  nTemper: 7,
  nWorkEthic: 8,
  bXenophobe: 9,
  bAnxious: 10,
  bGourmand: 11,
  bJoker: 12,
  bSentimental: 13,
  bCompetitive: 15,
  bLowerCase: 16,
  bHipster: 17,
  nPositivity: 18,
  nAuthoritarian: 19,
} as const;

export const PERSONALITY_LIKELIHOOD: Record<string, number> = {
  bEmoticon: 0.1,
  bJoker: 0.2,
  bXenophobe: 0.1,
  bHipster: 0.2,
  bLowerCase: 0.05,
  bCompetitive: 0.3,
};

// ── Log / Journal System ──────────────────────────────────────────
export const MAX_LOG_ENTRIES = 100;
export const LOG_RECENT_HISTORY = 5;
export const LOG_RATE_MIN = 5;
export const LOG_RATE_MAX = 15;
export const LOG_MORALE_NEEDS_RATE = 180;
export const MORALE_EVENTS_LOG_MAX = 100;
export const ROOM_MORALE_LOG_THRESHOLD = 0.8;
export const INFESTATION_LOG_TIME = 300;
export const INFESTATION_CHANCE = 0.025;
export const GENERIC_LOG_FREQUENCY = 240;
export const STUFF_NEED_LOG_FREQUENCY = 800;
export const PATROL_LOG_FREQUENCY = 120;
export const BASE_LOG_SKILL_UP_DURATION = 30;

export const LOG_DEFAULT_PRIORITY = 0;
export const LOG_PRIORITY_ALWAYS_POST = 4;

// Memory keys for log rate-limiting
export const MEMORY_LOGGED_RECENTLY = 'bLoggedRecently';
export const MEMORY_LOGGED_MORALE_RECENTLY = 'bLoggedMoraleRecently';
export const MEMORY_GENERIC_LOG = 'bMadeGenericLogRecently';
export const MEMORY_STUFF_NEED = 'bMadeStuffNeedLogRecently';
export const MEMORY_ATTEMPTED_MONSTER_LOG_RECENTLY = 'bRecentLogAboutParasite';
export const MEMORY_LOGGED_PATROL_RECENTLY = 'bLoggedPatrolRecently';
export const MEMORY_LOGGED_RESEARCH_RECENTLY = 'bLoggedResearchRecently';

// Memory keys for room/event context
export const MEMORY_ROOM_BREACHED_PREFIX = 'bRoomBreached';
export const MEMORY_ROOM_COMBAT_PREFIX = 'bCombatInRoom';
export const MEMORY_ROOM_FIRE_PREFIX = 'bFireInRoom';
export const MEMORY_ROOM_LOWO2_PREFIX = 'bLowOxygenInRoom';
export const MEMORY_PRISON_ANGER_RECENTLY = 'bPrisonAngerRecently';
export const MEMORY_EXPLORED_RECENTLY = 'bExploredRecently';
export const MEMORY_TOOK_DAMAGE_RECENTLY = 'bTookDamageRecently';
export const MEMORY_ENTERED_COMBAT_RECENTLY = 'bEnteredCombatRecently';
export const MEMORY_WORKED_OUT_RECENTLY = 'bWorkedOutRecently';
export const MEMORY_PLAYED_GAME_RECENTLY = 'bPlayedGameRecently';
export const MEMORY_LAST_BED = 'tLastSleptInBed';
export const MEMORY_SENT_TO_HOSPITAL = 'bSentToHospital';
export const MEMORY_STARTLED_RECENTLY = 'bStartledRecently';
export const MEMORY_STARTLED_RECENTLY_DURATION = 15;

/** Chance to play startle animation when entering combat (Lua CharacterConstants.STARTLE_CHANCE = 0.75). */
export const STARTLE_CHANCE = 0.75;
export const MEMORY_SAW_TANTRUM_RECENTLY = 'tSawTantrum';
export const WORKOUT_COOLDOWN = 120;
export const GAMING_COOLDOWN = 120;
export const CORPSE_DURATION = 600;
export const SLEEP_DURATION = 270;

export const XP_FIRE_EXTINGUISH = 15;
export const XP_COMBAT_KILL = 15;
export const XP_COMBAT_DAMAGE = 1;
export const XP_BUILD_BASE = 2;
