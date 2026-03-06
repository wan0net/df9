/**
 * Malady.ts — Disease system with full Lua parity.
 * Mirrors Malady.lua: strains, multi-stage symptoms, contagion, research, specials.
 */

import {
  MALADY_DEFS, type MaladyType, type ReduceMods, type SymptomStage,
  getInjuryList, getMinorInjuryList, getSpawnableDiseases,
} from './MaladyData';
import { Base } from '../core/Base';
import {
  CAUSE_OF_DEATH, STATUS_DEAD, TEAM_ID_PLAYER, DOCTOR,
} from '../characters/CharacterConstants';

// ── Forward type for Character (avoids circular import) ──────────────────

export interface CharacterLike {
  id: number;
  tileX: number;
  tileY: number;
  tStats: { nTeam: number; nStatus: number; nHP: number; nJob: number };
  bSpacewalking: boolean;
  bSpacesuit: boolean;
  maladies: MaladyInstance[];
  damage(amount: number, cause: number): void;
  kill(cause: number): void;
  currentTask: { name?: string } | null;
}

// ── Constants ────────────────────────────────────────────────────────────

export const FIELD_HP_COOLDOWN = 600;
export const CHECKUP_COOLDOWN = 240;
export const TIME_TO_WORRY = 360;
export const MIN_SPREAD_CHANCE = 0.1;
const SNEEZE_RANGE_MIN = 45;
const SNEEZE_RANGE_MAX = 90;
const LOG_RANGE_MIN = 120;
const LOG_RANGE_MAX = 360;
const SPREAD_RANGE = 5;

const INCAPACITATED_ALLOWED = new Set(['IncapacitatedOnFloor', 'GetFieldScanned']);

// ── MaladyInstance ───────────────────────────────────────────────────────

/** Active malady on a character — all def fields + runtime state. */
export interface MaladyInstance {
  // Identity
  sMaladyName: string;
  sMaladyType: string;

  // Timing (absolute game time)
  nMaladyStart: number;
  nMaladyEnd: number;
  nContagiousStart: number;
  nSymptomStart: number;

  // Runtime state
  bContagious: boolean;
  bSymptomatic: boolean;
  bDiagnosed: boolean;
  nCurrentStage: number;
  tSymptomStageStarts: number[];
  nNextSneeze: number;
  nNextLog: number;

  // Merged from def (may be overridden by stages)
  sType: MaladyType;
  nDifficultyTier: number;
  nSeverity: number;
  nPerceivedSeverity: number;
  nAdditionalDeadliness: number;
  nFieldTreatSkill: number;
  nResearchCure: number;
  nSpeed?: number;
  bRefuseHeal: boolean;
  bHidden: boolean;
  sSpecial?: string;
  tReduceMods?: ReduceMods;
  bSpreadSneeze: boolean;
  bSpreadTouch: boolean;
  nChanceToInfect: number;
  nChanceOfNewStrain: number;
  nChanceOfAffliction: number;
  nBacteriaLifetime: number;
  nImmuneChance: number;
  tSymptomStages?: SymptomStage[];
  nForceResearch?: number;
  sSymptomLog?: string;
  bCreateStrains: boolean;
  tDurationRange: [number, number];
  bNoSpawnInEvent?: boolean;
  tTimeToContagious?: [number, number];
  tTimeToSymptoms?: [number, number];
  sFriendlyName?: string;
  sDesc?: string;
}

// ── Research Entry ───────────────────────────────────────────────────────

export interface ResearchEntry {
  sMaladyName: string;
  sMaladyType: string;
  bEncountered: boolean;
  nCureProgress: number;
  nResearchCure: number;
}

// ── Module State ─────────────────────────────────────────────────────────

interface MaladyModuleState {
  tResearch: Record<string, ResearchEntry>;
  tMaladyStrains: Record<string, string[]>;
  tUsedNames: string[];
}

let tS: MaladyModuleState = {
  tResearch: {},
  tMaladyStrains: {},
  tUsedNames: [],
};
let usedNamesSet = new Set<string>();
let nElapsedTime = 0;

// ── Utilities ────────────────────────────────────────────────────────────

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Disease Name Tables (matches Lua) ────────────────────────────────────

