import { GameRules } from '../core/GameRules';
import { Base } from '../core/Base';
import { line } from '../localization/Localization';
import type { Character } from '../characters/Character';
import type { CharacterManager } from '../characters/CharacterManager';
import { TEAM_ID_PLAYER } from '../characters/CharacterConstants';

export interface DerelictShip {
  id: string;
  type: 'research' | 'cargo' | 'military' | 'mining' | 'luxury';
  name: string;
  x: number;
  y: number;
  explored: boolean;
  looted: boolean;
  hasHostiles: boolean;
  condition: 'intact' | 'damaged' | 'derelict';
  resources: {
    matter: number;
    food: number;
    research: number;
  };
  crewRemaining: number;
  dangerLevel: number;
}

export type DerelictEventType = 
  | 'discovery'
  | 'hostileEncounter'
  | 'friendlySurvivors'
  | 'valuableLoot'
  | 'trap'
  | 'parasiteInfestation'
  | 'systemFailure';

export interface DerelictEvent {
  type: DerelictEventType;
  shipId: string;
  description: string;
  choices: DerelictChoice[];
}

export interface DerelictChoice {
  id: string;
  label: string;
  consequence: () => void;
  requiredJob?: number;
}

export class DerelictSystem {
  private derelicts: Map<string, DerelictShip> = new Map();
  private activeEvent: DerelictEvent | null = null;
  private exploredDerelicts = 0;
  private characterManager: CharacterManager;

  constructor(characterManager: CharacterManager) {
    this.characterManager = characterManager;
  }

  private shipNames = [
    'Von Braun', 'Event Horizon', 'Nostromo', 'Sulaco', 'Discovery',
    'Enterprise', 'Defiant', 'Galactica', 'Pegasus', 'Serenity',
    'Bebop', 'Outlaw Star', 'Arcadia', 'Yamato', 'Macross',
  ];

  private shipTypes: DerelictShip['type'][] = ['research', 'cargo', 'military', 'mining', 'luxury'];

