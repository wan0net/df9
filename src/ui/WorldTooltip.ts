/**
 * Structured world-tooltip rows mirroring Character/Room/EnvObject
 * getToolTipTextInfos in the original Lua UI.
 */

import type { Character } from '../characters/Character';
import {
  BARTENDER,
  BOTANIST,
  BUILDER,
  CAUSE_OF_DEATH,
  DOCTOR,
  EMERGENCY,
  JANITOR,
  MINER,
  NEEDS_HUNGER_STARVATION,
  OXYGEN_PER_SECOND,
  RAIDER,
  RACE_KILLBOT,
  SCIENTIST,
  SPACESUIT_MAX_OXYGEN,
  STATUS_DEAD,
  STATUS_HEALTHY,
  STATUS_HURT,
  STATUS_ILL,
  STATUS_INCAPACITATED,
  STATUS_INJURED,
  STATUS_SCUFFED_UP,
  STATUS_SICK,
  STATUS_DRUGGED,
  TEAM_ID_PLAYER,
  TECHNICIAN,
  TRADER,
  UNEMPLOYED,
  OXYGEN_SUFFOCATION_UNTIL_DEATH,
} from '../characters/CharacterConstants';
import type { EnvObject } from '../envobjects/EnvObject';
import type { Room } from '../rooms/Room';
import { formatTime } from '../core/MiscUtil';
import { line } from '../localization/Localization';
import { ZoneType, ZONE_SPRITES } from '../world/ZoneType';

export const TOOLTIP_AMBER = '#dfa200';
export const TOOLTIP_RED = '#ff3d00';
export const TOOLTIP_GREEN = '#a5d318';

export interface WorldTooltipRow {
  text: string;
  icon?: string;
  color?: string;
  iconColor?: string;
  iconMaskMode?: 'alpha' | 'luminance';
}

const INSPECTOR_ICON = (name: string) => `assets/ui/inspector/${name}.png`;
const JOB_ICON = (name: string) => `assets/ui/hud/${name}.png`;

const JOB_ICONS: Record<number, string> = {
  [UNEMPLOYED]: JOB_ICON('ui_jobs_iconJobUnemployed'),
  [BUILDER]: JOB_ICON('ui_jobs_iconJobBuilder'),
  [TECHNICIAN]: JOB_ICON('ui_jobs_iconJobTechnician'),
  [MINER]: JOB_ICON('ui_jobs_iconJobMiner'),
  [EMERGENCY]: JOB_ICON('ui_jobs_iconJobResponse'),
  [RAIDER]: JOB_ICON('ui_jobs_iconJobUnemployed'),
  [BARTENDER]: JOB_ICON('ui_jobs_iconJobBarkeep'),
  [BOTANIST]: JOB_ICON('ui_jobs_iconJobBotanist'),
  [SCIENTIST]: JOB_ICON('ui_jobs_iconJobScientist'),
  [DOCTOR]: JOB_ICON('ui_jobs_iconJobDoctor'),
  [JANITOR]: JOB_ICON('JanitorIcon_small'),
  [TRADER]: JOB_ICON('ui_jobs_iconJobUnemployed'),
};

const HEALTH_LINES: Record<number, string> = {
  [STATUS_HEALTHY]: 'INSPEC022TEXT',
  [STATUS_HURT]: 'INSPEC021TEXT',
  [STATUS_SICK]: 'INSPEC009TEXT',
  [STATUS_DEAD]: 'INSPEC010TEXT',
  [STATUS_INCAPACITATED]: 'INSPEC142TEXT',
  [STATUS_ILL]: 'INSPEC143TEXT',
  [STATUS_SCUFFED_UP]: 'INSPEC151TEXT',
  [STATUS_INJURED]: 'INSPEC201TEXT',
  [STATUS_DRUGGED]: 'INSPEC202TEXT',
};

const ROBOT_HEALTH_LINES: Record<number, string> = {
  [STATUS_HEALTHY]: 'INSPEC089TEXT',
  [STATUS_HURT]: 'INSPEC090TEXT',
  [STATUS_SICK]: 'INSPEC092TEXT',
  [STATUS_DEAD]: 'INSPEC091TEXT',
  [STATUS_INCAPACITATED]: 'INSPEC142TEXT',
  [STATUS_ILL]: 'INSPEC142TEXT',
  [STATUS_SCUFFED_UP]: 'INSPEC151TEXT',
  [STATUS_INJURED]: 'INSPEC201TEXT',
};

