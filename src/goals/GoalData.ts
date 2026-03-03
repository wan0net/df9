/**
 * GoalData.ts — Goal/achievement definitions.
 * Mirrors GoalData.lua: 12 goals tracking player progress.
 */

export interface GoalDef {
  sName: string;
  friendlyName: string;
  description: string;
  /** Check function key — matched in GoalSystem. */
  checkType: string;
  /** Threshold value for completion. */
  nThreshold: number;
}

export const GOAL_DEFS: GoalDef[] = [
  {
    sName: 'FirstRoom',
    friendlyName: 'First Room',
    description: 'Build your first enclosed room',
    checkType: 'roomCount',
    nThreshold: 1,
  },
  {
    sName: 'FiveRooms',
    friendlyName: 'Expanding',
    description: 'Have 5 rooms in your base',
    checkType: 'roomCount',
    nThreshold: 5,
  },
  {
    sName: 'TenCrew',
    friendlyName: 'Growing Community',
    description: 'Have 10 crew members',
    checkType: 'population',
    nThreshold: 10,
  },
  {
    sName: 'TwentyCrew',
    friendlyName: 'Bustling Station',
    description: 'Have 20 crew members',
    checkType: 'population',
    nThreshold: 20,
  },
  {
    sName: 'FirstResearch',
    friendlyName: 'Discovery',
    description: 'Complete your first research project',
    checkType: 'researchCompleted',
    nThreshold: 1,
  },
  {
    sName: 'ThreeResearch',
    friendlyName: 'Scientific Progress',
    description: 'Complete 3 research projects',
    checkType: 'researchCompleted',
    nThreshold: 3,
  },
  {
    sName: 'FirstKill',
    friendlyName: 'First Blood',
    description: 'Defeat a hostile raider',
    checkType: 'hostilesDefeated',
    nThreshold: 1,
  },
  {
    sName: 'SurviveOneHour',
    friendlyName: 'Survivor',
    description: 'Survive for 1 hour',
    checkType: 'simTime',
    nThreshold: 3600,
  },
  {
    sName: 'Matter5000',
    friendlyName: 'Resourceful',
    description: 'Accumulate 5000 matter',
    checkType: 'matter',
    nThreshold: 5000,
  },
  {
    sName: 'AllZones',
    friendlyName: 'Full Service',
    description: 'Have at least one of every zone type',
    checkType: 'uniqueZones',
    nThreshold: 8,
  },
  {
    sName: 'SurviveSiege',
    friendlyName: 'Under Siege',
    description: 'Survive the compound event',
    checkType: 'siegeSurvived',
    nThreshold: 1,
  },
  {
    sName: 'HighMorale',
    friendlyName: 'Happy Station',
    description: 'All crew members have morale above 50',
    checkType: 'allMoraleAbove',
    nThreshold: 50,
  },
];
