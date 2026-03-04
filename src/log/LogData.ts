/**
 * LogData.ts -- Log type definitions, replacement codes, tag definitions,
 * and random data tables for the character log system.
 * Faithfully mirrors Data/Scripts/Log.lua
 */

// ── Log Type Definitions ─────────────────────────────────────────

export interface LogType {
  lineCodes: string[];
  priority: number;
}

/** Default priority for log types that don't specify one (Log.lua line 632) */
export const DEFAULT_PRIORITY = 0;

/** Logs with this priority or higher always post, even if more are queued (Log.lua line 634) */
export const PRIORITY_ALWAYS_POST = 4;

/**
 * All 128 log types from Log.lua lines 21-628.
 * Each entry has a lineCodes array (list of linecode string keys) and a priority number.
 * Empty lineCodes arrays are preserved for types that exist but have no lines defined.
 */
export const LOG_TYPES: Record<string, LogType> = {
  // super general observations: life, the universe, and everything
  GENERIC: {
    lineCodes: [
      'SFGNRC001CITZ', 'SFGNRC002CITZ', 'SFGNRC003CITZ', 'SFGNRC004CITZ', 'SFGNRC005CITZ',
      'SFGNRC006CITZ', 'SFGNRC007CITZ', 'SFGNRC008CITZ', 'SFGNRC009CITZ', 'SFGNRC010CITZ',
      'SFGNRC011CITZ', 'SFGNRC012CITZ', 'SFGNRC013CITZ', 'SFGNRC014CITZ', 'SFGNRC015CITZ',
      'SFGNRC016CITZ', 'SFGNRC017CITZ', 'SFGNRC018CITZ', 'SFGNRC019CITZ', 'SFGNRC020CITZ',
      'SFGNRC021CITZ', 'SFGNRC022CITZ', 'SFGNRC023CITZ', 'SFGNRC024CITZ', 'SFGNRC025CITZ',
      'SFGNRC026CITZ', 'SFGNRC027CITZ', 'SFGNRC028CITZ', 'SFGNRC029CITZ', 'SFGNRC030CITZ',
      'SFGNRC031CITZ', 'SFGNRC032CITZ', 'SFGNRC033CITZ', 'SFGNRC034CITZ', 'SFGNRC035CITZ',
      'SFGNRC036CITZ', 'SFGNRC037CITZ', 'SFGNRC038CITZ', 'SFGNRC039CITZ', 'SFGNRC040CITZ',
      'SFGNRC041CITZ', 'SFGNRC042CITZ', 'SFGNRC043CITZ', 'SFGNRC044CITZ', 'SFGNRC045CITZ',
      'SFGNRC046CITZ', 'SFGNRC047CITZ', 'SFGNRC048CITZ', 'SFGNRC049CITZ', 'SFGNRC050CITZ',
      'SFGNRC051CITZ', 'SFGNRC052CITZ', 'SFGNRC053CITZ', 'SFGNRC054CITZ', 'SFGNRC055CITZ',
      'SFGNRC056CITZ', 'SFGNRC057CITZ', 'SFGNRC058CITZ', 'SFGNRC059CITZ', 'SFGNRC060CITZ',
    ],
    priority: 0,
  },
  // like/dislike "interesting" (strong affinity*familiarity) person in room
  LIKE_NEARBY_PERSON: {
    lineCodes: [
      'SFNEAR001CITZ', 'SFNEAR005CITZ', 'SFNEAR006CITZ', 'SFNEAR007CITZ', 'SFNEAR013CITZ',
      'SFNEAR014CITZ',
    ],
    priority: 0,
  },
  DISLIKE_NEARBY_PERSON: {
    lineCodes: [
      'SFNEAR002CITZ', 'SFNEAR008CITZ', 'SFNEAR009CITZ', 'SFNEAR010CITZ', 'SFNEAR011CITZ',
      'SFNEAR012CITZ',
    ],
    priority: 0,
  },
  NEARBY_OBJECT: {
    lineCodes: [
      'SFNEAR003CITZ', 'SFNEAR016CITZ', 'SFNEAR017CITZ', 'SFNEAR004CITZ', 'SFNEAR015CITZ',
      'SFNEAR018CITZ',
    ],
    priority: 0,
  },
  // became a citizen of the base
  JOINED: {
    lineCodes: [
      'SFSPWN001CITZ', 'SFSPWN002CITZ', 'SFSPWN003CITZ', 'SFSPWN004CITZ', 'SFSPWN005CITZ',
      'SFSPWN006CITZ',
    ],
    priority: 3,
  },
  // raider enters your base
  ENEMY_JOINED: {
    lineCodes: [
      'SFSPWN007RAID', 'SFSPWN008RAID', 'SFSPWN009RAID', 'SFSPWN010RAID', 'SFSPWN011RAID',
      'SFSPWN012RAID',
    ],
    priority: 3,
  },
  // did some useful work
  DUTY_GENERIC: {
    lineCodes: [],
    priority: 0,
  },
  // assigned a new duty
  DUTY_ASSIGNED: {
    lineCodes: [
      'SFDTAS006CITZ', 'SFDTAS007CITZ', 'SFDTAS008CITZ', 'SFDTAS009CITZ', 'SFDTAS010CITZ',
      'SFDTAS011CITZ', 'SFDTAS012CITZ', 'SFDTAS013CITZ', 'SFDTAS014CITZ', 'SFDTAS015CITZ',
      'SFDTAS016CITZ', 'SFDTAS017CITZ', 'SFDTAS018CITZ', 'SFDTAS019CITZ', 'SFDTAS020CITZ',
    ],
    priority: 2,
  },
  DUTY_UNEMPLOYED: {
    lineCodes: [
      'SFDTAS001CITZ', 'SFDTAS002CITZ', 'SFDTAS003CITZ', 'SFDTAS004CITZ', 'SFDTAS005CITZ',
    ],
    priority: 0,
  },
  // duty-specific
  DUTY_BUILD: {
    lineCodes: [
      'SFDTBD001CITZ', 'SFDTBD002CITZ', 'SFDTBD003CITZ', 'SFDTBD004CITZ', 'SFDTBD005CITZ',
      'SFDTBD006CITZ', 'SFDTBD007CITZ',
    ],
    priority: 0,
  },
  DUTY_TECH: {
    lineCodes: [
      'SFDTTK001CITZ', 'SFDTTK002CITZ', 'SFDTTK003CITZ', 'SFDTTK004CITZ', 'SFDTTK005CITZ',
      'SFDTTK007CITZ', 'SFDTTK008CITZ', 'SFDTTK009CITZ', 'SFDTTK010CITZ', 'SFDTTK011CITZ',
      'SFDTTK012CITZ',
    ],
    priority: 0,
  },
  DUTY_MINE: {
    lineCodes: [
      'SFMINE001CITZ', 'SFMINE002CITZ', 'SFMINE003CITZ', 'SFMINE004CITZ', 'SFMINE005CITZ',
      'SFMINE006CITZ', 'SFMINE007CITZ', 'SFMINE009CITZ', 'SFMINE010CITZ',
    ],
    priority: 0,
  },
  DUTY_SECURITY_PATROL: {
    lineCodes: [
      'SFSECU010CITZ', 'SFSECU011CITZ', 'SFSECU012CITZ', 'SFSECU013CITZ', 'SFSECU014CITZ',
      'SFSECU015CITZ', 'SFSECU016CITZ', 'SFSECU017CITZ', 'SFSECU018CITZ', 'SFSECU019CITZ',
      'SFSECU020CITZ', 'SFSECU021CITZ',
    ],
    priority: 0,
  },
  DUTY_SECURITY_START_EXPLORE: {
    lineCodes: [
      'SFSECU022CITZ', 'SFSECU023CITZ', 'SFSECU024CITZ', 'SFSECU025CITZ', 'SFSECU026CITZ',
    ],
    priority: 0,
  },
  DUTY_SECURITY_EXPLORED_COMBAT: {
    lineCodes: [
      'SFSECU028CITZ', 'SFSECU030CITZ', 'SFSECU031CITZ', 'SFSECU032CITZ', 'SFSECU033CITZ',
    ],
    priority: 2,
  },
  DUTY_SECURITY_EXPLORED_NOCOMBAT: {
    lineCodes: [
      'SFSECU029CITZ', 'SFSECU034CITZ', 'SFSECU035CITZ', 'SFSECU036CITZ', 'SFSECU037CITZ',
    ],
    priority: 2,
  },
  DUTY_BOTANIST_MAINTAIN: {
    lineCodes: [
      'SFBOTN001CITZ', 'SFBOTN007CITZ', 'SFBOTN008CITZ', 'SFBOTN009CITZ', 'SFBOTN010CITZ',
      'SFBOTN011CITZ', 'SFBOTN012CITZ', 'SFBOTN013CITZ', 'SFBOTN014CITZ', 'SFBOTN018CITZ',
      'SFBOTN019CITZ', 'SFBOTN020CITZ',
    ],
    priority: 0,
  },
  DUTY_BOTANIST_HARVEST: {
    lineCodes: [
      'SFBOTN015CITZ', 'SFBOTN016CITZ', 'SFBOTN017CITZ',
    ],
    priority: 0,
  },
  DUTY_SERVE_DRINK: {
    lineCodes: [
      'SFDRNK009CITZ', 'SFBART001CITZ', 'SFBART002CITZ', 'SFBART003CITZ', 'SFBART004CITZ',
      'SFBART005CITZ', 'SFBART006CITZ',
    ],
    priority: 0,
  },
  DUTY_SCIENTIST_RESEARCH_FIRE: {
    lineCodes: [
      'SFRSCH015CITZ', 'SFRSCH016CITZ', 'SFRSCH017CITZ', 'SFRSCH018CITZ',
    ],
    priority: 0,
  },
  DUTY_SCIENTIST_DO_RESEARCH: {
    lineCodes: [
      'SFRSCH001CITZ', 'SFRSCH002CITZ', 'SFRSCH003CITZ', 'SFRSCH004CITZ', 'SFRSCH011CITZ',
      'SFRSCH012CITZ', 'SFRSCH013CITZ', 'SFRSCH014CITZ', 'SFRSCH019CITZ',
    ],
    priority: 0,
  },
  DUTY_SCIENTIST_COLLECT_RESEARCH: {
    lineCodes: [
      'SFRSCH005CITZ', 'SFRSCH007CITZ', 'SFRSCH008CITZ',
    ],
    priority: 0,
  },
  DUTY_SCIENTIST_DELIVER_RESEARCH: {
    lineCodes: [
      'SFRSCH006CITZ', 'SFRSCH009CITZ', 'SFRSCH010CITZ',
    ],
    priority: 0,
  },
  EXPLORED_ROOM: {
    lineCodes: [
      'SFSECU001CITZ', 'SFSECU002CITZ', 'SFSECU003CITZ', 'SFSECU004CITZ', 'SFSECU005CITZ',
      'SFSECU006CITZ', 'SFSECU007CITZ', 'SFSECU008CITZ', 'SFSECU009CITZ',
    ],
    priority: 0,
  },
  // janitor duty
  DUTY_JANITOR_REFINE_CORPSE_FRIENDLY: {
    lineCodes: [
      'SFJANI001CITZ', 'SFJANI002CITZ', 'SFJANI003CITZ', 'SFJANI004CITZ', 'SFJANI005CITZ',
      'SFJANI006CITZ', 'SFJANI007CITZ', 'SFJANI008CITZ', 'SFJANI018CITZ',
    ],
    priority: 2,
  },
  DUTY_JANITOR_REFINE_CORPSE_MONSTER: {
    lineCodes: [
      'SFJANI009CITZ', 'SFJANI010CITZ', 'SFJANI011CITZ', 'SFJANI016CITZ', 'SFJANI017CITZ',
    ],
    priority: 0,
  },
  DUTY_JANITOR_REFINE_CORPSE_RAIDER: {
    lineCodes: [
      'SFJANI012CITZ', 'SFJANI013CITZ', 'SFJANI014CITZ', 'SFJANI015CITZ', 'SFJANI016CITZ',
      'SFJANI017CITZ',
    ],
    priority: 0,
  },
  // doctor duty
  DUTY_DOCTOR_SCAN_HEALTHY: {
    lineCodes: [
      'SFDOCT026CITZ', 'SFDOCT034CITZ', 'SFDOCT035CITZ', 'SFDOCT062CITZ', 'SFDOCT063CITZ',
    ],
    priority: 0,
  },
  DUTY_DOCTOR_HEAL_ILLNESS: {
    lineCodes: [
      'SFDOCT001CITZ', 'SFDOCT011CITZ', 'SFDOCT014CITZ', 'SFDOCT015CITZ',
    ],
    priority: 0,
  },
  DUTY_DOCTOR_HEAL_BROKEN_LEG: {
    lineCodes: [
      'SFDOCT002CITZ', 'SFDOCT009CITZ', 'SFDOCT012CITZ', 'SFDOCT013CITZ',
    ],
    priority: 0,
  },
  DUTY_DOCTOR_HEAL_HP_MAJOR: {
    lineCodes: [
      'SFDOCT009CITZ', 'SFDOCT012CITZ', 'SFDOCT013CITZ',
    ],
    priority: 0,
  },
  DUTY_DOCTOR_HEAL_HP_MINOR: {
    lineCodes: [
      'SFDOCT061CITZ', 'SFDOCT060CITZ',
    ],
    priority: 0,
  },
  DUTY_DOCTOR_DIAGNOSE_ILLNESS: {
    lineCodes: [
      'SFDOCT003CITZ', 'SFDOCT007CITZ', 'SFDOCT010CITZ', 'SFDOCT016CITZ',
    ],
    priority: 2,
  },
  // citizen illness/injury
  HEALTH_CITIZEN_SCAN: {
    lineCodes: [
      'SFDOCT021CITZ', 'SFDOCT036CITZ', 'SFDOCT037CITZ', 'SFDOCT038CITZ', 'SFDOCT039CITZ',
      'SFDOCT040CITZ', 'SFDOCT041CITZ',
    ],
    priority: 0,
  },
  HEALTH_CITIZEN_GETTING_ILL: {
    lineCodes: [
      'SFDOCT022CITZ', 'SFDOCT042CITZ', 'SFDOCT043CITZ', 'SFDOCT044CITZ', 'SFDOCT054CITZ',
      'SFDOCT055CITZ',
    ],
    priority: 2,
  },
  HEALTH_CITIZEN_GETTING_FIREPLAGUE: {
    lineCodes: [
      'FIREPLAGUE01', 'FIREPLAGUE02', 'FIREPLAGUE03', 'FIREPLAGUE04', 'FIREPLAGUE05',
      'FIREPLAGUE06', 'FIREPLAGUE07', 'FIREPLAGUE08', 'FIREPLAGUE09', 'FIREPLAGUE10',
      'FIREPLAGUE11',
    ],
    priority: 3,
  },
  HEALTH_CITIZEN_GETTING_HIGH: {
    lineCodes: [
      'DRUGGED01', 'DRUGGED02', 'DRUGGED03', 'DRUGGED04', 'DRUGGED05',
      'DRUGGED06', 'DRUGGED07', 'DRUGGED08', 'DRUGGED09', 'DRUGGED10',
      'DRUGGED11', 'DRUGGED12', 'DRUGGED13', 'DRUGGED14', 'DRUGGED15',
      'DRUGGED16', 'DRUGGED17', 'DRUGGED18', 'DRUGGED19', 'DRUGGED20',
      'DRUGGED21', 'DRUGGED22', 'DRUGGED23', 'DRUGGED24', 'DRUGGED25',
      'DRUGGED26', 'DRUGGED27', 'DRUGGED28', 'DRUGGED29', 'DRUGGED30',
    ],
    priority: 3,
  },
  HEALTH_CITIZEN_DIAGNOSED: {
    lineCodes: [
      'SFDOCT023CITZ', 'SFDOCT047CITZ', 'SFDOCT051CITZ',
    ],
    priority: 2,
  },
  HEALTH_CITIZEN_INCAPACITATED_ILLNESS: {
    lineCodes: [
      'SFDOCT024CITZ', 'SFDOCT048CITZ',
    ],
    priority: 3,
  },
  HEALTH_CITIZEN_INCAPACITATED_INJURY: {
    lineCodes: [
      'SFDOCT025CITZ', 'SFDOCT049CITZ', 'SFDOCT050CITZ',
    ],
    priority: 3,
  },
  HEALTH_CITIZEN_MINOR_INJURY: {
    lineCodes: [
      'SFINJURY001', 'SFINJURY002', 'SFINJURY003', 'SFINJURY004', 'SFINJURY005',
      'SFINJURY006', 'SFINJURY007', 'SFINJURY008',
    ],
    priority: 3,
  },
  HEALTH_CITIZEN_HEAL_ILLNESS: {
    lineCodes: [
      'SFDOCT045CITZ', 'SFDOCT046CITZ', 'SFDOCT052CITZ', 'SFDOCT053CITZ',
    ],
    priority: 3,
  },
  HEALTH_CITIZEN_HOSPITAL_CHECKIN: {
    lineCodes: [
      'SFDOCT056CITZ', 'SFDOCT057CITZ', 'SFDOCT058CITZ', 'SFDOCT059CITZ',
    ],
    priority: 2,
  },
  // chatting
  CHAT_INTRODUCE: {
    lineCodes: [
      'SFCHAT001CITZ', 'SFCHAT002CITZ', 'SFCHAT003CITZ', 'SFCHAT004CITZ',
    ],
    priority: 3,
  },
  CHAT_GOOD_GENERIC: {
    lineCodes: [
      'SFCHAT005CITZ', 'SFCHAT006CITZ', 'SFCHAT007CITZ', 'SFCHAT008CITZ',
    ],
    priority: 0,
  },
  CHAT_BAD_GENERIC: {
    lineCodes: [
      'SFCHAT009CITZ', 'SFCHAT010CITZ', 'SFCHAT011CITZ', 'SFCHAT012CITZ', 'SFCHAT020CITZ',
      'SFCHAT021CITZ',
    ],
    priority: 0,
  },
  CHAT_CHEER_UP: {
    lineCodes: [
      'SFCHAT013CITZ', 'SFCHAT014CITZ', 'SFCHAT015CITZ', 'SFCHAT016CITZ', 'SFCHAT017CITZ',
      'SFCHAT018CITZ',
    ],
    priority: 2,
  },
  // Jukebox
  JUKEBOX_GENERIC: {
    lineCodes: [
      'JB01', 'JB02', 'JB03', 'JB04', 'JB05', 'JB06', 'JB07', 'JB08', 'JB09', 'JB10',
      'JB11', 'JB12', 'JB13',
    ],
    priority: 3,
  },
  // trading
  CHAT_TRADE: {
    lineCodes: [
      'SFCHAT019CITZ', 'SFTRAD007CITZ', 'SFTRAD008CITZ', 'SFTRAD009CITZ',
      'SFTRAD010CITZ', 'SFTRAD011CITZ', 'SFTRAD012CITZ',
    ],
    priority: 2,
  },
  PICKUP_ITEM: {
    lineCodes: [
      'SFTRAD001CITZ',
    ],
    priority: 2,
  },
  // death-related
  // logging about a (non-self) citizen who died
  DEATH_REACT_CITIZEN: {
    lineCodes: [
      'SFDTHG002CITZ', 'SFDTHG003CITZ', 'SFDTHG004CITZ', 'SFDTHG018CITZ',
    ],
    priority: 4,
  },
  // reaction of enemy death
  DEATH_REACT_ENEMY: {
    lineCodes: [
      'SFDTHG015CITZ', 'SFDTHG016CITZ', 'SFDTHG017CITZ',
    ],
    priority: 4,
  },
  // friend who died
  DEATH_REACT_FRIEND: {
    lineCodes: [
      'SFDTHG005CITZ', 'SFDTHG006CITZ', 'SFDTHG007CITZ', 'SFDTHG019CITZ',
    ],
    priority: 4,
  },
  // raider reaction to citizen death
  DEATH_REACT_RAIDER_TO_CITZ: {
    lineCodes: [
      'SFDTHG008RAID', 'SFDTHG009RAID', 'SFDTHG010RAID',
    ],
    priority: 4,
  },
  // raider reaction to raider death
  DEATH_REACT_RAIDER_TO_RAIDER: {
    lineCodes: [
      'SFDTHG011RAID', 'SFDTHG012RAID', 'SFDTHG013RAID', 'SFDTHG014RAID',
    ],
    priority: 4,
  },
  ENTER_BRAWL: {
    lineCodes: [
      'SFCOMB030CITZ', 'SFCOMB031CITZ', 'SFCOMB032CITZ', 'SFCOMB033CITZ', 'SFCOMB034CITZ',
      'SFCOMB035CITZ', 'SFCOMB036CITZ',
    ],
    priority: 2,
  },
  ENTER_COMBAT_MELEE: {
    lineCodes: [
      'SFCOMB021CITZ', 'SFCOMB022CITZ', 'SFCOMB023CITZ',
    ],
    priority: 2,
  },
  ENTER_COMBAT_RANGED: {
    lineCodes: [
      'SFCOMB018CITZ', 'SFCOMB019CITZ', 'SFCOMB020CITZ', 'SFCOMB027CITZ',
    ],
    priority: 2,
  },
  ENTER_COMBAT_RAIDER: {
    lineCodes: [
      'SFCOMB024RAID', 'SFCOMB025RAID', 'SFCOMB026RAID',
    ],
    priority: 2,
  },
  RAIDER_ATTACK_DOOR: {
    lineCodes: [
      'SFCOMB028RAID', 'SFCOMB029RAID',
    ],
    priority: 0,
  },
  KILLED_A_THING_MELEE: {
    lineCodes: [
      'SFCOMB003CITZ', 'SFCOMB007CITZ',
    ],
    priority: 2,
  },
  KILLED_A_THING_RANGED: {
    lineCodes: [
      'SFCOMB004CITZ', 'SFCOMB014CITZ', 'SFCOMB017CITZ',
    ],
    priority: 2,
  },
  ER_KILLED_A_THING_MELEE: {
    lineCodes: [
      'SFCOMB001CITZ', 'SFCOMB013CITZ',
    ],
    priority: 2,
  },
  ER_KILLED_A_THING_RANGED: {
    lineCodes: [
      'SFCOMB002CITZ', 'SFCOMB008CITZ', 'SFCOMB012CITZ',
    ],
    priority: 2,
  },
  RAIDER_KILLED_A_THING_MELEE: {
    lineCodes: [
      'SFCOMB005RAID', 'SFCOMB009RAID', 'SFCOMB010RAID', 'SFCOMB011RAID',
    ],
    priority: 2,
  },
  RAIDER_KILLED_A_THING_RANGED: {
    lineCodes: [
      'SFCOMB006RAID', 'SFCOMB009RAID', 'SFCOMB010RAID', 'SFCOMB011RAID', 'SFCOMB015RAID',
      'SFCOMB016RAID',
    ],
    priority: 2,
  },
  CAUGHT_FIRE: {
    lineCodes: [
      'SFFIRE001CITZ', 'SFFIRE003CITZ', 'SFFIRE005CITZ', 'SFFIRE006CITZ', 'SFFIRE007CITZ',
    ],
    priority: 3,
  },
  CAUGHT_FIRE_MANY: {
    // caught fire more than once
    lineCodes: [
      'SFFIRE002CITZ', 'SFFIRE004CITZ', 'SFFIRE001CITZ', 'SFFIRE003CITZ', 'SFFIRE005CITZ',
      'SFFIRE006CITZ', 'SFFIRE007CITZ', 'SFFIRE008CITZ', 'SFFIRE009CITZ',
    ],
    priority: 3,
  },
  // speaker is dying
  DEATH_GENERIC: {
    lineCodes: [],
    priority: 0,
  },
  DEATH_FIRE: {
    lineCodes: [],
    priority: 0,
  },
  DEATH_CHESTBURST: {
    lineCodes: [
      'SFPARA010CITZ', 'SFPARA011CITZ', 'SFPARA012CITZ', 'SFPARA013CITZ', 'SFPARA014CITZ',
      'SFPARA015CITZ', 'SFPARA016CITZ', 'SFPARA017CITZ', 'SFPARA018CITZ',
    ],
    priority: 4,
  },
  DEATH_THING: {
    lineCodes: [
      'SFTHICIT01', 'SFTHICIT02', 'SFTHICIT03', 'SFTHICIT04', 'SFTHICIT05',
    ],
    priority: 4,
  },
  DEATH_SUFFOCATION: {
    lineCodes: [
      'OXYGEN001CITZ', 'OXYGEN008CITZ', 'OXYGEN009CITZ', 'OXYGEN010CITZ', 'OXYGEN011CITZ',
      'OXYGEN012CITZ', 'OXYGEN013CITZ', 'OXYGEN024CITZ', 'OXYGEN025CITZ', 'OXYGEN027CITZ',
    ],
    priority: 4,
  },
  DEATH_STARVATION: {
    lineCodes: [
      'SFEATS039CITZ', 'SFEATS040CITZ', 'SFEATS041CITZ',
    ],
    priority: 4,
  },
  // witnessing / hearing about a disaster
  DISASTER_FIRE: {
    lineCodes: [
      'SFDISA012CITZ', 'SFDISA013CITZ', 'SFDISA014CITZ', 'SFDISA015CITZ', 'SFDISA016CITZ',
      'SFDISA017CITZ', 'SFDISA018CITZ', 'SFDISA019CITZ', 'SFDISA020CITZ',
    ],
    priority: 3,
  },
  DISASTER_MONSTER: {
    lineCodes: [],
    priority: 0,
  },
  DISASTER_RAIDER: {
    lineCodes: [],
    priority: 0,
  },
  DISASTER_BREACH: {
    lineCodes: [
      'SFDISA003CITZ', 'SFDISA004CITZ', 'SFDISA005CITZ', 'SFDISA006CITZ', 'SFDISA007CITZ',
      'SFDISA009CITZ', 'SFDISA010CITZ', 'SFDISA011CITZ',
    ],
    priority: 3,
  },
  // anger events
  RAMPAGE_START: {
    lineCodes: [
      'SFRAMP003CITZ', 'SFRAMP005CITZ', 'SFRAMP006CITZ', 'SFRAMP007CITZ', 'SFRAMP008CITZ',
    ],
    priority: 3,
  },
  TANTRUM_START: {
    lineCodes: [
      'SFRAMP001CITZ', 'SFRAMP002CITZ', 'SFRAMP004CITZ', 'SFRAMP007CITZ', 'SFRAMP009CITZ',
    ],
    priority: 3,
  },
  RAMPAGE_NEARBY: {
    lineCodes: [
      'SFRAMP010CITZ', 'SFRAMP011CITZ', 'SFRAMP012CITZ', 'SFRAMP013CITZ',
    ],
    priority: 3,
  },
  TANTRUM_NEARBY: {
    lineCodes: [
      'SFDISA021CITZ', 'SFDISA022CITZ', 'SFDISA023CITZ', 'SFDISA024CITZ',
    ],
    priority: 3,
  },
  BRIG_ASSIGN_INCAPACITATED: {
    lineCodes: [
      'SFRAMP017CITZ', 'SFRAMP019CITZ', 'SFRAMP020CITZ', 'SFRAMP021CITZ',
    ],
    priority: 2,
  },
  BRIG_ASSIGN_NOT_INCAPACITATED: {
    lineCodes: [
      'SFRAMP014CITZ', 'SFRAMP015CITZ', 'SFRAMP016CITZ', 'SFRAMP018CITZ',
    ],
    priority: 2,
  },
  BRIG_ESCAPE: {
    lineCodes: [
      'SFRAMP022CITZ', 'SFRAMP023CITZ', 'SFRAMP024CITZ',
    ],
    priority: 2,
  },
  // slept on floor / in bed
  SLEEP_FLOOR: {
    lineCodes: [
      'SFSLEP009CITZ', 'SFSLEP010CITZ', 'SFSLEP011CITZ', 'SFSLEP013CITZ', 'SFSLEP012CITZ',
      'SFSLEP014CITZ', 'SFSLEP015CITZ', 'SFSLEP016CITZ', 'SFSLEP018CITZ', 'SFSLEP022CITZ',
      'SFSLEP023CITZ', 'SFSLEP024CITZ',
    ],
    priority: 3,
  },
  SLEEP_BED_OWNED: {
    // includes "generic" slept in bed
    lineCodes: [
      'SFSLEP009CITZ', 'SFSLEP010CITZ', 'SFSLEP011CITZ', 'SFSLEP017CITZ', 'SFSLEP018CITZ',
      'SFSLEP019CITZ', 'SFSLEP020CITZ', 'SFSLEP021CITZ',
      'SFSLEP025CITZ', 'SFSLEP029CITZ', 'SFSLEP030CITZ',
    ],
    priority: 2,
  },
  SLEEP_BED_UNOWNED: {
    // includes "generic" slept in bed
    lineCodes: [
      'SFSLEP009CITZ', 'SFSLEP010CITZ', 'SFSLEP011CITZ', 'SFSLEP017CITZ', 'SFSLEP018CITZ',
      'SFSLEP019CITZ', 'SFSLEP020CITZ', 'SFSLEP021CITZ',
      'SFSLEP026CITZ', 'SFSLEP027CITZ', 'SFSLEP028CITZ',
    ],
    priority: 3,
  },
  EAT_REPLICATOR: {
    lineCodes: [
      'SFEATS001CITZ', 'SFEATS002CITZ', 'SFEATS003CITZ', 'SFEATS004CITZ', 'SFEATS005CITZ',
      'SFEATS006CITZ', 'SFEATS007CITZ', 'SFEATS008CITZ', 'SFEATS009CITZ', 'SFEATS010CITZ',
      'SFEATS036CITZ', 'SFEATS046CITZ', 'SFEATS047CITZ',
    ],
    priority: 0,
  },
  ENEMY_EAT_REPLICATOR: {
    lineCodes: [
      'SFEATS011RAID', 'SFEATS012RAID', 'SFEATS013RAID', 'SFEATS014RAID', 'SFEATS015RAID',
      'SFEATS036CITZ',
    ],
    priority: 0,
  },
  EAT_RAW_FOOD: {
    lineCodes: [
      'SFEATS016CITZ', 'SFEATS017CITZ', 'SFEATS018CITZ', 'SFEATS019CITZ', 'SFEATS020CITZ',
      'SFEATS021CITZ', 'SFEATS022CITZ',
    ],
    priority: 0,
  },
  ENEMY_EAT_RAW_FOOD: {
    lineCodes: [
      'SFEATS023RAID', 'SFEATS024RAID', 'SFEATS025RAID', 'SFEATS026RAID',
    ],
    priority: 0,
  },
  EAT_COOKED_MEAL_GOOD: {
    lineCodes: [
      'SFEATS027CITZ', 'SFEATS028CITZ', 'SFEATS029CITZ', 'SFEATS031CITZ', 'SFEATS042CITZ',
    ],
    priority: 2,
  },
  EAT_COOKED_MEAL_BAD: {
    lineCodes: [
      'SFEATS030CITZ', 'SFEATS032CITZ', 'SFEATS033CITZ', 'SFEATS034CITZ', 'SFEATS035CITZ',
    ],
    priority: 2,
  },
  EAT_COOKED_MEAL_FAVORITE: {
    lineCodes: [
      'SFEATS043CITZ',
    ],
    priority: 3,
  },
  // drinking
  DRINK_GOOD_MORALE: {
    lineCodes: [
      'SFDRNK001CITZ', 'SFDRNK005CITZ', 'SFDRNK008CITZ', 'SFDRNK010CITZ', 'SFDRNK011CITZ',
    ],
    priority: 0,
  },
  DRINK_BAD_MORALE: {
    lineCodes: [
      'SFDRNK003CITZ', 'SFDRNK006CITZ', 'SFDRNK007CITZ', 'SFDRNK012CITZ', 'SFDRNK013CITZ',
    ],
    priority: 0,
  },
  // general good/bad morale cases
  MORALE_GENERIC_GOOD: {
    lineCodes: [],
    priority: 0,
  },
  MORALE_GENERIC_BAD: {
    lineCodes: [],
    priority: 0,
  },
  MORALE_HIGH_OXYGEN: {
    lineCodes: [
      'OXYGEN003CITZ', 'OXYGEN018CITZ', 'OXYGEN019CITZ', 'OXYGEN021CITZ', 'OXYGEN022CITZ',
      'OXYGEN023CITZ', 'OXYGEN026CITZ', 'OXYGEN028CITZ', 'OXYGEN029CITZ',
    ],
    priority: 3,
  },
  // morale lower due to basic needs not being met
  MORALE_LOW_DUTY: {
    lineCodes: [
      'SFNEED025CITZ', 'SFNEED026CITZ', 'SFNEED027CITZ', 'SFNEED055CITZ', 'SFNEED056CITZ',
      'SFNEED057CITZ', 'SFNEED058CITZ', 'SFNEED059CITZ', 'SFNEED060CITZ', 'SFNEED061CITZ',
      'SFNEED062CITZ', 'SFNEED063CITZ', 'SFNEED064CITZ',
    ],
    priority: 0,
  },
  MORALE_LOW_SOCIAL: {
    lineCodes: [
      'SFNEED028CITZ', 'SFNEED029CITZ', 'SFNEED030CITZ', 'SFNEED072CITZ',
    ],
    priority: 0,
  },
  MORALE_LOW_AMUSEMENT: {
    lineCodes: [
      'SFNEED031CITZ', 'SFNEED032CITZ', 'SFNEED033CITZ',
    ],
    priority: 0,
  },
  MORALE_LOW_ENERGY: {
    lineCodes: [
      'SFNEED034CITZ', 'SFNEED035CITZ', 'SFNEED036CITZ', 'SFNEED071CITZ',
    ],
    priority: 0,
  },
  MORALE_LOW_HUNGER: {
    lineCodes: [
      'SFEATS038CITZ', 'SFNEED050CITZ', 'SFNEED051CITZ', 'SFNEED054CITZ', 'SFNEED070CITZ',
    ],
    priority: 2,
  },
  MORALE_LOW_STUFF: {
    lineCodes: [
      'SFNEED065CITZ', 'SFNEED066CITZ', 'SFNEED067CITZ', 'SFNEED068CITZ', 'SFNEED069CITZ',
    ],
    priority: 2,
  },
  NEED_SHELVING: {
    lineCodes: [
      'SFTRAD015CITZ', 'SFTRAD016CITZ', 'SFTRAD017CITZ',
    ],
    priority: 0,
  },
  // morale higher due to this need being satisfactorily high
  MORALE_HIGH_DUTY: {
    lineCodes: [
      'SFNEED037CITZ', 'SFNEED038CITZ', 'SFNEED039CITZ',
    ],
    priority: 0,
  },
  MORALE_HIGH_SOCIAL: {
    lineCodes: [
      'SFNEED040CITZ', 'SFNEED041CITZ', 'SFNEED042CITZ',
    ],
    priority: 0,
  },
  MORALE_HIGH_AMUSEMENT: {
    lineCodes: [
      'SFNEED043CITZ', 'SFNEED044CITZ', 'SFNEED045CITZ',
    ],
    priority: 0,
  },
  MORALE_HIGH_ENERGY: {
    lineCodes: [
      'SFNEED046CITZ', 'SFNEED047CITZ', 'SFNEED048CITZ',
    ],
    priority: 0,
  },
  MORALE_HIGH_HUNGER: {
    lineCodes: [
      'SFNEED049CITZ', 'SFNEED052CITZ', 'SFNEED053CITZ',
    ],
    priority: 0,
  },
  MORALE_LOW_OXYGEN: {
    lineCodes: [
      'OXYGEN002CITZ', 'OXYGEN004CITZ', 'OXYGEN005CITZ', 'OXYGEN006CITZ', 'OXYGEN007CITZ',
      'OXYGEN014CITZ', 'OXYGEN015CITZ', 'OXYGEN016CITZ', 'OXYGEN027CITZ', 'OXYGEN017CITZ',
      'OXYGEN020CITZ', 'OXYGEN025CITZ',
    ],
    priority: 3,
  },
  // high room score
  MORALE_COOL_PUB: {
    lineCodes: [
      'SFWAND023CITZ', 'SFWAND024CITZ', 'SFWAND025CITZ', 'SFWAND026CITZ', 'SFWAND027CITZ',
    ],
    priority: 0,
  },
  MORALE_COOL_GARDEN: {
    lineCodes: [
      'SFWAND028CITZ', 'SFWAND029CITZ', 'SFWAND030CITZ', 'SFWAND031CITZ', 'SFWAND032CITZ',
    ],
    priority: 0,
  },
  MORALE_COOL_ROOM_GENERIC: {
    lineCodes: [
      'SFWAND033CITZ', 'SFWAND034CITZ', 'SFWAND035CITZ', 'SFWAND036CITZ', 'SFWAND037CITZ',
    ],
    priority: 0,
  },
  // activities
  WORK_OUT: {
    lineCodes: [
      'SFWOUT001CITZ', 'SFWOUT002CITZ', 'SFWOUT003CITZ', 'SFWOUT004CITZ', 'SFWOUT005CITZ',
      'SFWOUT006CITZ', 'SFWOUT007CITZ', 'SFWOUT008CITZ', 'SFWOUT009CITZ', 'SFWOUT010CITZ',
      'SFWOUT011CITZ', 'SFWOUT012CITZ', 'SFWOUT022CITZ', 'SFWOUT023CITZ',
    ],
    priority: 0,
  },
  LIFT_WEIGHTS: {
    lineCodes: [
      'SFWOUT013CITZ', 'SFWOUT014CITZ', 'SFWOUT015CITZ', 'SFWOUT016CITZ', 'SFWOUT017CITZ',
      'SFWOUT018CITZ', 'SFWOUT019CITZ', 'SFWOUT020CITZ', 'SFWOUT021CITZ', 'SFWOUT022CITZ',
      'SFWOUT022CITZ',
    ],
    priority: 0,
  },
  PLAY_GAME_SYSTEM: {
    lineCodes: [
      'SFGAME001CITZ', 'SFGAME002CITZ', 'SFGAME003CITZ', 'SFGAME005CITZ', 'SFGAME007CITZ',
      'SFGAME008CITZ', 'SFGAME009CITZ', 'SFGAME010CITZ', 'SFGAME012CITZ', 'SFGAME013CITZ',
      'SFGAME014CITZ', 'SFGAME015CITZ',
    ],
    priority: 0,
  },
  PLAY_GAME_SYSTEM_UNEMPLOYED: {
    lineCodes: [
      'SFGAME001CITZ', 'SFGAME002CITZ', 'SFGAME004CITZ', 'SFGAME005CITZ', 'SFGAME006CITZ',
      'SFGAME007CITZ', 'SFGAME008CITZ', 'SFGAME009CITZ', 'SFGAME010CITZ', 'SFGAME011CITZ',
    ],
    priority: 0,
  },
  WANDER: {
    lineCodes: [
      'SFWAND001CITZ', 'SFWAND002CITZ', 'SFWAND003CITZ', 'SFWAND004CITZ', 'SFWAND005CITZ',
      'SFWAND006CITZ', 'SFWAND007CITZ', 'SFWAND008CITZ', 'SFWAND020CITZ',
    ],
    priority: 0,
  },
  WANDER_SPACE: {
    lineCodes: [
      'SFWAND007CITZ', 'SFWAND009CITZ', 'SFWAND010CITZ', 'SFWAND011CITZ', 'SFWAND012CITZ',
      'SFWAND013CITZ', 'SFWAND014CITZ', 'SFWAND015CITZ', 'SFWAND016CITZ', 'SFWAND017CITZ',
      'SFWAND018CITZ', 'SFWAND019CITZ', 'SFWAND020CITZ', 'SFWAND021CITZ', 'SFWAND021CITZ',
      'SFWAND022CITZ',
    ],
    priority: 0,
  },
  INFECTED_PARASITE: {
    lineCodes: [
      'SFPARA001CITZ', 'SFPARA002CITZ', 'SFPARA003CITZ', 'SFPARA004CITZ', 'SFPARA005CITZ',
      'SFPARA006CITZ', 'SFPARA007CITZ', 'SFPARA008CITZ', 'SFPARA009CITZ',
    ],
    priority: 2,
  },
  MONSTER_GENERIC: {
    lineCodes: [
      'SFMONS001MONS', 'SFMONS002MONS', 'SFMONS003MONS', 'SFMONS004MONS', 'SFMONS005MONS',
      'SFMONS006MONS', 'SFMONS007MONS', 'SFMONS008MONS', 'SFMONS009MONS', 'SFMONS010MONS',
      'SFMONS011MONS', 'SFMONS012MONS', 'SFMONS013MONS', 'SFMONS014MONS', 'SFMONS015MONS',
      'SFMONS016MONS', 'SFMONS017MONS', 'SFMONS018MONS', 'SFMONS019MONS', 'SFMONS020MONS',
    ],
    priority: 0,
  },
  KILLBOT_GENERIC: {
    lineCodes: [
      'SFMONS021KBOT', 'SFMONS022KBOT', 'SFMONS023KBOT', 'SFMONS024KBOT', 'SFMONS025KBOT',
      'SFMONS026KBOT', 'SFMONS027KBOT', 'SFMONS028KBOT', 'SFMONS029KBOT', 'SFMONS030KBOT',
      'SFMONS031KBOT',
    ],
    priority: 0,
  },
  HEALTH_CITIZEN_IS_THING: {
    lineCodes: [
      'SFTHING01', 'SFTHING02', 'SFTHING03', 'SFTHING04', 'SFTHING05', 'SFTHING06',
      'SFTHING07',
    ],
    priority: 3,
  },
  WORM_STAGE_ONE: {
    lineCodes: [
      'WORMSTAGE101', 'WORMSTAGE102', 'WORMSTAGE103', 'WORMSTAGE104',
      'WORMSTAGE105', 'WORMSTAGE106', 'WORMSTAGE107', 'WORMSTAGE108',
      'WORMSTAGE109', 'WORMSTAGE110', 'WORMSTAGE111', 'WORMSTAGE112',
    ],
    priority: 2,
  },
  WORM_STAGE_TWO: {
    lineCodes: [
      'WORMSTAGE201', 'WORMSTAGE202', 'WORMSTAGE203', 'WORMSTAGE204',
      'WORMSTAGE205', 'WORMSTAGE206', 'WORMSTAGE207', 'WORMSTAGE208',
      'WORMSTAGE209', 'WORMSTAGE210', 'WORMSTAGE211', 'WORMSTAGE212',
      'WORMSTAGE213', 'WORMSTAGE214', 'WORMSTAGE215',
    ],
    priority: 2,
  },
};


