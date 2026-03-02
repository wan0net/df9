/**
 * CitizenNames.ts — Name pools for character generation.
 * Mirrors CitizenNames.lua with plain-text names (original uses localization codes).
 */

const FIRST_NAMES_FEMALE = [
  'Ada', 'Agnes', 'Amara', 'Bao', 'Biyu', 'Carmen', 'Devi', 'Elena',
  'Faye', 'Greta', 'Hana', 'Iris', 'Jun', 'Kira', 'Lena', 'Mira',
  'Nadia', 'Olga', 'Petra', 'Rani', 'Suki', 'Tara', 'Uma', 'Vera',
  'Wren', 'Xia', 'Yuki', 'Zara',
];

const FIRST_NAMES_MALE = [
  'Abe', 'Boris', 'Cal', 'Dex', 'Erik', 'Fang', 'Gus', 'Hiro',
  'Ivan', 'Jax', 'Knox', 'Lars', 'Max', 'Nico', 'Oleg', 'Pavel',
  'Quinn', 'Rex', 'Sven', 'Tao', 'Uri', 'Vex', 'Wolf', 'Xander',
  'Yuri', 'Zeke', 'Ash', 'Blaze', 'Cole', 'Dane', 'Eli', 'Finn',
  'Gil', 'Hawk', 'Ike', 'Jin', 'Kai', 'Leo', 'Milo', 'Nero',
  'Otto', 'Pike', 'Rho', 'Sol', 'Troy', 'Voss', 'Wade', 'Zane',
];

const LAST_NAMES = [
  'Aldrin', 'Barnes', 'Chen', 'Drake', 'Ellis', 'Frost', 'Garcia',
  'Hawke', 'Ishida', 'Jensen', 'Kim', 'Locke', 'Mercer', 'Nakamura',
  'Okafor', 'Park', 'Quinn', 'Reyes', 'Singh', 'Torres', 'Ueda',
  'Volkov', 'Wu', 'Xiao', 'Yamada', 'Zhang', 'Armstrong', 'Bishop',
  'Cruz', 'Decker', 'Engel', 'Flynn', 'Grant', 'Hayes', 'Ivankov',
  'Johansson', 'Kowalski', 'Lang', 'Markov', 'Novak', 'Ortiz',
  'Petrov', 'Rao', 'Sato', 'Tanaka', 'Ulrich', 'Vargas', 'Webb',
  'Xu', 'Yang', 'Zhukov', 'Astra', 'Bolt', 'Cain', 'Dust',
  'Edge', 'Flux', 'Grit', 'Helm', 'Ion', 'Jet', 'Keel',
  'Lux', 'Mach', 'Nox', 'Ore', 'Pulse', 'Quark', 'Rift',
  'Shard', 'Thorn', 'Umbra', 'Vane', 'Warp', 'Xenon',
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Generate a random human name. */
export function generateHumanName(): { first: string; last: string; full: string } {
  const isFemale = Math.random() < 0.5;
  const first = isFemale ? pick(FIRST_NAMES_FEMALE) : pick(FIRST_NAMES_MALE);
  const last = pick(LAST_NAMES);
  return { first, last, full: `${first} ${last}` };
}

/** Generate a random name based on species. */
export function generateName(species = 'Human'): string {
  if (species === 'Human') {
    return generateHumanName().full;
  }
  // Default fallback
  return generateHumanName().full;
}