const MORALE_LINES: { min: number; linecode: string }[] = [
  { min: 75, linecode: 'INSPEC069TEXT' },
  { min: 50, linecode: 'INSPEC067TEXT' },
  { min: 25, linecode: 'INSPEC024TEXT' },
  { min: 5, linecode: 'INSPEC066TEXT' },
  { min: -5, linecode: 'INSPEC025TEXT' },
  { min: -25, linecode: 'INSPEC065TEXT' },
  { min: -50, linecode: 'INSPEC023TEXT' },
  { min: -75, linecode: 'INSPEC064TEXT' },
  { min: -100, linecode: 'INSPEC068TEXT' },
];

const ANGER_LINES: { min: number; linecode: string }[] = [
  { min: 90, linecode: 'INSPEC187TEXT' },
  { min: 80, linecode: 'INSPEC185TEXT' },
  { min: 70, linecode: 'INSPEC186TEXT' },
  { min: 60, linecode: 'INSPEC184TEXT' },
  { min: 50, linecode: 'INSPEC183TEXT' },
  { min: 40, linecode: 'INSPEC182TEXT' },
  { min: 30, linecode: 'INSPEC181TEXT' },
  { min: 20, linecode: 'INSPEC180TEXT' },
  { min: 10, linecode: 'INSPEC179TEXT' },
  { min: 0, linecode: 'INSPEC178TEXT' },
];

