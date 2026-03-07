/**
 * Localization.ts — Mirrors LinecodeManager.lua.
 * Loads language string tables and provides linecode lookups
 * with /placeholder/ substitution.
 */

import { enUS } from './enUS';

export type Language = 'enUS';

const LANGUAGES: Record<Language, Record<string, string>> = {
  enUS,
};

/** Human-readable names for the language selector UI. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  enUS: 'English',
};

let currentLang: Language = 'enUS';
let data: Record<string, string> = LANGUAGES[currentLang];

/**
 * Get the localized string for a linecode.
 * Supports /placeholder/ substitution via replacements map.
 * Returns empty string if linecode is null/undefined.
 * Returns "INVALID LINECODE: KEY" if key not found.
 */
export function line(linecode: string | null | undefined, replacements?: Record<string, string>): string {
  if (!linecode) return '';
  let s = data[linecode];
  if (s === undefined) return `INVALID LINECODE: ${linecode}`;
  if (replacements) {
    for (const [k, v] of Object.entries(replacements)) {
      s = s.replace(new RegExp(`/${k}/`, 'g'), v);
    }
  }
  return s;
}

/** Get a random line from an array of linecodes. */
export function randomLine(linecodes: string[], replacements?: Record<string, string>): string {
  const code = linecodes[Math.floor(Math.random() * linecodes.length)];
  return line(code, replacements);
}

/** Get current language. */
export function getLanguage(): Language {
  return currentLang;
}

/** Set language. */
export function setLanguage(lang: Language) {
  if (LANGUAGES[lang]) {
    currentLang = lang;
    data = LANGUAGES[currentLang];
  }
}

/** Get all available languages. */
export function getAvailableLanguages(): Language[] {
  return Object.keys(LANGUAGES) as Language[];
}

/** Check if a linecode exists in the current language. */
export function hasLine(linecode: string): boolean {
  return linecode in data;
}
