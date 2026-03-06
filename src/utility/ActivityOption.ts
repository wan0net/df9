/**
 * ActivityOption.ts — Activity option for utility AI evaluation.
 * Mirrors Utility/ActivityOption.lua: needs advertisement, utility scoring,
 * prerequisites, tags, personality gates, priority levels.
 */

import type { Task, NeedAdvertisement } from './Task';
import type { Character } from '../characters/Character';
import { TEAM_ID_PLAYER, STARTING_AFFINITY, ACTIVITY_AFFINITY_CHANGE_PCT } from '../characters/CharacterConstants';
import { isoSquareDist } from '../core/MiscUtil';

/** Distance penalty factor for utility scoring. */
const DISTANCE_PENALTY_FACTOR = 0.05;
const HIGH_DIST_PENALTY_FACTOR = 0.15;

/** Priority levels matching Lua tPriorities. */
export const PRIORITY = {
  NO_ACTIVITY: -1,
  NORMAL: 0,
  SURVIVAL_LOW: 1,
  SURVIVAL_NORMAL: 2,
  PUPPET: 3,
} as const;

export type PriorityLevel = typeof PRIORITY[keyof typeof PRIORITY];

/** Prerequisites that must be met for an activity to be available. */
export interface ActivityPrereqs {
  EmptyHands?: boolean;
  EmptyHandsOrCuffed?: boolean;
  Spacewalking?: boolean;
  WearingSuit?: boolean;
  HeldItem?: string;        // Must be holding a specific item
  Cuffed?: boolean;
  NonThreatening?: boolean;
}

/** Tags controlling when/where an activity is valid. */
export interface ActivityTags {
  WorkShift?: boolean;       // Only available when on shift
  DestOwned?: boolean;       // Target must be in owned (player) territory
  DestSafe?: boolean | 'AllowAirlock'; // Target must be safe (no breach/fire/hostiles)
  Job?: number;              // Restricted to specific job
  HighDistPenalty?: boolean; // Higher distance penalty
  NonThreatening?: boolean;  // Only for non-threatening characters
  AllowHostilePathing?: boolean; // Allow pathing through hostile territory
}

/** Personality gates: character trait must be within [min, max] to use this activity. */
export interface PersonalityGates {
  nBravery?: [number, number];
  nTemper?: [number, number];
  nWorkEthic?: [number, number];
  nGregariousness?: [number, number];
}

export class ActivityOption {
  /** The task this option would create. */
  task: Task;

  /** Target tile for distance calculation. */
  targetX: number;
  targetY: number;

  /** Base priority bonus (from ScoreMods.BaseScore in Lua). */
  basePriority: number;

  /** Priority level (NORMAL, SURVIVAL_LOW, SURVIVAL_NORMAL, PUPPET). */
  priorityLevel: PriorityLevel;

  /** Minimum score threshold (from ScoreMods.MinimumScore). */
  minimumScore: number;

  /** Prerequisites for this activity. */
  prerequisites: ActivityPrereqs;

  /** Tags controlling availability. */
  tags: ActivityTags;

  /** Personality trait gates. */
  personalityGates: PersonalityGates;

  constructor(
    task: Task,
    targetX: number,
    targetY: number,
    basePriority = 0,
    options?: {
      priorityLevel?: PriorityLevel;
      minimumScore?: number;
      prerequisites?: ActivityPrereqs;
      tags?: ActivityTags;
      personalityGates?: PersonalityGates;
    },
  ) {
    this.task = task;
    this.targetX = targetX;
    this.targetY = targetY;
    this.basePriority = basePriority;
    this.priorityLevel = options?.priorityLevel ?? PRIORITY.NORMAL;
    this.minimumScore = options?.minimumScore ?? 0;
    this.prerequisites = options?.prerequisites ?? {};
    this.tags = options?.tags ?? {};
    this.personalityGates = options?.personalityGates ?? {};
  }

