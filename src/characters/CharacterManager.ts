import { Character } from './Character';
import {
  MINER, BUILDER, TECHNICIAN,
  CAUSE_OF_DEATH, MORALE_CITIZEN_DIES_MIN, MORALE_CITIZEN_DIES_MAX,
  ANGER_MAX, VIOLENT_RAMPAGE_CHANCE,
} from './CharacterConstants';
import { TileGrid } from '../world/TileGrid';
import { TileType } from '../world/TileTypes';
import { RoomManager } from '../rooms/RoomManager';
import { Room } from '../rooms/Room';
import { findPath, WALKABLE_DEFAULT, WALKABLE_SPACEWALK } from '../pathfinding/AStar';
import { INITIAL_CREW } from '../config';
import { UtilityAI } from '../utility/UtilityAI';
import { ActivityOption } from '../utility/ActivityOption';
import { WanderAround } from '../utility/tasks/WanderAround';
import { SleepOnFloor } from '../utility/tasks/SleepOnFloor';
import { SleepInBed } from '../utility/tasks/SleepInBed';
import { Chat } from '../utility/tasks/Chat';
import { Mine } from '../utility/tasks/Mine';
import { BuildEnvObject } from '../utility/tasks/BuildEnvObject';
import { GetDrink } from '../utility/tasks/GetDrink';
import { Eat } from '../utility/tasks/Eat';
import { MaintainEnvObject } from '../utility/tasks/MaintainEnvObject';
import { CommandQueue } from '../core/CommandQueue';
import { EnvObjectManager } from '../envobjects/EnvObjectManager';
import { Base } from '../core/Base';
import { Corpse } from '../pickups/Corpse';
import type { Task } from '../utility/Task';
import type { CharacterRenderer } from '../renderer/CharacterRenderer';
import type { CrewSpawnPoint } from '../world/WorldGen';
import type { Pickup } from '../pickups/Pickup';

/** Max AI decisions per tick (Lua: UPDATES_PER_TICK=10) */
const UPDATES_PER_TICK = 10;

export class CharacterManager {
  private grid: TileGrid;
  private roomManager: RoomManager;
  private characterRenderer: CharacterRenderer | null = null;
  private characters: Character[] = [];
  private spawned = false;
  private nextId = 0;
  private aiTickAccum = 0;
  private aiTickInterval = 1000; // ms between AI decisions

  /** Characters needing new task decisions. */
  private decisionQueue: Character[] = [];

  /** Active pickups (corpses, debris, etc.) */
  pickups: Pickup[] = [];

  constructor(grid: TileGrid, roomManager: RoomManager) {
    this.grid = grid;
    this.roomManager = roomManager;
  }

  setRenderer(renderer: CharacterRenderer) {
    this.characterRenderer = renderer;
  }

  getCharacters(): Character[] {
    return this.characters;
  }

  getPopulation(): number {
    return this.characters.length;
  }

  /**
   * Spawn the initial crew at given positions (from WorldGen).
   * Original: 3 SpacewalkingSettlers in open space near the seed pod.
   */
  spawnInitialCrew(spawns: CrewSpawnPoint[]) {
    for (const spawn of spawns) {
      const char = new Character(this.nextId++, spawn.x, spawn.y);
      char.bSpacewalking = true; // Initial crew starts spacewalking
      this.characterRenderer?.createCharacter(char);
      this.characters.push(char);
    }
    this.spawned = true;
  }