function lerpHex(a: string, b: string, t: number): string {
  const parse = (value: string) => [1, 3, 5].map(i => Number.parseInt(value.slice(i, i + 2), 16));
  const aa = parse(a);
  const bb = parse(b);
  const rgb = aa.map((v, i) => Math.round(v + (bb[i] - v) * Math.max(0, Math.min(1, t))));
  return `#${rgb.map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

function healthText(char: Character): string {
  const status = char.tStats.nStatus;
  const table = char.getRace() === RACE_KILLBOT ? ROBOT_HEALTH_LINES : HEALTH_LINES;
  let text = line(table[status] ?? 'INSPEC022TEXT');
  if (char.getRace() === RACE_KILLBOT) return text;

  const starving = char.needs.hunger < NEEDS_HUNGER_STARVATION;
  if (starving) {
    const starvingText = line('INSPEC088TEXT');
    text = status === STATUS_HURT ? `${text}, ${starvingText}` : starvingText;
  }
  if (char.suffocationTime > 0) {
    const seconds = Math.max(0, OXYGEN_SUFFOCATION_UNTIL_DEATH - char.suffocationTime);
    const suffocating = `${line('INSPEC107TEXT')} (${formatTime(seconds)})`;
    text = status === STATUS_HURT || starving ? `${text}, ${suffocating}` : suffocating;
  }
  return text;
}

function moraleText(char: Character): string {
  if (!char.isAlive() || char.tStats.nTeam !== TEAM_ID_PLAYER) return line('INSPEC079TEXT');
  if (char.bViolentRampage) return line('INSPEC189TEXT');
  if (char.bNonviolentRampage) return line('INSPEC190TEXT');
  const morale = MORALE_LINES.find(entry => char.nMorale >= entry.min);
  let text = line(morale?.linecode ?? 'INSPEC068TEXT');
  if (char.nAnger > 0) {
    const anger = ANGER_LINES.find(entry => char.nAnger >= entry.min);
    if (anger) text += `, ${line(anger.linecode)}`;
  }
  return text;
}

function deathCauseText(cause: number): string {
  switch (cause) {
    case CAUSE_OF_DEATH.SUFFOCATION: return line('INSPEC098TEXT');
    case CAUSE_OF_DEATH.STARVATION: return line('INSPEC099TEXT');
    case CAUSE_OF_DEATH.FIRE: return line('INSPEC100TEXT');
    case CAUSE_OF_DEATH.COMBAT_MELEE: return line('INSPEC101TEXT');
    case CAUSE_OF_DEATH.COMBAT_RANGED: return line('INSPEC102TEXT');
    case CAUSE_OF_DEATH.PARASITE: return line('INSPEC104TEXT');
    case CAUSE_OF_DEATH.SUCKED_INTO_SPACE: return line('INSPEC105TEXT');
    case CAUSE_OF_DEATH.DISEASE: return line('INSPEC109TEXT');
    default: return line('INSPEC103TEXT');
  }
}

export function getCharacterTooltipRows(char: Character): WorldTooltipRow[] {
  const rows: WorldTooltipRow[] = [{
    text: char.getName(),
    icon: JOB_ICONS[char.getJob()] ?? JOB_ICONS[UNEMPLOYED],
    // The original standalone janitor PNG uses a black chroma background
    // rather than alpha; luminance masking reproduces the Lua sprite tint.
    iconMaskMode: char.getJob() === JANITOR ? 'luminance' : 'alpha',
  }];

  const unhealthy = char.tStats.nStatus !== STATUS_HEALTHY
    || char.needs.hunger < NEEDS_HUNGER_STARVATION
    || char.suffocationTime > 0;
  rows.push({
    text: healthText(char),
    icon: INSPECTOR_ICON('ui_icon_health'),
    color: unhealthy ? TOOLTIP_RED : TOOLTIP_AMBER,
  });

  if (!char.isAlive()) {
    rows.push({
      text: deathCauseText(char.nCauseOfDeath),
      icon: INSPECTOR_ICON('ui_icon_enemy'),
      color: TOOLTIP_RED,
    });
  } else {
    const moraleTarget = char.nMorale < 0 ? TOOLTIP_RED : TOOLTIP_GREEN;
    const moraleColor = lerpHex(TOOLTIP_AMBER, moraleTarget, Math.abs(char.nMorale) / 100);
    rows.push({
      text: moraleText(char),
      icon: INSPECTOR_ICON('ui_icon_morale'),
      color: moraleColor,
    });
  }

  if (char.currentTask) {
    rows.push({
      text: char.currentTask.name,
      icon: INSPECTOR_ICON('ui_icon_activity'),
    });
  }

  if (char.bSpacewalking && char.isAlive()) {
    const seconds = Math.max(0, char.nSuitOxygen / OXYGEN_PER_SECOND);
    const pct = Math.max(0, Math.min(100, Math.floor(char.nSuitOxygen / SPACESUIT_MAX_OXYGEN * 100)));
    rows.push({
      text: `${line('INSPEC059TEXT')} ${formatTime(seconds)} (${pct}%)`,
      icon: INSPECTOR_ICON('ui_icon_bulletpoint'),
      color: pct <= 25 ? TOOLTIP_RED : TOOLTIP_AMBER,
    });
  }
  return rows;
}

export function getEnvObjectTooltipRows(obj: EnvObject): WorldTooltipRow[] {
  const conditionColor = obj.nCondition <= 25 ? TOOLTIP_RED : TOOLTIP_AMBER;
  const rows: WorldTooltipRow[] = [
    { text: obj.tData.friendlyName },
    {
      text: `${line('INSPEC054TEXT')} ${obj.getConditionUIString()} (${Math.floor(obj.nCondition)}%)`,
      icon: INSPECTOR_ICON('ui_icon_bulletpoint'),
      color: conditionColor,
    },
  ];

  if (obj.tData.nPowerDraw > 0 || obj.tData.nPowerOutput > 0) {
    const output = obj.tData.nPowerOutput > 0;
    rows.push({
      text: `${line(output ? 'INSPEC165TEXT' : 'INSPEC164TEXT')} ${output ? obj.getPowerOutput() : obj.getPowerDraw()} ${line('INSPEC166TEXT')}`,
      icon: INSPECTOR_ICON('ui_icon_bulletpoint'),
    });
  }
  return rows;
}

export function getRoomTooltipRows(room: Room): WorldTooltipRow[] {
  const rows: WorldTooltipRow[] = [
    { text: room.uniqueZoneName || ZONE_SPRITES[room.zone].name },
  ];
  if (room.zone === ZoneType.PLAIN) rows.push({ text: line('UIMISC015TEXT') });

  const oxygenPct = Math.max(0, Math.min(100, Math.floor(room.oxygen / 255 * 100)));
  rows.push({
    text: `${line('INSPEC059TEXT')} ${oxygenPct}%`,
    icon: INSPECTOR_ICON('ui_icon_bulletpoint'),
    color: oxygenPct <= 25 ? TOOLTIP_RED : TOOLTIP_AMBER,
  });

  if (room.nPowerDraw > 0 || room.nPowerOutput > 0) {
    const providing = room.nPowerOutput > room.nPowerDraw;
    const supplied = providing ? Math.min(room.nPowerDraw, room.nPowerOutput) : room.nPowerSupply;
    const total = providing ? room.nPowerOutput : room.nPowerDraw;
    let color = TOOLTIP_AMBER;
    if (providing && supplied < total) color = TOOLTIP_GREEN;
    else if (!providing && supplied < total) color = TOOLTIP_RED;
    rows.push({
      text: `${line(providing ? 'INSPEC165TEXT' : 'INSPEC164TEXT')} ${supplied}/${total} ${line('INSPEC166TEXT')}`,
      icon: INSPECTOR_ICON('ui_icon_bulletpoint'),
      color,
    });
  }
  return rows;
}
