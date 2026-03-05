# Spacebase DF-9 — Gap Closure Plan

## Status Key
- [ ] Not started
- [~] In progress
- [x] Complete

---

## 1. Inventory System (~5% → ~95%)
**Goal**: Port all 62+ item templates from Lua InventoryData, weapon stats, armor, job tools, procedural naming, containers, affinity decay, outfit overrides.

- [x] Port all 54+ item templates from InventoryData.lua (32 base) + WeaponData.lua (22 weapons)
- [x] Add full ItemTemplate interface with 40+ properties matching Lua exactly
- [x] Add weapon properties (nDamage, nRange, nMeleeCoolDown, nMaxCoolDown, nMinCoolDown, nDamageType, nPoints, sStance, sBulletSprite)
- [x] Add armor properties (nDamageReduction, nDodgeChance, sOutfit)
- [x] Add item flags (bStackable, bHeldOnly, bDisappearOnDrop, bSingleton, bSatisfier, bStuff, bDisplayable, bJobTool, bContainer)
- [x] Add job restrictions (Job field, getItemJob(), getHeldItemSatisfier())
- [x] Add tag system (Color×14, Material×5, Texture×5, Shape×4, Style×5 — all with RGB colors)
- [x] Add procedural item naming (tPossibleTags, tForcedTags, 0-2 random tags, _generateName)
- [x] Add affinity decay (getAffinityDecay: job tools=0, weapons=75%, default=0.016)
- [x] Add container support (putItemIntoContainer, removeItemFromContainer, putItemListIntoContainer)
- [x] Add incineration system (getIncinerateBias, allowIncinerate, TIME_UNWANTED 5-20 min, JOB_ITEM_NO_INCINERATE_MULT=4)
- [x] Add outfit override system (getOutfitOverride, sOutfit per armor level)
- [x] Add createItem() with full Lua logic (unique tags, forced tags, tint colors, containers)
- [x] Add dupeItem(), createRandomStartingStuff(), canStack(), getMaxStacks()
- [x] Add portrait/display sprite accessors (getPortrait, getDisplaySprite)
- [x] Add save/load (portFromSave with validation, getSaveTable)
- [x] Add CharacterInventory class with addItem, removeItem, stacking, singleton, save/load
- [x] Add SPRITE_NAME constants to CharacterConstants.ts
- [x] Wire inventory into main.ts window.__df9 (13 test helpers)
- [x] E2E tests: 7 tests (template count, item creation, weapon data, armor data, item flags, affinity decay, character inventory ops)