  update(delta: number) {

    // Update characters
    const dtSec = delta / 1000;
    for (const char of this.characters) {
      char.update(delta);
      char.needs.decay(dtSec);
      // Pass room morale score to character morale update
      const charRoom = this.roomManager.getRoomAt(char.tileX, char.tileY);
      char.updateMorale(dtSec, charRoom?.nMoraleScore ?? 0);

      // Update active task
      if (char.currentTask && char.currentTask.isActive()) {
        char.currentTask.update(dtSec);
      }

      // Update O2 need from room
      const room = this.roomManager.getRoomAt(char.tileX, char.tileY);
      if (room) {
        char.needs.updateOxygen(room.oxygen);
        // Character entered a room — stop spacewalking
        if (char.bSpacewalking) {
          char.bSpacewalking = false;
        }
      } else {
        char.needs.updateOxygen(0);
      }

      // Update renderer
      this.characterRenderer?.updateCharacter(char);
    }

    // Handle dead characters → corpse conversion
    this.processDeaths();

    // AI tick
    this.aiTickAccum += delta;
    if (this.aiTickAccum >= this.aiTickInterval) {
      this.aiTickAccum -= this.aiTickInterval;
      this.runAI();
    }
  }

  /** Spawn a single character on a random floor tile in any available room */
  spawnCharacter() {
    const rooms = this.roomManager.getRooms();
    for (const room of rooms) {
      if (room.tiles.length > 0) {
        const tile = room.tiles[Math.floor(Math.random() * room.tiles.length)];
        const char = new Character(this.nextId++, tile.x, tile.y);
        this.characterRenderer?.createCharacter(char);
        this.characters.push(char);
        return;
      }
    }
  }

  /** Convert dead characters into corpses and remove them. */
  private processDeaths() {
    for (let i = this.characters.length - 1; i >= 0; i--) {
      const char = this.characters[i];
      if (!char.isAlive()) {
        // Create corpse pickup at death tile
        const corpse = new Corpse(char.tileX, char.tileY, char.getName(), char.nCauseOfDeath);
        this.pickups.push(corpse);

        // Log death alert
        const causeName = Object.entries(CAUSE_OF_DEATH).find(([, v]) => v === char.nCauseOfDeath)?.[0] ?? 'unknown';
        Base.addAlert('death', `${char.getName()} has died (${causeName.toLowerCase()})`);

        // Morale hit on all living characters
        for (const other of this.characters) {
          if (other === char || !other.isAlive()) continue;
          const affinity = other.tAffinity.get(char.id) ?? 0;
          const scale = Math.min(1, affinity / 10);
          const hit = MORALE_CITIZEN_DIES_MIN + scale * (MORALE_CITIZEN_DIES_MAX - MORALE_CITIZEN_DIES_MIN);
          other.nMorale = Math.max(-100, other.nMorale + hit);
        }

        // Remove from renderer and character list
        this.characterRenderer?.destroyCharacter(char.id);
        char.destroy();
        this.characters.splice(i, 1);
      }
    }
  }

  /** Spawn a character at a specific tile position. Returns the new character. */
  spawnCharacterAt(tileX: number, tileY: number, spacewalking = false): Character {
    const char = new Character(this.nextId++, tileX, tileY);
    char.bSpacewalking = spacewalking;
    this.characterRenderer?.createCharacter(char);
    this.characters.push(char);
    return char;
  }

  /** Get all active pickups. */
  getPickups(): Pickup[] {
    return this.pickups;
  }

