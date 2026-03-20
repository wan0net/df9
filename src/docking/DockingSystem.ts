import { GameRules } from '../core/GameRules';
import { Base } from '../core/Base';
import { line } from '../localization/Localization';
import type { CharacterManager } from '../characters/CharacterManager';

export interface DockedShip {
  id: string;
  type: 'trader' | 'immigration' | 'diplomatic' | 'raider';
  name: string;
  dockingTime: number;
  duration: number;
  cargo?: TradeCargo;
  immigrants?: number;
  faction: string;
}

export interface TradeCargo {
  food: number;
  matter: number;
  luxuryGoods: number;
  medicalSupplies: number;
  priceMultiplier: number;
}

export interface TradeOffer {
  item: string;
  quantity: number;
  price: number;
}

export class DockingSystem {
  private dockedShips: Map<string, DockedShip> = new Map();
  private characterManager: CharacterManager;
  private nextTraderTime: number;
  private nextImmigrationTime: number;
  private readonly TRADER_INTERVAL = 300;
  private readonly IMMIGRATION_INTERVAL = 180;

  constructor(characterManager: CharacterManager) {
    this.characterManager = characterManager;
    this.nextTraderTime = (GameRules.simTime ?? 0) + 60 + Math.random() * 120;
    this.nextImmigrationTime = (GameRules.simTime ?? 0) + 30 + Math.random() * 60;
  }

  onTick(dt: number) {
    const currentTime = GameRules.simTime;
    
    for (const ship of this.dockedShips.values()) {
      if (currentTime - ship.dockingTime > ship.duration) {
        this.undockShip(ship.id);
      }
    }

    if (currentTime > this.nextTraderTime) {
      this.spawnTrader();
      this.nextTraderTime = currentTime + this.TRADER_INTERVAL + Math.random() * 120;
    }

    if (currentTime > this.nextImmigrationTime) {
      this.spawnImmigrationShip();
      this.nextImmigrationTime = currentTime + this.IMMIGRATION_INTERVAL + Math.random() * 60;
    }
  }

  spawnTrader(): DockedShip {
    const id = `trader_${Date.now()}`;
    const factions = ['Sol Federation', 'Free Traders Guild', 'Outer Rim Consortium', 'Nomad Caravan'];
    const faction = factions[Math.floor(Math.random() * factions.length)];
    
    const ship: DockedShip = {
      id,
      type: 'trader',
      name: `${faction} Vessel`,
      dockingTime: GameRules.simTime,
      duration: 60 + Math.random() * 60,
      cargo: {
        food: Math.floor(Math.random() * 50),
        matter: Math.floor(Math.random() * 200),
        luxuryGoods: Math.floor(Math.random() * 20),
        medicalSupplies: Math.floor(Math.random() * 10),
        priceMultiplier: 0.8 + Math.random() * 0.4,
      },
      faction,
    };

    this.dockedShips.set(id, ship);
    Base.addAlert('docking', line('ALERT_TRADER_ARRIVED', { faction }));
    
    return ship;
  }

  spawnImmigrationShip(): DockedShip {
    const id = `immigration_${Date.now()}`;
    const immigrants = 1 + Math.floor(Math.random() * 3);
    
    const ship: DockedShip = {
      id,
      type: 'immigration',
      name: line('IMMIGRATION_SHUTTLE'),
      dockingTime: GameRules.simTime,
      duration: 30,
      immigrants,
      faction: 'Diaspora Fleet',
    };

    this.dockedShips.set(id, ship);
    Base.addAlert('immigration', line('ALERT_IMMIGRATION_ARRIVED', { count: String(immigrants) }));
    
    for (let i = 0; i < immigrants; i++) {
      // E-7: Spawn at a random room tile instead of (0,0)
      const tile = this.characterManager.getRandomRoomTile();
      if (tile) {
        this.characterManager.spawnCharacterAt(tile.x, tile.y, false, true);
      }
    }
    
    return ship;
  }

  spawnRaider(): DockedShip {
    const id = `raider_${Date.now()}`;
    
    const ship: DockedShip = {
      id,
      type: 'raider',
      name: line('RAIDER_SHIP'),
      dockingTime: GameRules.simTime,
      duration: 20,
      faction: 'Hostile',
    };

    this.dockedShips.set(id, ship);
    Base.addAlert('hostile', line('ALERT_RAIDER_ARRIVED'));
    
    return ship;
  }

  undockShip(shipId: string) {
    const ship = this.dockedShips.get(shipId);
    if (!ship) return;
    
    this.dockedShips.delete(shipId);
    
    if (ship.type === 'trader') {
      Base.addAlert('system', line('ALERT_TRADER_DEPARTED', { faction: ship.faction }));
    } else if (ship.type === 'immigration') {
      Base.addAlert('system', line('ALERT_IMMIGRATION_DEPARTED'));
    }
  }

  buyCargo(shipId: string, item: keyof TradeCargo, quantity: number): boolean {
    const ship = this.dockedShips.get(shipId);
    if (!ship || ship.type !== 'trader' || !ship.cargo) return false;
    
    const itemValue = ship.cargo[item];
    if (typeof itemValue !== 'number' || itemValue < quantity) return false;
    
    const price = Math.floor(quantity * 10 * ship.cargo.priceMultiplier);
    if (GameRules.nMatter < price) return false;
    
    GameRules.nMatter -= price;
    ship.cargo[item] = itemValue - quantity;
    
    Base.addAlert('system', line('TRADE_COMPLETE', { item, quantity: String(quantity) }));
    return true;
  }

  sellMatter(shipId: string, amount: number): boolean {
    const ship = this.dockedShips.get(shipId);
    if (!ship || ship.type !== 'trader' || !ship.cargo) return false;
    
    if (GameRules.nMatter < amount) return false;
    
    const price = Math.floor(amount * 0.5 * ship.cargo.priceMultiplier);
    GameRules.nMatter -= amount;
    ship.cargo.matter += amount;
    
    Base.addAlert('system', line('SALE_COMPLETE', { amount: String(amount), price: String(price) }));
    return true;
  }

  getDockedShips(): DockedShip[] {
    return Array.from(this.dockedShips.values());
  }

  getActiveTraders(): DockedShip[] {
    return this.getDockedShips().filter(s => s.type === 'trader');
  }

  getTimeRemaining(shipId: string): number {
    const ship = this.dockedShips.get(shipId);
    if (!ship) return 0;
    return Math.max(0, ship.duration - (GameRules.simTime - ship.dockingTime));
  }

  clear() {
    this.dockedShips.clear();
    this.nextTraderTime = 0;
    this.nextImmigrationTime = 0;
  }
}
