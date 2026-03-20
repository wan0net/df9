import { Character } from './Character';
import { addLog } from './Log';
import { line } from '../localization/Localization';
import {
  MINER, BUILDER, TECHNICIAN, BARTENDER, BOTANIST, SCIENTIST, DOCTOR, JANITOR, EMERGENCY,
  RAIDER, UNEMPLOYED,
  CAUSE_OF_DEATH, FAMILIARITY_TICK_RATE, FAMILIARITY_TICK_INCREASE,
  HURT_THRESHOLD,
  TEAM_ID_PLAYER, TEAM_ID_DEBUG_ENEMYGROUP, STARTING_HIT_POINTS,
  STATUS_DEAD,
  OXYGEN_PER_SECOND, OXYGEN_SUFFOCATION_UNTIL_DEATH, SPACESUIT_MAX_OXYGEN,
  OXYGEN_LOW, OXYGEN_SUFFOCATING,
  NEEDS_HUNGER_STARVATION, TIME_BEFORE_STARVATION,
  JOB_EXPERIENCE_RATE, UNNECESSARY_SPACESUIT_REMOVE,
  RACE_KILLBOT,
} from './CharacterConstants';
import { SpatialAudio } from '../audio/SpatialAudio';
import { TileGrid } from '../world/TileGrid';
import { TileType } from '../world/TileTypes';
import { RoomManager } from '../rooms/RoomManager';
import { Room } from '../rooms/Room';
import { ZoneType } from '../world/ZoneType';
import { findPath, WALKABLE_DEFAULT, WALKABLE_SPACEWALK } from '../pathfinding/AStar';
import { INITIAL_CREW } from '../config';
import { GameRules } from '../core/GameRules';
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
import { PickUpFloorItem } from '../utility/tasks/PickUpFloorItem';
import { IncapacitatedOnFloor } from '../utility/tasks/IncapacitatedOnFloor';
import { ExtinguishFireWithTool } from '../utility/tasks/ExtinguishFireWithTool';
import { ExtinguishFireBareHanded } from '../utility/tasks/ExtinguishFireBareHanded';
import { DropEverything } from '../utility/tasks/DropEverything';
import { DestroyEnvObject } from '../utility/tasks/DestroyEnvObject';
import { ChatPartner } from '../utility/tasks/ChatPartner';
import { MaintainPub } from '../utility/tasks/MaintainPub';
import { EatAtFoodReplicator } from '../utility/tasks/EatAtFoodReplicator';
import { EatPlant } from '../utility/tasks/EatPlant';
import { PlayGameSystem } from '../utility/tasks/PlayGameSystem';
import { WorkOutInGym } from '../utility/tasks/WorkOutInGym';
import { CheckInToHospital } from '../utility/tasks/CheckInToHospital';
import { PanicOnFire } from '../utility/tasks/PanicOnFire';
import { VacuumPull } from '../utility/tasks/VacuumPull';
import { CircleBeacon } from '../utility/tasks/CircleBeacon';
import { PRIORITY, type PriorityLevel } from '../utility/ActivityOption';
import { EmergencyBeacon } from '../combat/EmergencyBeacon';
import { CommandQueue } from '../core/CommandQueue';
import { EnvObjectManager } from '../envobjects/EnvObjectManager';
import { tDoorsByAddr, Door } from '../envobjects/Door';
import { Base } from '../core/Base';
import { Corpse, CORPSE_TYPE_FRIENDLY, CORPSE_TYPE_RAIDER, CORPSE_TYPE_MONSTER } from '../pickups/Corpse';
import { CombatSystem, isHostile } from '../combat/CombatSystem';
import { SquadList } from '../combat/SquadList';
import { FIRE_DAMAGE_PER_SECOND } from '../hazards/Fire';
import type { Fire } from '../hazards/Fire';
import { Malady } from '../malady/Malady';
import { CHANCE_OF_MALADY } from '../events/EventData';
import {
  addTopic, generateCharacterAffinities, getRandomImmigrationCategory,
  IMMIGRATION_ADD_TOPIC_CHANCE,
} from './Topics';
import type { Task } from '../utility/Task';
import type { CharacterRenderer } from '../renderer/CharacterRenderer';
import type { CrewSpawnPoint } from '../world/WorldGen';
import type { Pickup } from '../pickups/Pickup';
import type { ProjectileManager } from '../hazards/Projectile';
import type { DecalRenderer } from '../renderer/DecalRenderer';
import type { VacuumSystem } from '../oxygen/VacuumSystem';

/** Max AI decisions per tick (Lua: UPDATES_PER_TICK=10) */
const UPDATES_PER_TICK = 10;

/** Lua CharacterConstants.SURVIVAL_TICK = 1 second.
 *  Timer per character: 0.5 * SURVIVAL_TICK + random * SURVIVAL_TICK -> 0.5-1.5s */
const SURVIVAL_TICK = 1;

export class CharacterManager {
  private grid: TileGrid;
  private roomManager: RoomManager;
  private wallAutoGen: import('../world/WallAutoGen').WallAutoGen | null = null;
  private characterRenderer: CharacterRenderer | null = null;
  private characters: Character[] = [];
  private spawned = false;
  private nextId = 0;
  private aiTickAccum = 0;
  private aiTickInterval = 1000; // ms between AI decisions

  /** Characters needing new task decisions. */
  private decisionQueue: Character[] = [];

  /** Characters needing immediate AI re-evaluation (task just completed or survival threat). */
  private immediateAIQueue: Set<Character> = new Set();

  /** Active pickups (corpses, debris, etc.) */
  pickups: Pickup[] = [];

  /** Combat system. */
  readonly combatSystem = new CombatSystem();

  /** Fire system reference for fire damage. */
  private fire: Fire | null = null;

  /** Decal renderer for blood decals. */
  private decalRenderer: DecalRenderer | null = null;

  /** Vacuum system for decompression vectors. */
  private vacuumSystem: VacuumSystem | null = null;

  /** Malady contagion check timer. */
  private contagionTimer = 0;
  /** Contagion check interval in seconds. */
  private static readonly CONTAGION_INTERVAL = 5;
  /** Contagion range in tiles (manhattan distance). */
  private static readonly CONTAGION_RANGE = 3;

  /** Familiarity tick accumulator (seconds). */
  private familiarityAccum = 0;

  setWallAutoGen(wag: import('../world/WallAutoGen').WallAutoGen) {
    this.wallAutoGen = wag;
  }