// ── Replacement Code Definitions ────────────────────────────────
//
// Codes used in log texts that signify a replacement to be performed,
// all caps and enclosed in slashes, eg /RANDOMBAND/
// evalFn: refer to a function name for replacement (evaluated at runtime).
// keyName: use a tData (passed to Log.add) key for replacement.
// bLink: this should appear as a clickable link in the UI.
// From Log.lua lines 641-687.

export interface ReplacementCode {
  /** Function-based replacement (evaluated at runtime) */
  evalFn?: string;
  /** Data key to look up in log entry's tData */
  keyName?: string;
  /** Whether this replacement should be rendered as a clickable link */
  bLink?: boolean;
}

/** 38 replacement codes from Log.lua lines 641-687 */
export const REPLACEMENT_CODES: Record<string, ReplacementCode> = {
  MYNAME: { evalFn: 'myName' },
  RANDOMBAND: { evalFn: 'randomBand' },
  RANDOMFOOD: { evalFn: 'randomFood' },
  FAVORITEFOOD: { evalFn: 'favoriteFood' },
  RANDOMGAME: { evalFn: 'randomGame' },
  PLAYTIME: { keyName: 'nPlayTime' },
  RANDOMDUTY: { evalFn: 'randomDuty' },
  MYDUTY: { evalFn: 'getDutyName' },
  DUTYTARGET: { bLink: true, keyName: 'sDutyTarget' },
  CHATPARTNER: { bLink: true, keyName: 'sChatPartner' },
  CHATTOPIC: { keyName: 'sTopic' },
  DECEASED: { bLink: true, keyName: 'sDeceased' },
  ATTACKTARGET: { bLink: true, keyName: 'sAttackTarget' },
  THINGKILLED: { keyName: 'sThingKilled' },
  TIMESBURNED: { keyName: 'sTimesBurned' },
  RANDOMDRINKNAME: { evalFn: 'randomDrinkName' },
  CURRENTROOM: { bLink: true, evalFn: 'currentRoom' },
  MYMEAL: { keyName: 'sMealName' },
  RANDOMPROVENANCE: { evalFn: 'randomProvenance' },
  RANDOMCREATURE: { evalFn: 'randomCreature' },
  RANDOMCITIZENINROOM: { evalFn: 'randomPersonInRoom' },
  CARRIEDRESEARCH: { keyName: 'sResearchData' },
  RESEARCHSUBJECT: { keyName: 'sResearchData' },
  RANDOMDISEASE: { evalFn: 'randomDisease' },
  PATIENT: { keyName: 'sPatient' },
  DOCTOR: { keyName: 'sDoctor' },
  DISEASE: { keyName: 'sDisease' },
  RANDOMPUB: { evalFn: 'randomPub' },
  NEARBYPERSON: { keyName: 'sCharacter' },
  NEARBYOBJECT: { keyName: 'sObject' },
  TRADEPARTNER: { bLink: true, keyName: 'sTradePartner' },
  TRADEITEM: { keyName: 'sItemName' },
  TRADEOTHERITEM: { keyName: 'sOtherItemName' },
  TRADETAG: { keyName: 'sFavTag' },
  ITEM: { keyName: 'sPickupItem' },
  ITEMTAG: { keyName: 'sFavTag' },
  OPPONENT: { keyName: 'sOpponent' },
  SABOTEUR: { keyName: 'sSaboteur' },
  RAMPAGER: { keyName: 'sRampager' },
  BESTFRIEND: { evalFn: 'bestFriend' },
};