  private runAI() {
    // Build decision queue: characters that need new tasks
    this.decisionQueue = [];
    for (const char of this.characters) {
      if (!char.isAlive()) continue;
      if (char.moving || char.path.length > 0) continue;

      // Check if current task is done or absent
      if (!char.currentTask || char.currentTask.isComplete() || char.currentTask.isFailed()) {
        this.decisionQueue.push(char);
      }

      char.idleTimer += this.aiTickInterval;
    }

    // Process up to UPDATES_PER_TICK decisions
    let processed = 0;
    for (const char of this.decisionQueue) {
      if (processed >= UPDATES_PER_TICK) break;

      // Spacewalking characters: seek nearest room
      if (char.bSpacewalking) {
        this.seekNearestRoom(char);
        processed++;
        continue;
      }

      // Character in space (not spacewalking) but not in a room → start spacewalking to find one
      const charRoom = this.roomManager.getRoomAt(char.tileX, char.tileY);
      if (!charRoom && this.grid.get(char.tileX, char.tileY) === TileType.SPACE) {
        char.bSpacewalking = true;
        this.seekNearestRoom(char);
        processed++;
        continue;
      }

      // Rampage check: anger at max triggers rampage
      if (char.nAnger >= ANGER_MAX && !char.bRampaging) {
        char.bRampaging = true;
        char.bViolentRampage = Math.random() < VIOLENT_RAMPAGE_CHANCE;
        Base.addAlert('rampage',
          `${char.getName()} has gone on a ${char.bViolentRampage ? 'violent' : 'non-violent'} rampage!`);
        // Rampage lasts until anger decays below 50
      }
      if (char.bRampaging && char.nAnger < 50) {
        char.bRampaging = false;
        char.bViolentRampage = false;
      }

      // Emergency: seek oxygen if suffocating
      if (char.needs.oxygen < 50) {
        this.seekOxygenatedRoom(char);
        processed++;
        continue;
      }

      // Gather activity options
      const options = this.gatherOptions(char);
      const task = UtilityAI.selectTask(char, options);

      if (task) {
        this.assignTask(char, task);
      } else if (char.idleTimer > 2000) {
        // Fallback: wander
        this.wander(char);
        char.idleTimer = 0;
      }

      processed++;
    }
  }

  /** Gather all available activity options for a character. */
  private gatherOptions(character: Character): ActivityOption[] {
    const options: ActivityOption[] = [];
    const room = this.roomManager.getRoomAt(character.tileX, character.tileY);
    const job = character.getJob();

    // Always available: wander
    if (room && room.tiles.length >= 2) {
      const target = room.tiles[Math.floor(Math.random() * room.tiles.length)];
      options.push(new ActivityOption(new WanderAround(), target.x, target.y, 1));
    }

    // Sleep on floor (low priority, always available)
    options.push(new ActivityOption(
      new SleepOnFloor(),
      character.tileX, character.tileY,
      0.5,
    ));

    // Chat (if other characters nearby in same room)
    // Priority scaled by gregariousness personality trait
    if (room) {
      for (const other of this.characters) {
        if (other === character) continue;
        if (!other.isAlive()) continue;
        const otherRoom = this.roomManager.getRoomAt(other.tileX, other.tileY);
        if (otherRoom === room) {
          const chatPriority = 2 + character.tStats.personality.nGregariousness * 4;
          options.push(new ActivityOption(
            new Chat(),
            other.tileX, other.tileY,
            chatPriority,
          ));
          break;
        }
      }
    }

    // ── Mine commands ────────────────────────────────────────
    for (const cmd of CommandQueue.getAvailable('mine')) {
      const priority = job === MINER ? 8 : 3;
      options.push(new ActivityOption(
        new Mine(cmd.id, this.grid),
        cmd.tileX, cmd.tileY,
        priority,
      ));
    }

    // ── Build object commands ────────────────────────────────
    for (const cmd of CommandQueue.getAvailable('build_object')) {
      const obj = EnvObjectManager.getObjects().find(
        o => o.tileX === cmd.tileX && o.tileY === cmd.tileY && !o.bBuilt,
      );
      if (obj) {
        const priority = job === BUILDER ? 8 : 3;
        options.push(new ActivityOption(
          new BuildEnvObject(obj, cmd.id),
          cmd.tileX, cmd.tileY,
          priority,
        ));
      }
    }

    // ── Sleep in bed ─────────────────────────────────────────
    for (const bed of EnvObjectManager.getObjectsByType('Bed')) {
      if (!bed.bBuilt || !bed.isFunctioning()) continue;
      options.push(new ActivityOption(
        new SleepInBed(),
        bed.tileX, bed.tileY,
        2,
      ));
    }

    // ── Get drink (bar) ──────────────────────────────────────
    for (const bar of EnvObjectManager.getObjectsByType('Bar')) {
      if (!bar.bBuilt || !bar.isFunctioning()) continue;
      options.push(new ActivityOption(
        new GetDrink(),
        bar.tileX, bar.tileY,
        2,
      ));
    }

    // ── Eat (food replicator / fridge) ───────────────────────
    const foodSources = [
      ...EnvObjectManager.getObjectsByType('Fridge'),
      ...EnvObjectManager.getObjectsByType('FridgeLvl2'),
      ...EnvObjectManager.getObjectsByType('FoodReplicator'),
    ];
    for (const food of foodSources) {
      if (!food.bBuilt || !food.isFunctioning()) continue;
      options.push(new ActivityOption(
        new Eat(),
        food.tileX, food.tileY,
        2,
      ));
    }

    // ── Maintain damaged objects ─────────────────────────────
    for (const obj of EnvObjectManager.getObjects()) {
      if (!obj.bBuilt || !obj.needsMaintenance()) continue;
      const priority = job === TECHNICIAN ? 10 : 2;
      options.push(new ActivityOption(
        new MaintainEnvObject(obj),
        obj.tileX, obj.tileY,
        priority,
      ));
    }

    return options;
  }

