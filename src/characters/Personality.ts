/**
 * Personality.ts — Character personality trait generation.
 * Mirrors CharacterConstants.lua PERSONALITY_TRAITS and PERSONALITY_LIKELIHOOD.
 */

import { PERSONALITY_LIKELIHOOD } from './CharacterConstants';

/** Personality trait values for a character. */
export interface PersonalityTraits {
  nBravery: number;       // 0-1, 1 = brave
  nGregariousness: number; // 0-1, 1 = gregarious
  nChattiness: number;    // 0-1, 1 = chatty
  nNeatness: number;      // 0-1, 1 = neat
  bEmoticon: boolean;     // uses emoticons
  nTemper: number;        // 0-1, 1 = angry
  nWorkEthic: number;     // 0-1, 1 = hardworking
  bXenophobe: boolean;    // fear of aliens
  bAnxious: boolean;      // worrier
  bGourmand: boolean;     // food snob
  bJoker: boolean;        // joke teller
  bSentimental: boolean;  // nostalgic
  bCompetitive: boolean;  // wants to win
  bLowerCase: boolean;    // types in lowercase
  bHipster: boolean;      // cares about being cool
  nPositivity: number;    // 0-1, 1 = positive
  nAuthoritarian: number; // 0-1, 1 = obedient
}

/** Generate random personality traits for a new character. */
export function generatePersonality(): PersonalityTraits {
  return {
    nBravery: Math.random(),
    nGregariousness: Math.random(),
    nChattiness: Math.random(),
    nNeatness: Math.random(),
    bEmoticon: Math.random() < (PERSONALITY_LIKELIHOOD.bEmoticon ?? 0.1),
    nTemper: Math.random(),
    nWorkEthic: Math.random(),
    bXenophobe: Math.random() < (PERSONALITY_LIKELIHOOD.bXenophobe ?? 0.1),
    bAnxious: Math.random() < 0.2,
    bGourmand: Math.random() < 0.15,
    bJoker: Math.random() < (PERSONALITY_LIKELIHOOD.bJoker ?? 0.2),
    bSentimental: Math.random() < 0.2,
    bCompetitive: Math.random() < (PERSONALITY_LIKELIHOOD.bCompetitive ?? 0.3),
    bLowerCase: Math.random() < (PERSONALITY_LIKELIHOOD.bLowerCase ?? 0.05),
    bHipster: Math.random() < (PERSONALITY_LIKELIHOOD.bHipster ?? 0.2),
    nPositivity: Math.random(),
    nAuthoritarian: Math.random(),
  };
}