// ── Tag Definitions ──────────────────────────────────────────────
//
// Tags attached to linecodes in the localization data. The log system
// scores each tag for a character to pick the best-fitting line.
// Tags can be prefixed with g_ (gated: only use if score > 0) or
// n_ (negated: only use if score <= 0).
// From Log.lua lines 689-741.

export interface TagDefinition {
  /** Scoring function name */
  scoreFn: string;
  /** Parameter for the scoring function (personality trait name, need name, job id, race id, activity name, etc.) */
  param?: string | number | boolean;
}

/** Race IDs matching CharacterConstants.lua */
export const RACE_HUMAN = 1;
export const RACE_JELLY = 2;
export const RACE_TOBIAN = 3;
export const RACE_CAT = 4;
export const RACE_BIRDSHARK = 5;
export const RACE_CHICKEN = 6;
export const RACE_MONSTER = 7;
export const RACE_SHAMON = 8;
export const RACE_MURDERFACE = 9;
export const RACE_KILLBOT = 10;

/** 41 tag definitions from Log.lua lines 689-741 */
export const TAG_DEFINITIONS: Record<string, TagDefinition> = {
  // personality variables
  brave: { scoreFn: 'normalizedScore', param: 'nBravery' },
  coward: { scoreFn: 'normalizedScoreInverted', param: 'nBravery' },
  gregarious: { scoreFn: 'normalizedScore', param: 'nGregariousness' },
  shy: { scoreFn: 'normalizedScoreInverted', param: 'nGregariousness' },
  neat: { scoreFn: 'normalizedScore', param: 'nNeatness' },
  slob: { scoreFn: 'normalizedScoreInverted', param: 'nNeatness' },
  optimist: { scoreFn: 'normalizedScore', param: 'nPositivity' },
  pessimist: { scoreFn: 'normalizedScoreInverted', param: 'nPositivity' },
  angry: { scoreFn: 'angerScore' },
  chill: { scoreFn: 'normalizedScoreInverted', param: 'nTemper' },
  hardworking: { scoreFn: 'normalizedScore', param: 'nWorkEthic' },
  lazy: { scoreFn: 'normalizedScoreInverted', param: 'nWorkEthic' },
  authoritarian: { scoreFn: 'normalizedScore', param: 'nAuthoritarian' },
  // morale
  happy: { scoreFn: 'moraleScore' },
  sad: { scoreFn: 'moraleScoreInverted' },
  // self-esteem (ie affinity for self)
  egoist: { scoreFn: 'selfEsteemScore' },
  insecure: { scoreFn: 'selfEsteemScoreInverted' },
  // "quirks" (boolean personality flags)
  emoticon: { scoreFn: 'quirkScore', param: 'bEmoticon' },
  gourmand: { scoreFn: 'quirkScore', param: 'bGourmand' },
  joker: { scoreFn: 'quirkScore', param: 'bJoker' },
  sentimental: { scoreFn: 'quirkScore', param: 'bSentimental' },
  competitive: { scoreFn: 'quirkScore', param: 'bCompetitive' },
  hipster: { scoreFn: 'quirkScore', param: 'bHipster' },
  // needs
  hungry: { scoreFn: 'needsScoreInverted', param: 'Hunger' },
  bored: { scoreFn: 'boredScore' },
  lonely: { scoreFn: 'needsScoreInverted', param: 'Social' },
  tired: { scoreFn: 'needsScoreInverted', param: 'Energy' },
  // duties
  scientist: { scoreFn: 'dutyScore', param: 9 },    // CharacterConstants.SCIENTIST
  technician: { scoreFn: 'dutyScore', param: 3 },    // CharacterConstants.TECHNICIAN
  // duty affinity
  lovesjob: { scoreFn: 'currentDutyAffScore' },
  hatesjob: { scoreFn: 'currentDutyAffScoreInverted' },
  // races
  human: { scoreFn: 'raceScore', param: RACE_HUMAN },
  tobian: { scoreFn: 'raceScore', param: RACE_TOBIAN },
  shamon: { scoreFn: 'raceScore', param: RACE_SHAMON },
  jelly: { scoreFn: 'raceScore', param: RACE_JELLY },
  cat: { scoreFn: 'raceScore', param: RACE_CAT },
  chicken: { scoreFn: 'raceScore', param: RACE_CHICKEN },
  birdshark: { scoreFn: 'raceScore', param: RACE_BIRDSHARK },
  // activity affinities - these correspond with Topics.tActivities entries
  boozer: { scoreFn: 'activityScore', param: 'Drinking' },
  jock: { scoreFn: 'activityScore', param: 'Exercise' },
  gamer: { scoreFn: 'activityScore', param: 'Gaming' },
};


