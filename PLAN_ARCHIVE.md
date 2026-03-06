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

## 9. Log/Journal System (0% → ~70%)
**Goal**: Implement character thought/memory system with 50+ thought types.

- [x] Create Log.ts module: tag-scored line selection, queue-based posting, text replacement
- [x] 44 tag score functions matching Lua Log.tTags exactly (personality, needs, race, jobs, quirks, activity affinity, job affinity)
- [x] Tag gating (g_ prefix = gated, n_ prefix = negative gated)
- [x] Queue system with priority sorting, dedup, flush-on-post (Lua-exact)
- [x] Priority 4+ entries post immediately (deaths, disasters)
- [x] Log cooldown based on nChattiness (5-15 seconds)
- [x] Text replacement with /CODE/ delimiters (35+ replacement codes)
- [x] tLog/tLogQueue fields on Character with log tick in update()
- [x] LogData.ts already has 89 log types with ~600 template strings
- [x] Save support (tLog serialized in CharSaveData)
- [x] Test helpers (getCharacterLog, addCharacterLog, getLogQueueLength)
- [x] E2E tests: queue/posting, priority-4 immediate, text replacement (3 tests)
- [x] Wire text replacements to Topics module (RANDOMBAND, RANDOMFOOD, FAVORITEFOOD, RANDOMDRINKNAME, RANDOMCREATURE, RANDOMPROVENANCE, RANDOMGAME)
- [x] Wire log triggers: JOINED/ENEMY_JOINED (spawn), CAUGHT_FIRE/CAUGHT_FIRE_MANY (catchFire), DEATH_SUFFOCATION/STARVATION/FIRE (kill), TANTRUM_START/RAMPAGE_START (rampage tasks), DISASTER_FIRE (PanicFire), DISASTER_BREACH (PanicOxygen)
- [x] Inspector Log tab UI display (#27)
- [ ] Wire remaining log triggers (DUTY_*, HEALTH_*, COMBAT_*, CHAT_*, EAT_*)
- [ ] Wire log triggers into task files (Eat subtypes, Chat outcome, Sleep, Combat kills)
- [ ] Morale-needs periodic logging (MORALE_LOW_*/MORALE_HIGH_* every 180s)
- [ ] Generic observation logging (GENERIC every 240s)

**What we did**: Complete Log module with Lua-exact tag scoring (44 tags), priority queue, text replacement via Topics. Log tab in Inspector. Key log triggers wired (spawn, fire, death, rampage, disasters).
**What we didn't do**: Remaining task-specific log triggers (DUTY_*, CHAT_*, EAT_*), periodic morale/generic logging.
**Blockers**: None.

---

## 10. Affinity & Familiarity (~15% → ~70%)
**Goal**: Implement full affinity system matching Lua (room, object, activity affinity + familiarity tracking).

- [x] Add familiarity system (tFamiliarity map, getFamiliarity, addFamiliarity)
- [ ] Add room affinity tracking (addRoomAffinity, getRoomAffinity)
- [ ] Add object/item affinity
- [ ] Add activity affinity modifiers (±20% scoring)
- [ ] Add affinity queries (getPeopleOfAffinity, getSortedAffinityList)
- [ ] Add affinity icon/emotion system (getAffinityIconAndColor)
- [x] Wire familiarity into death morale calculation (-4 to -60 scaling)
- [x] Add tAffinity (topic-keyed Map), getAffinity, addAffinity, getNormalizedAffinity
- [x] Add getJobAffinity, getJobXPMultiplier, getJobMoraleModifier
- [x] Add passive familiarity tick in CharacterManager (FAMILIARITY_TICK_RATE=5s, +0.1)
- [x] Wire getDeathMoraleLoss into CharacterManager.processDeaths()
- [x] Add getAffinityForActivity (Topics.getTopicForActivity delegation)
- [x] Add getFavorite (highest affinity in category, Lua Character:getFavorite)
- [x] Add getPeopleOfAffinity (filter people by affinity threshold)
- [x] Wire activity affinity into AI scoring (±20% via ACTIVITY_AFFINITY_CHANGE_PCT in ActivityOption.evaluate)
- [x] Add E2E tests (affinity, familiarity, death morale scaling, getFavorite) — 4 tests

**What we did**: Full affinity system: topic-keyed affinity, person-keyed familiarity, passive room ticks, death morale, job affinity, activity affinity ±20% AI scoring modifier, getFavorite/getPeopleOfAffinity queries.
**What we didn't do**: Room affinity, object/item affinity, icon/emotion display.
**Blockers**: None

---

## 11. Race System (0% → ~75%)
**Goal**: Add 10 character races from Lua, race-dependent behavior.

- [x] Add nRace property to CharacterStats with 10 races (HUMAN=1..KILLBOT=10)
- [x] Add RACE_TYPE definitions: sName, nRig, bBreathes, bCanBeCuffed, bCanBeTreated, nMeleeDamage
- [x] Add race spawn rates: HUMAN_RACE_PCT=60, CAT_RACE_PCT=2, rest evenly split
- [x] Add Character.rollRace() static method
- [x] Add race accessor methods: getRace, getRaceDef, doesBreathe, canBeCuffed, canBeTreated, getMeleeDamage
- [x] Add RACE_NAMES lookup table
- [x] Add RIG_* constants (BASE=1, ALIEN=2, CUBE=3, MONSTER=4, KILLBOT=5, SPHERE=6)
- [x] STATUS_SCUFFED_UP=7, STATUS_INJURED=8, STATUS_DRUGGED=9 already existed
- [x] Race saved/loaded in CharSaveData
- [x] Race exposed in test API, 1 E2E test
- [x] Wire doesBreathe() into CharacterManager O2 update (non-breathing = full O2, never spacewalking)
- [x] Wire canBeCuffed() into Cuff AI scoring (MONSTER/KILLBOT skipped)
- [x] Wire canBeTreated() into FieldScanAndHeal AI scoring (MONSTER/KILLBOT skipped)
- [x] Wire getMeleeDamage() into CombatSystem.getWeapon (race damage overrides Fists default)
- [x] Wire race tags into Log.ts (Lua raceScore: 1 if match, 0 if not)
- [ ] Wire race into CharacterRenderer (model selection by nRig)

**What we did**: Full race constants, type definitions, spawn rates, accessor methods. All 10 Lua races with correct behavior flags. Wired doesBreathe (O2), canBeCuffed (Cuff), canBeTreated (FieldScanAndHeal), getMeleeDamage (CombatSystem), Log.ts race tags.
**What we didn't do**: CharacterRenderer model selection by nRig.
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

## 13. Goals Update (~60% → ~95%) ✅
**Goal**: Match original Lua goals (16 achievements with correct thresholds).

- [x] Replace simplified 12 goals with all 16 Lua-exact goals (Citizens≥50, Matter≥50000, BuiltEverything, HostilesKilled≥50, BaseTiles≥3000, MealsServed≥1000, CuresResearched≥10, AllTechs, HappyCitizens≥30@morale>90, BreachShipsDestroyed≥5, AllPossessions, RaidersConverted≥10, HostilesAsphyxiated≥10, HostilesKilledByTurrets≥20, BodiesRefined≥100, FinalSiege)
- [x] Wire goal checks to Base.getStats() for stat-based goals
- [x] Add GoalCheckProviders for complex checks (getBuiltObjectTypeCount, getResearchedTechCount, getHappyCitizenCount, getOwnedTileCount)
- [x] Update E2E test (totalGoals=16, removed FirstRoom check)
- [ ] Implement FinalSiege complex check (survive mega-event + 120s, friendly in safe room, all hostiles dead)
- [ ] Implement AllPossessions check (possession tracking)

**What we did**: Complete rewrite of GoalData.ts (16 Lua-exact goals) and GoalSystem.ts (new check functions using Base.getStats()). Updated main.ts providers.
**What we didn't do**: FinalSiege (needs mega-event system), AllPossessions (needs possession tracking).
**Blockers**: FinalSiege needs mega-event system (#25). AllPossessions needs inventory display tracking.

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

## 15. Character Morale Events & Need Interactions (0% → 75%)
**Goal**: Add all missing morale event constants and wire them into the systems that trigger them. Lua `CharacterConstants.lua` defines ~15 morale-modifying events not yet implemented.

- [x] Add all 12 missing morale-event constants to CharacterConstants.ts matching Lua values exactly
- [x] Wire `MORALE_LOW_OXYGEN` into Character.ts morale tick (no spacesuit + O2 < threshold → penalty + early return)
- [x] Wire `MORALE_NEEDS_MET_BONUS` into Character.ts morale tick (all needs > 50 + morale < 0)
- [x] Wire `MORALE_MINE_ASTEROID` into DropOffCorpse.ts on completion (matches Lua DropOffCorpse.lua:34)
- [x] Wire `MORALE_BUILD_BASE` into BuildEnvObject.ts on completion (matches Character.lua:2795)
- [x] Wire `MORALE_DID_HOBBY` into ListenToJukebox.ts, WorkOut.ts, LiftAtWeightBench.ts
- [x] Wire `MORALE_MAINTAIN_OBJECT` into MaintainEnvObject.ts on success
- [x] Wire `MORALE_DELIVERED_FOOD` into ServeFoodAtTable.ts / HarvestAndDeliverFood.ts
- [ ] Wire `MORALE_BAD_CHAT / NICE_CHAT` into Chat.ts (personality-dependent outcome)

**What we did**: Added all constants; wired the two non-zero morale modifiers (MORALE_LOW_OXYGEN=-0.1, MORALE_NEEDS_MET_BONUS=0.5) and all zero-value task completions (MORALE_MINE_ASTEROID, MORALE_BUILD_BASE, MORALE_DID_HOBBY, MORALE_MAINTAIN_OBJECT, MORALE_DELIVERED_FOOD).
**What we didn't do**: MORALE_BAD_CHAT/NICE_CHAT in Chat.ts (all are 0 in Lua — no gameplay effect but pending correctness wire).
**Blockers**: None

---

## 16. Room Lighting & Danger State System (0% → 85%)
**Goal**: Implement Lua `Room.lua` lighting scheme enum and danger/visibility timers.

- [x] Add all 6 `LIGHTING_SCHEME_*` constants to Room.ts (matching Lua Room.lua:46-51)
- [x] Add `DANGEROUS_DURATION`, `LOSE_VISIBILITY_TIME`, `LOSE_REVEALED_TIME`, `FLOAT_AWAY_TIME`, `CONTIGUITY_TEST_INTERVAL`, `POWER_DRAW_PER_TILE` constants to Room.ts
- [x] Add `nLightingScheme`, `nLightFadeTimer`, `nLightFadesPerSecond`, `nDangerTimer`, `nVisibilityTimer` fields to Room.ts
- [x] Rewrite `Lighting.getRoomLightingScheme()` to match Lua `Room:updateEmergency()` priority (VACUUM → FIRE → LOWPOWER → NORMAL)
- [x] Add `Lighting.onTick()` that updates `room.nLightingScheme` and advances flash timers each frame
- [x] Wire FireSystem into Lighting so room-has-fire detection works in scheme computation
- [x] Update `getRoomTint()` to use `lightFadeTimer` for sine-wave flash on emergency schemes
- [x] Update `renderRoomLighting()` in main.ts to use `room.nLightingScheme`/`nLightFadeTimer`
- [ ] Wire `POWER_DRAW_PER_TILE` into PowerSystem (room tile count × 1 per tile power draw)
- [ ] Wire `nDangerTimer` increment + `DANGEROUS_DURATION` alert

**What we did**: All scheme constants, Room fields, correct Lua priority logic with fire detection, sine-wave flashing for FIRE/VACUUM/LOWPOWER, exact Lua tint colors (VACUUM=cyan, FIRE=red).
**What we didn't do**: POWER_DRAW_PER_TILE in PowerSystem; nDangerTimer active increment/alert.
**Blockers**: None

---

## 17. Tile Damage & Wall Destruction (0% → 90%)
**Goal**: Implement Lua `WorldConstants.lua` tile HP system — walls degrade under fire/explosion.

- [x] Add all constants to config.ts: `TILE_STARTING_HIT_POINTS=100`, `TILE_DAMAGE_HEALTHY=4`, `TILE_DAMAGE_LIGHT_DAMAGE=3`, `TILE_DAMAGE_HEAVY_DAMAGE=2`, `TILE_DAMAGE_DESTROYED=1`, `TILE_HEAL_OVER_TIME=0.05`, `CHARACTER_SAFETY_TOLERANCE=2` (exact Lua values from WorldConstants.lua:14-24)
- [x] `WALL_DESTROYED = 6` tile type already exists in TileTypes.ts
- [x] Add sparse `tileHP` Map to TileGrid (only populated when wall takes damage)
- [x] Add `damageTile(x, y, amount)` — reduces HP, converts WALL → WALL_DESTROYED at 0, calls `onWallDestroyed` callback
- [x] Add `getTileHP()`, `getTileHealthState()` accessors
- [x] Add `healTick(dt)` — passive TILE_HEAL_OVER_TIME healing each frame
- [x] Add `getTileHPData()`/`loadTileHPData()` for save/load
- [x] Wire `grid.onWallDestroyed` → `roomManager.markDirty()` so room breach is detected on wall destruction
- [x] Wire `grid.healTick()` into game loop
- [x] Wire `CHARACTER_SAFETY_TOLERANCE = 2` into `BuildCursor.canPlace()` (blocks building within 2 tiles of world edge)
- [ ] Fire-to-wall damage: Lua confirms fire does NOT directly damage walls (only meteors do) — no wiring needed

**What we did**: Full tile HP infrastructure in TileGrid with Lua-faithful constants, wall destruction → room re-flood, passive healing, build-edge tolerance.
**What we didn't do**: Nothing meaningful; Lua confirms fire doesn't damage walls directly.
**Blockers**: None

---

## 18. Airlock Pressurisation State Machine (0% → 80%)
**Goal**: Implement full Lua `Airlock.lua` pressurisation cycle — pump out, open outer, cycle, pump in.

- [x] All 7 stage constants matching Lua (CLOSE_DOORS→VENT→OPEN_DOORS→LEAVE→RECLOSE_DOORS→REPRESSURIZE→UNLOCK)
- [x] `tickVenting(dt, bIncreasing)` — drains/fills `room.oxygen` at `OXYGEN_INCREASE_RATE=0.3` × O2_MAX/sec (exact Lua rate)
- [x] `testSafetyInterrupt()` — aborts/redirects to REPRESSURIZE when citizen without spacesuit in room
- [x] `disallowO2Propagation()` — OxygenSystem skips rooms with active airlock cycle (mirrors Airlock.lua:76)
- [x] `getLightingOverride()` — returns LIGHTING_SCHEME_VACUUM when not functional (mirrors Airlock.lua:221)
- [x] `updateDoorMonitor()` — tracks OXYNONE/OXYLOW/OXYMED/OXYFULL based on room O2 %
- [x] `bFunctional` flag (simplified: sealed room = functional)
- [x] `canGoOutside()` / `isSafe()` / `requestOpen()` accessors
- [x] Zone `onTick()` wired into main.ts game loop for all rooms
- [x] `CharacterManager.getCharactersAt(room)` added for safety interrupt
- [x] `safetyCheck` callback wired from main.ts per-room
- [x] Lighting system respects zone `getLightingOverride()` (non-functional airlock → VACUUM tint)
- [ ] Actual door lock/unlock control (deferred — requires door state API)
- [ ] Explosive decompression damage when outer door opens to vacuum

**What we did**: Full O2 pump cycle, safety abort, O2 propagation blocking, lighting override, door monitor state.
**What we didn't do**: Physical door locking (no door state API yet); explosive decompression damage.
**Blockers**: None

---

## 19. Personality Trait Modifiers on AI Scoring (~40% → ~80%)
**Goal**: Wire personality traits that have actual Lua gameplay effects.

**From Lua audit** — only 5 of 19 traits have actual gameplay effects:
- `nTemper` → probability gate in `angerEvent()` (done ✅)
- `nBravery` → gates panic/flee/attack tasks (done ✅)
- `nChattiness` → log posting rate (done ✅ — wired in Log.ts)
- `nAuthoritarian` → raider conversion time: `(1 - nAuthoritarian) * 600`
- `nNeatness` → littering penalty in task utility

**All other traits (bGourmand, bXenophobe, bJoker, bSentimental, bCompetitive, bHipster, bEmoticon, bLowerCase, nGregariousness, nWorkEthic, nPositivity)** are log-tag-scoring only in Lua — no gameplay effect.

- [x] Fix `addAnger()` to match Lua exactly: `nMoraleMult = 2 - 1.6*morale/100`, `if random() > nTemper then nAmt *= 0.25`
- [x] `nBravery` gates panic/flee/attack tasks (CharacterManager activity options)
- [x] `nGregariousness` scales chat task priority in CharacterManager
- [x] `nChattiness` controls log posting frequency (Log.ts getLogCooldown)
- [x] All 14 boolean+slider traits wired into Log.ts tag scoring (44 tag score functions, all Lua-exact: quirks=random 0-0.5, race=0/1, jobs=0/1, lovesjob/hatesjob, activity affinity)
- [ ] Wire `nAuthoritarian` into raider conversion time (DEPENDENCY: raider conversion system)
- [ ] Wire `nNeatness` into littering penalty (DEPENDENCY: littering task)

**What we did**: All 5 gameplay-affecting traits wired (temper, bravery, chattiness, gregariousness). All 19 traits wired for log scoring. nAuthoritarian and nNeatness gameplay effects deferred pending systems.
**What we didn't do**: nAuthoritarian raider conversion (needs raider conversion system), nNeatness littering (needs littering task).
**Blockers**: Raider conversion system, littering task.

---

## 20. Topics / Gossip System (0% → ~80%)
**Goal**: Implement Lua `Topics.lua` — global topic registry with procedural name generators and affinity wiring.

**From Lua `Topics.lua`** (retrieved from installed game):
- Topics are a global registry (People, Bands, Foods, Activities, Duties)
- Each category generates topics via name generators or list generators
- Characters have per-topic affinities (lazy-generated, -10 to +10 range)
- Topics affect Chat interactions, activity preferences, and relationship queries
- New topics generated on immigration (10% chance)

- [x] Create Topics.ts: global topic registry matching Lua
- [x] 5 categories: People, Bands, Foods, Activities, Duties
- [x] Lua-exact name generators: generateBandName, generateFoodName, generateDrinkName, generateCreatureName
- [x] All Lua localization word lists (43 band words, 90+ food words, 23 games, 16 drink words, 31 creature words)
- [x] initializeTopicList (generates DEFAULT_INITIAL_TOPICS=10 per category)
- [x] addTopic with category-specific ID derivation (People=charID, Duties=DUTY_ prefix)
- [x] generateCharacterAffinities for new characters
- [x] generateAffinitiesFor for new topics (broadcast to all existing characters)
- [x] getTopicForActivity (maps task names to activity topics)
- [x] IMMIGRATION_ADD_TOPIC_CHANCE=0.1 wired into CharacterManager.spawnCharacterAt
- [x] Save/load support (topics data persisted in SaveData)
- [x] Character.hasAffinity, Character.generateAffinityFor methods
- [x] Test helpers + 2 E2E tests
- [x] Wire activity affinity into AI scoring (±20% in ActivityOption.evaluate)
- [x] Implement getFavorite, getPeopleOfAffinity queries on Character
- [x] Wire Log replacements to Topics (RANDOMBAND, RANDOMFOOD, FAVORITEFOOD, RANDOMDRINKNAME, RANDOMCREATURE, RANDOMPROVENANCE, RANDOMGAME)
- [ ] Wire Chat.ts to exchange topic affinities during conversation

**What we did**: Full Topics module matching Lua: registry, name generators, all word lists, category system, immigration wiring, save/load, character affinity wiring, AI scoring, relationship queries, Log text replacements.
**What we didn't do**: Chat topic exchange.
**Blockers**: None

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

## 22. Power Circuit Propagation (~100%) ✅
**Goal**: Match Lua power distribution — power flows through connected rooms, not just individual room generators.

**From Lua `Power.lua` + `Room.lua`**:
- Rooms are connected via doors into power networks
- `tContiguousRooms` in Room.lua tracks connected room groups
- Power shared across entire connected network: total output vs total draw
- Rooms with enough total network power get `bHasPower = true` on all objects
- Network breaks when a door is destroyed/locked — isolated rooms lose power
- `POWER_DRAW_PER_TILE = 1` means larger rooms cost more to power

- [x] Implement power network BFS in PowerSystem: starting from generators, walk connected rooms via open doors
- [x] Accumulate total output and draw per network
- [x] Apply `POWER_DRAW_PER_TILE` per room tile count in draw calculation
- [x] Set `bHasPower` on objects based on network balance (not per-room balance)
- [x] Re-run network calculation when a door opens/closes/breaks or generator condition changes
- [x] Wire network power failure state into room lighting (dimmed when power < demand)

**What we did**: Full BFS contiguity blob system in PowerSystem.ts — exactly matches Lua `tContiguousRooms` approach. Rooms connected via door tiles, shared output/draw, POWER_DRAW_PER_TILE*size per room in blob draw. bHasPower set per-blob. Already fully implemented (PLAN.md was stale).
**What we didn't do**: Nothing — fully complete.
**Blockers**: None

---

## 23. Zone Benefit Implementations (~25% → ~45%)
**Goal**: Implement the functional effects of each zone type matching Lua `Zones/*.lua`.

**From Lua audit** — zone benefits are mostly object-placement gating (already done via zoneName) and character AI:
- Zone object placement restrictions (ResearchDesk→RESEARCH, WeightBench→FITNESS, Bar→PUB) already enforced at place time ✅
- Character tasks (ResearchInLab, LiftAtWeightBench, ServeDrink) already assigned to correct zone objects ✅

- [x] **BedZone**: Assignment tracking + `getBedCount()` now dynamically queries EnvObjectManager (matches Lua getPropsOfName)
- [x] **ResearchZone**: `onTick()` clears stale activeResearch when research is completed (matches Lua)
- [x] **FitnessZone**: `LiftAtWeightBench` task linked via WeightBench `inherentActivities`, WorkOut as fallback
- [x] **AirlockZone**: Full pressurisation cycle with O2 pump, safety interrupt, lighting override (#18 ✅)
- [x] **BrigZone**: Prisoner assignment tracking (BrigZone class)
- [x] MaintainEnvObject wires MORALE_MAINTAIN_OBJECT on completion
- [x] ServeFoodAtTable + HarvestAndDeliverFood wire MORALE_DELIVERED_FOOD on completion
- [ ] **BedZone**: Wire SleepInBed to prefer assigned beds (character assignment → target tile)
- [ ] **PubZone**: Wire `atCapacity()` to count actual characters in room vs capacity formula
- [ ] **HospitalZone**: `nBedCount` tracks hospital capacity; triage priority for doctor AI
- [ ] **GardenZone**: `nFoodProduced` tracking per botanist cycle
- [ ] **BrigZone**: Cuffed characters auto-pathfind to brig bed; `nCapacity` enforcement
- [ ] **RefineryZone**: Rock drop-off point; matter output tracking
- [ ] **ReactorZone**: Power bonus multiplier for generators

**What we did**: BedZone dynamic bed count, ResearchZone.onTick() validation, morale wires, all zone objects exist and onTick() called from game loop.
**What we didn't do**: Bed assignment AI preference, Pub capacity enforcement, Hospital/Refinery/Reactor specialty logic.
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

- [x] Verify fire spread uses correct diamond-grid adjacency (4 diagonal neighbors only, matching Lua) ✅
- [x] Wire wall blocking into fire spread (WALL tiles stop propagation) ✅
- [x] Verify `FIRE_DAMAGE_RATE = 5` HP/second (FIRE_DAMAGE_PER_SECOND=5) ✅
- [x] Wire `DESTROYED_FIRE_CHECK_INTERVAL` into EnvObject.onTick() → Fire.startFire() via onFireStart callback
- [x] Constants: DESTROYED_FIRE_CHECK_DELAY=30, DESTROYED_FIRE_CHECK_INTERVAL=60, DESTROYED_FIRE_CHANCE=0.05 ✅
- [x] bCaughtFire flag prevents duplicate fires from same object ✅
- [x] Updated Fire.ts with all Lua-exact constants from Fire.lua (retrieved from installed game)
- [x] Intensity system: INTENSITY_DEFAULT=10, THRESHOLD_LOW=5, THRESHOLD_HIGH=15
- [x] Spread probability by intensity: LOW=0.025, DEFAULT=0.075, HIGH=0.15
- [x] Citizen ignition probability: LOW=0.1, DEFAULT=0.2, HIGH=0.3
- [x] O2 interaction: OXYGEN_PER_SECOND=200, LOW_OXYGEN_THRESHOLD=500, NO_OXYGEN_THRESHOLD=25
- [x] Dousing: LOW_OXYGEN_DOUSE_RATE=10, NO_OXYGEN_DOUSE_RATE=100
- [x] Tile damage: DAMAGE_HEALTHY_TILE_PROBABILITY=0.85, DAMAGE_HURT_TILE_PROBABILITY=0.15
- [x] TIME_BETWEEN_UPDATES=1 (was incorrectly 5)
- [x] Only 1 fire spread per tick (Lua early return behavior)
- [x] douseTile() method, getNearbyFire(), getCitizenSpreadProbability()
- [x] Wire oxygenCheck callback (room O2 → Lua TILE_MAX scale)
- [x] Wire tileHealthCheck callback (TileGrid.getTileHP)
- [x] Wire citizen ignition (citizenIgnite callback in Fire.onTick per-fire, calls Character.catchFire)
- [x] Add Character.catchFire/douseFire (bOnFire, nTotalTimesOnFire, log entries)
- [x] Fire damage applies to bOnFire OR standing on fire tile (Lua tickFireDamage)
- [x] Auto-douse when character leaves fire tile
- [ ] Add smoke/visibility reduction in fire rooms

**What we did**: Complete Fire.ts with all Lua-exact constants, O2 dousing (scaled room O2 to Lua TILE_MAX=1000), tile HP checks, citizen ignition per-fire-tick with catchFire/douseFire on Character, fire damage from both onFire and standing on tile.
**What we didn't do**: Smoke visibility.
**Blockers**: None

---

## 25. Event System Lua Parity (0% → ~80%)
**Goal**: Match Lua `EventController.lua` spawn frequency math, module loading, and compound event structure.

- [x] All 9 event types with Lua-exact weights, minPopulation, minTime gates
- [x] `getExpMod()` — exponential galaxy-position modifier (`0.5 * 2^(2*v)`)
- [x] `getDifficulty()` — Lua-exact formula (75% time + 25% population)
- [x] `getChallengeLevel()` — difficulty ± 0.15 randomness
- [x] `getNextEventTimeDelta()` — oscillating alpha curve (6πx sine wave)
- [x] `computeTimeBetweenEvents()` — galaxy-position weighted average → 135-600s range
- [x] `rollRandomRaiders()` — difficulty-scaled count, killbot upgrade at >0.75 challenge
- [x] Wire galaxy landing zone (density/threat/interference) into EventController from main.ts
- [x] Per-event spawn modifiers from galaxy position (hostile × inverse hostility, friendly × hostility)
- [x] Immigration early-game boost (1.5× weight when <25 min and pop <12)
- [x] Mega event weight boost (CompoundEvent → weight 60 after siege time)
- [x] First event timing: 400-440 seconds (Lua tFirstEventTimeRange)
- [x] Alert timing: 45 seconds (Lua tAlertTimeRange)
- [x] bSkipAlert for Breaching and CompoundEvent
- [x] Max 3 consecutive same-event in forecast
- [x] Previous events history (last 10)
- [x] bRanMegaEvent persisted in save data
- [x] HostileDerelict event type added
- [x] E2E test: difficulty scaling, galaxy values, time-between-events range
- [ ] Compound event sub-event staggering (0-60s per sub-event)
- [ ] Disease pre-rolling on events (nChanceOfMalady=15)
- [ ] Breaching weight doubles to 16 when no exterior rooms

**What we did**: Complete rewrite of EventData.ts and EventController.ts with all Lua-exact formulas, weights, gates, galaxy modifiers, and difficulty scaling.
**What we didn't do**: Sub-event stagger timing, disease pre-roll, breaching weight dynamic adjustment, bHardcoreMode (confirmed NOT in Lua source).
**Blockers**: None

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

## 27. Inspector Panel Log Tab & Save/Load Dialogs (0% → ~30%)
**Goal**: Complete the UI work deferred from #6: Log tab, save/load dialogs, portrait display.

- [x] Inspector Log tab: shows character's 20 most recent log entries (newest first) matching Lua CitizenLogTab
- [ ] Inspector portrait: render character portrait sprite from `Portraits.png` atlas in inspector header
- [ ] Save Base dialog: name input, overwrite confirmation, existing save list
- [ ] Load Base dialog: save file browser, preview info, delete option
- [ ] Mine mode UI: show mineable asteroid tiles, matter yield preview
- [ ] Build menu wall/airlock/vaporize mode buttons in sidebar sub-menu

**What we did**: Added Log tab to InspectorPanel (6th tab, between Psych and Actions). Shows recent entries newest-first with textContent rendering.
**What we didn't do**: Portrait rendering, save/load dialogs, mine mode UI, build menu sub-buttons.
**Blockers**: None

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
| 2026-03-05 | #15 Morale Events | Added 12 missing morale event constants, wired MORALE_LOW_OXYGEN + MORALE_NEEDS_MET_BONUS into Character.ts, MORALE_MINE_ASTEROID/BUILD_BASE/DID_HOBBY into task files | done |
| 2026-03-05 | #16 Room Lighting | Rewrote Lighting.ts with Lua priority order (VACUUM/FIRE/LOWPOWER/NORMAL), sine-wave flash timers, Lua-accurate tint colors, setFire() method. Added LIGHTING_SCHEME_* constants + timer fields to Room.ts | done |
| 2026-03-05 | #17 Tile Damage | Sparse tileHP map in TileGrid.ts, TILE_STARTING_HIT_POINTS=100, healTick(), damageTile(), onWallDestroyed callback, CHARACTER_SAFETY_TOLERANCE=2 in BuildCursor.ts | done |
| 2026-03-05 | #18 Airlock | Complete Airlock.ts rewrite: O2 pump cycle (CLOSE_DOORS→VENT→OPEN_DOORS→LEAVE→RECLOSE_DOORS→REPRESSURIZE→UNLOCK), safety interrupt, disallowO2Propagation(), getLightingOverride(), zone onTick loop in main.ts | done |
| 2026-03-05 | NewGameScreen | Rewrote landing zone screen to match Lua original: INFO_MAP_SIZE=64, region name from adjective+noun word lists (full localization text), 4 stats (density/distance/threat/interference), correct coloring (density high=green, threat high=red), age formula, tutorial marker at (12,34)="QUICK-START MODE", 9-step severity labels, inspector slide-in animation | done |
| 2026-03-05 | NewGameScreen UI Sprites | Complete rewrite with Lua-faithful sprite layout: extracted 18+ sprites from NewGame.png (launch cover/active/pressed, confirm/decline buttons, sidebars, cursor, cancel). Sprite-based confirm/decline on LEFT side, big red LAUNCH button with cover→active animation, decorative tiled sidebars, crosshair cursor, DEPLOY label, CANCEL button. All 82 E2E tests pass. | done |
| 2026-03-05 | NewGameScreen Audio + Sprite Fixes | Wired all Lua-exact audio (cursorappear→Intro_LaunchScreen, accept→Intro_AcceptButton, launchopen/close, previewappear/disappear, launchbutton+stopMusic). Re-extracted all sprites from BFS analysis of NewGame.png (correct bounds: sidebar tiles 277x544/124x544, launch housing 405x351, buttons 154x154). Fixed 4 rendering issues: seamless CSS repeat-y sidebar tiling, correct right sidebar bottom (no red bleed), proportional sidebar widths (148/78px), full launch housing sprite with baked-in CANCEL. | done |
| 2026-03-05 | ObjectPlacement Lua Audit | Full Lua comparison of _checkPropFit/_findPropFit/_getPropFootprint/_getDiamondPropFootprint + Door:init. Rewrote ObjectPlacement.ts to match exactly: door straight-wall validation, againstWall floor-tile placement with flip derivation, occupied-tile check (getObjectAt), autoFlip for doors. Removed erroneous againstWall:true from Door/HeavyDoor/Airlock in EnvObjectData.ts | done |
| 2026-03-05 | NewGameScreen Fixes | Fixed cancel button (separate overlay element, not child of housing). Fixed deploy housing position (bottom:102 matching Lua 204/2). Fixed cover position (left:-20 matching Lua -40/2). Added left sidebar bottom cap. Fixed info panel lag (only animate on first appearance). All 82 E2E tests pass. | done |
| 2026-03-05 | #13 Goals | Complete rewrite: GoalData.ts (16 Lua-exact goals), GoalSystem.ts (Base.getStats() checks, GoalCheckProviders), main.ts providers updated. E2E test updated (16 goals). All 82 tests pass. | ~95% done |
| 2026-03-05 | #9 Log System | Created Log.ts: 41 tag score functions, priority queue, text replacement (35+ codes), tLog/tLogQueue on Character, log tick in update(), save support. LogData.ts already has 89 types/~600 lines. 3 new E2E tests. | ~70% done |
| 2026-03-05 | #25 Events | Complete rewrite: EventData.ts (9 event types with Lua-exact weights/gates), EventController.ts (getExpMod, getDifficulty, oscillating time-delta, galaxy position modifiers, rollRandomRaiders, mega event tracking). Wired landing zone → galaxy values. 1 new E2E test. All 86 tests pass. | ~80% done |
| 2026-03-05 | #10 Affinity | Core affinity/familiarity system: topic-keyed tAffinity, person-keyed tFamiliarity, getAffinity/addAffinity/getNormalizedAffinity, getJobAffinity/getJobXPMultiplier/getJobMoraleModifier, passive familiarity tick (5s intervals, +0.1 per pair in same room), Lua-exact death morale formula. 3 new E2E tests. All 89 tests pass. | ~70% done |
| 2026-03-05 | #20 Topics | Full Topics module from Lua Topics.lua (retrieved from installed game): 5 categories, procedural name generators (bands/foods/drinks/creatures), all Lua word lists, immigration wiring, save/load. Character.hasAffinity + generateAffinityFor methods. 2 new E2E tests. | ~80% done |
| 2026-03-05 | #24 Fire | Complete Fire.ts rewrite with Lua-exact constants from Fire.lua (installed game): intensity-based spread (LOW/DEFAULT/HIGH), O2 dousing, tile damage probability, citizen spread probability, TIME_BETWEEN_UPDATES=1. douseTile/getNearbyFire methods. | ~75% done |
| 2026-03-05 | #27 Log Tab | Added Log tab to InspectorPanel: 6th tab (between Psych and Actions), shows 20 most recent log entries newest-first. | ~30% done |
| 2026-03-05 | Lua source | Copied missing files from installed game: Fire.lua, Topics.lua, LogEntries.lua, MaladyData.lua, Hint.lua + 17 standalone files + Foods/ directory | reference |
| 2026-03-05 | Tests | All 91 passing (1 skipped), 0 type errors | 92 total tests |
| 2026-03-05 | #11 Race | 10 races with RACE_TYPE definitions (sName, nRig, bBreathes, bCanBeCuffed, bCanBeTreated, nMeleeDamage), spawn rates, accessor methods, RACE_NAMES, RIG_* constants. 1 new E2E test. | ~75% done |
| 2026-03-05 | Tests | All 92 passing (1 skipped), 0 type errors | 93 total tests |
| 2026-03-05 | #9 Log | Fixed all tag scores to Lua-exact: quirks=random 0-0.5, race/jobs=0/1, lovesjob/hatesjob, activity affinity/STARTING_AFFINITY, anger/ANGER_MAX. Wired text replacements to Topics module. Wired log triggers: JOINED, CAUGHT_FIRE, DEATH_*, RAMPAGE_START, TANTRUM_START, DISASTER_FIRE/BREACH. | ~85% done |
| 2026-03-05 | #10 Affinity | Added getAffinityForActivity, getFavorite, getPeopleOfAffinity. Wired ±20% activity affinity into ActivityOption.evaluate. | ~85% done |
| 2026-03-05 | #20 Topics | Wired Log replacements to Topics (removed hardcoded word lists), getFavorite delegation. | ~90% done |
| 2026-03-05 | #24 Fire | Wired oxygenCheck (room O2 scaled to Lua TILE_MAX=1000), tileHealthCheck, citizenIgnite callback. Added catchFire/douseFire on Character with bOnFire/log. Fire damage from bOnFire OR tile. Auto-douse off tile. | ~90% done |
| 2026-03-05 | #11 Race | Wired race tags into Log.ts (Lua raceScore: 1/0). | ~80% done |
| 2026-03-05 | Tests | All 95 passing (1 skipped), 0 type errors | 96 total tests |
