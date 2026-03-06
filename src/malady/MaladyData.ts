/**
 * MaladyData.ts — Disease/condition definitions.
 * Mirrors NewMaladyData.lua exactly — all 25 diseases.
 */

// ── Need Modifier Map ───────────────────────────────────────────────────

/** Need modifiers: 0 = lock need, negative = increases need, positive = reduces need rate. */
export type ReduceMods = Partial<Record<'Hunger' | 'Energy' | 'Amusement' | 'Social' | 'Duty', number>>;

// ── Symptom Stage ───────────────────────────────────────────────────────

export interface SymptomStage {
  /** [min, max] seconds before this stage triggers. */
  tTimeToSymptoms: [number, number];
  /** Need modifiers for this stage. */
  tReduceMods?: ReduceMods;
  /** Log message type for this stage. */
  sSymptomLog?: string;
  /** Special effect: 'thing' | 'parasite' | 'fire' | 'death'. */
  sSpecial?: string;
  /** Speed override for this stage. */
  nSpeed?: number;
  /** Hide disease from diagnosis during this stage. */
  bHidden?: boolean;
}

// ── Malady Type ─────────────────────────────────────────────────────────

export type MaladyType = 'none' | 'MajorInjury' | 'MinorInjury' | 'DrugAffliction' | 'Disease' | 'WormParisite';

// ── Malady Definition ───────────────────────────────────────────────────

export interface MaladyDef {
  // ── Identity ──────────────────────────────────────────────
  /** Friendly name localization key. */
  sFriendlyName?: string;
  /** Description localization key. */
  sDesc?: string;
  /** Disease type category. */
  sType: MaladyType;

  // ── Duration ──────────────────────────────────────────────
  /** [min, max] duration in seconds. Very large = permanent. */
  tDurationRange: [number, number];

  // ── Severity ──────────────────────────────────────────────
  /** Difficulty tier: -2=drug, -1=special, 0=injury, 1=easy, 2=medium, 3=plague. */
  nDifficultyTier: number;
  /** How severe disease actually is (0-1). */
  nSeverity?: number;
  /** How severe it appears to player (0-1). */
  nPerceivedSeverity?: number;
  /** Extra mortality risk. */
  nAdditionalDeadliness?: number;

  // ── Contagion ─────────────────────────────────────────────
  /** Chance to become infected when exposed (0-100%). */
  nChanceOfAffliction?: number;
  /** Chance to create a new strain variant (0-100%). */
  nChanceOfNewStrain?: number;
  /** Direct contact transmission probability (0-1). */
  nChanceToInfect?: number;
  /** Spreads via sneeze range. */
  bSpreadSneeze?: boolean;
  /** Spreads via direct contact. */
  bSpreadTouch?: boolean;
  /** [min, max] seconds before becoming contagious. */
  tTimeToContagious?: [number, number];
  /** [min, max] seconds before symptoms appear. */
  tTimeToSymptoms?: [number, number];
  /** How long bacteria persist in environment (seconds). */
  nBacteriaLifetime?: number;
  /** Chance to be immune (0-1). */
  nImmuneChance?: number;
  /** Immune race types. */
  tImmuneRaces?: number[];
  /** Whether this creates strain variants. */
  bCreateStrains: boolean;

  // ── Effects ───────────────────────────────────────────────
  /** Movement speed multiplier. */
  nSpeed?: number;
  /** Top-level need modifiers (for non-staged diseases). */
  tReduceMods?: ReduceMods;
  /** Multi-stage symptom progression. */
  tSymptomStages?: SymptomStage[];
  /** Log message type for initial symptom. */
  sSymptomLog?: string;
  /** Special effect: 'thing' | 'parasite' | 'fire' | 'death'. */
  sSpecial?: string;

  // ── Treatment ─────────────────────────────────────────────
  /** Doctor skill level required for field treatment (0=any, 99999=impossible). */
  nFieldTreatSkill?: number;
  /** Forces research requirement before curable. */
  nForceResearch?: number;
  /** Character refuses doctor treatment. */
  bRefuseHeal?: boolean;
  /** Disease hidden from diagnosis. */
  bHidden?: boolean;