// ── Random Data Tables ───────────────────────────────────────────
// These replace Topics.lua which is missing from the source distribution.
// Names are inferred from game context and Log.lua references.

export const RANDOM_BANDS: string[] = [
  'The Spacebillies',
  'Meteor Shower',
  'Zero-G Funk',
  'Nebula Dreams',
  'The Astro-Punks',
  'Void Walkers',
  'Starside',
  'The Cosmic Rays',
  'Dark Matter',
  'Solar Flare',
  'Quantum Leap',
  'Event Horizon',
  'The Parsecs',
  'Derelict Signal',
  'Stardust Rebellion',
  'Ionosphere',
  'Phase Shift',
  'Orbital Decay',
  'The Singularity',
  'Warp Whistle',
];

export const RANDOM_FOODS: string[] = [
  'space tacos',
  'freeze-dried ice cream',
  'nutrient paste',
  'synth-steak',
  'moon cheese',
  'protein cubes',
  'astro-noodles',
  'star fruit',
  'cosmic curry',
  'nebula soup',
  'gravity gravy',
  'plasma pudding',
  'replicator pizza',
  'vacuum-sealed sushi',
  'algae cake',
  'tofu surprise',
  'reconstituted scramble',
  'cryo-berries',
  'solar salad',
  'microwave burrito',
];

