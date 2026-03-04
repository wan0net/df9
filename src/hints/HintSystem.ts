/**
 * HintSystem.ts — Contextual tutorial hints.
 * Mirrors HintChecks.lua: ~25 conditions checked periodically, shown once each.
 * Hints are sorted by priority (0 = critical, 3 = informational).
 */

import { Base } from '../core/Base';
import {
  BUILDER, MINER, TECHNICIAN, DOCTOR, BOTANIST, SCIENTIST,
} from '../characters/CharacterConstants';

/** Matter threshold for the low-matter warning (from Lua LOW_MATTER_WARNING). */
const LOW_MATTER_WARNING = 500;
/** Fraction of population in low-O2 rooms that triggers the warning. */
const LOW_OXYGEN_FRACTION_THRESHOLD = 0.5;
/** Max damaged objects per technician before showing warning. */
const DAMAGED_OBJECTS_PER_TECH = 3;

export interface HintProviders {
  // ── Basics ───────────────────────────────────────────────────
  /** Whether any enclosed (non-breached) rooms exist. */
  hasEnclosedRooms: () => boolean;
  /** Whether any room has a non-PLAIN zone assigned. */
  hasZonedRoom: () => boolean;
  /** Whether research has been started or completed at least once. */
  hasStartedResearch: () => boolean;
  /** Whether any object has been placed and built. */
  hasBuiltObject: () => boolean;
  /** Current player population count. */
  getPopulation: () => number;
  /** Whether any hostile characters are present on the station. */
  hasHostiles: () => boolean;
  // ── Resources ────────────────────────────────────────────────
  /** Current matter balance. */
  getMatter: () => number;
  // ── Jobs ─────────────────────────────────────────────────────
  /**
   * Count of living (non-incapacitated) player characters assigned to a given job.
   * Pass a job constant from CharacterConstants.
   */
  getJobCount: (job: number) => number;
  // ── Construction ─────────────────────────────────────────────
  /** Whether any build (tile/object) orders are pending in the CommandQueue. */
  hasPendingBuildOrders: () => boolean;
  /** Whether any mine orders are pending in the CommandQueue. */
  hasPendingMineOrders: () => boolean;
  /** Count of built objects whose nCondition is below the damaged threshold. */
  getDamagedObjectCount: () => number;
  // ── Objects ──────────────────────────────────────────────────
  /** Whether at least one built object with the given sName exists. */
  hasBuiltObjectType: (sName: string) => boolean;
  /**
   * Whether at least one built object with the given sFunctionality string exists.
   * Uses EnvObjectData.getObjectsByFunctionality() under the hood.
   */
  hasBuiltObjectFunc: (func: string) => boolean;
  // ── Environment ──────────────────────────────────────────────
  /**
   * Fraction (0..1) of the living player population currently in rooms with
   * oxygen below OXYGEN_LOW (400 units).
   */
  getLowOxygenFraction: () => number;
  /** Whether any player room has a power deficit (nPowerSupply < 0). */
  hasRoomsWithPowerDeficit: () => boolean;
  /** Whether ALL player rooms lack power generation (nPowerOutput === 0). */
  allRoomsLackPower: () => boolean;
  // ── Characters ───────────────────────────────────────────────
  /** Whether any player character is sick (STATUS_SICK or STATUS_ILL). */
  hasSickCharacter: () => boolean;
  /** Whether any player character is incapacitated or in critical state. */
  hasIncapacitatedCharacter: () => boolean;
  /** Whether any player character has a hunger need below the starvation threshold. */
  hasStarvingCitizen: () => boolean;
  /** Whether any Miner is currently carrying a Rock item. */
  hasMinerWithRocks: () => boolean;
  // ── Pickups / Zones ──────────────────────────────────────────
  /** Whether any un-collected Corpse pickup exists on the station. */
  hasCorpse: () => boolean;
  /** Whether any room is zoned as INFIRMARY. */
  hasHospitalZone: () => boolean;
  /** Whether any room is zoned as GARDEN. */
  hasGardenZone: () => boolean;
  /** Whether any garden plants (HydroPlant / space_tree) are placed and built. */
  hasGardenPlants: () => boolean;
  /** Whether a research project is currently active. */
  hasActiveResearch: () => boolean;
}

/** Priority levels — lower number = more urgent. */
const enum HintPriority {
  Critical = 0,
  High = 1,
  Medium = 2,
  Low = 3,
}