  constructor(grid: TileGrid, roomManager: RoomManager) {
    this.grid = grid;
    this.roomManager = roomManager;

    // Wire AttackEnemy statics for LoS + target resolution
    AttackEnemy.grid = grid;
    AttackEnemy.getCharById = (id: number) => this.characters.find(c => c.id === id);

    // Wire combat system grid for LoS
    this.combatSystem.grid = grid;

    // Create default security squad
    SquadList.createSquad('Alpha Squad');

    // Wire ActivityOption.roomLookup for DestSafe/DestOwned tag enforcement (C-1)
    ActivityOption.roomLookup = (tx: number, ty: number) => this.roomManager.getRoomAt(tx, ty);
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

  setDecalRenderer(dr: DecalRenderer) {
    this.decalRenderer = dr;
  }

  setVacuumSystem(vs: VacuumSystem) {
    this.vacuumSystem = vs;
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

  /** Get characters on a specific team (Lua CharacterManager.getTeamCharacters). */
  getTeamCharacters(nTeam: number): Character[] {
    return this.characters.filter(c => c.tStats.nTeam === nTeam && c.isAlive());
  }

  /** Find a living character by name. */
  getCharacterNamed(name: string): Character | undefined {
    return this.characters.find(c => c.getName() === name && c.isAlive());
  }

  /** Get characters with a specific active task type. */
  getOwnedCharactersWithTask(taskName: string): Character[] {
    return this.characters.filter(c =>
      c.tStats.nTeam === TEAM_ID_PLAYER && c.isAlive() &&
      c.currentTask?.name === taskName,
    );
  }

  /** Get all characters whose current tile belongs to the given room. */
  getCharactersAt(room: { tiles: { x: number; y: number }[] }): Character[] {
    const tileSet = new Set(room.tiles.map(t => `${t.x},${t.y}`));
    return this.characters.filter(c => tileSet.has(`${c.tileX},${c.tileY}`));
  }

  /**
   * Spawn the initial crew at given positions (from WorldGen).
   * Original: 3 SpacewalkingSettlers in open space near the seed pod.
   */
  spawnInitialCrew(spawns: CrewSpawnPoint[]) {
    for (const spawn of spawns) {
      const char = new Character(this.nextId++, spawn.x, spawn.y);
      char.bSpacewalking = true; // Initial crew starts spacewalking
      // Lua: SpacewalkingSettler template (ModuleData.lua:85-100)
      char.bSpacesuit = true;
      char.nSuitOxygen = SPACESUIT_MAX_OXYGEN;
      char.setJob(BUILDER); // Starting crew are all builders
      // Lua: tStatus={bBaseFounder=true, bImmuneToParasite=true, nMorale=50}
      char.nMorale = 50;
      char.bBaseFounder = true;
      char.bImmuneToParasite = true;
      // Lua: tNeeds={Energy=80, Hunger=80} — needs start at 80% (not full)
      char.needs.energy = 80;
      char.needs.hunger = 80;
      this.characterRenderer?.createCharacter(char);
      this.characters.push(char);
    }
    this.spawned = true;
  }

  update(delta: number) {

    // Update characters
    const dtSec = delta / 1000;

    // Clear room character sets before re-populating
    for (const room of this.roomManager.getRooms()) {
      room.tCharacters.clear();
      room.bHasHostiles = false;
    }

    for (const char of this.characters) {
      char.update(delta);
      // Lua: skip need decay for needs promised by the current task
      let promisedNeeds: Set<string> | undefined;
      if (char.currentTask) {
        const advNeeds = char.currentTask.getAdvertisedNeeds();
        if (advNeeds.length > 0) {
          promisedNeeds = new Set(advNeeds.map(a => a.need.charAt(0).toUpperCase() + a.need.slice(1)));
        }
      }
      // M-1: Get malady need modifiers (one per need)
      const maladyMods: Record<string, number> = {};
      for (const need of ['Hunger', 'Energy', 'Amusement', 'Social', 'Duty'] as const) {
        const mod = Malady.getNeedsReduceMods(char, need);
        if (mod !== undefined) maladyMods[need] = mod;
      }
      char.needs.decay(dtSec, promisedNeeds, Object.keys(maladyMods).length > 0 ? maladyMods : undefined);

      // C-5: Continuous job XP gain for on-duty characters performing work-shift tasks
      // Lua Character.lua: JOB_EXPERIENCE_RATE = 25/60 per second while working
      if (char.currentTask && char.currentTask.tags?.WorkShift && char.onDuty()) {
        const job = char.tStats.nJob;
        if (job >= 0 && job !== UNEMPLOYED) {
          char.addJobExperience(JOB_EXPERIENCE_RATE * dtSec);
        }
      }

      // Starvation check (Lua Character.lua:2430-2443)
      if (char.needs.hunger <= NEEDS_HUNGER_STARVATION) {
        char.nStarveTime += dtSec;
        if (char.nStarveTime >= TIME_BEFORE_STARVATION) {
          char.kill(CAUSE_OF_DEATH.STARVATION);
        }
      } else if (char.nStarveTime > 0) {
        char.nStarveTime = 0;
      }

      // Pass room morale score to character morale update
      const charRoom = this.roomManager.getRoomAt(char.tileX, char.tileY);
      char.updateMorale(dtSec, charRoom?.nMoraleScore ?? 0, charRoom ? ZoneType[charRoom.zone] : undefined);

      // Update active task
      if (char.currentTask && char.currentTask.isActive()) {
        char.currentTask.update(dtSec);
      }

      // C-2: Immediate reassignment -- Lua checks needsNewTask() every frame.
      // When a task completes or fails, queue for immediate AI instead of
      // waiting for the next aiTickInterval.
      if (char.isAlive() && !char.moving && char.path.length === 0 &&
          (!char.currentTask || char.currentTask.isComplete() || char.currentTask.isFailed())) {
        this.immediateAIQueue.add(char);
      }

      // Register character with room — add to current room's tCharacters
      // (Old room removal happens via room rebuild clearing tCharacters, or
      //  we clear all rooms' tCharacters at start of this loop — see below.)
      if (charRoom) {
        charRoom.tCharacters.add(char.id);
        // Update room last-seen time when player-team character is present
        if (char.tStats.nTeam === TEAM_ID_PLAYER) {
          charRoom.nLastSeen = GameRules.elapsedTime;
        }
        // Track hostiles in room
        if (char.tStats.nTeam !== TEAM_ID_PLAYER && isHostile(char.tStats.nTeam, TEAM_ID_PLAYER)) {
          charRoom.bHasHostiles = true;
        }
      }

      // Update O2 need from room + suffocation (Lua Character.updateOxygen)
      // Lua uses a 0.25s tick accumulator — oxygen logic only runs every OXYGEN_TICK seconds
      const room = charRoom;
      const OXYGEN_TICK = 0.25;

      // Non-breathing races (MONSTER, KILLBOT) don't need O2
      if (!char.doesBreathe()) {
        char.needs.updateOxygen(255);
        char.suffocationTime = 0;
        if (char.bSpacewalking) char.bSpacewalking = false;
      } else {
        char.oxygenTimer -= dtSec;
        if (char.oxygenTimer < 0) {
          const o2dt = OXYGEN_TICK + Math.abs(char.oxygenTimer);
          char.oxygenTimer = OXYGEN_TICK;

          // Get O2 on Lua scale (0-65535) for threshold comparisons
          const o2 = room ? room.getOxygenScore() : 0;
          char.needs.updateOxygen(room?.oxygen ?? 0);

          // Lua: _updateSpacewalking(o2 < OXYGEN_LOW)
          if (o2 < OXYGEN_LOW) {
            if (!char.bSpacewalking) char.bSpacewalking = true;
          } else {
            if (char.bSpacewalking) char.bSpacewalking = false;
          }

          // Suit vs no-suit logic (Lua Character.updateOxygen lines 1627-1750)
          if (!char.bSpacesuit) {
            // No spacesuit — check O2 thresholds (Lua lines 1663-1700)
            const tileType = this.grid.get(char.tileX, char.tileY);
            let newO2 = o2 - (OXYGEN_PER_SECOND * o2dt);

            // Bonus suffocation in space (Lua: suffocationTime += 15 per tick)
            if (tileType === TileType.SPACE) {
              char.suffocationTime += 15;
              newO2 = 0;
            }

            if (newO2 < OXYGEN_SUFFOCATING) {
              char.suffocationTime += o2dt;
              char.bLowOxygen = true;
            } else if (newO2 < OXYGEN_LOW) {
              char.bLowOxygen = true;
              // No suffocation in low-O2 range, just warning
            } else {
              char.bLowOxygen = false;
              char.suffocationTime = 0;
            }
          } else {
            // Wearing spacesuit — consume suit O2 (Lua lines 1712-1745)
            char.nSuitOxygen -= OXYGEN_PER_SECOND * o2dt;
            if (char.nSuitOxygen <= 0) {
              char.nSuitOxygen = 0;
              char.suffocationTime += o2dt;
              char.bLowOxygen = true;
            } else {
              char.suffocationTime = 0;
              char.bLowOxygen = false;
            }
          }
        }
      }

      // Kill if suffocated too long
      if (char.suffocationTime >= OXYGEN_SUFFOCATION_UNTIL_DEATH && char.isAlive()) {
        char.kill(CAUSE_OF_DEATH.SUFFOCATION);
      }

      // C-26: Remove unnecessary spacesuit after 10s in pressurized room
      // Lua: UNNECESSARY_SPACESUIT_REMOVE = 10 seconds
      if (char.bSpacesuit && !char.bSpacewalking && charRoom && charRoom.sealed && charRoom.oxygen > 200) {
        (char as any).nUnnecessarySpacesuit += dtSec;
        if ((char as any).nUnnecessarySpacesuit >= UNNECESSARY_SPACESUIT_REMOVE) {
          char.bSpacesuit = false;
          (char as any).nUnnecessarySpacesuit = -1;
        }
      } else if (char.bSpacesuit) {
        (char as any).nUnnecessarySpacesuit = 0;
      }

      // Update renderer
      this.characterRenderer?.updateCharacter(char);
    }

    // Door auto-open proximity (Lua Door:setCharacterNearby)
    // For each door, check if any character is on or adjacent to it
    if (tDoorsByAddr.size > 0) {
      for (const [key, door] of tDoorsByAddr) {
        let nearby = false;
        for (const char of this.characters) {
          if (!char.isAlive()) continue;
          // Character is on the door tile
          if (char.tileX === door.tileX && char.tileY === door.tileY) {
            nearby = true;
            break;
          }
          // Character is on the second tile (airlock)
          if (door.secondTileX >= 0 && char.tileX === door.secondTileX && char.tileY === door.secondTileY) {
            nearby = true;
            break;
          }
          // Character is adjacent to door (diamond neighbors)
          const neighbors = this.grid.getDiagonalNeighbors(door.tileX, door.tileY);
          for (const n of neighbors) {
            if (n && char.tileX === n.x && char.tileY === n.y) {
              nearby = true;
              break;
            }
          }
          if (nearby) break;
        }
        door.setCharacterNearby(nearby);
      }
    }

    // Fire damage (Lua tickFireDamage: onFire OR standing on fire tile)
    if (this.fire) {
      const fireTiles = this.fire.getFireTiles();
      for (const char of this.characters) {
        if (!char.isAlive()) continue;
        const key = `${char.tileX},${char.tileY}`;
        const onFireTile = fireTiles.has(key);
        if (char.bOnFire || onFireTile) {
          char.damage(FIRE_DAMAGE_PER_SECOND * dtSec, CAUSE_OF_DEATH.FIRE);
        }
        // Douse if not on a fire tile anymore (Lua: douseFire when moving off)
        if (char.bOnFire && !onFireTile) {
          char.douseFire();
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

    // Tick vacuum death animations (Lua CharacterManager:deathTick)
    for (let i = this.characters.length - 1; i >= 0; i--) {
      const char = this.characters[i];
      if (!char.isAlive() && char.nVacuumScale >= 0) {
        if (char.tickVacuumDeath(dtSec)) {
          // Animation done — force immediate corpse conversion
          char.nVacuumScale = -1;
        }
        // Update renderer with shrink/spin values
        this.characterRenderer?.updateCharacter(char);
      }
    }

    // Handle dead characters → corpse conversion
    this.processDeaths();

    // Familiarity tick — characters in same room gain familiarity
    this.familiarityAccum += dtSec;
    if (this.familiarityAccum >= FAMILIARITY_TICK_RATE) {
      this.familiarityAccum -= FAMILIARITY_TICK_RATE;
      this.tickFamiliarity();
    }

    // C-3: Survival threat preemption (Lua Character:_testSurvivalThreats)
    for (const char of this.characters) {
      if (!char.isAlive()) continue;
      if (char.tStats.nTeam !== TEAM_ID_PLAYER) continue;
      if (char.survivalTimer === undefined) {
        char.survivalTimer = 0.5 * SURVIVAL_TICK + Math.random() * SURVIVAL_TICK;
      }
      char.survivalTimer -= dtSec;
      if (char.survivalTimer <= 0) {
        char.survivalTimer = 0.5 * SURVIVAL_TICK + Math.random() * SURVIVAL_TICK;
        this.testSurvivalThreats(char);
      }
    }

    // C-2: Process immediate AI queue (characters whose tasks just completed
    // or who were flagged by survival threat checks).
    if (this.immediateAIQueue.size > 0) {
      let processed = 0;
      for (const char of this.immediateAIQueue) {
        if (processed >= UPDATES_PER_TICK) break;
        if (!char.isAlive()) continue;
        this.runAIForCharacter(char);
        processed++;
      }
      this.immediateAIQueue.clear();
    }

    // AI tick (periodic batch re-evaluation for idle characters)
    this.aiTickAccum += delta;
    if (this.aiTickAccum >= this.aiTickInterval) {
      this.aiTickAccum -= this.aiTickInterval;
      this.runAI();
    }
  }

  /** Get a random tile from an existing room (for spawn placement). */
  getRandomRoomTile(): { x: number; y: number } | null {
    const rooms = this.roomManager.getRooms();
    for (const room of rooms) {
      if (room.tiles.length > 0) {
        return room.tiles[Math.floor(Math.random() * room.tiles.length)];
      }
    }
    return null;
  }

  /** Spawn a single character on a random floor tile in any available room */
  spawnCharacter(): Character | null {
    const rooms = this.roomManager.getRooms();
    for (const room of rooms) {
      if (room.tiles.length > 0) {
        const tile = room.tiles[Math.floor(Math.random() * room.tiles.length)];
        const char = new Character(this.nextId++, tile.x, tile.y);
        this.characterRenderer?.createCharacter(char);
        this.characters.push(char);
        return char;
      }
    }
    return null;
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
      const attacker = this.characters.find(c => c.id === hit.attackerId);
      if (defender && defender.isAlive()) {
        CombatSystem.processHit(defender, hit.damage, hit.damageType, attacker, this.characters);
        if (!defender.isAlive()) {
          const cause = CombatSystem.getCauseFromDamageType(hit.damageType);
          defender.nCauseOfDeath = cause;
        }
      }
    }
  }

  /** Convert dead characters into corpses and remove them. */
  private processDeaths() {
    for (let i = this.characters.length - 1; i >= 0; i--) {
      const char = this.characters[i];
      if (!char.isAlive()) {
        // Vacuum death: delay removal for shrink/spin animation (Lua _vacuumDisappear)
        if (char.nVacuumScale >= 0) continue; // still animating

        // Determine corpse type from team/race (Lua Corpse.TYPE_*)
        let corpseType = CORPSE_TYPE_FRIENDLY;
        if (char.tStats.nTeam !== TEAM_ID_PLAYER) {
          // Check if monster race
          const raceDef = char.getRaceDef();
          corpseType = !raceDef.bCanBeCuffed ? CORPSE_TYPE_MONSTER : CORPSE_TYPE_RAIDER;
        }
        // Create corpse pickup at death tile
        const corpse = new Corpse(char.tileX, char.tileY, char.getName(), char.nCauseOfDeath, corpseType);
        // Register with room (Lua: Room:addProp for pickups)
        corpse.rRoom = this.roomManager.getRoomAt(char.tileX, char.tileY);
        this.pickups.push(corpse);

        // Blood decal on combat deaths (Lua: bBloodDecal for SHOT/THING/default causes)
        // Not for killbots, suffocation, starvation, fire, space deaths
        const cause = char.nCauseOfDeath;
        const bBloodDecal = cause === CAUSE_OF_DEATH.COMBAT_RANGED ||
          cause === CAUSE_OF_DEATH.COMBAT_MELEE || cause === CAUSE_OF_DEATH.THING ||
          cause === CAUSE_OF_DEATH.UNSPECIFIED;
        const tileType = this.grid.get(char.tileX, char.tileY);
        if (bBloodDecal && tileType !== TileType.SPACE && this.decalRenderer) {
          this.decalRenderer.addBloodDecal(char.tileX, char.tileY);
        }

        // Release any object reservations held by the dead character
        if (char.currentTask?.rTargetObject) {
          char.currentTask.rTargetObject.unreserve(char.id);
        }

        // Disengage from combat
        this.combatSystem.disengage(char.id);

        // A-12: Killbot death sound
        if (char.tStats.nRace === RACE_KILLBOT) {
          SpatialAudio.playAtTile('Killbot_Death', char.tileX, char.tileY);
        }

        // Log death alert — per-cause linecodes (Lua CharacterManager:_alertOnDeath)
        const deathAlertLC = (() => {
          switch (char.nCauseOfDeath) {
            case CAUSE_OF_DEATH.SUFFOCATION: return 'ALERTS004TEXT';
            case CAUSE_OF_DEATH.FIRE: return 'ALERTS005TEXT';
            case CAUSE_OF_DEATH.DISEASE: return 'ALERTS006TEXT';
            case CAUSE_OF_DEATH.SUCKED_INTO_SPACE: return 'ALERTS014TEXT';
            case CAUSE_OF_DEATH.COMBAT_RANGED:
            case CAUSE_OF_DEATH.COMBAT_MELEE: return 'ALERTS015TEXT';
            case CAUSE_OF_DEATH.PARASITE: return 'ALERTS016TEXT';
            case CAUSE_OF_DEATH.STARVATION: return 'ALERTS018TEXT';
            case CAUSE_OF_DEATH.DEBUG: return 'ALERTS008TEXT';
            default: return 'ALERTS007TEXT';
          }
        })();
        Base.addAlert('death', line(deathAlertLC, { name: char.getName() }));

        // Death react logs + morale hit (Lua CharacterManager.killCharacter)
        const deceasedName = char.getName();
        const isPlayerDeath = char.tStats.nTeam === TEAM_ID_PLAYER;
        for (const other of this.characters) {
          if (other === char || !other.isAlive()) continue;
          const otherIsPlayer = other.tStats.nTeam === TEAM_ID_PLAYER;
          const logData = { sDeceased: deceasedName };

          if (otherIsPlayer && isPlayerDeath) {
            // Player reacts to player death
            const fam = other.getFamiliarity(char.id);
            const aff = other.getAffinity(String(char.id));
            if (aff > 0 && fam >= 5) {
              addLog('DEATH_REACT_FRIEND', other, logData);
            } else {
              addLog('DEATH_REACT_CITIZEN', other, logData);
            }
            const hit = other.getDeathMoraleLoss(char.id);
            other.nMorale = Math.max(-100, other.nMorale + hit);
          } else if (otherIsPlayer && !isPlayerDeath) {
            addLog('DEATH_REACT_ENEMY', other, logData);
          } else if (!otherIsPlayer && isPlayerDeath) {
            addLog('DEATH_REACT_RAIDER_TO_CITZ', other, logData);
          } else {
            addLog('DEATH_REACT_RAIDER_TO_RAIDER', other, logData);
          }
        }

        // Remove from squads
        const squad = SquadList.getSquadForChar(char.id);
        if (squad) squad.removeMember(char.id);

        // Track death
        this.deadCharacterIds.add(char.id);

        // Remove from renderer and character list
        this.characterRenderer?.destroyCharacter(char.id);
        char.destroy();
        this.characters.splice(i, 1);
      }
    }
  }

  /** Spawn a character at a specific tile position. Returns the new character.
   *  @param bImmigration — if true, apply malady pre-roll (Lua: CHANCE_OF_MALADY). */
  spawnCharacterAt(tileX: number, tileY: number, spacewalking = false, bImmigration = false): Character {
    const char = new Character(this.nextId++, tileX, tileY);
    char.bSpacewalking = spacewalking;
    this.characterRenderer?.createCharacter(char);
    this.characters.push(char);

    // Topics wiring (Lua CharacterManager:onImmigration)
    addTopic('People', String(char.id));
    generateCharacterAffinities(char);
    // Random chance to add a new topic on immigration
    if (Math.random() < IMMIGRATION_ADD_TOPIC_CHANCE) {
      const category = getRandomImmigrationCategory();
      if (category) addTopic(category);
    }

    // Malady pre-roll on immigration (Lua: CHANCE_OF_MALADY = 15/100)
    if (bImmigration && char.tStats.nTeam === TEAM_ID_PLAYER && Math.random() * 100 < CHANCE_OF_MALADY) {
      Malady.infectWithRandom(char);
    }

    // Log: character joined (Lua: JOINED for player team, ENEMY_JOINED for hostiles)
    if (char.tStats.nTeam === TEAM_ID_PLAYER) {
      addLog('JOINED', char);
    } else {
      addLog('ENEMY_JOINED', char);
    }

    return char;
  }

  /** Dead character IDs — tracked for morale/familiarity reference. Lua: tDeadCharacters. */
  private deadCharacterIds: Set<number> = new Set();

  /** Get count of dead characters since game start. */
  getDeadCount(): number { return this.deadCharacterIds.size; }

  /** Check if a character has died (Lua CharacterManager:isDead). */
  isDead(charId: number): boolean { return this.deadCharacterIds.has(charId); }

  /** Get character by ID (alive only). */
  getCharacterById(id: number): Character | undefined {
    return this.characters.find(c => c.id === id);
  }

  /** Get count of living characters on a team. */
  getTeamCount(team: number): number {
    return this.characters.filter(c => c.isAlive() && c.tStats.nTeam === team).length;
  }

  /** Clear all characters (for load). */
  clearAll() {
    for (const c of this.characters) {
      this.characterRenderer?.destroyCharacter(c.id);
      c.destroy();
    }
    this.characters = [];
    this.pickups = [];
    this.deadCharacterIds.clear();
    this.nextId = 0;
  }

  /** Get all active pickups. */
  getPickups(): Pickup[] {
    return this.pickups;
  }

  /** Remove a pickup from the active list (after being picked up). */
  removePickup(pickup: Pickup): void {
    const idx = this.pickups.indexOf(pickup);
    if (idx >= 0) this.pickups.splice(idx, 1);
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
        // Check for outdoor tasks (build_tile, build_object, mine) in a spacesuit
        const outdoorOptions: ActivityOption[] = [];
        for (const cmd of CommandQueue.getAvailable('build_tile')) {
          outdoorOptions.push(new ActivityOption(
            new BuildTile(cmd.id, this.grid, this.wallAutoGen ?? undefined),
            cmd.tileX, cmd.tileY,
            9,
          ));
        }
        // Build objects (doors on walls, etc.) while spacewalking
        for (const cmd of CommandQueue.getAvailable('build_object')) {
          const obj = EnvObjectManager.getObjects().find(
            o => o.tileX === cmd.tileX && o.tileY === cmd.tileY && !o.bBuilt,
          );
          if (obj) {
            outdoorOptions.push(new ActivityOption(
              new BuildEnvObject(obj, cmd.id, this.grid),
              cmd.tileX, cmd.tileY,
              8,
            ));
          }
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

      // Rampage is now handled by Character.angerEvent() → beginRampage()
      // and Character.angerReduction() → endRampage() (Lua Character.lua:5816-5830)

      // Emergency: seek oxygen if suffocating (needs range -100..+100; 0 = midpoint)
      if (char.needs.oxygen < 0) {
        this.seekOxygenatedRoom(char);
        processed++;
        continue;
      }

      // Incapacitation check (Lua: Malady.isIncapacitated → only GetFieldScanned allowed)
      if (Malady.isIncapacitated(char)) {
        char.bIncapacitated = true;
        // Incapacitated characters can't do anything; they wait for a doctor
        processed++;
        continue;
      }
      char.bIncapacitated = false;

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

  /**
   * C-3: Survival threat preemption for a single character.
   * Mirrors Lua Character:_testSurvivalThreats().
   */
  private testSurvivalThreats(char: Character): void {
    if (char.currentTask && (char.currentTask as any).priorityLevel === PRIORITY.PUPPET) return;
    if (Malady.isIncapacitated(char)) return;

    const room = this.roomManager.getRoomAt(char.tileX, char.tileY);
    let nThreat: PriorityLevel = PRIORITY.NORMAL;

    const tileType = this.grid.get(char.tileX, char.tileY);
    if (tileType === TileType.SPACE && !char.bSpacesuit) {
      nThreat = PRIORITY.SURVIVAL_NORMAL;
    } else if (char.bLowOxygen) {
      nThreat = PRIORITY.SURVIVAL_NORMAL;
    } else if (room && (room.bBreach || room.bPendingBreach || room.getOxygenScore() < OXYGEN_LOW)) {
      nThreat = PRIORITY.SURVIVAL_NORMAL;
    } else if (room && room.isEmergencyAlarmOn()) {
      nThreat = PRIORITY.SURVIVAL_NORMAL;
    } else if (char.needs.hunger <= NEEDS_HUNGER_STARVATION) {
      nThreat = PRIORITY.SURVIVAL_NORMAL;
    } else {
      if (room && room.bHasHostiles) {
        nThreat = PRIORITY.SURVIVAL_NORMAL;
      }
      if (nThreat < PRIORITY.SURVIVAL_NORMAL && room && (room.bBurning || room.nFireTiles > 0)) {
        nThreat = PRIORITY.SURVIVAL_NORMAL;
      }
      if (nThreat < PRIORITY.SURVIVAL_LOW && char.bRampaging) {
        nThreat = PRIORITY.SURVIVAL_LOW;
      }
    }

    const currentPri = char.currentTask
      ? ((char.currentTask as any).priorityLevel ?? PRIORITY.NORMAL)
      : PRIORITY.NO_ACTIVITY;
    if (nThreat > currentPri) {
      if (char.currentTask) {
        if (char.currentTask.rTargetObject) {
          char.currentTask.rTargetObject.unreserve(char.id);
        }
        char.currentTask = null;
        char.path = [];
      }
      this.immediateAIQueue.add(char);
    }
  }

  /**
   * C-2: Run AI decision for a single character (immediate reassignment).
   */
  private runAIForCharacter(char: Character): void {
    if (!char.isAlive()) return;
    if (char.moving || char.path.length > 0) return;
    if (char.currentTask && !char.currentTask.isComplete() && !char.currentTask.isFailed()) return;

    if (char.bSpacewalking) {
      const outdoorOptions: ActivityOption[] = [];
      for (const cmd of CommandQueue.getAvailable('build_tile')) {
        outdoorOptions.push(new ActivityOption(
          new BuildTile(cmd.id, this.grid, this.wallAutoGen ?? undefined),
          cmd.tileX, cmd.tileY, 9,
        ));
      }
      for (const cmd of CommandQueue.getAvailable('build_object')) {
        const obj = EnvObjectManager.getObjects().find(
          o => o.tileX === cmd.tileX && o.tileY === cmd.tileY && !o.bBuilt,
        );
        if (obj) {
          outdoorOptions.push(new ActivityOption(
            new BuildEnvObject(obj, cmd.id, this.grid),
            cmd.tileX, cmd.tileY, 8,
          ));
        }
      }
      for (const cmd of CommandQueue.getAvailable('mine')) {
        outdoorOptions.push(new ActivityOption(
          new Mine(cmd.id, this.grid),
          cmd.tileX, cmd.tileY, 7,
        ));
      }
      if (outdoorOptions.length > 0) {
        const task = UtilityAI.selectTask(char, outdoorOptions);
        if (task) { this.assignTask(char, task); return; }
      }
      this.seekNearestRoom(char);
      return;
    }

    const charRoom = this.roomManager.getRoomAt(char.tileX, char.tileY);
    if (!charRoom && this.grid.get(char.tileX, char.tileY) === TileType.SPACE) {
      char.bSpacewalking = true;
      this.seekNearestRoom(char);
      return;
    }

    if (isHostile(TEAM_ID_PLAYER, char.tStats.nTeam)) {
      this.runHostileAI(char);
      return;
    }

    if (char.needs.oxygen < 0) {
      this.seekOxygenatedRoom(char);
      return;
    }

    if (Malady.isIncapacitated(char)) {
      char.bIncapacitated = true;
      return;
    }
    char.bIncapacitated = false;

    const options = this.gatherOptions(char);
    const task = UtilityAI.selectTask(char, options);
    if (task) {
      this.assignTask(char, task);
    } else {
      this.wander(char);
    }
    char.idleTimer = 0;
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

    // Always available: wander (Lua: DestOwned=true)
    if (room && room.tiles.length >= 2) {
      const target = room.tiles[Math.floor(Math.random() * room.tiles.length)];
      options.push(new ActivityOption(new WanderAround(), target.x, target.y, 1,
        { tags: { DestOwned: true } }));
    }

    // Sleep on floor (Lua: DestOwned=true)
    options.push(new ActivityOption(
      new SleepOnFloor(),
      character.tileX, character.tileY,
      0.5,
      { tags: { DestOwned: true } },
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
          // nGregariousness scales priority — gregarious chars chat more
          let chatPriority = 2 + character.tStats.personality.nGregariousness * 4;
          // _chatUtilityOverride (Character.lua:6529-6543): on-duty target halves attractiveness
          if (other.onDuty()) chatPriority *= 0.5;
          options.push(new ActivityOption(
            new Chat(),
            other.tileX, other.tileY,
            chatPriority,
          ));
          // ChatPartner: if other char is chatting with us, high priority to reciprocate
          if (other.currentTask && other.currentTask.name === 'Chat') {
            options.push(new ActivityOption(
              new ChatPartner(),
              other.tileX, other.tileY,
              10,
            ));
          }
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
    // Floors get higher priority than walls so builders complete the interior
    // before sealing it off (completed WALLs are impassable).
    for (const cmd of CommandQueue.getAvailable('build_tile')) {
      const isFloor = this.grid.get(cmd.tileX, cmd.tileY) === TileType.FLOOR_PENDING;
      const priority = job === BUILDER
        ? (isFloor ? 10 : 9)   // floors first, then walls
        : (isFloor ? 5 : 4);
      options.push(new ActivityOption(
        new BuildTile(cmd.id, this.grid, this.wallAutoGen ?? undefined),
        cmd.tileX, cmd.tileY,
        priority,
      ));
    }

    // ── Sleep in bed (Lua: DestOwned+DestSafe) ──────────────
    for (const bed of EnvObjectManager.getObjectsByType('Bed')) {
      if (!bed.bBuilt || !bed.isFunctioning()) continue;
      options.push(new ActivityOption(
        new SleepInBed(),
        bed.tileX, bed.tileY,
        2,
        { tags: { DestOwned: true, DestSafe: true } },
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
      const opt = new ActivityOption(
        new Eat(),
        food.tileX, food.tileY,
        2,
        { tags: { DestOwned: true, DestSafe: true } },
      );
      opt.targetObject = food;
      options.push(opt);
    }

    // ── Maintain damaged objects ─────────────────────────────
    for (const obj of EnvObjectManager.getObjects()) {
      if (!obj.bBuilt || !obj.needsMaintenance()) continue;
      const priority = job === TECHNICIAN ? 10 : 2;
      const opt = new ActivityOption(
        new MaintainEnvObject(obj),
        obj.tileX, obj.tileY,
        priority,
        { tags: { DestOwned: true } },
      );
      opt.targetObject = obj;
      options.push(opt);
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
        if (other.bRampaging && other.tStats.nTeam === TEAM_ID_PLAYER && other.canBeCuffed()) {
          options.push(new ActivityOption(
            new Cuff(other.id),
            other.tileX, other.tileY,
            12,
          ));
        }
      }
    }

    // ── Job-specific tasks ────────────────────────────────────
    const shiftBoost = character.onDuty() ? 2 : 0;

    // BARTENDER: Serve drink at bar + maintain pub
    if (job === BARTENDER) {
      for (const bar of EnvObjectManager.getObjectsByType('Bar')) {
        if (!bar.bBuilt || !bar.isFunctioning()) continue;
        options.push(new ActivityOption(
          new ServeDrink(),
          bar.tileX, bar.tileY,
          6 + shiftBoost,
          { tags: { DestSafe: true, Job: BARTENDER, WorkShift: true } },
        ));
        // MaintainPub (Lua: DestOwned+DestSafe)
        const opt = new ActivityOption(
          new MaintainPub(),
          bar.tileX, bar.tileY,
          8 + shiftBoost,
          { tags: { Job: BARTENDER, WorkShift: true, DestOwned: true, DestSafe: true } },
        );
        opt.targetObject = bar;
        options.push(opt);
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
            { tags: { DestOwned: true, DestSafe: true, Job: BOTANIST, WorkShift: true } },
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
          { tags: { DestOwned: true, DestSafe: true, Job: SCIENTIST, WorkShift: true } },
        ));
      }
    }

    // DOCTOR: Heal wounded characters
    if (job === DOCTOR) {
      for (const other of this.characters) {
        if (other === character || !other.isAlive()) continue;
        if (other.tStats.nTeam !== TEAM_ID_PLAYER) continue; // Don't heal hostiles
        if (!other.canBeTreated()) continue; // MONSTER/KILLBOT can't be treated
        if (other.tStats.nHP < HURT_THRESHOLD) {
          options.push(new ActivityOption(
            new FieldScanAndHeal(other),
            other.tileX, other.tileY,
            10 + shiftBoost,
            { tags: { DestOwned: true, DestSafe: true, Job: DOCTOR, WorkShift: true } },
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
          { tags: { DestOwned: true, Job: EMERGENCY, WorkShift: true } },
        ));
      }

      // EMERGENCY: Respond to emergency beacons (CircleBeacon task)
      const squad = SquadList.getSquadForChar(character.id);
      if (squad && EmergencyBeacon.hasBeacon(squad.name) && EmergencyBeacon.needsMoreResponders(squad.name)) {
        const beacon = EmergencyBeacon.getBeacon(squad.name)!;
        options.push(new ActivityOption(
          new CircleBeacon(),
          beacon.tx, beacon.ty,
          20, // High priority — beacon orders override normal patrol
          { tags: { Job: EMERGENCY } },
        ));
      }
    }

    // JANITOR: Pick up corpses and debris from floor (then deliver to refinery)
    if (job === JANITOR && character.heldItem === null) {
      for (const pickup of this.pickups) {
        if ((pickup.sName === 'Corpse' || pickup.sName === 'Debris') && !pickup.bPickedUp) {
          const task = new PickUpFloorItem(pickup, (p) => this.removePickup(p));
          options.push(new ActivityOption(
            task,
            pickup.tileX, pickup.tileY,
            8 + shiftBoost,
            {
              tags: { Job: JANITOR, WorkShift: true },
              prerequisites: { EmptyHands: true },
            },
          ));
        }
      }
    }

    // JANITOR: Drop off held corpse or debris at refinery
    if (job === JANITOR && (character.heldItem === 'Corpse' || character.heldItem === 'Debris')) {
      const refineries = [
        ...EnvObjectManager.getObjectsByType('RefineryDropoff'),
        ...EnvObjectManager.getObjectsByType('RefineryDropoffLevel2'),
      ];
      for (const ref of refineries) {
        if (!ref.bBuilt || !ref.isFunctioning()) continue;
        options.push(new ActivityOption(
          new DropOffCorpse(),
          ref.tileX, ref.tileY,
          9 + shiftBoost,
          { tags: { Job: JANITOR, DestOwned: true, WorkShift: true } },
        ));
      }
    }

    // MINER: Pick up rocks from floor
    if (job === MINER && character.heldItem === null) {
      for (const pickup of this.pickups) {
        if (pickup.sName === 'Rock' && !pickup.bPickedUp) {
          const task = new PickUpFloorItem(pickup, (p) => this.removePickup(p));
          options.push(new ActivityOption(
            task,
            pickup.tileX, pickup.tileY,
            7 + shiftBoost,
            {
              tags: { Job: MINER, WorkShift: true },
              prerequisites: { EmptyHands: true },
            },
          ));
        }
      }
    }

    // ── Hobby: Listen to Jukebox ──────────────────────────────
    for (const jukebox of EnvObjectManager.getObjectsByType('Jukebox')) {
      if (!jukebox.bBuilt || !jukebox.isFunctioning()) continue;
      const opt = new ActivityOption(
        new ListenToJukebox(),
        jukebox.tileX, jukebox.tileY,
        2,
        { tags: { DestOwned: true, DestSafe: true } },
      );
      opt.targetObject = jukebox;
      options.push(opt);
    }

    // ── Hobby: Lift at weight bench ─────────────────────────
    for (const bench of EnvObjectManager.getObjectsByType('WeightBench')) {
      if (!bench.bBuilt || !bench.isFunctioning()) continue;
      const opt = new ActivityOption(
        new LiftAtWeightBench(),
        bench.tileX, bench.tileY,
        2,
        { tags: { DestOwned: true, DestSafe: true } },
      );
      opt.targetObject = bench;
      options.push(opt);
    }

    // ── Hobby: Work out (no gym needed) ─────────────────────
    if (room) {
      options.push(new ActivityOption(
        new WorkOut(),
        character.tileX, character.tileY,
        0.5,
        { tags: { DestOwned: true, DestSafe: true } },
      ));
    }

    // ── Hobby: Work out in gym (with gym equipment) ──────────
    for (const gym of EnvObjectManager.getObjectsByType('GymEquipment')) {
      if (!gym.bBuilt || !gym.isFunctioning()) continue;
      const opt = new ActivityOption(
        new WorkOutInGym(),
        gym.tileX, gym.tileY,
        1.5,
        { tags: { DestOwned: true, DestSafe: true } },
      );
      opt.targetObject = gym;
      options.push(opt);
    }

    // ── Hobby: Play game system ──────────────────────────────
    for (const game of EnvObjectManager.getObjectsByType('ArcadeGame')) {
      if (!game.bBuilt || !game.isFunctioning()) continue;
      const opt = new ActivityOption(
        new PlayGameSystem(),
        game.tileX, game.tileY,
        1.5,
        { tags: { DestOwned: true, DestSafe: true } },
      );
      opt.targetObject = game;
      options.push(opt);
    }

    // ── Eat plant (if edible plants available) ───────────────
    const ediblePlants = ['space_tree', 'HydroPlant', 'BulbousPlant'];
    for (const pType of ediblePlants) {
      for (const plant of EnvObjectManager.getObjectsByType(pType)) {
        if (!plant.bBuilt || plant.nCondition < 50) continue;
        const opt = new ActivityOption(
          new EatPlant(),
          plant.tileX, plant.tileY,
          2,
          { tags: { DestOwned: true, DestSafe: true } },
        );
        opt.targetObject = plant;
        options.push(opt);
        break; // Just nearest
      }
    }

    // ── Eat at food replicator (specific task) ───────────────
    for (const rep of EnvObjectManager.getObjectsByType('FoodReplicator')) {
      if (!rep.bBuilt || !rep.isFunctioning()) continue;
      const opt = new ActivityOption(
        new EatAtFoodReplicator(),
        rep.tileX, rep.tileY,
        1.5,
        { tags: { DestOwned: true, DestSafe: true } },
      );
      opt.targetObject = rep;
      options.push(opt);
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
      // Find nearest fire tile in room for extinguishing
      const fireTile = this.findFireInRoom(room);

      // Brave characters: extinguish with tool (BaseScore=8)
      if (fireTile && this.fire) {
        options.push(new ActivityOption(
          new ExtinguishFireWithTool(this.fire),
          fireTile.x, fireTile.y,
          8,
          {
            priorityLevel: PRIORITY.SURVIVAL_NORMAL,
            personalityGates: { nBravery: [0.05, 1] },
            prerequisites: { EmptyHands: true },
            tags: { DestOwned: true },
          },
        ));
        // Extinguish bare-handed (BaseScore=6, Lua: DestOwned)
        options.push(new ActivityOption(
          new ExtinguishFireBareHanded(this.fire),
          fireTile.x, fireTile.y,
          6,
          {
            priorityLevel: PRIORITY.SURVIVAL_NORMAL,
            personalityGates: { nBravery: [0.15, 1] },
            prerequisites: { EmptyHands: true },
            tags: { DestOwned: true },
          },
        ));
      }
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

    // ── Emergency alarm flee — Lua Character.lua:1260-1266 ───
    // EMERGENCY job characters performing work shift tasks ignore alarm
    if (room && room.isEmergencyAlarmOn()) {
      if (!(job === EMERGENCY && character.isPerformingWorkShiftTask())) {
        options.push(new ActivityOption(
          new FleeEmergencyAlarm(),
          character.tileX, character.tileY,
          100,
          { priorityLevel: PRIORITY.SURVIVAL_NORMAL },
        ));
      }
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
              { tags: { Job: DOCTOR, WorkShift: true, DestOwned: true, DestSafe: true } },
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
              { tags: { Job: BOTANIST, WorkShift: true, DestOwned: true, DestSafe: true } },
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
        const opt = new ActivityOption(
          new ServeFoodAtTable(),
          table.tileX, table.tileY,
          6 + shiftBoost,
          { tags: { Job: BARTENDER, WorkShift: true, DestSafe: true } },
        );
        opt.targetObject = table;
        options.push(opt);
      }
    }

    // ── Eat at table (better than replicator) ────────────────
    for (const table of EnvObjectManager.getObjectsByType('StandingTable')) {
      if (!table.bBuilt) continue;
      options.push(new ActivityOption(
        new EatAtTable(),
        table.tileX, table.tileY,
        3,
        { tags: { DestSafe: true } },
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
          new DropOffRocks(ref.sName),
          ref.tileX, ref.tileY,
          7 + shiftBoost,
          {
            tags: { Job: MINER, DestOwned: true, WorkShift: true },
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

    // ── Demolish commands (destroy env objects) ───────────────
    for (const cmd of CommandQueue.getAvailable('demolish')) {
      const obj = EnvObjectManager.getObjects().find(
        o => o.tileX === cmd.tileX && o.tileY === cmd.tileY && o.bBuilt,
      );
      if (obj) {
        const priority = job === BUILDER ? 10 : 3;
        options.push(new ActivityOption(
          new DestroyEnvObject(obj),
          cmd.tileX, cmd.tileY,
          priority,
          { tags: { Job: BUILDER, WorkShift: true } },
        ));
      }
    }

    // ── Drop everything (prereq satisfier) ───────────────────
    if (character.heldItem !== null && !character.bCuffed) {
      options.push(new ActivityOption(
        new DropEverything(),
        character.tileX, character.tileY,
        0.002,
      ));
    }

    // ── VacuumPull: character in breaching room gets pulled toward space ───
    if (room && !room.sealed && room.oxygen < 50 && !character.bSpacesuit) {
      const spaceTile = this.findNearestSpaceTile(character.tileX, character.tileY);
      if (spaceTile) {
        const vec = this.vacuumSystem?.getVacuumVec(character.tileX, character.tileY);
        const pull = new VacuumPull();
        pull.vacuumMagnitude = vec?.magnitude ?? 0;
        options.push(new ActivityOption(
          pull,
          spaceTile.x, spaceTile.y,
          500, // PUPPET level — overrides everything
          { priorityLevel: PRIORITY.PUPPET },
        ));
      }
    }

    // ── PanicOnFire: character standing on a fire tile ───────
    if (this.fire && this.fire.isOnFire(character.tileX, character.tileY)) {
      options.push(new ActivityOption(
        new PanicOnFire(),
        character.tileX, character.tileY,
        200,
        { priorityLevel: PRIORITY.SURVIVAL_NORMAL },
      ));
    }

    // ── CheckInToHospital: wounded characters seek hospital beds ───
    if (character.tStats.nHP < character.tStats.nMaxHP * 0.5 && !character.bIncapacitated) {
      for (const bed of EnvObjectManager.getObjectsByType('HospitalBed')) {
        if (!bed.bBuilt || !bed.isFunctioning()) continue;
        const opt = new ActivityOption(
          new CheckInToHospital(),
          bed.tileX, bed.tileY,
          4,
          { tags: { DestOwned: true, DestSafe: true } },
        );
        opt.targetObject = bed;
        options.push(opt);
        break; // nearest hospital bed
      }
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

  /** Find the first fire tile in a room (for targeting). */
  private findFireInRoom(room: Room): { x: number; y: number } | null {
    if (!this.fire) return null;
    const fireTiles = this.fire.getFireTiles();
    for (const tile of room.tiles) {
      if (fireTiles.has(`${tile.x},${tile.y}`)) return { x: tile.x, y: tile.y };
    }
    return null;
  }

  /** Find nearest SPACE tile from a position (for vacuum pull direction). */
  private findNearestSpaceTile(x: number, y: number): { x: number; y: number } | null {
    // Check expanding rings of neighbors
    for (let r = 1; r <= 5; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue; // only ring edge
          const nx = x + dx, ny = y + dy;
          if (this.grid.get(nx, ny) === TileType.SPACE) return { x: nx, y: ny };
        }
      }
    }
    return null;
  }

  /** Assign a task to a character and start pathfinding if needed. */
  private assignTask(char: Character, task: Task) {
    char.currentTask = task;
    char.onNewTaskStarted(task);
    // Reserve target object if applicable
    if (task.rTargetObject) {
      task.rTargetObject.reserve(char.id);
    }
    task.start(char);

    // Path to task target if not already there
    if (task.targetX >= 0 && (task.targetX !== char.tileX || task.targetY !== char.tileY)) {
      const filter = char.bSpacewalking ? WALKABLE_SPACEWALK : WALKABLE_DEFAULT;
      const maxNodes = char.bSpacewalking ? 3000 : 1000;
      // Lua Room:_refreshPropJobList sets pathToNearest=true for build tasks.
      // If the target tile is non-walkable (e.g. WALL for door building, ASTEROID
      // for mining), path to the nearest adjacent walkable tile instead.
      const targetType = this.grid.get(task.targetX, task.targetY);
      const bPathToNearest = !filter(targetType);
      const path = findPath(this.grid, char.tileX, char.tileY, task.targetX, task.targetY, maxNodes, filter, bPathToNearest);
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

  /**
   * Passive familiarity tick (Lua: Character._tickFamiliarity).
   * Characters in the same room gain FAMILIARITY_TICK_INCREASE toward each other.
   */
  private tickFamiliarity() {
    // Group living characters by room
    const roomChars = new Map<Room, Character[]>();
    for (const c of this.characters) {
      if (c.tStats.nStatus === STATUS_DEAD) continue;
      if (c.tStats.nTeam !== TEAM_ID_PLAYER) continue;
      const room = this.roomManager.getRoomAt(c.tileX, c.tileY);
      if (!room) continue;
      let list = roomChars.get(room);
      if (!list) {
        list = [];
        roomChars.set(room, list);
      }
      list.push(c);
    }

    // For each room with 2+ characters, add familiarity between all pairs
    for (const chars of roomChars.values()) {
      if (chars.length < 2) continue;
      for (let i = 0; i < chars.length; i++) {
        for (let j = i + 1; j < chars.length; j++) {
          chars[i].addFamiliarity(chars[j].id, FAMILIARITY_TICK_INCREASE);
          chars[j].addFamiliarity(chars[i].id, FAMILIARITY_TICK_INCREASE);
        }
      }
    }
  }
}