  /**
   * Check if this activity's prerequisites are met by the character.
   * Returns false if any prerequisite fails.
   */
  meetsPrerequisites(character: Character): boolean {
    const p = this.prerequisites;

    if (p.EmptyHands && character.heldItem !== null) return false;
    if (p.EmptyHandsOrCuffed && character.heldItem !== null && !character.bCuffed) return false;
    if (p.Spacewalking && !character.bSpacewalking) return false;
    if (p.WearingSuit && !character.bSpacesuit) return false;
    if (p.HeldItem && character.heldItem !== p.HeldItem) return false;
    if (p.Cuffed && !character.bCuffed) return false;
    if (p.NonThreatening && character.tStats.nTeam !== TEAM_ID_PLAYER) return false;

    return true;
  }

  /**
   * Check if this activity's tags are met.
   */
  meetsTags(character: Character): boolean {
    const t = this.tags;

    // Work shift check: if tagged, only available when on shift
    if (t.WorkShift && !character.wantsWorkShiftTask()) return false;

    // Job restriction: only available to characters with matching job
    if (t.Job !== undefined && character.getJob() !== t.Job) return false;

    return true;
  }

  /**
   * Check if this activity's personality gates are met.
   */
  meetsPersonalityGates(character: Character): boolean {
    const g = this.personalityGates;
    const p = character.tStats.personality;

    if (g.nBravery) {
      if (p.nBravery < g.nBravery[0] || p.nBravery > g.nBravery[1]) return false;
    }
    if (g.nTemper) {
      if (p.nTemper < g.nTemper[0] || p.nTemper > g.nTemper[1]) return false;
    }
    if (g.nWorkEthic) {
      if (p.nWorkEthic < g.nWorkEthic[0] || p.nWorkEthic > g.nWorkEthic[1]) return false;
    }
    if (g.nGregariousness) {
      if (p.nGregariousness < g.nGregariousness[0] || p.nGregariousness > g.nGregariousness[1]) return false;
    }

    return true;
  }

  /**
   * Evaluate the utility of this option for a character.
   * Higher score = character wants this more.
   * Considers need satisfaction, distance penalty, and priority level.
   */
  evaluate(character: Character): number {
    // Check prerequisites, tags, personality gates
    if (!this.meetsPrerequisites(character)) return -Infinity;
    if (!this.meetsTags(character)) return -Infinity;
    if (!this.meetsPersonalityGates(character)) return -Infinity;

    let score = this.basePriority;

    // Priority level bonus: survival activities get a large boost
    switch (this.priorityLevel) {
      case PRIORITY.PUPPET:          score += 10000; break;
      case PRIORITY.SURVIVAL_NORMAL: score += 1000; break;
      case PRIORITY.SURVIVAL_LOW:    score += 500; break;
      // NORMAL: no bonus
    }

    // Need satisfaction utility
    const advertisedNeeds = this.task.getAdvertisedNeeds();
    for (const adv of advertisedNeeds) {
      const currentValue = this.getNeedValue(character, adv.need);
      // Lower current value = higher utility for satisfying it
      // Needs range -100..+100, so urgency maps to 0..1 across full range
      const urgency = Math.max(0, 100 - currentValue) / 200;
      score += urgency * adv.amount;
    }

    // Distance penalty
    const dist = isoSquareDist(character.tileX, character.tileY, this.targetX, this.targetY);
    const distFactor = this.tags.HighDistPenalty ? HIGH_DIST_PENALTY_FACTOR : DISTANCE_PENALTY_FACTOR;
    score -= dist * distFactor;

    // Activity affinity modifier (Lua: ±20% from topic affinity)
    const activityAff = character.getAffinityForActivity(this.task.name);
    if (activityAff !== null) {
      const affinityBonus = activityAff / STARTING_AFFINITY;
      score += score * (ACTIVITY_AFFINITY_CHANGE_PCT * affinityBonus);
    }

    // Minimum score enforcement
    if (score < this.minimumScore) return -Infinity;

    return score;
  }

  private getNeedValue(character: Character, need: string): number {
    switch (need) {
      case 'oxygen': return character.needs.oxygen;
      case 'hunger': return character.needs.hunger;
      case 'energy': return character.needs.energy;
      case 'amusement': return character.needs.amusement;
      case 'social': return character.needs.social;
      case 'duty': return character.needs.duty;
      default: return 100;
    }
  }
}
