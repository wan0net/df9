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

## 9. Log/Journal System (0% → ~95%) ✅
**Goal**: Implement character thought/memory system matching Lua Log.lua.

- [x] Create LineCodes.ts with 845 localized text strings with personality tags
- [x] Create LogData.ts with 128 log types, 38 replacement codes, 41 tag definitions, random data tables
- [x] Create Log.ts with Log.add(), tag scoring (g_/n_ gating), /CODE/ replacement parsing, priority queue
- [x] Add character log infrastructure (tLog, tLogQueue, recentLineCodes, cooldown, queue methods)
- [x] Add Inspector panel Log tab with priority-colored entries
- [x] Wire log queue processing into CharacterManager update loop
- [x] Add test helpers (addCharacterLog, getCharacterLog, getLogTypeCount, getLineCodeCount)
- [x] 6 E2E tests (all pass)

**What we did**: Complete faithful reimplementation of Log.lua. 845 linecodes from MainGame_enUS.lua, all 128 log types with exact lineCodes arrays and priorities, 38 replacement codes (/MYNAME/, /RANDOMBAND/, etc.), 41 personality tag definitions with scoring functions (normalizedScore, needsScore, moraleScore, quirkScore, etc.), tag gating (g_/n_ prefixes), priority queue with chattiness-based cooldowns, Inspector Log tab.
**What we didn't do**: Log entries are not yet generated automatically from game events (requires wiring Log.add() calls into task completions, combat, death events, etc.). Topics.lua random data tables are approximated (bands, foods, games, creatures, drinks, provenances). bestFriend/randomPersonInRoom use placeholder fallbacks until CharacterManager lookup is wired.
**Blockers**: Auto-generation of log entries needs integration with task system, combat, events.

---

## 10. Affinity & Familiarity (~15% → 100%) ✅
**Goal**: Implement full affinity system matching Lua (room, object, activity affinity + familiarity tracking).

- [x] Expand tAffinity to support string-keyed topics (people, duties, activities, rooms)
- [x] Add familiarity system (tFamiliarity map, getFamiliarity, addFamiliarity, setFamiliarity)
- [x] Add lazy-loaded affinity generation (random -STARTING_AFFINITY to +STARTING_AFFINITY on first access)
- [x] Add room affinity tracking (addRoomAffinity, getRoomAffinity using Room_ prefix)
- [x] Add job/duty affinity (getJobAffinity, DUTY_<jobname> topics)
- [x] Add activity affinity modifiers (±ACTIVITY_AFFINITY_CHANGE_PCT scoring in ActivityOption.ts)
- [x] Add affinity queries (getPeopleOfAffinity sorted by affinity*familiarity, getSortedAffinityList)
- [x] Add affinity icon/emotion system (getAffinityIconAndColor: bigfrown/frown/meh/smile/bigsmile)
- [x] Wire familiarity ticking (same-room proximity in CharacterManager, FAMILIARITY_TICK_RATE=5s)
- [x] Wire familiarity into death morale calculation (lossPct = fam*aff / MAX scales)
- [x] Wire log system stubs (currentDutyAffScore, activityScore, selfEsteemScore)
- [x] Add E2E tests (6 tests: lazy gen, clamping, DUTY_ prefix, familiarity, icons, log stubs)

**What we did**: Changed tAffinity from Map<number,number> to Map<string,number> for all topic types. Added tFamiliarity map. Added 15 affinity/familiarity methods to Character.ts (getAffinity with lazy random gen, addAffinity clamped, getNormalizedAffinity, getJobAffinity, getActivityAffinity, addRoomAffinity, getRoomAffinity, getFamiliarity, addFamiliarity, setFamiliarity, getPeopleOfAffinity, getSortedAffinityList, static getAffinityIconAndColor). Updated CharacterManager.ts with familiarity ticking (processFamiliarity groups chars by room, increases pairs by FAMILIARITY_TICK_INCREASE) and fixed death morale to use string keys + familiarity scaling per Lua formula. Wired activity affinity ±20% scoring into ActivityOption.ts evaluate(). Fixed Log.ts stubs: currentDutyAffScore uses char.getJobAffinity()/10, activityScore uses char.getActivityAffinity()/STARTING_AFFINITY, selfEsteemScore uses char.getAffinity(String(char.id)). Added test helpers to main.ts. 92 tests pass (1 pre-existing skip).
**What we didn't do**: Stuff/object affinity pickup/discard integration (constants exist but no pickup system yet). Room affinity auto-adjustment on room visits (no room visit tracking yet). Favorites system (Topics.tTopics from Lua).
**Blockers**: None

---

## 11. Race System (0% → 100% ✅)
**Goal**: Add 10 character races from Lua, missing health statuses.

- [x] Add 10 RACE_* constants + RACE_NAMES + HUMAN_RACE_PCT/CAT_RACE_PCT to CharacterConstants.ts
- [x] Add NON_BREATHING_RACES and RANDOM_ALIEN_RACES sets
- [x] Add `nRace: number` to CharacterStats interface
- [x] Add `bDoesNotBreathe: boolean` field to Character
- [x] Implement `Character.rollRace()` static method (60% Human, 2% Cat, 38% random alien)
- [x] Wire race assignment in Character constructor
- [x] Add `getRace()` and `getRaceName()` accessors
- [x] Wire `bDoesNotBreathe` into CharacterManager O2 update (non-breathing races always have 100% O2)
- [x] Add health statuses STATUS_SCUFFED_UP (7), STATUS_INJURED (8), STATUS_DRUGGED (9) — already existed
- [x] Add `getCharacterRace()` and `rollRace()` test helpers to main.ts
- [x] Add 5 E2E tests (valid range, rollRace distribution, Human majority, raceName, bDoesNotBreathe)

**What we did**: Full race system — 10 races, weighted random generation, non-breathing flag for Killbot/Monster, 97 tests passing.
**What we didn't do**: Race-specific visual body variants (renderer not yet at that stage).
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