const tDiseaseAdjectives: Record<string, string[]> = {
  default: [
    'Space', 'Cosmic', 'Lunar', 'Solar', 'Stellar', 'Astral', 'Nebular', 'Galactic',
    'Funky', 'Groovy', 'Radical', 'Tubular', 'Gnarly',
    'Purple', 'Green', 'Blue', 'Crimson', 'Golden',
    'Itchy', 'Creeping', 'Crawling', 'Bubbling', 'Oozing',
  ],
  Thing: ['Hungry', 'Angry', 'Growing', 'Mutating', 'Evolving'],
  Hyper: ['Hyper', 'Turbo', 'Mega', 'Ultra', 'Super'],
  SocialWorm: ['Social', 'Chatty', 'Friendly', 'Bubbly', 'Clingy'],
  FirePlague: ['Fire', 'Flame', 'Blaze', 'Inferno', 'Burning'],
};

const tDiseaseNouns: Record<string, string[]> = {
  default: [
    'Flu', 'Pox', 'Plague', 'Fever', 'Rot', 'Blight', 'Worm',
    'Syndrome', 'Disorder', 'Condition', 'Infection', 'Disease',
    'Malaise', 'Affliction', 'Ailment', 'Contagion',
  ],
  Thing: ['Thing', 'Blob', 'Mass', 'Growth', 'Entity'],
  Hyper: ['Rush', 'Dash', 'Sprint', 'Burst', 'Surge'],
  SocialWorm: ['Worm', 'Bug', 'Parasite', 'Critter', 'Pest'],
  FirePlague: ['Plague', 'Pox', 'Fever', 'Blight', 'Scourge'],
};

const tDiseaseSpecials = [
  'Captain Trips', 'Andromeda Strain', 'Grey Death',
  'The Wobbles', 'Space Madness', 'Cosmic Cooties',
];

const tGreekLetters = [
  'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta',
  'Eta', 'Theta', 'Iota', 'Kappa', 'Lambda', 'Mu',
];

// ── Malady Module ────────────────────────────────────────────────────────