  spawnDerelict(forceHostile = false): DerelictShip {
    const id = `derelict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const type = this.shipTypes[Math.floor(Math.random() * this.shipTypes.length)];
    const name = this.shipNames[Math.floor(Math.random() * this.shipNames.length)];
    
    const ship: DerelictShip = {
      id,
      type,
      name,
      x: this.randomPosition(),
      y: this.randomPosition(),
      explored: false,
      looted: false,
      hasHostiles: forceHostile || Math.random() < this.getHostileChance(type),
      condition: this.randomCondition(),
      resources: this.generateResources(type),
      crewRemaining: Math.floor(Math.random() * 5),
      dangerLevel: forceHostile ? Math.max(this.calculateDanger(type), 4) : this.calculateDanger(type),
    };

    this.derelicts.set(id, ship);
    
    Base.addAlert('derelict', line('ALERT_DERELICT_DETECTED', { name: ship.name }));
    
    return ship;
  }

  private randomPosition(): number {
    return Math.floor(Math.random() * 200) - 100;
  }

  private getHostileChance(type: DerelictShip['type']): number {
    const chances: Record<string, number> = {
      research: 0.2,
      cargo: 0.4,
      military: 0.7,
      mining: 0.3,
      luxury: 0.1,
    };
    return chances[type];
  }

  private randomCondition(): DerelictShip['condition'] {
    const roll = Math.random();
    if (roll < 0.3) return 'intact';
    if (roll < 0.7) return 'damaged';
    return 'derelict';
  }

  private generateResources(type: DerelictShip['type']): DerelictShip['resources'] {
    const baseResources: Record<string, DerelictShip['resources']> = {
      research: { matter: 100, food: 50, research: 500 },
      cargo: { matter: 300, food: 200, research: 100 },
      military: { matter: 200, food: 100, research: 200 },
      mining: { matter: 500, food: 80, research: 50 },
      luxury: { matter: 150, food: 300, research: 150 },
    };
    
    const base = baseResources[type];
    return {
      matter: base.matter + Math.floor(Math.random() * 100),
      food: base.food + Math.floor(Math.random() * 50),
      research: base.research + Math.floor(Math.random() * 200),
    };
  }

  private calculateDanger(type: DerelictShip['type']): number {
    const dangers: Record<string, number> = {
      research: 2,
      cargo: 3,
      military: 5,
      mining: 2,
      luxury: 1,
    };
    return dangers[type];
  }

  exploreDerelict(shipId: string, explorer?: Character, forceHostileEncounter = false): DerelictEvent {
    const ship = this.derelicts.get(shipId);
    if (!ship) throw new Error(`Derelict ${shipId} not found`);
    
    ship.explored = true;
    this.exploredDerelicts++;

    const activeExplorer = explorer ?? this.pickExplorer();
    const eventType = this.determineEventType(ship, forceHostileEncounter);
    const event = this.createEvent(eventType, ship, activeExplorer);
    this.activeEvent = event;
    
    return event;
  }

  private determineEventType(ship: DerelictShip, forceHostileEncounter = false): DerelictEventType {
    if (forceHostileEncounter) return 'hostileEncounter';
    if (ship.hasHostiles && Math.random() < 0.6) return 'hostileEncounter';
    if (ship.crewRemaining > 0 && Math.random() < 0.4) return 'friendlySurvivors';
    if (ship.condition === 'derelict' && Math.random() < 0.3) return 'systemFailure';
    if (ship.resources.research > 300 && Math.random() < 0.3) return 'parasiteInfestation';
    if (Math.random() < 0.2) return 'trap';
    if (ship.resources.matter > 300) return 'valuableLoot';
    return 'discovery';
  }

  private pickExplorer(): Character {
    const candidates = this.characterManager.getAllCharacters();
    const player = candidates.find(c => c.isAlive() && c.tStats.nTeam === TEAM_ID_PLAYER);
    if (player) return player;
    const fallback = candidates.find(c => c.isAlive());
    if (fallback) return fallback;
    throw new Error('No available explorer for derelict event');
  }

  private createEvent(type: DerelictEventType, ship: DerelictShip, explorer: Character): DerelictEvent {
    const events: Record<DerelictEventType, () => DerelictEvent> = {
      discovery: () => this.createDiscoveryEvent(ship),
      hostileEncounter: () => this.createHostileEvent(ship, explorer),
      friendlySurvivors: () => this.createSurvivorEvent(ship),
      valuableLoot: () => this.createLootEvent(ship),
      trap: () => this.createTrapEvent(ship, explorer),
      parasiteInfestation: () => this.createParasiteEvent(ship, explorer),
      systemFailure: () => this.createFailureEvent(ship),
    };

    return events[type]();
  }

  private createDiscoveryEvent(ship: DerelictShip): DerelictEvent {
    return {
      type: 'discovery',
      shipId: ship.id,
      description: line('DERELICT_DISCOVERY', { name: ship.name, type: ship.type }),
      choices: [
        {
          id: 'loot',
          label: line('DERELICT_CHOICE_LOOT'),
          consequence: () => this.lootDerelict(ship.id),
        },
        {
          id: 'leave',
          label: line('DERELICT_CHOICE_LEAVE'),
          consequence: () => {},
        },
      ],
    };
  }

  private createHostileEvent(ship: DerelictShip, explorer: Character): DerelictEvent {
    return {
      type: 'hostileEncounter',
      shipId: ship.id,
      description: line('DERELICT_HOSTILES', { name: ship.name }),
      choices: [
        {
          id: 'fight',
          label: line('DERELICT_CHOICE_FIGHT'),
          consequence: () => this.resolveCombat(ship, explorer),
        },
        {
          id: 'retreat',
          label: line('DERELICT_CHOICE_RETREAT'),
          consequence: () => {},
        },
      ],
    };
  }

  private createSurvivorEvent(ship: DerelictShip): DerelictEvent {
    return {
      type: 'friendlySurvivors',
      shipId: ship.id,
      description: line('DERELICT_SURVIVORS', { name: ship.name, count: String(ship.crewRemaining) }),
      choices: [
        {
          id: 'rescue',
          label: line('DERELICT_CHOICE_RESCUE'),
          consequence: () => this.rescueSurvivors(ship),
        },
        {
          id: 'ignore',
          label: line('DERELICT_CHOICE_IGNORE'),
          consequence: () => {},
        },
      ],
    };
  }

  private createLootEvent(ship: DerelictShip): DerelictEvent {
    return {
      type: 'valuableLoot',
      shipId: ship.id,
      description: line('DERELICT_VALUABLE', { name: ship.name }),
      choices: [
        {
          id: 'secure',
          label: line('DERELICT_CHOICE_SECURE'),
          consequence: () => this.secureLoot(ship),
        },
        {
          id: 'mark',
          label: line('DERELICT_CHOICE_MARK'),
          consequence: () => {},
        },
      ],
    };
  }

  private createTrapEvent(ship: DerelictShip, explorer: Character): DerelictEvent {
    return {
      type: 'trap',
      shipId: ship.id,
      description: line('DERELICT_TRAP', { name: ship.name }),
      choices: [
        {
          id: 'disarm',
          label: line('DERELICT_CHOICE_DISARM'),
          consequence: () => this.attemptDisarm(ship, explorer),
          requiredJob: 3,
        },
        {
          id: 'flee',
          label: line('DERELICT_CHOICE_FLEE'),
          consequence: () => this.attemptFlee(explorer),
        },
      ],
    };
  }

  private createParasiteEvent(ship: DerelictShip, explorer: Character): DerelictEvent {
    return {
      type: 'parasiteInfestation',
      shipId: ship.id,
      description: line('DERELICT_PARASITES', { name: ship.name }),
      choices: [
        {
          id: 'exterminate',
          label: line('DERELICT_CHOICE_EXTERMINATE'),
          consequence: () => this.fightParasites(ship, explorer),
        },
        {
          id: 'quarantine',
          label: line('DERELICT_CHOICE_QUARANTINE'),
          consequence: () => this.quarantineShip(ship),
        },
      ],
    };
  }

  private createFailureEvent(ship: DerelictShip): DerelictEvent {
    return {
      type: 'systemFailure',
      shipId: ship.id,
      description: line('DERELICT_FAILURE', { name: ship.name }),
      choices: [
        {
          id: 'salvage',
          label: line('DERELICT_CHOICE_SALVAGE'),
          consequence: () => this.salvageWreck(ship),
        },
        {
          id: 'abandon',
          label: line('DERELICT_CHOICE_ABANDON'),
          consequence: () => {},
        },
      ],
    };
  }

  private lootDerelict(shipId: string) {
    const ship = this.derelicts.get(shipId);
    if (!ship || ship.looted) return;
    
    ship.looted = true;
    GameRules.nMatter += ship.resources.matter;
    Base.addAlert('system', line('DERELICT_LOOTED', { matter: String(ship.resources.matter) }));
  }

  private resolveCombat(ship: DerelictShip, explorer: Character) {
    const success = Math.random() > 0.4;
    if (success) {
      this.lootDerelict(ship.id);
      Base.addAlert('system', line('DERELICT_COMBAT_WON'));
    } else {
      Base.addAlert('system', line('DERELICT_COMBAT_LOST'));
    }
  }

  private rescueSurvivors(ship: DerelictShip) {
    for (let i = 0; i < ship.crewRemaining; i++) {
      this.characterManager.spawnCharacterAt(0, 0, false, true);
    }
    Base.addAlert('system', line('DERELICT_RESCUED', { count: String(ship.crewRemaining) }));
    ship.crewRemaining = 0;
  }

  private secureLoot(ship: DerelictShip) {
    GameRules.nMatter += ship.resources.matter * 2;
    Base.addAlert('system', line('DERELICT_SECURED', { matter: String(ship.resources.matter * 2) }));
  }

  private attemptDisarm(ship: DerelictShip, explorer: Character) {
    const success = Math.random() > 0.3;
    if (success) {
      this.lootDerelict(ship.id);
      Base.addAlert('system', line('DERELICT_DISARMED'));
    } else {
      Base.addAlert('system', line('DERELICT_DISARM_FAILED'));
    }
  }

  private attemptFlee(explorer: Character) {
    Base.addAlert('system', line('DERELICT_FLED'));
  }

  private fightParasites(ship: DerelictShip, explorer: Character) {
    const success = Math.random() > 0.5;
    if (success) {
      this.lootDerelict(ship.id);
      Base.addAlert('system', line('DERELICT_PARASITES_CLEARED'));
    } else {
      Base.addAlert('system', line('DERELICT_PARASITES_FAILED'));
    }
  }

  private quarantineShip(ship: DerelictShip) {
    Base.addAlert('system', line('DERELICT_QUARANTINED'));
  }

  private salvageWreck(ship: DerelictShip) {
    const salvage = Math.floor(ship.resources.matter * 0.5);
    GameRules.nMatter += salvage;
    Base.addAlert('system', line('DERELICT_SALVAGED', { matter: String(salvage) }));
  }

  getDerelicts(): DerelictShip[] {
    return Array.from(this.derelicts.values());
  }

  getActiveEvent(): DerelictEvent | null {
    return this.activeEvent;
  }

  resolveEvent(choiceId: string) {
    if (!this.activeEvent) return;
    
    const choice = this.activeEvent.choices.find(c => c.id === choiceId);
    if (choice) {
      choice.consequence();
    }
    this.activeEvent = null;
  }

  getExploredCount(): number {
    return this.exploredDerelicts;
  }

  onTick(dt: number) {
    if (Math.random() < dt / 300 && this.derelicts.size < 9) {
      this.spawnDerelict();
    }
  }

  clear() {
    this.derelicts.clear();
    this.activeEvent = null;
    this.exploredDerelicts = 0;
  }
}
