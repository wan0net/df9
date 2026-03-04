/**
 * CharacterConstants.ts — All character mechanics constants.
 * Mirrors CharacterConstants.lua: teams, jobs, personality, morale, anger, combat, O2.
 */

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
  [UNEMPLOYED]: 'Unemployed',
  [BUILDER]: 'Builder',
  [TECHNICIAN]: 'Technician',
  [MINER]: 'Miner',
  [EMERGENCY]: 'Security',
  [RAIDER]: 'Raider',
  [BARTENDER]: 'Bartender',
  [BOTANIST]: 'Botanist',
  [SCIENTIST]: 'Scientist',
  [EMERGENCY2]: 'Security',
  [EMERGENCY3]: 'Security',
  [DOCTOR]: 'Doctor',
  [JANITOR]: 'Janitor',
  [TRADER]: 'Trader',
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

// ── Oxygen / Survival ───────────────────────────────────────────────────
export const OXYGEN_PER_SECOND = 200;
export const OXYGEN_LOW = 400;
export const OXYGEN_SUFFOCATING = 100;
export const OXYGEN_SUFFOCATION_UNTIL_DEATH = 60;
export const OXYGEN_AVERAGE_SAMPLE = 5;
export const SPACESUIT_MAX_OXYGEN = 480 * OXYGEN_PER_SECOND;
export const SPACESUIT_OXYGEN_SUFFOCATING = OXYGEN_SUFFOCATION_UNTIL_DEATH * OXYGEN_PER_SECOND;
export const UNNECESSARY_SPACESUIT_REMOVE = 10;

// ── Movement / Combat ───────────────────────────────────────────────────
export const BASE_SPEED = 1.5;
export const RUN_SPEED = 2.2;
export const MELEE_RANGE = 2;
export const HUMAN_MELEE_DAMAGE = 20;
export const MONSTER_MELEE_DAMAGE = 40;

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

// ── Stuff / Object Affinity ─────────────────────────────────────────────
export const STUFF_AFFINITY_PICKUP_THRESHOLD = 2;
export const STUFF_AFFINITY_DISCARD_THRESHOLD = -1;

// ── Log / Journal ──────────────────────────────────────────────────────
export const MAX_LOG_ENTRIES = 100;
export const LOG_RECENT_HISTORY = 5;
export const LOG_RATE_MIN = 5;
export const LOG_RATE_MAX = 15;

export const PERSONALITY_LIKELIHOOD: Record<string, number> = {
  bEmoticon: 0.1,
  bJoker: 0.2,
  bXenophobe: 0.1,
  bHipster: 0.2,
  bLowerCase: 0.05,
  bCompetitive: 0.3,
};
