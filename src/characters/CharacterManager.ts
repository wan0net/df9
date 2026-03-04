import { Character } from './Character';
import {
  MINER, BUILDER, TECHNICIAN, BARTENDER, BOTANIST, SCIENTIST, DOCTOR, JANITOR, EMERGENCY,
  RAIDER,
  CAUSE_OF_DEATH, MORALE_CITIZEN_DIES_MIN, MORALE_CITIZEN_DIES_MAX,
  ANGER_MAX, VIOLENT_RAMPAGE_CHANCE, HURT_THRESHOLD,
  TEAM_ID_PLAYER, TEAM_ID_DEBUG_ENEMYGROUP, STARTING_HIT_POINTS,
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
import { BuildTile } from '../utility/tasks/BuildTile';
import { GetDrink } from '../utility/tasks/GetDrink';
import { Eat } from '../utility/tasks/Eat';
import { MaintainEnvObject } from '../utility/tasks/MaintainEnvObject';
import { ServeDrink } from '../utility/tasks/ServeDrink';
import { MaintainPlants } from '../utility/tasks/MaintainPlants';
import { ResearchInLab } from '../utility/tasks/ResearchInLab';
import { FieldScanAndHeal } from '../utility/tasks/FieldScanAndHeal';
import { Patrol } from '../utility/tasks/Patrol';
import { DropOffCorpse } from '../utility/tasks/DropOffCorpse';
import { AttackEnemy } from '../utility/tasks/AttackEnemy';
import { Cuff } from '../utility/tasks/Cuff';
import { ListenToJukebox } from '../utility/tasks/ListenToJukebox';
import { LiftAtWeightBench } from '../utility/tasks/LiftAtWeightBench';
import { WorkOut } from '../utility/tasks/WorkOut';
import { Explore } from '../utility/tasks/Explore';
import { Breathe } from '../utility/tasks/Breathe';
import { Brawl } from '../utility/tasks/Brawl';
import { PanicFire } from '../utility/tasks/PanicFire';
import { PanicOxygen } from '../utility/tasks/PanicOxygen';
import { FleeThreat } from '../utility/tasks/FleeThreat';
import { PanicThreat } from '../utility/tasks/PanicThreat';
import { FireFleeArea } from '../utility/tasks/FireFleeArea';
import { OxygenFleeArea } from '../utility/tasks/OxygenFleeArea';
import { FleeEmergencyAlarm } from '../utility/tasks/FleeEmergencyAlarm';
import { RampageTantrum } from '../utility/tasks/RampageTantrum';
import { Sabotage } from '../utility/tasks/Sabotage';
import { BedHeal } from '../utility/tasks/BedHeal';
import { PutOnSuit } from '../utility/tasks/PutOnSuit';
import { HarvestAndDeliverFood } from '../utility/tasks/HarvestAndDeliverFood';
import { ServeFoodAtTable } from '../utility/tasks/ServeFoodAtTable';
import { EatAtTable } from '../utility/tasks/EatAtTable';
import { DropOffRocks } from '../utility/tasks/DropOffRocks';
import { IncapacitatedOnFloor } from '../utility/tasks/IncapacitatedOnFloor';
import { PRIORITY } from '../utility/ActivityOption';
import { CommandQueue } from '../core/CommandQueue';
import { EnvObjectManager } from '../envobjects/EnvObjectManager';
import { Base } from '../core/Base';
import { Corpse } from '../pickups/Corpse';
import { CombatSystem, isHostile } from '../combat/CombatSystem';
import { SquadList } from '../combat/SquadList';
import { FIRE_DAMAGE_PER_SECOND } from '../hazards/Fire';
import type { Fire } from '../hazards/Fire';
import { Malady } from '../malady/Malady';
import type { Task } from '../utility/Task';
import type { CharacterRenderer } from '../renderer/CharacterRenderer';
import type { CrewSpawnPoint } from '../world/WorldGen';
import type { Pickup } from '../pickups/Pickup';
import type { ProjectileManager } from '../hazards/Projectile';

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

  /** Combat system. */
  readonly combatSystem = new CombatSystem();

  /** Fire system reference for fire damage. */
  private fire: Fire | null = null;

  /** Malady contagion check timer. */
  private contagionTimer = 0;
  /** Contagion check interval in seconds. */
  private static readonly CONTAGION_INTERVAL = 5;
  /** Contagion range in tiles (manhattan distance). */
  private static readonly CONTAGION_RANGE = 3;

  constructor(grid: TileGrid, roomManager: RoomManager) {
    this.grid = grid;
    this.roomManager = roomManager;

    // Create default security squad
    SquadList.createSquad('Alpha Squad');
  }

  setRenderer(renderer: CharacterRenderer) {
    this.characterRenderer = renderer;
  }

  setProjectileManager(pm: ProjectileManager) {
    this.combatSystem.setProjectileManager(pm);
  }

  setFire(fire: Fire) {
    this.fire = fire;
  }

  getCharacters(): Character[] {
    return this.characters;
  }

  getPopulation(): number {
    return this.characters.filter(c => c.tStats.nTeam === TEAM_ID_PLAYER).length;
  }

  /** Get all characters including hostiles. */
  getAllCharacters(): Character[] {
    return this.characters;
  }

  /**
   * Spawn the initial crew at given positions (from WorldGen).
   * Original: 3 SpacewalkingSettlers in open space near the seed pod.
   */
  spawnInitialCrew(spawns: CrewSpawnPoint[]) {
    for (const spawn of spawns) {
      const char = new Character(this.nextId++, spawn.x, spawn.y);
      char.bSpacewalking = true; // Initial crew starts spacewalking
      char.setJob(BUILDER); // Starting crew are all builders (original Lua behavior)
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
      if (room && room.sealed && room.oxygen > 50) {
        // Safe sealed room — breathable
        char.needs.updateOxygen(room.oxygen);
        if (char.bSpacewalking) {
          char.bSpacewalking = false;
        }
      } else {
        // In space, on unsealed floor, or in a room with no oxygen
        char.needs.updateOxygen(room?.oxygen ?? 0);
        if (!char.bSpacewalking) {
          char.bSpacewalking = true;
        }
      }

      // Update renderer
      this.characterRenderer?.updateCharacter(char);
    }

    // Fire damage to characters on fire tiles
    if (this.fire) {
      const fireTiles = this.fire.getFireTiles();
      for (const char of this.characters) {
        if (!char.isAlive()) continue;
        const key = `${char.tileX},${char.tileY}`;
        if (fireTiles.has(key)) {
          char.damage(FIRE_DAMAGE_PER_SECOND * dtSec, CAUSE_OF_DEATH.FIRE);
        }
      }
    }

    // Malady contagion
    this.contagionTimer += dtSec;
    if (this.contagionTimer >= CharacterManager.CONTAGION_INTERVAL) {
      this.contagionTimer -= CharacterManager.CONTAGION_INTERVAL;
      this.processContagion();
    }

    // Process combat
    this.processCombat(dtSec);

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

  /** Spawn hostile raiders in a random room. */
  spawnHostiles(count: number, hp: number = STARTING_HIT_POINTS) {
    const rooms = this.roomManager.getRooms();
    if (rooms.length === 0) return;

    for (let i = 0; i < count; i++) {
      const room = rooms[Math.floor(Math.random() * rooms.length)];
      if (room.tiles.length === 0) continue;
      const tile = room.tiles[Math.floor(Math.random() * room.tiles.length)];

      const char = new Character(this.nextId++, tile.x, tile.y);
      char.tStats.nTeam = TEAM_ID_DEBUG_ENEMYGROUP;
      char.tStats.nJob = RAIDER;
      char.tStats.nHP = hp;
      char.tStats.nMaxHP = hp;
      char.tStats.sName = `Raider ${i + 1}`;
      char.weapon = 'LaserPistol';

      this.characterRenderer?.createCharacter(char);
      this.characters.push(char);
    }
  }

  /** Process combat system — resolve hits. */
  private processCombat(dt: number) {
    const hits = this.combatSystem.update(dt, (id) => this.characters.find(c => c.id === id));

    for (const hit of hits) {
      const defender = this.characters.find(c => c.id === hit.defenderId);
      if (defender && defender.isAlive()) {
        const cause = CombatSystem.getCauseFromDamageType(hit.damageType);
        defender.damage(hit.damage, cause);
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

        // Disengage from combat
        this.combatSystem.disengage(char.id);

        // Log death alert
        const causeName = Object.entries(CAUSE_OF_DEATH).find(([, v]) => v === char.nCauseOfDeath)?.[0] ?? 'unknown';
        Base.addAlert('death', `${char.getName()} has died (${causeName.toLowerCase()})`);

        // Morale hit on all living player characters (not for enemy deaths)
        if (char.tStats.nTeam === TEAM_ID_PLAYER) {
          for (const other of this.characters) {
            if (other === char || !other.isAlive()) continue;
            if (other.tStats.nTeam !== TEAM_ID_PLAYER) continue;
            const affinity = other.tAffinity.get(char.id) ?? 0;
            const scale = Math.min(1, affinity / 10);
            const hit = MORALE_CITIZEN_DIES_MIN + scale * (MORALE_CITIZEN_DIES_MAX - MORALE_CITIZEN_DIES_MIN);
            other.nMorale = Math.max(-100, other.nMorale + hit);
          }
        }

        // Remove from squads
        const squad = SquadList.getSquadForChar(char.id);
        if (squad) squad.removeMember(char.id);

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

  /** Get count of hostile characters currently alive. */
  getHostileCount(): number {
    return this.characters.filter(c => c.isAlive() && isHostile(TEAM_ID_PLAYER, c.tStats.nTeam)).length;
  }

  /** Check malady contagion: sneeze spread to nearby characters. */
  private processContagion() {
    for (const carrier of this.characters) {
      if (!carrier.isAlive() || carrier.maladies.length === 0) continue;

      // Check if it's time for a sneeze-spread
      const anim = Malady.getSymptomAnim(carrier);
      if (anim === 'sneeze') {
        Malady.playedSymptomAnim(carrier, this.characters);
      }
    }
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

      // Spacewalking characters: try outdoor tasks first, then seek nearest room
      if (char.bSpacewalking) {
        // Check for outdoor tasks (build_tile, mine) that can be done in a spacesuit
        const outdoorOptions: ActivityOption[] = [];
        for (const cmd of CommandQueue.getAvailable('build_tile')) {
          outdoorOptions.push(new ActivityOption(
            new BuildTile(cmd.id, this.grid),
            cmd.tileX, cmd.tileY,
            9,
          ));
        }
        for (const cmd of CommandQueue.getAvailable('mine')) {
          outdoorOptions.push(new ActivityOption(
            new Mine(cmd.id, this.grid),
            cmd.tileX, cmd.tileY,
            7,
          ));
        }
        if (outdoorOptions.length > 0) {
          const task = UtilityAI.selectTask(char, outdoorOptions);
          if (task) {
            this.assignTask(char, task);
            processed++;
            continue;
          }
        }
        // No outdoor tasks — just seek the nearest room
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

      // Hostile AI: attack nearest player character
      if (isHostile(TEAM_ID_PLAYER, char.tStats.nTeam)) {
        this.runHostileAI(char);
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

  /** Run hostile AI — attack nearest player character. */
  private runHostileAI(char: Character) {
    const target = this.combatSystem.findNearestHostile(char, this.characters);
    if (target) {
      const task = new AttackEnemy(target.id);
      task.targetX = target.tileX;
      task.targetY = target.tileY;
      this.assignTask(char, task);

      // Engage in combat system
      this.combatSystem.engage(char, target);
    } else {
      // No targets — wander
      this.wander(char);
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
        if (other.tStats.nTeam !== TEAM_ID_PLAYER) continue; // Don't chat with hostiles
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
          new BuildEnvObject(obj, cmd.id, this.grid),
          cmd.tileX, cmd.tileY,
          priority,
        ));
      }
    }

    // ── Build tile commands (floor/wall construction) ─────
    for (const cmd of CommandQueue.getAvailable('build_tile')) {
      const priority = job === BUILDER ? 9 : 4; // Higher priority than objects
      options.push(new ActivityOption(
        new BuildTile(cmd.id, this.grid),
        cmd.tileX, cmd.tileY,
        priority,
      ));
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

    // ── Combat response: attack hostiles ────────────────────
    if (job === EMERGENCY || this.getHostileCount() > 0) {
      const nearest = this.combatSystem.findNearestHostile(character, this.characters);
      if (nearest) {
        const combatPriority = job === EMERGENCY ? 15 : 5;
        const attackTask = new AttackEnemy(nearest.id);
        options.push(new ActivityOption(
          attackTask,
          nearest.tileX, nearest.tileY,
          combatPriority,
        ));
      }
    }

    // ── Security: cuff rampaging citizens ────────────────────
    if (job === EMERGENCY) {
      for (const other of this.characters) {
        if (other === character || !other.isAlive()) continue;
        if (other.bRampaging && other.tStats.nTeam === TEAM_ID_PLAYER) {
          options.push(new ActivityOption(
            new Cuff(other.id),
            other.tileX, other.tileY,
            12,
          ));
        }
      }
    }

    // ── Job-specific tasks ────────────────────────────────────
    const shiftBoost = character.bOnShift ? 2 : 0;

    // BARTENDER: Serve drink at bar
    if (job === BARTENDER) {
      for (const bar of EnvObjectManager.getObjectsByType('Bar')) {
        if (!bar.bBuilt || !bar.isFunctioning()) continue;
        options.push(new ActivityOption(
          new ServeDrink(),
          bar.tileX, bar.tileY,
          6 + shiftBoost,
        ));
      }
    }

    // BOTANIST: Maintain garden plants
    if (job === BOTANIST) {
      const plantTypes = ['space_tree', 'HydroPlant', 'BulbousPlant', 'StrangePlant', 'HousePlant'];
      for (const pType of plantTypes) {
        for (const plant of EnvObjectManager.getObjectsByType(pType)) {
          if (!plant.bBuilt || !plant.needsMaintenance()) continue;
          options.push(new ActivityOption(
            new MaintainPlants(plant),
            plant.tileX, plant.tileY,
            7 + shiftBoost,
          ));
        }
      }
    }

    // SCIENTIST: Research at desk
    if (job === SCIENTIST) {
      for (const desk of EnvObjectManager.getObjectsByType('ResearchDesk')) {
        if (!desk.bBuilt || !desk.isFunctioning()) continue;
        options.push(new ActivityOption(
          new ResearchInLab(),
          desk.tileX, desk.tileY,
          5 + shiftBoost,
        ));
      }
    }

    // DOCTOR: Heal wounded characters
    if (job === DOCTOR) {
      for (const other of this.characters) {
        if (other === character || !other.isAlive()) continue;
        if (other.tStats.nTeam !== TEAM_ID_PLAYER) continue; // Don't heal hostiles
        if (other.tStats.nHP < HURT_THRESHOLD) {
          options.push(new ActivityOption(
            new FieldScanAndHeal(other),
            other.tileX, other.tileY,
            10 + shiftBoost,
          ));
        }
      }
    }

    // EMERGENCY: Patrol rooms
    if (job === EMERGENCY) {
      if (room && room.tiles.length >= 2) {
        const target = room.tiles[Math.floor(Math.random() * room.tiles.length)];
        options.push(new ActivityOption(
          new Patrol(),
          target.x, target.y,
          3 + shiftBoost,
        ));
      }
    }

    // JANITOR: Pick up corpses
    if (job === JANITOR) {
      for (const pickup of this.pickups) {
        if (pickup.sName === 'Corpse' && !pickup.bPickedUp) {
          options.push(new ActivityOption(
            new DropOffCorpse(),
            pickup.tileX, pickup.tileY,
            8 + shiftBoost,
          ));
        }
      }
    }

    // ── Hobby: Listen to Jukebox ──────────────────────────────
    for (const jukebox of EnvObjectManager.getObjectsByType('Jukebox')) {
      if (!jukebox.bBuilt || !jukebox.isFunctioning()) continue;
      options.push(new ActivityOption(
        new ListenToJukebox(),
        jukebox.tileX, jukebox.tileY,
        2,
      ));
    }

    // ── Hobby: Lift at weight bench ─────────────────────────
    for (const bench of EnvObjectManager.getObjectsByType('WeightBench')) {
      if (!bench.bBuilt || !bench.isFunctioning()) continue;
      options.push(new ActivityOption(
        new LiftAtWeightBench(),
        bench.tileX, bench.tileY,
        2,
      ));
    }

    // ── Hobby: Work out (no gym needed) ─────────────────────
    if (room) {
      options.push(new ActivityOption(
        new WorkOut(),
        character.tileX, character.tileY,
        0.5,
      ));
    }

    // ── Explore (all characters, low priority) ──────────────
    if (room && room.tiles.length >= 2) {
      const target = room.tiles[Math.floor(Math.random() * room.tiles.length)];
      options.push(new ActivityOption(
        new Explore(),
        target.x, target.y,
        0.3,
        { tags: { WorkShift: true } },
      ));
    }

    // ── Brawl (anger-driven, high anger only) ───────────────
    if (character.nAnger >= 60) {
      for (const other of this.characters) {
        if (other === character || !other.isAlive()) continue;
        if (other.tStats.nTeam !== TEAM_ID_PLAYER) continue;
        const otherRoom = this.roomManager.getRoomAt(other.tileX, other.tileY);
        if (otherRoom === room) {
          options.push(new ActivityOption(
            new Brawl(),
            other.tileX, other.tileY,
            60,
            { priorityLevel: PRIORITY.SURVIVAL_LOW },
          ));
          break;
        }
      }
    }

    // ── Fire response (branching on bravery) ──────────────────
    if (room && this.hasFireInRoom(room)) {
      // Low bravery: panic
      options.push(new ActivityOption(
        new PanicFire(),
        character.tileX, character.tileY,
        2,
        {
          priorityLevel: PRIORITY.SURVIVAL_NORMAL,
          personalityGates: { nBravery: [0, 0.4] },
        },
      ));
      // Moderate+ bravery: flee the area
      options.push(new ActivityOption(
        new FireFleeArea(),
        character.tileX, character.tileY,
        4,
        {
          priorityLevel: PRIORITY.SURVIVAL_NORMAL,
          personalityGates: { nBravery: [0.2, 1] },
        },
      ));
    }

    // ── Oxygen response (branching on bravery) ───────────────
    if (room && room.oxygen < 30) {
      // Low bravery: panic
      options.push(new ActivityOption(
        new PanicOxygen(),
        character.tileX, character.tileY,
        1,
        {
          priorityLevel: PRIORITY.SURVIVAL_NORMAL,
          personalityGates: { nBravery: [0, 0.4] },
        },
      ));
      // All: flee low-oxygen area
      options.push(new ActivityOption(
        new OxygenFleeArea(),
        character.tileX, character.tileY,
        200,
        { priorityLevel: PRIORITY.SURVIVAL_NORMAL },
      ));
    }

    // ── Threat response (branching on bravery) ───────────────
    if (this.getHostileCount() > 0 && job !== EMERGENCY) {
      const nearest = this.combatSystem.findNearestHostile(character, this.characters);
      if (nearest) {
        const dist = Math.abs(character.tileX - nearest.tileX) + Math.abs(character.tileY - nearest.tileY);
        if (dist < 10) {
          // Low bravery: panic
          options.push(new ActivityOption(
            new PanicThreat(),
            character.tileX, character.tileY,
            110,
            {
              priorityLevel: PRIORITY.SURVIVAL_NORMAL,
              personalityGates: { nBravery: [0, 0.2] },
            },
          ));
          // Moderate bravery: flee
          options.push(new ActivityOption(
            new FleeThreat(),
            character.tileX, character.tileY,
            110,
            {
              priorityLevel: PRIORITY.SURVIVAL_NORMAL,
              personalityGates: { nBravery: [0.2, 0.8] },
            },
          ));
        }
      }
    }

    // ── Rampage (anger-driven, rampaging characters only) ────
    if (character.bRampaging) {
      // Violent rampage
      options.push(new ActivityOption(
        new RampageTantrum(),
        character.tileX, character.tileY,
        100,
        { priorityLevel: PRIORITY.SURVIVAL_NORMAL },
      ));
      // Non-violent sabotage: target a nearby object
      for (const obj of EnvObjectManager.getObjects()) {
        if (!obj.bBuilt || obj.nCondition <= 0) continue;
        options.push(new ActivityOption(
          new Sabotage(obj),
          obj.tileX, obj.tileY,
          105,
          { priorityLevel: PRIORITY.SURVIVAL_LOW },
        ));
        break; // Just the nearest one
      }
    }

    // ── Incapacitated (very low HP) ──────────────────────────
    if (character.tStats.nHP <= 10 && character.tStats.nHP > 0) {
      options.push(new ActivityOption(
        new IncapacitatedOnFloor(),
        character.tileX, character.tileY,
        0.002,
        { prerequisites: { NonThreatening: true } },
      ));
    }

    // ── Doctor: Heal patients in hospital beds ───────────────
    if (job === DOCTOR) {
      for (const bed of EnvObjectManager.getObjectsByType('HospitalBed')) {
        if (!bed.bBuilt || !bed.isFunctioning()) continue;
        // Find a wounded character near the bed
        for (const other of this.characters) {
          if (other === character || !other.isAlive()) continue;
          if (other.tStats.nTeam !== TEAM_ID_PLAYER) continue;
          if (other.tStats.nHP < other.tStats.nMaxHP * 0.7) {
            options.push(new ActivityOption(
              new BedHeal(other),
              bed.tileX, bed.tileY,
              16 + shiftBoost,
              { tags: { Job: DOCTOR, WorkShift: true } },
            ));
            break;
          }
        }
      }
    }

    // ── Botanist: Harvest and deliver food ───────────────────
    if (job === BOTANIST) {
      const plantTypes = ['space_tree', 'HydroPlant', 'BulbousPlant', 'StrangePlant'];
      for (const pType of plantTypes) {
        for (const plant of EnvObjectManager.getObjectsByType(pType)) {
          if (!plant.bBuilt) continue;
          if (plant.nCondition > 80) { // Harvestable when healthy
            options.push(new ActivityOption(
              new HarvestAndDeliverFood(),
              plant.tileX, plant.tileY,
              7 + shiftBoost,
              { tags: { Job: BOTANIST, WorkShift: true } },
            ));
            break;
          }
        }
      }
    }

    // ── Bartender: Serve food at table ───────────────────────
    if (job === BARTENDER) {
      for (const table of EnvObjectManager.getObjectsByType('StandingTable')) {
        if (!table.bBuilt) continue;
        options.push(new ActivityOption(
          new ServeFoodAtTable(),
          table.tileX, table.tileY,
          6 + shiftBoost,
          { tags: { Job: BARTENDER, WorkShift: true } },
        ));
      }
    }

    // ── Eat at table (better than replicator) ────────────────
    for (const table of EnvObjectManager.getObjectsByType('StandingTable')) {
      if (!table.bBuilt) continue;
      options.push(new ActivityOption(
        new EatAtTable(),
        table.tileX, table.tileY,
        3,
      ));
    }

    // ── Miner: Drop off rocks at refinery ────────────────────
    if (job === MINER && character.heldItem === 'Rock') {
      const refineries = [
        ...EnvObjectManager.getObjectsByType('RefineryDropoff'),
        ...EnvObjectManager.getObjectsByType('RefineryDropoffLevel2'),
      ];
      for (const ref of refineries) {
        if (!ref.bBuilt || !ref.isFunctioning()) continue;
        options.push(new ActivityOption(
          new DropOffRocks(),
          ref.tileX, ref.tileY,
          7 + shiftBoost,
          {
            tags: { Job: MINER },
            prerequisites: { HeldItem: 'Rock' },
          },
        ));
      }
    }

    // ── Put on suit (near airlock lockers) ───────────────────
    for (const locker of EnvObjectManager.getObjectsByType('AirlockLocker')) {
      if (!locker.bBuilt || !locker.isFunctioning()) continue;
      if (character.bSpacesuit) continue; // Already suited
      options.push(new ActivityOption(
        new PutOnSuit(),
        locker.tileX, locker.tileY,
        0.5,
      ));
    }

    // ── Breathe (absolute fallback) ─────────────────────────
    options.push(new ActivityOption(
      new Breathe(),
      character.tileX, character.tileY,
      0.001,
    ));

    return options;
  }

  /** Check if a room has any active fires. */
  private hasFireInRoom(room: Room): boolean {
    if (!this.fire) return false;
    const fireTiles = this.fire.getFireTiles();
    for (const tile of room.tiles) {
      if (fireTiles.has(`${tile.x},${tile.y}`)) return true;
    }
    return false;
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

    // Start combat engagement if this is an AttackEnemy task
    if (task instanceof AttackEnemy) {
      const targetId = task.getTargetCharId();
      const target = this.characters.find(c => c.id === targetId);
      if (target) {
        this.combatSystem.engage(char, target);
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