export const RANDOM_GAMES: string[] = [
  'Space Invaders',
  'Asteroid Blaster',
  'Zero-G Chess',
  'Nebula Quest',
  'Star Trader',
  'Gravity Ball',
  'Cosmic Checkers',
  'Warp Speed',
  'Derelict Dungeon',
  'Turret Defense',
  'Orbital Kombat',
  'Void Runner',
];

export const RANDOM_CREATURES: string[] = [
  'space slug',
  'void worm',
  'nebula jellyfish',
  'asteroid beetle',
  'cosmic spider',
  'star serpent',
  'plasma moth',
  'gravity bat',
  'crater crab',
  'vent crawler',
  'ion eel',
  'dust mite',
];

export const RANDOM_DRINK_NAMES: string[] = [
  'Cosmic Ale',
  'Star Lager',
  'Nebula Stout',
  'Void Porter',
  'Plasma Punch',
  'Zero-G Grog',
  'Meteor Mead',
  'Astro Cider',
  'Black Hole Brew',
  'Solar Sangria',
  'Quasar Cooler',
  'Warp Whiskey',
  'Comet Cocktail',
  'Supernova Sour',
  'Gamma Ray IPA',
  'Pulsar Pilsner',
];

export const RANDOM_PROVENANCES: string[] = [
  'Earth',
  'Mars Colony',
  'Europa Station',
  'Titan Base',
  'Ganymede Outpost',
  'Ceres Mining Hub',
  'Luna City',
  'Proxima Colony',
  'Kepler Station',
  'Tau Ceti Relay',
  'Enceladus Lab',
  'Vesta Settlement',
  'Io Foundry',
  'Callisto Port',
  'Triton Depot',
  'Eris Frontier',
];

/** Disease names for random log references (from Malady system context) */
export const RANDOM_DISEASES: string[] = [
  'Space Flu',
  'Cosmic Cough',
  'Nebula Fever',
  'Zero-G Nausea',
  'Void Rash',
  'Star Sickness',
  'Radiation Burns',
  'Cryo-Ache',
];

/** Generic pub names used when no named pubs exist on base */
export const RANDOM_PUBS: string[] = [
  'the pub',
  'the bar',
  'the cantina',
  'the lounge',
];