interface HintDef {
  id: string;
  priority: HintPriority;
  message: string;
  check: (p: HintProviders) => boolean;
}

/**
 * All hint definitions, sorted by priority ascending so the most critical
 * warnings are considered first.
 */
const HINTS: HintDef[] = [
  // ── Critical (0) ────────────────────────────────────────────
  {
    id: 'everyone_dead',
    priority: HintPriority.Critical,
    message: 'Warning: All of your crew are dead. The station has been lost.',
    check: (p) => p.getPopulation() === 0,
  },
  {
    id: 'low_oxygen',
    priority: HintPriority.Critical,
    message: 'Warning: Low oxygen levels detected! Over half of your crew is suffocating. Build more Oxygen Recyclers.',
    check: (p) => p.getLowOxygenFraction() >= LOW_OXYGEN_FRACTION_THRESHOLD,
  },
  // ── High (1) ─────────────────────────────────────────────────
  {
    id: 'rooms_but_no_oxygen',
    priority: HintPriority.High,
    message: 'Tip: You have enclosed rooms but no oxygen supply. Build an Oxygen Recycler in a Life Support zone to breathe.',
    check: (p) => p.hasEnclosedRooms() && !p.hasBuiltObjectFunc('OxygenRecycler'),
  },
  {
    id: 'no_power',
    priority: HintPriority.High,
    message: 'Warning: No power! Your station has no generators running. Build a Generator in a Reactor zone.',
    check: (p) => p.hasEnclosedRooms() && p.allRoomsLackPower(),
  },
  {
    id: 'starving_no_food',
    priority: HintPriority.High,
    message: 'Warning: Citizens are starving! Build a Fridge and Stove in a Pub zone and assign a Bartender.',
    check: (p) => p.hasStarvingCitizen() && !p.hasBuiltObjectFunc('Fridge') && !p.hasBuiltObjectFunc('Stove'),
  },
  {
    id: 'illness_no_doctor',
    priority: HintPriority.High,
    message: 'Warning: Crew members are ill and no Doctor is on duty! Assign a Doctor to treat them.',
    check: (p) => p.hasSickCharacter() && p.getJobCount(DOCTOR) === 0,
  },
  {
    id: 'corpse_no_refinery',
    priority: HintPriority.High,
    message: 'Tip: There are unrecovered corpses. Build a Refinery to recycle them back into matter.',
    check: (p) => p.hasCorpse() && !p.hasBuiltObjectFunc('refinery'),
  },
  {
    id: 'no_builders',
    priority: HintPriority.High,
    message: 'Tip: You have pending construction orders but no Builders assigned. Assign crew as Builders.',
    check: (p) => p.hasPendingBuildOrders() && p.getJobCount(BUILDER) === 0,
  },
  // ── Medium (2) ───────────────────────────────────────────────
  {
    id: 'combat',
    priority: HintPriority.Medium,
    message: 'Warning: Hostile raiders detected! Assign crew as Security personnel to defend the station.',
    check: (p) => p.hasHostiles(),
  },
  {
    id: 'low_matter',
    priority: HintPriority.Medium,
    message: `Tip: Matter reserves are critically low (below ${LOW_MATTER_WARNING}). Assign Miners and build Refineries to gather more.`,
    check: (p) => p.getMatter() < LOW_MATTER_WARNING && p.getPopulation() > 0,
  },
  {
    id: 'not_enough_technicians',
    priority: HintPriority.Medium,
    message: 'Tip: Too many damaged objects for your Technicians to repair. Assign more crew as Technicians.',
    check: (p) => {
      const techs = p.getJobCount(TECHNICIAN);
      const damaged = p.getDamagedObjectCount();
      return damaged > 0 && damaged > techs * DAMAGED_OBJECTS_PER_TECH;
    },
  },
  {
    id: 'no_miners',
    priority: HintPriority.Medium,
    message: 'Tip: You have pending mine orders but no Miners assigned. Assign crew as Miners.',
    check: (p) => p.hasPendingMineOrders() && p.getJobCount(MINER) === 0,
  },
  {
    id: 'no_refineries',
    priority: HintPriority.Medium,
    message: 'Tip: Miners are collecting rocks but there is no Refinery to process them. Build a Refinery zone.',
    check: (p) => p.hasMinerWithRocks() && !p.hasBuiltObjectFunc('refinery'),
  },
  {
    id: 'patient_no_doctor',
    priority: HintPriority.Medium,
    message: 'Tip: Citizens are waiting in the Infirmary but there is no Doctor. Assign a Doctor to help them.',
    check: (p) => p.hasHospitalZone() && p.hasIncapacitatedCharacter() && p.getJobCount(DOCTOR) === 0,
  },
  {
    id: 'research_no_desks',
    priority: HintPriority.Medium,
    message: 'Tip: Research is active but there are no Research Desks! Place desks in a Research Lab zone.',
    check: (p) => p.hasActiveResearch() && !p.hasBuiltObjectFunc('ResearchDesk'),
  },
  {
    id: 'research_no_scientists',
    priority: HintPriority.Medium,
    message: 'Tip: Research is queued but no Scientists are assigned. Assign crew as Scientists to progress.',
    check: (p) => p.hasActiveResearch() && p.getJobCount(SCIENTIST) === 0,
  },
  {
    id: 'low_power',
    priority: HintPriority.Medium,
    message: 'Tip: Some rooms have insufficient power. Build more Generators or reduce power draw.',
    check: (p) => p.hasRoomsWithPowerDeficit() && !p.allRoomsLackPower(),
  },
  // ── Low / Informational (3) ───────────────────────────────────
  {
    id: 'build_room',
    priority: HintPriority.Low,
    message: 'Tip: Press C to enter room build mode. Drag to create an enclosed room for your crew.',
    check: (p) => !p.hasEnclosedRooms() && p.getPopulation() > 0,
  },
  {
    id: 'zone_room',
    priority: HintPriority.Low,
    message: 'Tip: Press Z to assign zones to rooms. Zones determine what activities happen there.',
    check: (p) => p.hasEnclosedRooms() && !p.hasZonedRoom(),
  },
  {
    id: 'place_objects',
    priority: HintPriority.Low,
    message: 'Tip: Press P to place objects. Generators provide power, Oxygen Recyclers supply air.',
    check: (p) => p.hasZonedRoom() && !p.hasBuiltObject(),
  },
  {
    id: 'research',
    priority: HintPriority.Low,
    message: 'Tip: Assign a Scientist to a Research Lab zone to unlock new technologies.',
    check: (p) => p.hasBuiltObject() && !p.hasStartedResearch(),
  },
  {
    id: 'research_ready_no_research',
    priority: HintPriority.Low,
    message: 'Tip: You have Scientists and Research Desks — open the Research menu to queue a project.',
    check: (p) =>
      p.getJobCount(SCIENTIST) > 0 &&
      p.hasBuiltObjectFunc('ResearchDesk') &&
      !p.hasActiveResearch(),
  },
  {
    id: 'garden_no_botanist',
    priority: HintPriority.Low,
    message: 'Tip: You have garden plants but no Botanist assigned. Plants will die without care.',
    check: (p) => p.hasGardenPlants() && p.getJobCount(BOTANIST) === 0,
  },
  {
    id: 'garden_zone_no_botanist',
    priority: HintPriority.Low,
    message: 'Tip: You have a Garden zone. Assign a Botanist and build Hydroponic Plants to grow food.',
    check: (p) => p.hasGardenZone() && !p.hasGardenPlants() && p.getJobCount(BOTANIST) === 0,
  },
];