  /** Assign a task to a character and start pathfinding if needed. */
  private assignTask(char: Character, task: Task) {
    char.currentTask = task;
    task.start(char);

    // Path to task target if not already there
    if (task.targetX >= 0 && (task.targetX !== char.tileX || task.targetY !== char.tileY)) {
      const filter = char.bSpacewalking ? WALKABLE_SPACEWALK : WALKABLE_DEFAULT;
      const maxNodes = char.bSpacewalking ? 3000 : 1000;
      const path = findPath(this.grid, char.tileX, char.tileY, task.targetX, task.targetY, maxNodes, filter);
      if (path && path.length > 0) {
        char.startPath(path);
      }
    }

    char.idleTimer = 0;
  }

  private seekOxygenatedRoom(char: Character) {
    const rooms = this.roomManager.getRooms();
    let bestRoom: Room | null = null;
    let bestO2 = 0;

    for (const room of rooms) {
      if (room.oxygen > bestO2 && room.sealed) {
        bestO2 = room.oxygen;
        bestRoom = room;
      }
    }

    if (bestRoom && bestRoom.tiles.length > 0) {
      const target = bestRoom.tiles[Math.floor(Math.random() * bestRoom.tiles.length)];
      const filter = char.bSpacewalking ? WALKABLE_SPACEWALK : WALKABLE_DEFAULT;
      const maxNodes = char.bSpacewalking ? 3000 : 1000;
      const path = findPath(this.grid, char.tileX, char.tileY, target.x, target.y, maxNodes, filter);
      if (path && path.length > 0) {
        char.startPath(path);
      }
    }
  }

  /**
   * Spacewalking character seeks the nearest room.
   * Finds closest door or floor tile belonging to any room and paths through space to reach it.
   */
  private seekNearestRoom(char: Character) {
    const rooms = this.roomManager.getRooms();
    if (rooms.length === 0) return; // No rooms built yet — stay idle

    // Find closest floor tile in any room
    let bestTile: { x: number; y: number } | null = null;
    let bestDist = Infinity;

    for (const room of rooms) {
      for (const tile of room.tiles) {
        const dx = tile.x - char.tileX;
        const dy = tile.y - char.tileY;
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) {
          bestDist = dist;
          bestTile = tile;
        }
      }
    }

    if (bestTile) {
      const path = findPath(
        this.grid, char.tileX, char.tileY,
        bestTile.x, bestTile.y,
        3000, WALKABLE_SPACEWALK,
      );
      if (path && path.length > 0) {
        char.startPath(path);
      }
    }
  }

  private wander(char: Character) {
    const room = this.roomManager.getRoomAt(char.tileX, char.tileY);
    if (!room || room.tiles.length < 2) return;

    const target = room.tiles[Math.floor(Math.random() * room.tiles.length)];
    if (target.x === char.tileX && target.y === char.tileY) return;

    const path = findPath(this.grid, char.tileX, char.tileY, target.x, target.y);
    if (path && path.length > 0) {
      char.startPath(path);
    }
  }
}