  // ── Flags ─────────────────────────────────────────────────
  /** Don't spawn this disease in random events. */
  bNoSpawnInEvent?: boolean;
  /** Internal: don't create instances directly. */
  bNoCreate?: boolean;
  /** Cannot be cured by any means. */
  bIncurable?: boolean;
}

// ── Default Template ────────────────────────────────────────────────────

const DEFAULT: MaladyDef = {
  sType: 'none',
  nDifficultyTier: 1,
  nBacteriaLifetime: 180,
  nChanceToInfect: 0.5,
  nImmuneChance: 0.5,
  tDurationRange: [600, 2000],
  tImmuneRaces: [],
  bSpreadSneeze: false,
  bSpreadTouch: false,
  nPerceivedSeverity: 0.2,
  nSeverity: 0.2,
  bCreateStrains: false,
  bNoCreate: true,
};

// ── All Malady Definitions ──────────────────────────────────────────────

export const MALADY_DEFS: Record<string, MaladyDef> = {
  Default: { ...DEFAULT },

  // ── Injuries (Non-Contagious) ───────────────────────────────────────
  BrokenLeg: {
    sFriendlyName: 'DISEASTYPE02TEXT',
    sDesc: 'DISEASDESC01TEXT',
    tDurationRange: [100000000, 100000000],
    nFieldTreatSkill: 0,
    nDifficultyTier: 0,
    nPerceivedSeverity: 1,
    bCreateStrains: false,
    bNoSpawnInEvent: true,
    sType: 'MajorInjury',
  },
  KnockedOut: {
    sFriendlyName: 'DISEASTYPE04TEXT',
    sDesc: 'DISEASDESC08TEXT',
    tDurationRange: [60 * 2.5, 60 * 5],
    nFieldTreatSkill: 0,
    nPerceivedSeverity: 1,
    nDifficultyTier: 0,
    bCreateStrains: false,
    bNoSpawnInEvent: true,
    sType: 'MajorInjury',
  },
  CrackedSkull: {
    sFriendlyName: 'DISEASTYPE05TEXT',
    sDesc: 'DISEASDESC11TEXT',
    tDurationRange: [100000000, 100000000],
    nFieldTreatSkill: 0,
    nDifficultyTier: 0,
    nPerceivedSeverity: 1,
    bCreateStrains: false,
    bNoSpawnInEvent: true,
    sType: 'MajorInjury',
  },
  BrokenRib: {
    sFriendlyName: 'DISEASTYPE07TEXT',
    sDesc: 'DISEASDESC12TEXT',
    tDurationRange: [100000000, 100000000],
    nFieldTreatSkill: 0,
    nDifficultyTier: 0,
    nPerceivedSeverity: 1,
    bCreateStrains: false,
    bNoSpawnInEvent: true,
    sType: 'MinorInjury',
  },
  BrokenNose: {
    sFriendlyName: 'DISEASTYPE06TEXT',
    sDesc: 'DISEASDESC13TEXT',
    tDurationRange: [100000000, 100000000],
    nFieldTreatSkill: 0,
    nDifficultyTier: 0,
    nPerceivedSeverity: 1,
    bCreateStrains: false,
    bNoSpawnInEvent: true,
    sType: 'MinorInjury',
  },
  SprainedAnkle: {
    sFriendlyName: 'DISEASTYPE08TEXT',
    sDesc: 'DISEASDESC21TEXT',
    tDurationRange: [100000000, 100000000],
    nFieldTreatSkill: 0,
    nDifficultyTier: 0,
    nPerceivedSeverity: 1,
    bCreateStrains: false,
    bNoSpawnInEvent: true,
    sType: 'MinorInjury',
    nSpeed: 0.8,
  },

  // ── Status Affliction ───────────────────────────────────────────────
  Drugged: {
    sFriendlyName: 'DISEASTYPE09TEXT',
    sDesc: 'DISEASDESC24TEXT',
    tDurationRange: [60 * 2, 60 * 3],
    tTimeToSymptoms: [0, 1],
    nFieldTreatSkill: 7,
    nDifficultyTier: -2,
    nSeverity: 1,
    nPerceivedSeverity: 0,
    bCreateStrains: false,
    bNoSpawnInEvent: true,
    sType: 'DrugAffliction',
    sSymptomLog: 'HEALTH_CITIZEN_GETTING_HIGH',
    tReduceMods: {
      Hunger: 2.3,
      Energy: -1.5,
      Amusement: -5,
      Duty: 5,
      Social: -1,
    },
  },

  // ── Contagious Diseases ─────────────────────────────────────────────

  AntisocialDisease: {
    sDesc: 'DISEASDESC05TEXT',
    nChanceOfAffliction: 50,
    nChanceOfNewStrain: 50,
    bSpreadSneeze: true,
    bSpreadTouch: true,
    nPerceivedSeverity: 0.2,
    nSeverity: 0.4,
    nDifficultyTier: 1,
    tDurationRange: [600, 2000],
    tTimeToContagious: [30, 60],
    tTimeToSymptoms: [60, 120],
    nFieldTreatSkill: 5,
    bCreateStrains: true,
    sType: 'Disease',
    sSymptomLog: 'HEALTH_CITIZEN_GETTING_ILL',
    tReduceMods: {
      Social: 0,
    },
  },

  Parasite: {
    sFriendlyName: 'DISEASTYPE03TEXT',
    sDesc: 'DISEASDESC02TEXT',
    nChanceOfAffliction: 10,
    nChanceOfNewStrain: 0,
    nSeverity: 1,
    nDifficultyTier: 1,
    nAdditionalDeadliness: 0.2,
    nPerceivedSeverity: 0.2,
    sSpecial: 'parasite',
    nFieldTreatSkill: 99999,
    bCreateStrains: false,
    sType: 'Disease',
    tDurationRange: [600, 2000],
    tSymptomStages: [
      {
        tTimeToSymptoms: [60 * 3, 60 * 8],
        tReduceMods: {
          Hunger: 1.5,
        },
        sSymptomLog: 'INFECTED_PARASITE',
      },
      {
        tTimeToSymptoms: [60 * 10, 60 * 15],
        sSpecial: 'parasite',
      },
    ],
  },

  Thing: {
    sDesc: 'DISEASTHINGTEXT',
    nSpeed: 1.5,
    nForceResearch: 2000,
    nChanceOfAffliction: 6,
    nChanceOfNewStrain: 100,
    bRefuseHeal: true,
    bHidden: true,
    bSpreadSneeze: false,
    bSpreadTouch: false,
    nSeverity: 1,
    nDifficultyTier: -1,
    nAdditionalDeadliness: 0.5,
    nPerceivedSeverity: 0.2,
    nFieldTreatSkill: 6,
    bCreateStrains: true,
    sType: 'Disease',
    tDurationRange: [600, 2000],
    tSymptomStages: [
      {
        tTimeToSymptoms: [60, 60 * 2],
        tReduceMods: {
          Hunger: 2,
          Social: 4,
        },
        sSymptomLog: 'HEALTH_CITIZEN_IS_THING',
      },
      {
        tTimeToSymptoms: [60, 60 * 4],
        sSpecial: 'thing',
      },
    ],
  },

  FirePlague: {
    sDesc: 'DISEASDESC23TEXT',
    nChanceOfAffliction: 15,
    nChanceOfNewStrain: 50,
    bSpreadSneeze: true,
    bSpreadTouch: true,
    nSeverity: 1,
    nImmuneChance: 0,
    nChanceToInfect: 0.7,
    nForceResearch: 800,
    nDifficultyTier: 3,
    tDurationRange: [600, 2000],
    tTimeToContagious: [30, 60],
    tTimeToSymptoms: [60, 120],
    nAdditionalDeadliness: 0.5,
    nPerceivedSeverity: 0.1,
    nFieldTreatSkill: 6,
    bCreateStrains: true,
    nSpeed: 1.1,
    sType: 'Disease',
    sSymptomLog: 'HEALTH_CITIZEN_GETTING_ILL',
    tSymptomStages: [
      {
        tTimeToSymptoms: [10, 60 * 10],
        tReduceMods: {
          Energy: 0.5,
          Amusement: 5,
          Duty: 0.5,
        },
        sSymptomLog: 'HEALTH_CITIZEN_GETTING_FIREPLAGUE',
      },
      {
        tTimeToSymptoms: [60 * 10, 60 * 15],
        tReduceMods: {
          Duty: 0,
          Amusement: 7,
          Energy: 2,
        },
        sSpecial: 'fire',
        sSymptomLog: 'HEALTH_CITIZEN_GETTING_FIREPLAGUE',
      },
    ],
  },

  Hyper: {
    sDesc: 'DISEASDESC10TEXT',
    nSpeed: 4,
    nChanceOfAffliction: 15,
    nChanceOfNewStrain: 50,
    bSpreadSneeze: true,
    bSpreadTouch: false,
    nSeverity: 1,
    nDifficultyTier: 2,
    tDurationRange: [600, 2000],
    tTimeToContagious: [30, 60],
    tTimeToSymptoms: [60, 120],
    nAdditionalDeadliness: 0.5,
    nPerceivedSeverity: 0.4,
    nFieldTreatSkill: 6,
    bCreateStrains: true,
    sType: 'Disease',
    tReduceMods: {
      Duty: 4,
      Hunger: 8,
      Energy: 8,
      Social: 4,
      Amusement: 4,
    },
  },

  Dysentery: {
    sDesc: 'DISEASDESC09TEXT',
    nChanceOfAffliction: 20,
    nChanceOfNewStrain: 10,
    bSpreadSneeze: false,
    bSpreadTouch: true,
    nPerceivedSeverity: 0.25,
    nSeverity: 0.75,
    nDifficultyTier: 2,
    nImmuneChance: 0.1,
    tDurationRange: [600, 2000],
    tTimeToContagious: [30, 60 * 15],
    nFieldTreatSkill: 2,
    nBacteriaLifetime: 60 * 15,
    bCreateStrains: true,
    sType: 'Disease',
    sSymptomLog: 'HEALTH_CITIZEN_GETTING_ILL',
    tSymptomStages: [
      {
        tTimeToSymptoms: [10, 60 * 2],
        tReduceMods: { Duty: 0.25, Hunger: 0 },
        sSymptomLog: 'HEALTH_CITIZEN_GETTING_ILL',
      },
      {
        tTimeToSymptoms: [60 * 2, 60 * 12],
        tReduceMods: { Duty: 0, Social: 0.2, Amusement: 0.2, Hunger: 0, Energy: 0.2 },
        sSymptomLog: 'HEALTH_CITIZEN_GETTING_ILL',
      },
      {
        tTimeToSymptoms: [60 * 12, 60 * 15],
        sSpecial: 'death',
      },
    ],
  },

  Rhinovirus: {
    sDesc: 'DISEASDESC07TEXT',
    nSpeed: 0.5,
    nChanceOfAffliction: 30,
    nChanceOfNewStrain: 50,
    nChanceToInfect: 0.5,
    bSpreadSneeze: true,
    bSpreadTouch: true,
    nPerceivedSeverity: 0.15,
    nSeverity: 0.2,
    nDifficultyTier: 1,
    nImmuneChance: 0.2,
    tDurationRange: [600, 2000],
    tTimeToContagious: [0, 10],
    nFieldTreatSkill: 2,
    nBacteriaLifetime: 60 * 15,
    bCreateStrains: true,
    sType: 'Disease',
    sSymptomLog: 'HEALTH_CITIZEN_GETTING_ILL',
    tSymptomStages: [
      {
        tTimeToSymptoms: [10, 60 * 2],
        tReduceMods: { Duty: 0.5, Energy: 0.1 },
        sSymptomLog: 'HEALTH_CITIZEN_GETTING_ILL',
      },
    ],
  },

  SpacePlague: {
    sDesc: 'DISEASDESC03TEXT',
    nChanceOfAffliction: 15,
    nChanceOfNewStrain: 50,
    nSpeed: 0.5,
    bSpreadSneeze: true,
    bSpreadTouch: true,
    nChanceToInfect: 0.9,
    nPerceivedSeverity: 0.15,
    nSeverity: 0.5,
    nDifficultyTier: 3,
    nImmuneChance: 0.1,
    tDurationRange: [600, 2000],
    tTimeToContagious: [1, 2],
    nFieldTreatSkill: 7,
    nBacteriaLifetime: 60 * 30,
    bCreateStrains: true,
    sType: 'Disease',
    sSymptomLog: 'HEALTH_CITIZEN_GETTING_ILL',
    tSymptomStages: [
      {
        tTimeToSymptoms: [10, 60 * 2],
        tReduceMods: { Duty: 0.5, Energy: 0.1 },
        sSymptomLog: 'HEALTH_CITIZEN_GETTING_ILL',
      },
      {
        tTimeToSymptoms: [60 * 2, 60 * 15],
        tReduceMods: { Duty: 0.9, Energy: 0.5, Social: 0.8, Amusement: 0.8, Hunger: 1 },
        sSymptomLog: 'HEALTH_CITIZEN_GETTING_ILL',
      },
      {
        tTimeToSymptoms: [60 * 15, 60 * 20],
        sSpecial: 'death',
      },
    ],
  },

  Hippovirus: {
    sDesc: 'DISEASDESC04TEXT',
    nChanceOfAffliction: 50,
    nChanceOfNewStrain: 20,
    bSpreadSneeze: false,
    bSpreadTouch: true,
    nPerceivedSeverity: 0.5,
    nSeverity: 0.5,
    nDifficultyTier: 3,
    tDurationRange: [600, 2000],
    tTimeToContagious: [60 * 2, 60 * 10],
    nFieldTreatSkill: 5,
    nChanceToInfect: 0.9,
    nBacteriaLifetime: 60 * 30,
    bCreateStrains: true,
    sType: 'Disease',
    sSymptomLog: 'HEALTH_CITIZEN_GETTING_ILL',
    tSymptomStages: [
      {
        tTimeToSymptoms: [10, 60 * 2],
        tReduceMods: { Duty: 0 },
        sSymptomLog: 'HEALTH_CITIZEN_GETTING_ILL',
      },
      {
        tTimeToSymptoms: [60 * 2, 60 * 10],
        tReduceMods: { Duty: 0, Social: 0.8, Amusement: 0.8, Energy: 0.5 },
        sSymptomLog: 'HEALTH_CITIZEN_GETTING_ILL',
      },
      {
        tTimeToSymptoms: [60 * 10, 60 * 11],
        sSpecial: 'death',
      },
    ],
  },

  Crazies: {
    sDesc: 'DISEASDESC14TEXT',
    nChanceOfAffliction: 15,
    nChanceOfNewStrain: 50,
    bSpreadSneeze: true,
    bSpreadTouch: true,
    nPerceivedSeverity: 0.35,
    nSeverity: 0.5,
    nDifficultyTier: 2,
    tDurationRange: [600, 2000],
    tTimeToContagious: [60 * 2, 60 * 10],
    nFieldTreatSkill: 5,
    nChanceToInfect: 0.5,
    nBacteriaLifetime: 60 * 30,
    bCreateStrains: true,
    sType: 'Disease',
    sSymptomLog: 'HEALTH_CITIZEN_GETTING_ILL',
    tSymptomStages: [
      {
        tTimeToSymptoms: [10, 60 * 2],
        tReduceMods: { Duty: 0, Social: 0, Amusement: -0.3 },
        sSymptomLog: 'HEALTH_CITIZEN_GETTING_ILL',
      },
      {
        tTimeToSymptoms: [60 * 2, 60 * 15],
        tReduceMods: { Duty: 0, Social: 0, Amusement: -0.8 },
        sSymptomLog: 'HEALTH_CITIZEN_GETTING_ILL',
      },
      {
        tTimeToSymptoms: [60 * 18, 60 * 21],
        sSpecial: 'death',
      },
    ],
  },

  ProcSyn: {
    sDesc: 'DISEASDESC22TEXT',
    nChanceOfAffliction: 10,
    nChanceOfNewStrain: 25,
    nChanceToInfect: 10,
    bSpreadSneeze: false,
    bSpreadTouch: true,
    nPerceivedSeverity: 0.1,
    nSeverity: 0.6,
    nDifficultyTier: 1,
    tDurationRange: [600, 2000],
    tTimeToContagious: [5, 10],
    tTimeToSymptoms: [2, 5],  // Note: Lua has typo "tTimeToSymptions"
    nFieldTreatSkill: 5,
    bCreateStrains: true,
    sType: 'Disease',
    sSymptomLog: 'HEALTH_CITIZEN_GETTING_ILL',
    tReduceMods: {
      Energy: -1,
      Amusement: 1,
      Social: 0,
      Hunger: 5,
      Duty: 0,
    },
  },

  Workaholic: {
    sDesc: 'DISEASDESC15TEXT',
    nChanceOfAffliction: 50,
    nChanceOfNewStrain: 30,
    bSpreadSneeze: true,
    bSpreadTouch: true,
    nPerceivedSeverity: 0.2,
    nSeverity: 0.5,
    nDifficultyTier: 1,
    tDurationRange: [600, 2000],
    tTimeToContagious: [30, 60],
    tTimeToSymptoms: [60, 120],
    nFieldTreatSkill: 5,
    bCreateStrains: true,
    sType: 'Disease',
    sSymptomLog: 'HEALTH_CITIZEN_GETTING_ILL',
    tReduceMods: {
      Duty: 3,
    },
  },

  SuperSocial: {
    sDesc: 'DISEASDESC16TEXT',
    nChanceOfAffliction: 50,
    nChanceOfNewStrain: 30,
    bSpreadSneeze: true,
    bSpreadTouch: true,
    nPerceivedSeverity: 0.2,
    nSeverity: 0.5,
    nDifficultyTier: 1,
    tDurationRange: [600, 2000],
    tTimeToContagious: [1, 10],
    tTimeToSymptoms: [10, 11],
    nFieldTreatSkill: 5,
    bCreateStrains: true,
    sType: 'Disease',
    sSymptomLog: 'HEALTH_CITIZEN_GETTING_ILL',
    tReduceMods: {
      Social: 3,
    },
  },

  NotAmused: {
    sDesc: 'DISEASDESC17TEXT',
    nChanceOfAffliction: 50,
    nChanceOfNewStrain: 30,
    bSpreadSneeze: true,
    bSpreadTouch: true,
    nPerceivedSeverity: 0.3,
    nSeverity: 0.5,
    nDifficultyTier: 1,
    tDurationRange: [600, 2000],
    tTimeToContagious: [1, 10],
    tTimeToSymptoms: [10, 11],
    nFieldTreatSkill: 5,
    bCreateStrains: true,
    sType: 'Disease',
    sSymptomLog: 'HEALTH_CITIZEN_GETTING_ILL',
    tReduceMods: {
      Amusement: 3,
    },
  },

  SleepyDisease: {
    sDesc: 'DISEASDESC18TEXT',
    nChanceOfAffliction: 50,
    nChanceOfNewStrain: 30,
    bSpreadSneeze: true,
    bSpreadTouch: true,
    nPerceivedSeverity: 0.3,
    nSeverity: 0.5,
    nDifficultyTier: 1,
    tDurationRange: [600, 2000],
    tTimeToContagious: [1, 10],
    tTimeToSymptoms: [10, 11],
    nFieldTreatSkill: 5,
    bCreateStrains: true,
    sType: 'Disease',
    sSymptomLog: 'HEALTH_CITIZEN_GETTING_ILL',
    tReduceMods: {
      Social: 0.2,
      Energy: 4,
    },
    nSpeed: 0.3,
  },

  AllBadDisease: {
    sDesc: 'DISEASDESC19TEXT',
    nChanceOfAffliction: 15,
    nChanceOfNewStrain: 90,
    nChanceToInfect: 0.5,
    bSpreadSneeze: true,
    bSpreadTouch: true,
    nPerceivedSeverity: 0.3,
    nSeverity: 0.5,
    nDifficultyTier: 2,
    tDurationRange: [600, 2000],
    tTimeToContagious: [1, 10],
    tTimeToSymptoms: [10, 11],
    nFieldTreatSkill: 5,
    bCreateStrains: true,
    sType: 'Disease',
    sSymptomLog: 'HEALTH_CITIZEN_GETTING_ILL',
    tReduceMods: {
      Energy: 4,
      Amusement: 3,
      Social: 3,
      Hunger: 8,
      Duty: 0,
    },
  },

  SocialWorm: {
    sDesc: 'DISEASDESC20TEXT',
    nChanceOfAffliction: 15,
    nChanceOfNewStrain: 70,
    nChanceToInfect: 0.9,
    nForceResearch: 2000,
    bRefuseHeal: true,
    bSpreadSneeze: false,
    bSpreadTouch: true,
    nPerceivedSeverity: 0,
    nImmuneChance: 0,
    nSeverity: 0.5,
    nDifficultyTier: -1,
    tDurationRange: [600, 2000],
    tTimeToContagious: [1, 10],
    nFieldTreatSkill: 7,
    bCreateStrains: true,
    sType: 'WormParisite',
    sSymptomLog: 'HEALTH_CITIZEN_GETTING_ILL',
    tSymptomStages: [
      {
        tTimeToSymptoms: [10, 60 * 5],
        tReduceMods: { Social: 6, Amusement: -0.3 },
        nSpeed: 1.2,
        sSymptomLog: 'WORM_STAGE_ONE',
      },
      {
        tTimeToSymptoms: [60 * 5, 60 * 20],
        tReduceMods: { Social: 12, Duty: 0, Energy: 0, Amusement: -3, Hunger: 0 },
        sSymptomLog: 'WORM_STAGE_TWO',
        nSpeed: 0.5,
        bHidden: true,
      },
      {
        tTimeToSymptoms: [60 * 20, 60 * 21],
        sSpecial: 'death',
      },
    ],
  },
};