// Sort by priority ascending (critical first) to ensure important hints are
// considered first when scanning for the next unseen hint.
HINTS.sort((a, b) => a.priority - b.priority);

export class HintSystem {
  private shownHints: Set<string> = new Set();
  private providers: HintProviders;
  private tickAccum = 0;
  /** Check interval in seconds (mirrors Lua hint tick rate). */
  private static readonly CHECK_INTERVAL = 10;

  constructor(providers: HintProviders) {
    this.providers = providers;
  }

  update(dt: number) {
    this.tickAccum += dt;
    if (this.tickAccum < HintSystem.CHECK_INTERVAL) return;
    this.tickAccum -= HintSystem.CHECK_INTERVAL;

    for (const hint of HINTS) {
      if (this.shownHints.has(hint.id)) continue;
      if (hint.check(this.providers)) {
        this.shownHints.add(hint.id);
        Base.addAlert('hint', hint.message);
        break; // One hint per check cycle
      }
    }
  }

  getShownHints(): string[] {
    return Array.from(this.shownHints);
  }

  /** Total number of hint definitions (for test assertions). */
  getTotalHints(): number {
    return HINTS.length;
  }

  getSaveData() {
    return Array.from(this.shownHints);
  }

  loadSaveData(data: string[]) {
    this.shownHints = new Set(data);
  }
}