export const Malady = {
  // ── Constants ──────────────────────────────────────────────
  FIELD_HP_COOLDOWN,
  CHECKUP_COOLDOWN,
  TIME_TO_WORRY,
  MIN_SPREAD_CHANCE,

  /** Callback: count powered AirScrubbers within range of a tile. */
  getAirScrubberCount: null as ((tx: number, ty: number, range: number) => number) | null,

  // ── State Management ───────────────────────────────────────

  reset(): void {
    tS = {
      tResearch: {},
      tMaladyStrains: {},
      tUsedNames: [],
    };
    usedNamesSet = new Set();
    nElapsedTime = 0;
    for (const key of Object.keys(MALADY_DEFS)) {
      if (!tS.tMaladyStrains[key]) {
        tS.tMaladyStrains[key] = [];
      }
    }
  },

  fromSaveData(tSaveData: Partial<MaladyModuleState> & { nElapsedTime?: number }): void {
    tS = {
      tResearch: tSaveData.tResearch ?? {},
      tMaladyStrains: tSaveData.tMaladyStrains ?? {},
      tUsedNames: tSaveData.tUsedNames ?? [],
    };
    usedNamesSet = new Set(tS.tUsedNames);
    nElapsedTime = tSaveData.nElapsedTime ?? 0;
    for (const key of Object.keys(MALADY_DEFS)) {
      if (!tS.tMaladyStrains[key]) {
        tS.tMaladyStrains[key] = [];
      }
    }
  },

  getSaveData(): Record<string, unknown> {
    return {
      tResearch: tS.tResearch,
      tMaladyStrains: tS.tMaladyStrains,
      tUsedNames: tS.tUsedNames,
      nElapsedTime,
    };
  },

  /** Update elapsed time (called from game loop). */
  updateElapsedTime(dt: number): void {
    nElapsedTime += dt;
  },

  getElapsedTime(): number {
    return nElapsedTime;
  },

  // ── Name Generation ─────────────────────────────────────────

  /** Generate a disease name for a given type. */
  getDiseaseName(sDiseaseType: string): string {
    // 2.5% chance of special name
    if (Math.random() < 0.025) {
      return pickRandom(tDiseaseSpecials);
    }

    const adjs = tDiseaseAdjectives[sDiseaseType] ?? tDiseaseAdjectives.default;
    const nouns = tDiseaseNouns[sDiseaseType] ?? tDiseaseNouns.default;

    let name = '';
    // 75% chance of a provenance prefix for special types
    if (Math.random() < 0.75 && tDiseaseAdjectives[sDiseaseType]) {
      name = pickRandom(tDiseaseAdjectives[sDiseaseType]) + ' ';
    }

    name += pickRandom(adjs) + ' ' + pickRandom(nouns);
    return name;
  },

  /** Get a unique disease name, appending Greek suffixes if needed. */
  getNewDiseaseName(sDiseaseType: string): string {
    let attempts = 0;
    let name: string;
    do {
      name = Malady.getDiseaseName(sDiseaseType);
      if (attempts > 20) {
        name += ' ' + pickRandom(tGreekLetters);
      }
      attempts++;
    } while (usedNamesSet.has(name) && attempts < 100);

    usedNamesSet.add(name);
    tS.tUsedNames.push(name);
    return name;
  },

  // ── Malady Queries ──────────────────────────────────────────

  /** Get all major injury type names. */
  getInjuryFromList: getInjuryList,

  /** Get all minor injury type names. */
  getMinorInjuryFromList: getMinorInjuryList,

  /** Get first undiagnosed symptomatic malady on a character. */
  getNextUndiagnosedMalady(rChar: CharacterLike): MaladyInstance | null {
    for (const m of rChar.maladies) {
      if (!m.bDiagnosed && m.bSymptomatic) return m;
    }
    return null;
  },

  /** Get first curable malady (diagnosed, cure discovered, skill sufficient). */
  getNextCurableMalady(rChar: CharacterLike, nSkillLevel: number): MaladyInstance | null {
    for (const m of rChar.maladies) {
      if (!m.bDiagnosed) continue;
      if (!Malady.hasDiscoveredCure(m.sMaladyName)) continue;
      if (m.nFieldTreatSkill <= nSkillLevel || m.nFieldTreatSkill === 0) {
        return m;
      }
    }
    return null;
  },

  /** Check if character is incapacitated (symptomatic major injury, not spacewalking). */
  isIncapacitated(rChar: CharacterLike): boolean {
    if (rChar.bSpacewalking) return false;
    return rChar.maladies.some(m =>
      m.sType === 'MajorInjury' && m.bSymptomatic
    );
  },

  /** Check if a malady type is an injury. */
  isInjury(sMaladyName: string): boolean {
    return MALADY_DEFS[sMaladyName]?.sType === 'MajorInjury';
  },

  /** Check if a malady type is a minor injury. */
  isMinorInjury(sMaladyName: string): boolean {
    return MALADY_DEFS[sMaladyName]?.sType === 'MinorInjury';
  },

  /** Get friendly display name for a strain. */
  getFriendlyName(sMaladyName: string): string {
    const entry = tS.tResearch[sMaladyName];
    if (entry) return sMaladyName;
    const def = MALADY_DEFS[sMaladyName];
    if (def?.sFriendlyName) return def.sFriendlyName;
    return sMaladyName;
  },

  /** Get description key for a malady type. */
  getDescription(sMaladyType: string): string {
    return MALADY_DEFS[sMaladyType]?.sDesc ?? '';
  },

  /** Get difficulty tier for a malady instance. */
  getDiseaseTier(tMalady: MaladyInstance): number {
    return tMalady.nDifficultyTier;
  },

  // ── Disease Encounter & Research ────────────────────────────

  /** Mark a disease as encountered (creates research entry if needed). */
  diseaseEncountered(tMalady: MaladyInstance, nTeam: number): void {
    const key = tMalady.sMaladyName;
    if (!tS.tResearch[key]) {
      const researchTime = tMalady.nForceResearch
        ?? Math.max(200, tMalady.nSeverity * 1000);
      tS.tResearch[key] = {
        sMaladyName: key,
        sMaladyType: tMalady.sMaladyType,
        bEncountered: false,
        nCureProgress: 0,
        nResearchCure: researchTime,
      };
    }
    if (nTeam === TEAM_ID_PLAYER) {
      tS.tResearch[key].bEncountered = true;
    }
  },

  hasEncounteredDisease(sMaladyName: string): boolean {
    return tS.tResearch[sMaladyName]?.bEncountered ?? false;
  },

  hasIdentifiedDisease(sMaladyName: string): boolean {
    return Malady.hasEncounteredDisease(sMaladyName);
  },

  /** Check if cure has been discovered (research complete or no entry). */
  hasDiscoveredCure(sMaladyName: string): boolean {
    const entry = tS.tResearch[sMaladyName];
    if (!entry) return true;
    return entry.nCureProgress >= entry.nResearchCure;
  },

  /** Add research progress. Returns true when cure is complete. */
  addResearch(sMaladyName: string, nAmount: number): boolean {
    const entry = tS.tResearch[sMaladyName];
    if (!entry) return true;
    entry.nCureProgress = Math.min(
      entry.nResearchCure,
      entry.nCureProgress + nAmount,
    );
    if (entry.nCureProgress >= entry.nResearchCure) {
      Base.incrementStat('nCuresResearched');
      return true;
    }
    return false;
  },

  /** Get all encountered diseases with completed research. */
  getCompletedResearch(): ResearchEntry[] {
    return Object.values(tS.tResearch).filter(e =>
      e.bEncountered && e.nCureProgress >= e.nResearchCure
    );
  },

  /** Get all encountered diseases with incomplete research. */
  getAvailableResearch(): ResearchEntry[] {
    return Object.values(tS.tResearch).filter(e =>
      e.bEncountered && e.nCureProgress < e.nResearchCure
    );
  },

  /** Get all research entries. */
  getResearch(): Record<string, ResearchEntry> {
    return { ...tS.tResearch };
  },

  // ── Malady Creation ────────────────────────────────────────

  /** Deep-copy def + runtime state to create an active malady instance. */
  reproduceMalady(sMaladyType: string, sMaladyName: string): MaladyInstance {
    const def = MALADY_DEFS[sMaladyType];
    if (!def) throw new Error(`Unknown malady type: ${sMaladyType}`);

    const duration = randRange(def.tDurationRange[0], def.tDurationRange[1]);
    const start = nElapsedTime;
    const end = start + duration;

    // Contagious start time
    let contagiousStart = end + 1;
    if (def.tTimeToContagious) {
      contagiousStart = start + randRange(def.tTimeToContagious[0], def.tTimeToContagious[1]);
    }

    // Symptom start time
    let symptomStart = start;
    if (def.tTimeToSymptoms) {
      symptomStart = start + randRange(def.tTimeToSymptoms[0], def.tTimeToSymptoms[1]);
    }

    const instance: MaladyInstance = {
      sMaladyName,
      sMaladyType,
      nMaladyStart: start,
      nMaladyEnd: end,
      nContagiousStart: contagiousStart,
      nSymptomStart: symptomStart,
      bContagious: false,
      bSymptomatic: false,
      bDiagnosed: false,
      nCurrentStage: -1,
      tSymptomStageStarts: [],
      nNextSneeze: start + randRange(SNEEZE_RANGE_MIN, SNEEZE_RANGE_MAX),
      nNextLog: start + randRange(LOG_RANGE_MIN, LOG_RANGE_MAX),
      sType: def.sType,
      nDifficultyTier: def.nDifficultyTier,
      nSeverity: def.nSeverity ?? 0.2,
      nPerceivedSeverity: def.nPerceivedSeverity ?? 0.2,
      nAdditionalDeadliness: def.nAdditionalDeadliness ?? 0,
      nFieldTreatSkill: def.nFieldTreatSkill ?? 99999,
      nResearchCure: def.nForceResearch ?? Math.max(200, (def.nSeverity ?? 0.2) * 1000),
      nSpeed: def.nSpeed,
      bRefuseHeal: def.bRefuseHeal ?? false,
      bHidden: def.bHidden ?? false,
      sSpecial: def.sSpecial,
      tReduceMods: def.tReduceMods ? { ...def.tReduceMods } : undefined,
      bSpreadSneeze: def.bSpreadSneeze ?? false,
      bSpreadTouch: def.bSpreadTouch ?? false,
      nChanceToInfect: def.nChanceToInfect ?? 0.5,
      nChanceOfNewStrain: def.nChanceOfNewStrain ?? 0,
      nChanceOfAffliction: def.nChanceOfAffliction ?? 0,
      nBacteriaLifetime: def.nBacteriaLifetime ?? 180,
      nImmuneChance: def.nImmuneChance ?? 0.5,
      tSymptomStages: def.tSymptomStages?.map(s => ({ ...s })),
      nForceResearch: def.nForceResearch,
      sSymptomLog: def.sSymptomLog,
      bCreateStrains: def.bCreateStrains,
      tDurationRange: [...def.tDurationRange],
      bNoSpawnInEvent: def.bNoSpawnInEvent,
      tTimeToContagious: def.tTimeToContagious,
      tTimeToSymptoms: def.tTimeToSymptoms,
      sFriendlyName: def.sFriendlyName,
      sDesc: def.sDesc,
    };

    Malady._initSymptomStarts(instance);
    return instance;
  },

  /** Set up time triggers for each symptom stage. */
  _initSymptomStarts(tMalady: MaladyInstance): void {
    if (!tMalady.tSymptomStages || tMalady.tSymptomStages.length === 0) return;

    tMalady.tSymptomStageStarts = [];
    for (const stage of tMalady.tSymptomStages) {
      const stageStart = tMalady.nMaladyStart +
        randRange(stage.tTimeToSymptoms[0], stage.tTimeToSymptoms[1]);
      tMalady.tSymptomStageStarts.push(stageStart);
    }
  },

  /** Create a new strain of a malady type. */
  _createNewStrain(
    sMaladyType: string,
    bRequireResearch = false,
    nResearchTimeOverride?: number,
  ): MaladyInstance {
    const friendlyName = Malady.getNewDiseaseName(sMaladyType);

    if (!tS.tMaladyStrains[sMaladyType]) {
      tS.tMaladyStrains[sMaladyType] = [];
    }
    const strainIndex = tS.tMaladyStrains[sMaladyType].length;
    const strainName = sMaladyType + strainIndex;
    tS.tMaladyStrains[sMaladyType].push(strainName);

    const instance = Malady.reproduceMalady(sMaladyType, strainName);

    if (bRequireResearch || instance.nForceResearch) {
      const researchTime = nResearchTimeOverride
        ?? instance.nForceResearch
        ?? Math.max(200, instance.nSeverity * 1000);
      instance.nResearchCure = researchTime;
    }

    // Store in research with friendly name
    tS.tResearch[strainName] = {
      sMaladyName: friendlyName,
      sMaladyType,
      bEncountered: false,
      nCureProgress: 0,
      nResearchCure: instance.nResearchCure,
    };

    return instance;
  },

  /** Main entry point for creating a new malady instance. */
  createNewMaladyInstance(
    sMaladyType: string,
    bUseExistingStrain = false,
    bRequireResearch = false,
    nResearchTimeOverride?: number,
  ): MaladyInstance {
    const def = MALADY_DEFS[sMaladyType];
    if (!def) throw new Error(`Unknown malady type: ${sMaladyType}`);

    // If using existing strain and strains exist, pick one
    if (bUseExistingStrain && def.bCreateStrains) {
      const strains = tS.tMaladyStrains[sMaladyType];
      if (strains && strains.length > 0) {
        const strainName = pickRandom(strains);
        return Malady.reproduceMalady(sMaladyType, strainName);
      }
    }

    // Create new strain for strain-capable diseases
    if (def.bCreateStrains) {
      return Malady._createNewStrain(sMaladyType, bRequireResearch, nResearchTimeOverride);
    }

    // Non-strain diseases use type name directly
    return Malady.reproduceMalady(sMaladyType, sMaladyType);
  },

  /** Look up a specific strain by name, creating if not found. */
  getMalady(sMaladyType: string, sMaladyName?: string): MaladyInstance {
    if (sMaladyName) {
      return Malady.reproduceMalady(sMaladyType, sMaladyName);
    }
    return Malady.createNewMaladyInstance(sMaladyType);
  },

  // ── Need Modifiers ──────────────────────────────────────────

  /** Get need reduce mod from the most severe symptomatic malady. */
  getNeedsReduceMods(rChar: CharacterLike, sNeedName: string): number | undefined {
    let worstMod: number | undefined;
    let worstSeverity = -1;
    for (const m of rChar.maladies) {
      if (!m.bSymptomatic || !m.tReduceMods) continue;
      const mod = m.tReduceMods[sNeedName as keyof ReduceMods];
      if (mod !== undefined && m.nSeverity > worstSeverity) {
        worstMod = mod;
        worstSeverity = m.nSeverity;
      }
    }
    return worstMod;
  },

  // ── Tick / Simulation ───────────────────────────────────────

  /** Tick all maladies on a character. Called from game loop. */
  tickMaladies(rChar: CharacterLike, dt: number): void {
    for (let i = rChar.maladies.length - 1; i >= 0; i--) {
      const tMalady = rChar.maladies[i];
      if (Malady._tickMalady(rChar, tMalady, dt)) {
        rChar.maladies.splice(i, 1);
      }
    }
  },

  /** Core per-malady tick. Returns true if malady should be removed. */
  _tickMalady(rChar: CharacterLike, tMalady: MaladyInstance, _dt: number): boolean {
    // Natural expiry
    if (nElapsedTime >= tMalady.nMaladyEnd) {
      return true;
    }

    // Advance symptom stages
    if (tMalady.tSymptomStages && tMalady.tSymptomStageStarts) {
      for (let i = tMalady.nCurrentStage + 1; i < tMalady.tSymptomStages.length; i++) {
        if (nElapsedTime >= tMalady.tSymptomStageStarts[i]) {
          tMalady.nCurrentStage = i;
          const stage = tMalady.tSymptomStages[i];
          if (stage.tReduceMods) tMalady.tReduceMods = { ...stage.tReduceMods };
          if (stage.sSpecial) tMalady.sSpecial = stage.sSpecial;
          if (stage.nSpeed !== undefined) tMalady.nSpeed = stage.nSpeed;
          if (stage.bHidden !== undefined) tMalady.bHidden = stage.bHidden;
          if (stage.sSymptomLog) tMalady.sSymptomLog = stage.sSymptomLog;
        }
      }
    }

    // Become contagious
    if (!tMalady.bContagious && nElapsedTime >= tMalady.nContagiousStart) {
      tMalady.bContagious = true;
    }

    // Become symptomatic
    if (!tMalady.bSymptomatic && nElapsedTime >= tMalady.nSymptomStart) {
      tMalady.bSymptomatic = true;
      Malady.diseaseEncountered(tMalady, rChar.tStats.nTeam);
    }

    // Handle specials (only when symptomatic)
    if (tMalady.bSymptomatic && tMalady.sSpecial) {
      Malady._handleSpecial(rChar, tMalady);
    }

    return false;
  },

  /** Handle special disease effects (thing, parasite, death, fire). */
  _handleSpecial(rChar: CharacterLike, tMalady: MaladyInstance): void {
    switch (tMalady.sSpecial) {
      case 'thing':
        // ~10% chance every 15s (0.67% per second at 1 tick/s)
        if (Math.random() < 0.0067) {
          Malady.spawnThing(rChar);
        }
        break;
      case 'parasite':
        if (Math.random() < 0.0067) {
          Malady.spawnMonster(rChar);
        }
        break;
      case 'death':
        rChar.kill(CAUSE_OF_DEATH.DISEASE);
        break;
      case 'fire':
        // 50% chance to catch fire on timer (60-300s intervals)
        if (nElapsedTime >= tMalady.nNextSneeze) {
          if (Math.random() < 0.5) {
            // Fire integration: would start fire at rChar's tile
            // Stub: deal damage until Fire system is wired
            rChar.damage(5, CAUSE_OF_DEATH.FIRE);
          }
          tMalady.nNextSneeze = nElapsedTime + randRange(60, 300);
        }
        break;
    }
  },

  // ── Contagion / Spread ──────────────────────────────────────

  /** Get sneeze animation name if it's time to sneeze. */
  getSymptomAnim(rChar: CharacterLike): string | null {
    for (const m of rChar.maladies) {
      if (m.bContagious && m.bSpreadSneeze && nElapsedTime >= m.nNextSneeze) {
        return 'sneeze';
      }
    }
    return null;
  },

  /** After sneeze animation, spread to nearby characters in same room. */
  playedSymptomAnim(rChar: CharacterLike, allChars: CharacterLike[]): void {
    for (const m of rChar.maladies) {
      if (!m.bContagious || !m.bSpreadSneeze) continue;

      m.nNextSneeze = nElapsedTime + randRange(SNEEZE_RANGE_MIN, SNEEZE_RANGE_MAX);

      for (const target of allChars) {
        if (target === rChar) continue;
        if (target.tStats.nStatus === STATUS_DEAD) continue;
        const dx = Math.abs(target.tileX - rChar.tileX);
        const dy = Math.abs(target.tileY - rChar.tileY);
        if (dx <= SPREAD_RANGE && dy <= SPREAD_RANGE) {
          Malady._testSpread(m, rChar, target);
        }
      }
    }
  },

  /** Test disease spread when two characters interact (touch). */
  interactedWith(rChar: CharacterLike, rTarget: CharacterLike): void {
    for (const m of rChar.maladies) {
      if (m.bContagious && m.bSpreadTouch) {
        Malady._testSpread(m, rChar, rTarget);
      }
    }
    for (const m of rTarget.maladies) {
      if (m.bContagious && m.bSpreadTouch) {
        Malady._testSpread(m, rTarget, rChar);
      }
    }
  },

  /** Core spread logic — matches Lua _testSpread. */
  _testSpread(
    tMalady: MaladyInstance,
    _rSource: CharacterLike,
    rTarget: CharacterLike,
  ): void {
    // Already infected with this strain
    if (rTarget.maladies.some(m => m.sMaladyName === tMalady.sMaladyName)) return;

    // Spacesuit blocks
    if (rTarget.bSpacesuit) return;

    // Immunity check
    if (Math.random() < tMalady.nImmuneChance) return;

    let chance = tMalady.nChanceToInfect;

    // WormParisite: doctors get 100% infection (thralls)
    if (tMalady.sType === 'WormParisite') {
      if (rTarget.tStats.nJob === DOCTOR) {
        chance = 1.0;
      }
    } else {
      // Doctors get 50% reduced chance (for Disease type)
      if (rTarget.tStats.nJob === DOCTOR) {
        chance *= 0.5;
      }
    }

    // Air scrubber environment mod (Lua Malady._getEnvironmentSpreadMod)
    // Each powered air scrubber in range halves chance, floor = MIN_SPREAD_CHANCE
    if (Malady.getAirScrubberCount) {
      const nScrubbers = Malady.getAirScrubberCount(rTarget.tileX, rTarget.tileY, 12);
      for (let i = 0; i < nScrubbers; i++) {
        chance *= 0.5;
      }
      chance = Math.max(chance, MIN_SPREAD_CHANCE);
    }

    if (Math.random() < chance) {
      let newMalady: MaladyInstance;
      if (tMalady.bCreateStrains && Math.random() * 100 < tMalady.nChanceOfNewStrain) {
        newMalady = Malady._createNewStrain(tMalady.sMaladyType);
      } else {
        newMalady = Malady.reproduceMalady(tMalady.sMaladyType, tMalady.sMaladyName);
      }
      rTarget.maladies.push(newMalady);
    }
  },

  // ── Utility AI Integration ──────────────────────────────────

  /** Check if current task should be interrupted due to incapacitation. */
  shouldInterruptCurrentTask(rChar: CharacterLike): boolean {
    if (!Malady.isIncapacitated(rChar)) return false;
    const taskName = rChar.currentTask?.name;
    if (!taskName) return false;
    return !INCAPACITATED_ALLOWED.has(taskName);
  },

  /** Modify Duty score for heal activities (matches Lua). */
  diseaseHealNeedsOverride(
    _rDoctor: CharacterLike,
    _rPatient: CharacterLike,
    bBedHeal: boolean,
    nTimeSinceCheckup: number,
  ): number {
    if (bBedHeal) return 4;
    // Field scan: 0-4 based on time since last checkup
    return Math.min(4, nTimeSinceCheckup / CHECKUP_COOLDOWN * 4);
  },

  // ── Speed Modifier ──────────────────────────────────────────

  /** Get speed modifier from all symptomatic maladies. */
  getSpeedModifier(rChar: CharacterLike): number {
    let speed = 1.0;
    for (const m of rChar.maladies) {
      if (m.bSymptomatic && m.nSpeed !== undefined) {
        speed = m.nSpeed;
      }
    }
    return speed;
  },

  // ── Monster Spawning ────────────────────────────────────────

  /** Spawn a Thing monster from infected character. */
  spawnThing(rChar: CharacterLike): void {
    if (rChar.bSpacesuit) return;
    if (rChar.tStats.nStatus === STATUS_DEAD) return;
    rChar.kill(CAUSE_OF_DEATH.THING);
    // Integration: CharacterManager.spawnHostileAt(rChar.tileX, rChar.tileY, 'Thing')
  },

  /** Spawn a Parasite monster from infected character. */
  spawnMonster(rChar: CharacterLike): void {
    if (rChar.bSpacesuit) return;
    if (rChar.tStats.nStatus === STATUS_DEAD) return;
    rChar.kill(CAUSE_OF_DEATH.PARASITE);
    // Integration: CharacterManager.spawnHostileAt(rChar.tileX, rChar.tileY, 'Parasite')
  },

  // ── Infection Entry Point ───────────────────────────────────

  /** Infect a character with a malady. Returns the instance or null. */
  infectCharacter(
    rChar: CharacterLike,
    sMaladyType: string,
    bUseExistingStrain = true,
  ): MaladyInstance | null {
    // Already infected with this type
    if (rChar.maladies.some(m => m.sMaladyType === sMaladyType)) return null;

    try {
      const instance = Malady.createNewMaladyInstance(sMaladyType, bUseExistingStrain);
      rChar.maladies.push(instance);
      return instance;
    } catch {
      return null;
    }
  },

  /** Infect a character with a random spawnable disease (Lua: immigration pre-roll). */
  infectWithRandom(rChar: CharacterLike): MaladyInstance | null {
    const diseases = getSpawnableDiseases();
    if (diseases.length === 0) return null;
    const pick = diseases[Math.floor(Math.random() * diseases.length)];
    return Malady.infectCharacter(rChar, pick);
  },

  /** Diagnose a malady (mark as identified). */
  diagnoseMalady(tMalady: MaladyInstance): void {
    tMalady.bDiagnosed = true;
  },

  /** Cure and remove a specific malady from a character. */
  cureMalady(rChar: CharacterLike, tMalady: MaladyInstance): boolean {
    const idx = rChar.maladies.indexOf(tMalady);
    if (idx >= 0) {
      rChar.maladies.splice(idx, 1);
      return true;
    }
    return false;
  },

  // ── Save/Load Helpers ───────────────────────────────────────

  /** Backfill missing default fields on saved maladies. */
  updateSavedMaladies(tMaladies: MaladyInstance[]): MaladyInstance[] {
    for (const m of tMaladies) {
      const def = MALADY_DEFS[m.sMaladyType];
      if (!def) continue;
      if (m.nSeverity === undefined) m.nSeverity = def.nSeverity ?? 0.2;
      if (m.nPerceivedSeverity === undefined) m.nPerceivedSeverity = def.nPerceivedSeverity ?? 0.2;
      if (m.bSpreadSneeze === undefined) m.bSpreadSneeze = def.bSpreadSneeze ?? false;
      if (m.bSpreadTouch === undefined) m.bSpreadTouch = def.bSpreadTouch ?? false;
      if (m.bContagious === undefined) m.bContagious = false;
      if (m.bSymptomatic === undefined) m.bSymptomatic = false;
      if (m.bDiagnosed === undefined) m.bDiagnosed = false;
      if (m.nCurrentStage === undefined) m.nCurrentStage = -1;
      if (m.tSymptomStageStarts === undefined) m.tSymptomStageStarts = [];
    }
    return tMaladies;
  },

  /** Get all strain names that have been created. */
  getAllStrains(): Record<string, string[]> {
    return { ...tS.tMaladyStrains };
  },
};