// ── Lookup Helpers ──────────────────────────────────────────────────────

/** Get all major injury types. */
export function getInjuryList(): string[] {
  return Object.keys(MALADY_DEFS).filter(k => MALADY_DEFS[k].sType === 'MajorInjury');
}

/** Get all minor injury types. */
export function getMinorInjuryList(): string[] {
  return Object.keys(MALADY_DEFS).filter(k => MALADY_DEFS[k].sType === 'MinorInjury');
}

/** Get diseases by difficulty tier. */
export function getMaladyByTier(tier: number): string[] {
  return Object.keys(MALADY_DEFS).filter(k => {
    const d = MALADY_DEFS[k];
    return d.nDifficultyTier === tier && !d.bNoCreate && !d.bNoSpawnInEvent;
  });
}

/** Get all spawnable disease names (no injuries, no internal types). */
export function getSpawnableDiseases(): string[] {
  return Object.keys(MALADY_DEFS).filter(k => {
    const d = MALADY_DEFS[k];
    return d.sType === 'Disease' && !d.bNoCreate && !d.bNoSpawnInEvent;
  });
}

/** Check if a malady is an injury type. */
export function isInjury(sName: string): boolean {
  return MALADY_DEFS[sName]?.sType === 'MajorInjury';
}

/** Check if a malady is a minor injury type. */
export function isMinorInjury(sName: string): boolean {
  return MALADY_DEFS[sName]?.sType === 'MinorInjury';
}