**What we did**: Complete rewrite of InventoryData.ts (54+ items matching Lua exactly) and Inventory.ts (full createItem, procedural naming, tag system, containers, incineration, weapon/armor accessors, save/load). CharacterInventory class replaces old simple Inventory.
**What we didn't do**: createItemAtCursor (debug feature, needs cursor integration). Object display rendering (CompoundProp equivalent — needs renderer work).
**Blockers**: Display rendering needs renderer system (#12).

---

## 2. Research Tree Corrections (~45% → ~98%)
**Goal**: Fix all costs, prerequisites, add 11 missing items, implement discovery blueprint system.

- [x] Fix 9 items with wrong costs (all now match Lua exactly)
- [x] Add 8 missing research items (SpaceSuit2, VaporizeLevel2, BuildLevel2, PlantLevel2, LaserRifles, ArmorLevel2, TeamTactics, HappyBot)
- [x] Add 4 discovery blueprints (FridgeLevel2Discovered, TeamTacticsDiscovered, MaintenanceLevel2Discovered, WallMountedTurretLevel2Discovered)
- [x] Implement bDiscoverOnly flag in ResearchDef and ResearchSystem
- [x] Fix all wrong prerequisites to use Discovered gates
- [x] Add AirScrubber as prerequisite for HappyBot and OxygenRecyclerLevel2
- [x] Add nConditionMultiplier field (MaintenanceLevel2: 1.5, PlantLevel2: 2)
- [x] Fix key names to match Lua (TurretLevel2→WallMountedTurret2, RefineryLevel2→RefineryDropoffLevel2)
- [x] Wire researchPrereq check into ObjectPlacement (was a stub)
- [x] Add discoverBlueprint() method for datacube/event-triggered discovery
- [x] Add getAllResearch() for UI/debug
- [x] Wire nConditionMultiplier into MaintainEnvObject (MaintenanceLevel2 → 1.5x repair)
- [x] Wire nConditionMultiplier into MaintainPlants (PlantLevel2 → 2x repair)
- [x] E2E tests: research tree costs, discovery gating, prereq blocks placement (3 tests)

**What we did**: Complete rewrite of ResearchData.ts matching Lua exactly (24 items). Updated ResearchSystem with bDiscoverOnly support. Wired research prereq into ObjectPlacement. Wired nConditionMultiplier into MaintainEnvObject and MaintainPlants tasks.
**What we didn't do**: Discovery trigger mechanics (datacubes, derelict events) — requires inventory/event system. Research UI panel.
**Blockers**: Datacube discovery triggers need inventory system (#1). Research UI panel needs UI system (#6).

---

## 3. Statistics Tracking (0% → ~90%)
**Goal**: Add persistent stat counters matching Lua Base.tStats, wire into game systems.

- [x] Create BaseStats interface with all 9 counters matching Lua Base.tS.tStats
- [x] Add incrementStat(), getStats(), loadStats() to Base class
- [x] Wire hostile kill tracking into Character.kill() (nHostilesKilled, nHostilesAsphyxiated)
- [x] Add save/load persistence for stats (SaveLoad.ts)
- [x] Expose getStats() and incrementStat() via window.__df9
- [x] E2E tests: kill counter tracking, stats persist through save/load (2 tests)
- [x] Wire nMealsServed into Eat.ts and ServeDrink.ts
- [x] Wire nCorpsesRecycled into DropOffCorpse.ts
- [x] Wire nBreachShipsDestroyed into EventController.ts (breach event callback)
- [x] Wire nCuresResearched into Malady.ts (attemptCure)
- [ ] Wire nHostilesKilledByTurret into turret combat (DEPENDENCY: turret damage system not implemented)
- [ ] Wire nHostilesKilledByParasite into parasite events (DEPENDENCY: parasite event type not implemented)
- [ ] Wire nRaidersConverted into raider conversion (DEPENDENCY: raider conversion system not implemented)

**What we did**: Stats infrastructure complete — all 9 counters, save/load, test helpers. Wired 7 of 9 stats: nHostilesKilled, nHostilesAsphyxiated, nMealsServed, nCorpsesRecycled, nBreachShipsDestroyed, nCuresResearched + Character.kill() tracking.
**What we didn't do**: 3 stats blocked by unimplemented systems.
**Blockers**: nHostilesKilledByTurret (turret damage system), nHostilesKilledByParasite (parasite events #5), nRaidersConverted (raider conversion system #7)

---

## 4. Character AI Tasks & Prerequisites (~50% → ~90%)
**Goal**: Add ~20 missing tasks, implement prerequisite/tag system, personality gates, priority levels, affinity modifiers.

- [x] Implement activity prerequisite system (EmptyHands, Spacewalking, WearingSuit, HeldItem, Cuffed, NonThreatening)
- [x] Implement activity tag system (WorkShift, DestOwned, DestSafe, Job, HighDistPenalty)
- [x] Add personality-based activity filtering (bravery gates, temper gates, work ethic, gregariousness)
- [x] Add priority levels (SURVIVAL_LOW, SURVIVAL_NORMAL, PUPPET) with score bonuses
- [x] Add heldItem and bCuffed fields to Character
- [x] Add hobby tasks: WorkOut, LiftAtWeightBench, ListenToJukebox
- [x] Add survival/panic tasks: PanicFire, PanicOxygen (with bravery gates)
- [x] Add combat variant: Brawl (anger-driven, SURVIVAL_LOW)
- [x] Add exploration: Explore (WorkShift-gated)
- [x] Add fallback: Breathe (absolute minimum activity)
- [x] Wire all new tasks into CharacterManager.gatherOptions()
- [x] Add hasFireInRoom() helper for panic checks
- [x] Add flee tasks: FleeThreat (bravery 0.2-0.8), PanicThreat (bravery 0-0.2), SURVIVAL_NORMAL
- [x] Add fire response: FireFleeArea (bravery 0.2-1), SURVIVAL_NORMAL
- [x] Add oxygen response: OxygenFleeArea (BaseScore=200, SURVIVAL_NORMAL)
- [x] Add emergency: FleeEmergencyAlarm (alarm panel check)
- [x] Add rampage tasks: RampageTantrum (SURVIVAL_NORMAL), Sabotage (SURVIVAL_LOW, targets objects)
- [x] Add hospital: BedHeal (HospitalBed, Job: DOCTOR, WorkShift)
- [x] Add food tasks: HarvestAndDeliverFood (BOTANIST), ServeFoodAtTable (BARTENDER), EatAtTable
- [x] Add mining: DropOffRocks (Refinery, Job: MINER, HeldItem: 'Rock')
- [x] Add suit management: PutOnSuit (AirlockLocker)
- [x] Add IncapacitatedOnFloor (HP<=10, NonThreatening prereq)
- [x] E2E tests: hobby task availability, brawl anger check (2 tests)
- [ ] Add affinity modifiers to scoring (±20% from relationships) (DEPENDENCY: affinity system #10)
- [ ] Add beacon/exploration tasks (ERCircleBeaconInside, ERBeaconExplore) (DEPENDENCY: beacon system not implemented)
- [ ] Add remaining hospital tasks (GetFieldScanned, CheckInToHospital) (DEPENDENCY: field scanner/hospital triage system)
- [ ] Add ViolentRampagePatrol (DEPENDENCY: full rampage state machine with patrol waypoints)

**What we did**: Full prerequisite/tag/personality gate infrastructure in ActivityOption. Added 22 new task types. Priority system with score bonuses. Character heldItem/bCuffed/bSpacesuit fields. Complete fire/oxygen/threat response chains with personality-gated bravery. Rampage (tantrum + sabotage). Job-specific tasks (doctor heal, botanist harvest, bartender serve, miner drop-off). Incapacitation. Suit management.
**What we didn't do**: 4 tasks blocked by unimplemented systems.
**Blockers**: Affinity modifiers (#10), beacon system, hospital triage, violent rampage patrol waypoints.

---

## 5. Disease/Malady Expansion (~15% → ~95%)
**Goal**: Port all 25 diseases from Lua NewMaladyData, add severity tiers, symptom stages, spread mechanics, cure research, specials.

- [x] Port all 25 disease definitions from NewMaladyData.lua (6 injuries, 1 drug, 17 contagious diseases, 1 Default template)
- [x] Full MaladyDef interface (40+ properties matching Lua exactly)
- [x] Add severity/difficulty tiers (nDifficultyTier: 0=injury, 1=easy, 2=medium, 3=plague, -1=special, -2=drug)
- [x] Add multi-stage symptom progression (tSymptomStages with tTimeToSymptoms, tReduceMods, sSpecial per stage)
- [x] Add need reduce mods (tReduceMods affecting Hunger, Social, Energy, Amusement, Duty — 0=lock, negative=increase)
- [x] Add contagion modes (bSpreadSneeze, bSpreadTouch) with range-based spreading via playedSymptomAnim
- [x] Add field treatment (nFieldTreatSkill, bRefuseHeal) with doctor skill checks
- [x] Add cure research integration (nResearchCure, nCureProgress, nForceResearch, separate from tech research)
- [x] Add random strain naming (type-specific adjective+noun tables, Greek letter suffixes, unique name tracking)
- [x] Add hidden/diagnosis mechanic (bHidden flag, bDiagnosed, getNextUndiagnosedMalady)
- [x] Add incubation periods (tTimeToContagious, tTimeToSymptoms ranges with absolute time tracking)
- [x] Add special effects: 'thing' (spawn monster), 'parasite' (chestburst), 'fire' (ignite), 'death' (instant kill)
- [x] Add incapacitation system (MajorInjury + bSymptomatic = INCAPACITATED_ALLOWED tasks only)
- [x] Add speed modifiers (nSpeed per malady/stage, getSpeedModifier wired into Character.getEffectiveSpeed)
- [x] Add contagion processing in CharacterManager (sneeze spread replaces old stub)
- [x] Add doctor infection mechanics (WormParisite: 100% for doctors, Disease: 50% reduction)
- [x] Add Malady module state (research, strains, used names, elapsed time) with save/load
- [x] Wire into game loop (Malady.updateElapsedTime, Character.update calls Malady.tickMaladies)
- [x] Wire into main.ts window.__df9 (12 test helpers)
- [x] E2E tests: 7 disease tests + 2 updated existing tests (definition count, strain generation, injuries, speed mods, multi-stage, research tracking, Drugged)

**What we did**: Complete rewrite of MaladyData.ts (25 diseases) and Malady.ts (full Lua-parity module with strains, stages, contagion, research, specials). Updated Character.ts (MaladyInstance, speed mods, proper tickMaladies). Updated CharacterManager.ts (proper sneeze contagion). Updated save/load.
**What we didn't do**: Air scrubber environment spread modifier (needs powered object detection wiring). Monster spawning integration (spawnThing/spawnMonster stubs kill character but don't create hostile). Disease UI panel.
**Blockers**: Air scrubber integration needs power/object query system. Monster spawning needs CharacterManager hostile creation. Disease UI needs UI system (#6).
**Blockers**: None

---

## 6. UI Panels (~40% → ~75%)
**Goal**: Implement missing UI screens and panel features matching original Lua UI.

- [x] Research panel (Tech/Disease tabs, progress bars, start research, prerequisites)
- [x] Goals/achievements display panel (12 goals, completion checkmarks)
- [x] Inspector: Actions tab (Cuff/Uncuff, Send to Brig, Execute for characters)
- [x] Inspector: Demolish button for objects (refunds matter)
- [x] Panel mutual exclusivity (Research/Goals auto-close each other)
- [x] Keyboard bindings (E=Research, G=Goals)
- [x] Sidebar buttons wired (replaced "Coming Soon" stubs)
- [x] Inspector: Psych tab (8 slider traits + 7 boolean quirks from PersonalityTraits)
- [x] Inspector: name editing with text input (click name to edit, Enter/Escape/blur to confirm)
- [x] Build menu: pending cost display (tile count, matter cost, no-funds warning)
- [ ] Save/Load dialogs (file browser, naming, confirmation)
- [ ] Inspector: Log tab (event history per citizen)
- [ ] Inspector: object sprite/portrait display
- [ ] Mine menu UI
- [ ] Beacon/rescue menu UI
- [ ] Build menu: Wall mode, Airlock mode, Vaporize mode
- [ ] Tab icons, status icons, hover sounds

**What we did**: ResearchPanel, GoalsPanel, InspectorPanel (Actions + Psych tabs, name editing, demolish), UIManager panel tracking, build cost overlay, keyboard bindings. 12 E2E tests total for UI panels.
**What we didn't do**: Save/Load dialogs, Log tab, portraits, mine/beacon menus, build menu modes, icons/sounds.
**Blockers**: Log tab needs Log/Journal system (#9).

---

## 7. Base Event & Faction System (~30% → ~90%)
**Goal**: Implement faction behavior mapping, alert priority system, team alliance logic.

- [x] Add faction behavior system (team ID → behavior: Citizen, EnemyGroup, Friendly, Monster, KillBot, Trader)
- [x] Implement Base.isFriendly(nTeamA, nTeamB) team alliance checking (Lua Base.lua lines 428-449)
- [x] Implement Base.isFriendlyToPlayer(nTeam) (Lua Base.lua lines 422-426)
- [x] Add createNewTeamID(nFactionBehavior) — Citizen→PLAYER, others allocate unique IDs ≥100
- [x] Add 20 alert event types with priorities and durations (all Lua BASE_EVENT types)
- [x] Add EVENT_DATA metadata table (nPriority, nLogVisibleTime per event type)
- [x] Add DEATH_ALERTS mapping (cause of death → message template)
- [x] Add eventOccurred() with deduplication by type+reporter
- [x] Add memory system (storeMemory/retrieveMemory with expiry)
- [x] Add Base.isHostileInBase() detection via room/character callback
- [x] Add onTick: periodic hostile check every 60s, expired event pruning
- [x] Replace hardcoded CombatSystem.isHostile/isFriendly with Base.isFriendly delegation
- [x] Complete UIManager ALERT_COLORS (all 20 BASE_EVENT types + extra categories)
- [x] Add faction save/load (teamFactions array + nNextTeamID)
- [x] Wire Base.setCharactersInRoomsCallback in main.ts
- [x] Add 8 window.__df9 test helpers (createNewTeamID, getTeamFactionBehavior, isFriendlyTeams, isHostileInBase, getBaseEvents, getEventPriority, getAllEventData, getFactionBehavior)
- [x] E2E tests: 6 tests (faction defaults, alliance matrix, team ID creation, event metadata, hostile-in-base, alert colors)
- [ ] Add Base.freeShelving() capacity tracking

**What we did**: Full faction registry with 4 default teams, Lua-exact alliance matrix (Citizen↔Friendly=ally, Monster↔Monster=ally, EnemyGroup teams only self-friendly), dynamic team allocation, 20 event types with metadata, memory system for cooldown-based checks, hostile-in-base detection, CombatSystem delegation to Base, complete alert color coverage.
**What we didn't do**: freeShelving() capacity tracking (needs shelving objects). Event localization strings (using English templates).
**Blockers**: freeShelving needs Env Object shelving support (#8).

---

## 8. Env Object Properties (~50% → 100%) ✅
**Goal**: Add missing objects and properties to match Lua EnvObjectData.

- [x] Add missing objects: Spawner, DockPoint added; HousePoint renamed to HousePlant
- [x] Add 26 new properties to EnvObjectDef interface (interactSprite, portrait, clickSound, placeSound, ambientSound, createJob, maintainJob, inherentActivities, changeZone, nCapacity, nRange, nFoodPrice, sFunctionality, bCanFlipY, bAttackable, bIgnoreLighting, bHelpsMorale, bSortBack, sFlavorText, tDisplaySlots, tAnimOffset, tAnimOffsetFlipped, spriteOffsetX, spriteOffsetXFlipped, layer, sPortraitPath)
- [x] Populate all object values from Lua source for all 48 objects
- [x] Add interactSprite state + getSpriteKey() toggle on EnvObject
- [x] Add sFunctionality getter on EnvObject
- [x] Add alias system (tAliases, resolveAlias, getObjectData)
- [x] Add getObjectsByFunctionality() query (data module + manager)
- [x] Update MaintainEnvObject to use object's maintainJob instead of hardcoded TECHNICIAN
- [x] Add test helpers (getObjectDef, getObjectsByFunc, resolveAlias)
- [x] 5 E2E tests: property completeness, alias resolution, functionality grouping, job requirements, missing objects

**What we did**: Complete implementation of all missing properties, objects, aliases, functionality queries, and runtime behaviors.
**What we didn't do**: GenerateStartingInventory (complex object, deferred). InteriorTurret (commented out in Lua).
**Blockers**: None

---

## 9. Log/Journal System (0% → ?)
**Goal**: Implement character thought/memory system with 50+ thought types.

- [ ] Create Log system with 8 categories (generic, health, work, social, recreation, food, combat, item)
- [ ] Add 50+ thought templates
- [ ] Wire thought generation into character actions/events
- [ ] Add thought display in inspector Log tab
- [ ] Add thought filtering

**What we did**: (not started)
**What we didn't do**: (everything)
**Blockers**: UI panels (#6, Log tab)

---

## 10. Affinity & Familiarity (~15% → ?)
**Goal**: Implement full affinity system matching Lua (room, object, activity affinity + familiarity tracking).

- [ ] Add familiarity system (tFamiliarity map, getFamiliarity, addFamiliarity)
- [ ] Add room affinity tracking (addRoomAffinity, getRoomAffinity)
- [ ] Add object/item affinity
- [ ] Add activity affinity modifiers (±20% scoring)
- [ ] Add affinity queries (getPeopleOfAffinity, getSortedAffinityList)
- [ ] Add affinity icon/emotion system (getAffinityIconAndColor)
- [ ] Wire familiarity into death morale calculation (-4 to -60 scaling)

**What we did**: (not started)
**What we didn't do**: (everything)
**Blockers**: None

---

## 11. Race System (0% → ?)
**Goal**: Add 10 character races from Lua, missing health statuses.

- [ ] Add nRace property with 10 races (HUMAN, JELLY, TOBIAN, CAT, BIRDSHARK, CHICKEN, MONSTER, SHAMON, MURDERFACE, KILLBOT)
- [ ] Add missing health statuses (STATUS_SCUFFED_UP, STATUS_INJURED, STATUS_DRUGGED)
- [ ] Wire race into character generation/visuals

**What we did**: (not started)
**What we didn't do**: (everything)
**Blockers**: None

---

## 12. Renderer Polish (~40% → ?)
**Goal**: Add skeletal animation, post-FX, particles, camera shake, construction feedback.

- [ ] Skeletal animation system (~20 animation states)
- [ ] Post-processing (FXAA, bloom, color LUT, outline filter)
- [ ] Particle effects (fire sparks, destruction debris, impact)
- [ ] Camera shake on damage/explosions
- [ ] Construction progress bars on objects
- [ ] Tile damage states (cracks, scorch marks)
- [ ] Object state animations (powered on/off, working)
- [ ] Selection highlighting on tiles/objects

**What we did**: (not started)
**What we didn't do**: (everything)
**Blockers**: Animation data (.banim format not fully reversed)

---

## 13. Goals Update (~60% → ?)
**Goal**: Match original Lua goals (15 achievements with correct thresholds).

- [ ] Replace simplified goals with original 15 (Citizens≥50, Matter≥50000, BuiltEverything, HostilesKilled≥50, BaseTiles≥3000, MealsServed≥1000, CuresResearched≥10, AllTechs, HappyCitizens≥30@morale>90, BreachShipsDestroyed≥5, AllPossessions, RaidersConverted≥10, HostilesAsphyxiated≥10, HostilesKilledByTurrets≥20, BodiesRefined≥100, FinalSiege)
- [ ] Wire goal checks to stats system
- [ ] Implement FinalSiege complex check (survive mega-event + 120s, friendly in safe room, all hostiles dead)

**What we did**: (not started)
**What we didn't do**: (everything)
**Blockers**: Statistics tracking (#3)

---

## 14. Hints Expansion (~15% → ?)
**Goal**: Add 30+ contextual hints matching Lua HintChecks.

- [ ] Port all hint checks from HintChecks.lua (30+ conditions)
- [ ] Wire hint triggers into game systems
- [ ] Add hint display in UI

**What we did**: (not started)
**What we didn't do**: (everything)
**Blockers**: UI panels (#6)

---

## 15. Character Morale Events & Need Interactions (0% → ?)
**Goal**: Add all missing morale event constants and wire them into the systems that trigger them. Lua `CharacterConstants.lua` defines ~15 morale-modifying events not yet implemented.

**Missing constants** (Lua `CharacterConstants.lua:374-400`):
- `MORALE_LOW_OXYGEN = -0.1` (per tick when O2 < `MORALE_LOW_OXYGEN_THRESHOLD = 550`)
- `MORALE_NEEDS_MET_BONUS = 0.5` (small bump when all needs met but morale is negative)
- `MORALE_NICE_CHAT` — from positive social interactions
- `MORALE_MINE_ASTEROID` — from successful mining
- `MORALE_MAINTAIN_OBJECT` — from successful maintenance
- `MORALE_REPAIR_OBJECT` — from repair actions
- `MORALE_BUILD_BASE` — from completing construction
- `MORALE_DID_HOBBY` — from hobby activities (jukebox, workout, etc.)
- `MORALE_DELIVERED_FOOD` — from bartender/delivery
- `MORALE_BAD_CHAT` — from negative/failed social interactions

- [ ] Add all 10 missing morale-event constants to CharacterConstants.ts matching Lua values
- [ ] Wire `MORALE_LOW_OXYGEN` into Character.update() (check O2 per tick)
- [ ] Wire `MORALE_NEEDS_MET_BONUS` into Character morale tick (when all needs satisfied + morale < 0)
- [ ] Wire `MORALE_MINE_ASTEROID` into Mine.ts on success
- [ ] Wire `MORALE_MAINTAIN_OBJECT` into MaintainEnvObject.ts on success
- [ ] Wire `MORALE_BUILD_BASE` into BuildEnvObject.ts / BuildTile.ts on completion
- [ ] Wire `MORALE_DID_HOBBY` into ListenToJukebox.ts, WorkOut.ts, LiftAtWeightBench.ts
- [ ] Wire `MORALE_DELIVERED_FOOD` into ServeFoodAtTable.ts / HarvestAndDeliverFood.ts
- [ ] Wire `MORALE_BAD_CHAT / NICE_CHAT` into Chat.ts (personality-dependent outcome)

**What we did**: (not started)
**What we didn't do**: (everything)
**Blockers**: None

---

## 16. Room Lighting & Danger State System (0% → ?)
**Goal**: Implement Lua `Room.lua` lighting scheme enum and danger/visibility timers.

**Missing from Lua `Room.lua:46-58`**:
- 6 lighting scheme constants: `LIGHTING_SCHEME_OFF`, `_NORMAL`, `_FIRE`, `_VACUUM`, `_DIM`, `_LOWPOWER`
- `DANGEROUS_DURATION = 120` seconds threshold for "room has been dangerous too long" alert
- `LOSE_VISIBILITY_TIME = 45` seconds after hostile leaves before room stops being "alert"
- `LOSE_REVEALED_TIME = 270` seconds until unexplored room loses its revealed status
- `FLOAT_AWAY_TIME = 720` seconds until loose items float away in vacuum
- `CONTIGUITY_TEST_INTERVAL = 2` ticks between re-checking room connectivity
- `POWER_DRAW_PER_TILE = 1` — rooms draw power proportional to tile count

- [ ] Add `LightingScheme` enum to Room.ts with all 6 values
- [ ] Add `nDangerTimer` to Room.ts; increment when hostile/fire/vacuum present; trigger alert at DANGEROUS_DURATION
- [ ] Add `nVisibilityTimer` to Room.ts for LOSE_VISIBILITY_TIME post-threat
- [ ] Add `FLOAT_AWAY_TIME` timer for items in vacuum rooms
- [ ] Wire `POWER_DRAW_PER_TILE` into PowerSystem — rooms themselves draw power per tile
- [ ] Wire lighting scheme into TileRenderer3D tinting (off=dark, vacuum=red, fire=orange, low-power=dim)

**What we did**: (not started)
**What we didn't do**: (everything)
**Blockers**: None

---

## 17. Tile Damage & Wall Destruction (0% → ?)
**Goal**: Implement Lua `WorldConstants.lua` tile HP system — walls degrade under fire/explosion.

**Missing from Lua `WorldConstants.lua:14-19`**:
- `TILE_STARTING_HIT_POINTS = 100`
- `TILE_DAMAGE_HEALTHY = 100`, `TILE_DAMAGE_LIGHT_DAMAGE = 50`, `TILE_DAMAGE_HEAVY_DAMAGE = 20`, `TILE_DAMAGE_DESTROYED = 0`
- `TILE_HEAL_OVER_TIME` rate
- `WALL_DESTROYED` tile type (Lua WorldConstants.lua) — destroyed wall becomes passable + breaches room

- [ ] Add `nTileHP` per-wall tracking to TileGrid (sparse map, only for WALL tiles)
- [ ] Add `TILE_DESTROYED` tile type constant
- [ ] Wire fire spread damage into wall HP reduction
- [ ] When wall HP hits 0 → convert to TILE_DESTROYED, trigger RoomManager re-flood, breach adjacent rooms
- [ ] Add `TILE_HEAL_OVER_TIME` slow wall repair (only in powered rooms)
- [ ] Wire `CHARACTER_SAFETY_TOLERANCE = 2` from WorldConstants into construction validation (prevent building too close to world edge)

**What we did**: (not started)
**What we didn't do**: (everything)
**Blockers**: Fire system (#12)

---

## 18. Airlock Pressurisation State Machine (0% → ?)
**Goal**: Implement full Lua `Airlock.lua` pressurisation cycle — pump out, open outer, cycle, pump in.

**Missing**:
- Lua Airlock.lua defines states: `IDLE`, `PUMPING_OUT`, `OUTER_OPEN`, `PUMPING_IN`
- Pressurisation cycle: takes time proportional to room O2 level, drains O2 during pump-out, fills during pump-in
- Inner/outer door distinction — airlock has two doors; cannot open both simultaneously
- Airlock vent event when outer opens in vacuum (rapid O2 loss + character force-push)
- Alert when character enters without spacesuit

- [ ] Add `AirlockState` enum to Door.ts/Airlock logic
- [ ] Implement pump-out phase: reduce room O2 to 0 over N seconds, then unlock outer door
- [ ] Implement pump-in phase: restore room O2 from station supply
- [ ] Prevent both doors open simultaneously (hard interlock)
- [ ] Wire vent event: when outer door opens to space, characters in airlock take explosive decompression damage
- [ ] Alert system: character without spacesuit entering active airlock cycle

**What we did**: (not started)
**What we didn't do**: (everything)
**Blockers**: Door state system, OxygenSystem

---

## 19. Personality Trait Modifiers on AI Scoring (0% → ?)
**Goal**: Wire all 17 personality traits into actual task score and morale calculations. Currently traits are stored but have no effect.

**Required from Lua `Character.lua` + `Personality.lua`**:
- `workEthic` → multiplier on all work task scores (0.5 to 1.5)
- `bravery` → already gates panic/flee tasks (done), but should also affect combat attack score
- `gregariousness` → multiplier on Chat task score
- `temper` → probability of Brawl at high anger; already gates brawl (done), but should scale anger build rate
- `creativity` → bonus score on Research and hobby tasks
- `empathy` → morale bonus when fellow citizens are happy; penalty when they are unhappy
- `laziness` → inverse multiplier on work tasks (stacks with workEthic)
- `punctuality` → affects work shift adherence scoring
- `bLoner` → penalty on Chat score, bonus on solo tasks
- `bInsomniac` → modified sleep schedule / reduced energy from rest
- `bHothead` → increases anger build rate (stacks with temper)
- `bNaturalist` → bonus to Garden zone tasks
- `bMachineWhisperer` → bonus to MaintainEnvObject
- `bGourmet` → higher food quality requirement; bonus morale from high-quality meals
- `bHoarder` → bonus to DropOffRocks; resistance to inventory incineration
- `bKlutz` → chance to accidentally damage objects during maintenance
- `bPhobic` → panic at lower thresholds for specific threats

- [ ] Add `getWorkEthicMultiplier()` to Character → workEthic * (1 - laziness) clamp [0.2, 2.0]
- [ ] Apply workEthic multiplier in all work-task `setScore()` calls
- [ ] Add `getGregariousnessMultiplier()` → wire into Chat.ts
- [ ] Wire `empathy` into morale tick (scan nearby characters' morale, apply empathy delta)
- [ ] Wire `bHothead + temper` into anger build rate (Brawl threshold scaling)
- [ ] Wire `creativity` into Research and hobby task scores
- [ ] Wire `bNaturalist` into Garden zone tasks
- [ ] Wire `bMachineWhisperer` into MaintainEnvObject score
- [ ] Wire `bGourmet` into Eat.ts morale bonus (scale with food quality)
- [ ] Wire `bKlutz` into MaintainEnvObject — chance to lower condition instead of raise
- [ ] Wire `bPhobic` into panic task thresholds

**What we did**: (not started)
**What we didn't do**: (everything)
**Blockers**: None

---

## 20. Topics / Gossip System (0% → ?)
**Goal**: Implement Lua `Topics.lua` — characters share information during Chat interactions.

**From Lua `Topics.lua`**:
- Topics are facts a character knows: enemy locations, discoveries, deaths, events
- Characters spread topics to each other during Chat tasks
- Topic memory has TTL (time-to-live); stale topics expire
- Topics affect AI decision-making (flee from known enemy location, seek known food source)

- [ ] Create `Topic` interface: `type`, `data`, `ttl`, `sourceCharId`
- [ ] Add `knownTopics: Topic[]` to Character
- [ ] Wire topic exchange into Chat.ts: when two characters chat, exchange top N topics
- [ ] Wire topic generation at events: enemy spotted → add enemy-location topic; fire spotted → add fire-location topic
- [ ] Wire topic consumption into AI: FleeThreat uses enemy-location topics as targets
- [ ] Add topic expiry in Character.update()

**What we did**: (not started)
**What we didn't do**: (everything)
**Blockers**: Chat task (#4)

---

## 21. Character Emoticons Above Heads (0% → ?)
**Goal**: Render Lua-style emoticon sprites above characters showing current mood/state.

**From Lua `UI/Emoticons` spritesheet and `Character.lua`**:
- Emoticons shown for: low morale (sad/angry), needs critical (hunger, sleep), social events (heart/speech bubble), combat (exclamation), carrying items, working
- Emoticon sprites extracted to `public/assets/ui/Emoticons.png`
- Original uses `ui_dialogicon_*` sprite names (meh, happy, sad, angry, heart, etc.)

- [ ] Add emoticon overlay sprite system to CharacterRenderer (billboard quad above character head)
- [ ] Map character state → emoticon sprite (hunger critical → food icon; low O2 → blue face; angry → red; happy → heart; working → wrench; combat → !)
- [ ] Wire morale thresholds into emoticon selection (morale < -50 → sad, < -80 → angry, > 50 → happy)
- [ ] Add emoticon fade-in/out with TTL (show for 3-5 seconds, fade)
- [ ] Add thought bubbles for specific events (marriage, death nearby, goal completed)

**What we did**: (not started)
**What we didn't do**: (everything)
**Blockers**: CharacterRenderer sprite overlay

---

## 22. Power Circuit Propagation (0% → ?)
**Goal**: Match Lua power distribution — power flows through connected rooms, not just individual room generators.

**From Lua `Power.lua` + `Room.lua`**:
- Rooms are connected via doors into power networks
- `tContiguousRooms` in Room.lua tracks connected room groups
- Power shared across entire connected network: total output vs total draw
- Rooms with enough total network power get `bHasPower = true` on all objects
- Network breaks when a door is destroyed/locked — isolated rooms lose power
- `POWER_DRAW_PER_TILE = 1` means larger rooms cost more to power

- [ ] Implement power network BFS in PowerSystem: starting from generators, walk connected rooms via open doors
- [ ] Accumulate total output and draw per network
- [ ] Apply `POWER_DRAW_PER_TILE` per room tile count in draw calculation
- [ ] Set `bHasPower` on objects based on network balance (not per-room balance)
- [ ] Re-run network calculation when a door opens/closes/breaks or generator condition changes
- [ ] Wire network power failure state into room lighting (dimmed when power < demand)

**What we did**: (not started — current PowerSystem uses per-room balance only)
**What we didn't do**: (everything — cross-room network propagation)
**Blockers**: RoomManager contiguous room tracking (partially done)

---

## 23. Zone Benefit Implementations (0% → ?)
**Goal**: Implement the functional effects of each zone type matching Lua `Zones/*.lua`.

Currently zones are assigned to rooms but have minimal runtime effect. Each zone in Lua grants specific benefits:

- [ ] **BedZone**: Characters assigned to beds for sleep; bed count caps population capacity; `nBedCount` tracked
- [ ] **ResearchZone**: ResearchSystem pulls from `nResearchPoints` generated per tick by characters working in zone
- [ ] **HospitalZone**: Doctor task eligibility; `nBedCount` tracks hospital capacity; triage priority
- [ ] **PubZone**: Social/morale bonus to characters drinking; Jukebox adds ambient morale to room
- [ ] **FitnessZone**: WorkOut task eligibility; `bHelpsMorale` for weight bench, pullup bar
- [ ] **GardenZone**: Food production rate; botanist task eligibility; `nFoodProduced` tracking
- [ ] **BrigZone**: Prisoner confinement; cuffed characters auto-pathfind to brig bed; `nCapacity` enforcement
- [ ] **AirlockZone**: Pressurisation cycle eligibility; spacesuit locker assignment; EVA management
- [ ] **RefineryZone**: Rock drop-off point; matter output per rock type; `nMatterGenerated` tracking
- [ ] **ReactorZone**: Power bonus multiplier for generators in reactor zone

**What we did**: Zone types assigned, zone objects exist, but no benefit calculations
**What we didn't do**: All benefit implementations
**Blockers**: None

---

## 24. Fire System Lua Parity (0% → ?)
**Goal**: Verify and fix fire spread/damage to exactly match Lua `Fire.lua`.

**From audit of Lua `Fire.lua`**:
- Fire spreads along isometric adjacency (4 diagonal neighbors matching grid geometry)
- Fire has `nFuelRemaining` per tile — burns out when fuel exhausted
- Walls block fire spread (fire cannot jump walls, only spreads to open tiles)
- Object flammability: env objects with `bFlammable = true` can catch fire from adjacent fire
- Character fire damage rate: `FIRE_DAMAGE_RATE = 5` HP/second (verify this is wired)
- Fire creates smoke: visibility reduced in fire rooms
- Destroyed env objects have a `DESTROYED_FIRE_CHANCE = 0.05` per 60-tick interval to ignite

- [ ] Verify fire spread uses correct diamond-grid adjacency (4 diagonal neighbors only, matching Lua)
- [ ] Add `nFuelRemaining` to Fire — fire burns out naturally; fuel decremented per tick
- [ ] Wire wall blocking into fire spread (WALL tiles stop propagation)
- [ ] Wire `bFlammable` from EnvObjectDef into fire spread (destroyed objects can ignite)
- [ ] Verify `FIRE_DAMAGE_RATE = 5` HP/second is wired into character damage (currently uses `O2_FIRE_DAMAGE` in CharacterConstants)
- [ ] Add smoke/visibility reduction in fire rooms
- [ ] Wire `DESTROYED_FIRE_CHECK_INTERVAL` into EnvObject.onTick() → Fire.startFire() (already partially stubbed)

**What we did**: Fire spread exists, adjacency implemented, character damage wired
**What we didn't do**: Fuel system, wall blocking verification, bFlammable wiring, smoke visibility
**Blockers**: None

---

## 25. Event System Lua Parity (0% → ?)
**Goal**: Match Lua `EventController.lua` spawn frequency math, module loading, and compound event structure.

**From Lua `EventController.lua:79-129`**:
- `getExpMod(nX, nY)` — exponential modifier based on galaxy coordinates; higher distance = more hostile events
- `nEventForecastMax = 15` (check TS matches)
- `tFirstEventTimeRange = {400, 440}` — first event appears between 400-440 stardate ticks
- `tAlertTimeRange = {45, 45}` — constant 45 ticks between forecast → active
- Module-based event definitions: events are loaded as Lua modules from `Events/` directory
- `CompoundEvent` type: multiple sub-events chained together with timing between them
- `nFinalSiegeTime = 60 * 60 * 6` — final siege at 6 hours of game time
- `bHardcoreMode` flag: doubles hostile event frequency
- Event `nDifficulty` scaling from galaxy zone density + distance traveled
- `bExpeditionMode` flag: alternative game mode with different event table

- [ ] Verify `FORECAST_SIZE = 15` in TS EventData.ts
- [ ] Implement `getExpMod()` — exponential galaxy-position difficulty modifier (use landing zone coordinates)
- [ ] Wire galaxy landing zone distance into event frequency scaling
- [ ] Add `bHardcoreMode` flag to GameRules; wire into EventController spawn rates
- [ ] Verify `FIRST_EVENT_DELAY` and alert timing match Lua ranges exactly
- [ ] Add `nDifficulty` per-event property; use in damage/hostile-count scaling
- [ ] Add CompoundEvent support: chained sub-events with inter-event delays

**What we did**: Basic event types, forecast queue, difficulty scaling stub
**What we didn't do**: Galaxy-position exponential mod, hardcore mode, compound events, per-event difficulty
**Blockers**: Landing zone data needs to be passed to EventController

---

## 26. World Generation Lua Parity (0% → ?)
**Goal**: Match Lua `WorldGen.lua` procedural generation exactly — seed-based asteroid layout, starting rooms, edge safety.

**From Lua `WorldGen.lua` + `WorldConstants.lua`**:
- `CHARACTER_SAFETY_TOLERANCE = 2` tiles — construction blocked within 2 tiles of world edge
- Starting room layout defined by Lua (specific shape/size for seed pod landing zone)
- Asteroid field procedurally generated from world seed — density and position deterministic
- `WALL_DESTROYED` tile type — when a wall reaches 0 HP it becomes this state (different from SPACE)
- Specific starting matter value tied to galaxy zone density choice

- [ ] Add `CHARACTER_SAFETY_TOLERANCE = 2` constant to config.ts; enforce in BuildSystem tile placement checks
- [ ] Verify starting room shape matches Lua's default layout (seed pod chamber dimensions)
- [ ] Make asteroid generation use explicit Lua-matching seeded PRNG (currently uses `Math.random`)
- [ ] Add `TILE_WALL_DESTROYED = 5` tile type (passable wall ruin; lets O2 and characters through)
- [ ] Wire landing zone density choice into GameRules starting matter (low density = less starting matter)

**What we did**: Basic world gen with seed pod, asteroids, starting room
**What we didn't do**: Safety tolerance enforcement, exact starting layout, seeded PRNG for asteroids, wall-destroyed tile type, density-linked starting matter
**Blockers**: None

---

## 27. Inspector Panel Log Tab & Save/Load Dialogs (0% → ?)
**Goal**: Complete the UI work deferred from #6: Log tab, save/load dialogs, portrait display.

- [ ] Inspector Log tab: show character's recent morale events, work history, social interactions (needs Log system #9)
- [ ] Inspector portrait: render character portrait sprite from `Portraits.png` atlas in inspector header
- [ ] Save Base dialog: name input, overwrite confirmation, existing save list
- [ ] Load Base dialog: save file browser, preview info, delete option
- [ ] Mine mode UI: show mineable asteroid tiles, matter yield preview
- [ ] Build menu wall/airlock/vaporize mode buttons in sidebar sub-menu

**What we did**: (not started)
**What we didn't do**: (everything)
**Blockers**: Log system (#9)

---

## Progress Log

| Date | Item | Action | Result |
|------|------|--------|--------|
| 2026-03-04 | #2 Research | Complete rewrite of ResearchData.ts (24 items matching Lua), bDiscoverOnly support, prereq wiring | ~95% done |
| 2026-03-04 | #3 Statistics | BaseStats infrastructure, hostile kill tracking, save/load, test helpers | ~70% done |
| 2026-03-04 | #4 AI Tasks | Prerequisite/tag/personality gate system, 8 new tasks, priority levels | ~65% done |
| 2026-03-04 | Tests | Added 7 new E2E tests (research×3, stats×2, AI×2) | 47 total tests |
| 2026-03-04 | #2 Research | Wired nConditionMultiplier into MaintainEnvObject (1.5x) and MaintainPlants (2x) | ~98% done |
| 2026-03-04 | #3 Statistics | Wired nMealsServed (Eat, ServeDrink), nCorpsesRecycled (DropOffCorpse), nBreachShipsDestroyed (EventController), nCuresResearched (Malady) | ~90% done |
| 2026-03-04 | #4 AI Tasks | Added 14 more tasks: FleeThreat, PanicThreat, FireFleeArea, OxygenFleeArea, FleeEmergencyAlarm, RampageTantrum, Sabotage, BedHeal, PutOnSuit, HarvestAndDeliverFood, ServeFoodAtTable, EatAtTable, DropOffRocks, IncapacitatedOnFloor | ~90% done |
| 2026-03-04 | Tests | All 46 passing (1 skipped), 0 type errors | 47 total tests |
| 2026-03-04 | #1 Inventory | Complete rewrite: 54+ item templates, tag system, procedural naming, weapon/armor data, containers, incineration, affinity decay, CharacterInventory class, 7 new tests | ~95% done |
| 2026-03-04 | Tests | All 53 passing (1 skipped), 0 type errors | 54 total tests |
| 2026-03-04 | #5 Disease | Complete rewrite: MaladyData.ts (25 diseases matching Lua), Malady.ts (full module with strains, stages, contagion, research, specials, speed mods, incapacitation). Updated Character.ts, CharacterManager.ts, SaveLoad.ts, main.ts. 7 new E2E tests | ~95% done |
| 2026-03-04 | Tests | All 60 passing (1 skipped), 0 type errors | 61 total tests |
| 2026-03-04 | #6 UI Panels | ResearchPanel (Tech/Disease tabs), GoalsPanel (12 goals), InspectorPanel Actions tab (Cuff/Execute/Demolish), UIManager panel tracking, keyboard bindings (E/G). 6 new E2E tests | ~65% done |
| 2026-03-04 | #6 UI Panels | Psych tab (8 sliders + 7 boolean quirks), name editing (click-to-edit), build cost overlay (pending cost + no-funds warning). 3 new E2E tests | ~75% done |
| 2026-03-04 | Tests | All 69 passing (1 skipped), 0 type errors | 70 total tests |
| 2026-03-04 | Tests | All 66 passing (1 skipped), 0 type errors | 67 total tests |
| 2026-03-04 | #7 Base Event & Faction | Faction registry (4 defaults), alliance matrix, createNewTeamID, 20 event types with metadata, memory system, eventOccurred with dedup, isHostileInBase, onTick hostile check, CombatSystem delegation, full alert colors, save/load faction data. 6 new E2E tests | ~90% done |
| 2026-03-04 | Tests | All 75 passing (1 skipped), 0 type errors | 76 total tests |
| 2026-03-04 | Tests | Fixed eat test: root cause was Fridge losing power (PowerSystem override) + room oxygen causing bSpacewalking. Added `buildSealedRoom` test helper. All 69 passing | 70 total tests |
| 2026-03-04 | #8 Env Object Properties | 26 new properties on EnvObjectDef, all 48 objects populated from Lua, Spawner+DockPoint added, HousePoint→HousePlant rename, alias system, functionality queries, interactSprite toggle, maintainJob wiring. 5 new E2E tests | 100% done |
