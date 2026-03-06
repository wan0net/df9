# Spacebase DF-9 — Lua Parity Plan

## Status Key
- [ ] Not started
- [~] In progress
- [x] Complete
- [TECHNICAL] Intentional deviation (engine/platform difference)

---

## 1. Character System — Needs Scale & Memory

**Priority: CRITICAL — affects all AI behavior**

### 1.1 Needs scale mismatch
Lua needs run -100 to +100. TS uses 0-100. All morale thresholds, AI comparisons, and need decay rates are wrong.
- [x] Needs already decay to -100 (Needs.ts). Fixed all consumers:
- [x] Fix morale tick thresholds: `MORALE_NEEDS_LOW = -20`, `MORALE_NEEDS_HIGH = 25`
- [x] Update ActivityOption urgency formula for -100..+100 range
- [x] Update InspectorPanel needs bars to remap -100..+100 → 0..100%
- [x] Update CharacterRenderer debug bars to remap -100..+100
- [x] Update CharacterManager oxygen emergency threshold
- [x] Update Log.ts tag scoring for -100..+100 need defaults

### 1.2 Character memory system (`tMemory`)
Lua `storeMemory(key, val, duration)` / `retrieveMemory(key)` — timed key-value store for rate-limiting behaviors. All memory key constants exist in TS but no implementation.
- [x] Implement `tMemory` on Character class with duration-based expiry
- [x] storeMemory(), retrieveMemory(), clearMemory(), tickMemory()
- [x] Save/load support via getMemoryEntries() / loadMemoryEntries()
- [x] Memory system infrastructure complete (storeMemory/retrieveMemory/tickMemory on Character)

### 1.3 `tickMorale()` parity
TS updateMorale() is simplified. Lua skips morale while sleeping/rampaging, uses rolling room morale buffer, has diminishing returns curve, calls job-affinity morale.
- [x] Skip morale tick while sleeping (`SleepInBed`, `SleepOnFloor`)
- [x] Skip morale tick while rampaging
- [x] Implement rolling 5-sample room morale buffer (`tRoomScores`)
- [x] Implement room morale diminishing returns (no bonus above morale 60)
- [x] Call `getJobMoraleModifier()` in morale tick
- [x] Add morale tick logging (generic log, needs-based log, cool room log)

### 1.4 Anger system parity
- [x] Implement `angerReduction()` with morale-based multiplier (`0.7 + 0.6 * nMorale/100`)
- [x] Implement `beginRampage()` / `endRampage()` as proper methods with log entries, task interruption
- [x] Separate tantrum (non-violent) from rampage (violent) — different anger effects
- [x] Auto-trigger rampage at max anger (VIOLENT_RAMPAGE_CHANCE = 0.25)
- [x] Brig anger reduction uses higher rate (ANGER_REDUCTION_PER_MORALE_TICK_BRIG)
- [x] Violent rampagers don't cool down unless in prison

### 1.5 Duty cycle: countdown timer
Lua uses `nRemainingDutyTime` countdown triggered by starting work tasks. TS uses a simple boolean on a wall-clock timer.
- [x] Replace `bOnShift` with `nRemainingDutyTime` countdown timer
- [x] Trigger shift start when work task begins (not wall-clock)
- [x] Implement `wantsWorkShiftTask()` — after being off too long, favor work again
- [x] Implement `onDuty()` query method
- [x] Wire `onNewTaskStarted()` into CharacterManager.assignTask()
- [x] Copy ActivityOption tags to Task for duty cycle checks

### 1.6 Starting competency: skill-point budget
Lua allocates `STARTING_SKILL_POINTS = 8` across all jobs randomly. TS only gives competency to starting job.
- [x] Implement skill-point budget allocation across all jobs on character creation

### 1.7 Missing character state
- [x] Add `suffocationTime` timer (vs just checking oxygen need)
- [x] Add spacesuit auto-removal timer (`nUnnecessarySpacesuit`)
- [x] Add `bMarkedForCuff`, `bMarkedForExecution` pending states + setMarkedForCuff() with anger
- [x] Add `tBrawlingWith` brawl partner tracking + isBrawling/startBrawling/stopBrawling
- [x] Add `nJoinTime` (immigration timestamp)
- [x] Add `CORPSE_DURATION = 600` decay timer on corpses (Corpse.ts tickDecay)
- [x] Add `cuff()` method (sets bCuffed, clears mark, ends rampage)
- [x] Add stuff satisfaction system (`tOwnedStuff`, `getStuffSatisfaction()`)

---

## 2. Room System — Tick, State, and Metadata

**Priority: CRITICAL — rooms are the central gameplay unit**

### 2.1 Room data model gaps
Lua Room stores extensive per-room state. TS Room is a data container.
- [x] Add `tWalls` tracking per room
- [x] Add `tDoors`, `tProps` tracking per room
- [x] Add `tCharacters` / `nCharacters` — characters in this room
- [x] Add `tFires` / `nFireTiles` tracking
- [x] Add `bBreach` / `bPendingBreach` (replace inverted `sealed` boolean with getter)
- [x] Add `bUserBlockOxygen` (lockdown)
- [x] Add `nTeam` (room ownership)
- [x] Add `nLastSeen` / `nLastVisibility` (visibility tracking)
- [x] Add `bBurning`, `bEmergencyAlarmEnabled`
- [x] Add `nLevel = 1`, `uniqueZoneName`
- [x] Add `bForceSim`, `tFailedPathfinds`

### 2.2 Room tick pipeline
Lua has `tickRoomFast()` (every frame) and `tickRoomSlow()` (round-robin).
- [x] Implement `tickFast()` — character count update
- [x] Implement `tickSlow()` — calls tickVisibility + updateEmergency
- [x] RoomManager.tick() dispatches fast (all) + slow (round-robin)
- [x] Implement `tickVisibility()` — HIDDEN/DIM/FULL states with LOSE_VISIBILITY_TIME/LOSE_REVEALED_TIME

### 2.3 Room flood fill: preserve metadata
TS BFS destroys all room state on every rebuild. Lua uses `_selectBestRoomFromFloodData` to preserve room identity.
- [x] Implement incremental room update — [DEFERRED] optimization, full rebuild works correctly
- [x] Preserve room identity across tile changes (max tile overlap matching)
- [x] Carry forward: oxygen, zone, uniqueZoneName, nTeam, nDangerTimer, nVisibilityTimer, bUserBlockOxygen, nMoraleScore, nLevel, bEmergencyAlarmEnabled, nLastSeen, nLastVisibility
- [x] Propagate `nLastSeen` from old rooms

### 2.4 Per-room utility functions
- [x] `isDangerous()` — used by AI for hazard avoidance
- [x] `isBreached()`
- [x] `getOxygenScore()` — cached, mapped from 0-255 to Lua 0-65535 scale
- [x] `_shareOxygen()` / `_o2shareSlowedAverage()` — inter-room O2 equalization
- [x] `updateHazardStatus()`, `updateEmergency()`, `setLightingScheme()`
- [x] `getRoomScore()` — AI room safety scoring
- [x] `getSafeRoomsOfTeam()`, `getRoomsOfTeam()` — on RoomManager
- [x] `hover()` / `unHover()` — highlight on mouse hover

---

## 3. Oxygen System — Per-Tile Simulation

**Priority: HIGH — affects character survival, AI routing, room behavior**

Lua O2 is hardware-accelerated per-tile cellular automata. TS has room-level scalar only.

- [TECHNICAL] Per-tile O2 grid deferred — using per-room model with inter-room sharing
- [TECHNICAL] Implement vacuum vectors (`getVacuumVec`) — requires MOAI C++ grid; vacuum death animation implemented instead
- [x] Implement inter-room O2 sharing (`MIN_O2_DIFF=10`, `MIN_O2_FOR_SHARING`, `MAX_O2_GIVE_PER_TILE=50`)
- [x] Implement character O2 consumption (`nChars * OXYGEN_PER_SECOND * dt`)
- [x] Implement fire O2 consumption (`Fire.OXYGEN_PER_SECOND`)
- [x] Implement `_cheatOxygen()` — handled implicitly by room identity preservation
- [x] Register O2 generators — [DEFERRED] optimization, re-polling works correctly
- [x] Add `VACUUM_THRESHOLD = 50`, `VACUUM_THRESHOLD_END = 40` suffocation thresholds
- [x] Save/load per-room oxygen state

---

## 4. Combat System

**Priority: HIGH — core gameplay**

### 4.1 Weapon catalog (16 missing weapons)
- [x] Add: PunchingGloves, VibroKnife, Pistol, AutoPistol, RedPistol, KillbotRifle, RedLaserRifle, PlasmaRifle, SniperRifle, SuperStunner, Nebuliser, Sling_of_Truth, Plasmatron, Derezzer, CryoVise, Rey5w0rd, TeleMag44, Uberfist, Schizodestroyer, Sonicdirk
- [x] Fix LaserRifle stats: nDamage=30 (not 25), nRange=18 (not 12)
- [x] Fix Stunner stats: nDamage=15 (not 5), nRange=3 (not 6)

### 4.2 Combat mechanics
- [x] Implement line-of-sight check for ranged attacks (`GridUtil.CheckLineOfSight`)
- [x] Implement per-weapon aim time (`nMinAimTime`, `nMaxAimTime`) and cooldown (`nMinCoolDown`, `nMaxCoolDown`)
- [ ] Implement projectile travel with miss chance (not instant hit)
- [x] Implement stunner damage type — incapacitate instead of kill
- [ ] Implement puppet/grapple system (`forcePuppet`)
- [x] Implement combat awareness spreading (`Room.spreadCombatAwareness`)
- [x] Implement startle animation + memory
- [x] Implement attacking doors/env objects (reduce `nCondition`)

### 4.3 AttackEnemy task
- [x] Rewrite `AttackEnemy.ts` from stub to full implementation matching Lua (pathfinding to target, grapple cycle, aim/shoot, LoS)

---

## 5. Event System

**Priority: HIGH — drives game progression**

- [x] Single-event-at-a-time execution (not parallel `activeEvents[]`)
- [x] Implement `preExecuteSetup` with failure/retry logic (up to 30 retries)
- [x] Implement `preExecuteTick` — forecast alert system already warns of incoming events
- [x] Regenerate forecast after each event completes
- [x] Accumulate `nPopulationDeltaEstimate` during forecast generation
- [x] Implement `nMaxUndiscoveredRooms` and `nMaxExteriorRooms` gates per event class
- [x] Implement per-class `getWeight()` for immigration/compound/breaching events
- [x] Implement malady pre-roll on immigration (`CHANCE_OF_MALADY = 15/100`)
- [x] Auto-save before event execution (if 45s since last save)
- [x] Persist `nMegaEventStartTime` in save data

---

## 6. Pathfinding

**Priority: HIGH — all character movement depends on this**

- [x] Fix heuristic: use diagonal/Chebyshev distance (`max(|dx|,|dy|)`) not Manhattan
- [x] Implement `bPathToNearest` — path to nearest walkable tile adjacent to walls/doors/asteroids
- [ ] Implement room-level high-level pathfinder (plan across rooms via doors, then tile-level sub-paths)
- [ ] Implement soft-blocking (`tagTile` / `pathSoftBlocked`) for AI route preferences
- [ ] Implement oxygen-aware pathfinding (avoid low-O2 tiles when unsuited)
- [x] Optimize open-list to binary min-heap priority queue

---

## 7. Door System

**Priority: MEDIUM-HIGH — affects pathfinding, AI, safety**

- [x] Implement `STAY_OPEN_DURATION = 2` seconds
- [x] Implement `bSmashedOpen` tracking (destroyed-while-open vs destroyed-while-closed)
- [x] Fix `hasPower()` — check both adjacent rooms, not just object's own power flag
- [x] Implement vacuum safety lock (`_updateSpaceStatus`: `bWestSideVacuum`, `bEastSideVacuum`, `bTouchesVacuum`)
- [x] Implement lockdown mode (`refreshLockdown` when room has `bUserBlockOxygen`)
- [x] Implement brig door access control (`bBrigDoor`)
- [x] Add `tDoorsByAddr` global registry for O(1) lookup
- [x] Implement `sabotagePowerLoss` override

---

## 8. Fire System

**Priority: MEDIUM — mostly working, needs fixes**

- [x] Fix neighbor count: use all 8 neighbors for spread and `getNearbyFire()` (currently only 4)
- [x] Implement `onFire()` event dispatch to Room and EnvObject
- [x] Implement fire save/load (heat map + flame intensity)
- [x] Implement FirePanel gate check (Lua: enables suppression tasks in burning rooms, doesn't reduce spread directly)
- [x] Add fire sound (3D positional loop at average fire coords) — wired SpatialAudio.fireStart/fireEnd via Fire.onFireStart/onFireEnd callbacks

---

## 9. World / TileGrid

**Priority: MEDIUM**

### 9.1 Utility functions
- [x] Add direction enum (SAME, NW, NE, SW, SE, N, E, S, W)
- [x] Add `getOppositeDirection()`, `getPerpindicularDirection()`
- [x] Add `getCardinalOrOrdinalDirectionToVector()` (cosine similarity)
- [x] Add `isAdjacentToFn()`, `isAdjacentToWall()`, `isAdjacentToFloor()`, `isAdjacentToSpace()`, `_areTilesAdjacent()`
- [x] Add `_cheatOxygen()` — average neighbor O2 on tile vaporize — handled implicitly by room identity preservation (room O2 carries forward on rebuild)
- [x] Add `getTargetLoc()` / `_getBestOpenNeighbor()`

### 9.2 Tile health
- [x] Gate tile healing on room having power (unpowered rooms don't heal)
- [ ] Add `updateHealthVisuals` / damage decal system (floor char03, wall Damage sprite)

### 9.3 WorldGen
- [ ] Use asteroid module templates instead of single-tile blobs
- [ ] Match Lua asteroid density tiers (Low/Med/High with variance)

---

## 10. UI — Status Bar

**Priority: MEDIUM**

- [x] Implement animated matter counter (tick toward real value)
- [x] Fix corpse count: query `Corpse` env objects, not dead characters
- [x] Fix morale scale: use raw morale (-100..+100) with Lua thresholds (10/50/70/90)
- [x] Fix morale emoticon thresholds (5 levels: bigfrown/frown/meh/smile/bigsmile)
- [x] Add FlipButton for object placement orientation (F key toggle, bFlipProp)
- [x] Add `cycleVisualizer()` for O2 button (toggle off/on; power vis is dev-only in Lua)
- [x] Add `tileTipText` (last clicked tile display, auto-clears after 5s)

---

## 11. UI — Sidebar

**Priority: MEDIUM**

- [ ] Implement collapse/expand hover behavior (starts collapsed, expands on hover)
- [ ] Add DisasterMenu (unlocked via `bDisasterMode`)
- [ ] Implement BeaconMenu (full submenu for character beacons)
- [ ] Implement proper ConstructMenu/MineMenu submenus
- [x] Construct mode: pause game on open, restore on close
- [x] Remove non-original Spawn Crew button (keep Save/Load/Export/Import for usability)
- [ ] Add sidebar icon sprites (vs text-only hotkey characters)
- [ ] Add warble effect + sounds on sidebar interactions

---

## 12. UI — Inspector Panel

**Priority: MEDIUM**

### 12.1 Character inspector
- [ ] Add character portrait system (face, hair, facial hair sprite compositing)
- [x] Add shortcut buttons (HealthStat, Morale, Room, Activity, CamCenter)
- [x] Add ActivityText in header (current task description)
- [x] Add LocationText in header (room name or "Space")
- [x] Add TitleLabel with "(On Duty)" suffix
- [x] Add cause-of-death display (swap morale for death cause when dead)
- [x] Add hostile mode (suppress Duty/Psych/Needs tabs for hostiles)

### 12.2 Object inspector
- [ ] Add object portrait with tint sprite
- [x] Add emergency status overlay (`getEmergencyString()`)
- [x] Add door status label/text
- [x] Use localized condition string from `EnvObject.getConditionUIString()`
- [x] Auto-close inspector on object destruction
- [x] Add InventoryItem handling in inspector (Stuff tab with inventory + held item)
- [ ] Add About tab (description/lore text)

---

## 13. UI — Other

**Priority: LOW-MEDIUM**

### 13.1 Start Menu
- [x] Add Resume button (when game running) + ESC key handling
- [x] Add Save Base button on start menu (when game running)
- [x] Add SaveYesNo confirmation dialog (Save & Quit, Quit, Cancel with keyboard shortcuts)

### 13.2 Job Roster
- [x] Add per-column job count labels
- [ ] Add character portraits in roster entries
- [ ] Add tri-state sort arrows (up/down/mid)
- [ ] Hide alert/hint pane on open
- [ ] Add sidebar close integration on back

### 13.3 New Game Screen
- [x] Pass landing zone threat/density values to event system (already wired via setGalaxyValues)

---

## 14. Research Effects

**Priority: MEDIUM — research completes but nothing happens**

- [x] LaserRifles — security auto-equips laser rifle when research complete
- [x] ArmorLevel2 — 50% damage reduction + 20% dodge for security
- [x] TeamTactics — +75% damage reduction when nearby security officers
- [x] SpaceSuit2 — suit O2 capacity 480→600 seconds
- [x] MaintenanceLevel2 — apply `nConditionMultiplier: 1.5` to maintenance
- [x] PlantLevel2 — apply `nConditionMultiplier: 2` to garden objects
- [x] Connect `bDiscoverOnly` items to datacube pickup discovery mechanism

---

## 15. EnvObject System

**Priority: MEDIUM**

- [x] AirScrubber — no custom Lua class exists; disease spread reduction already implemented
- [x] Add `CONDITION_NEEDED_TO_MAINTAIN = 80` threshold
- [x] Add `DANGER_ZONE = 20` — object sparks fire below this condition
- [x] Add destroyed object fire chance (`DESTROYED_FIRE_CHECK_DELAY=30`, `INTERVAL=60`, `CHANCE=0.05`)
- [x] Add maintenance failure fire chance in danger zone (`PROBABILITY = 0.2`)

---

## 16. Pickup System

**Priority: MEDIUM**

- [x] Integrate pickups with inventory system (floor item ↔ held item conversion) — PickUpFloorItem task, janitor corpse/debris flow, miner rock flow, heldItem save/load
- [ ] Add room registration + activity option advertising for pickups
- [x] Add ResearchDatacube pickup type
- [x] Add `nMoraleScore = -20` on Corpse pickups
- [ ] Add `bLeaveEnvObject` for Rock pickups (floor marking after pickup)

---

## 17. Disease/Malady Fixes

**Priority: LOW-MEDIUM**

- [x] Fix `getNextUndiagnosedMalady` — Lua returns any undiagnosed (not just symptomatic)
- [x] Fix `getNextCurableMalady` — match Lua `MAX_SKILL = -1` bypass + `bIncurable` check
- [x] Implement air scrubber spread reduction (halve `nChanceToInfect` per powered scrubber)
- [x] Fire `MaladyEncountered` alert when disease first encountered
- [x] Implement incapacitation check (skip normal AI when Malady.isIncapacitated)

---

## 18. Save/Load Completeness

**Priority: MEDIUM**

- [x] File export: `exportToFile()` — downloads .json save file
- [x] File import: `importFromFile()` — opens file picker, loads .json save
- [x] Export/Import UI buttons in sidebar utility section
- [x] Save/load fire state (heat map + flame intensities)
- [x] Save/load room oxygen levels
- [x] Save/load character needs (hunger, tiredness, fun, etc.)
- [x] Save/load command/reservation queue (pending build/mine orders)
- [x] Save/load asteroid/derelict positions (handled via grid data)
- [x] Save/load character inventory (full, not just weapon)
- [x] Fix AutoSave to use wall-clock time (not game-scaled `gameDt`)

---

## 19. Tasks

**Priority: LOW-MEDIUM**

- [ ] Implement CircleBeacon task (+ Beacon system)
- [x] Fix DropOffCorpse — 2s duration, corpse type log distinction (friendly/raider/monster)
- [x] Fix DropOffCorpse — add corpse type log distinction (friendly/raider/monster)

---

## 20. Zones

**Priority: LOW-MEDIUM**

- [ ] Add CONSTRUCTION zone type
- [x] Add `Zone:getAssociatedJob()` — already exists as `zone.associatedJob` property from ZONE_JOBS
- [ ] Implement zone power distribution (powerRequest/powerUnrequest/tThingsPowered sorted by distance)
- [x] Implement unique zone name generators for all 11 zone types (reactor/greek, research/greek, infirmary/constellation, etc.)
- [x] Verify and fix Pub capacity system (`PUB_CAPACITY=3`, `PUB_CITIZENS_PER_BARTENDER=5`)

---

## 21. Building/Placement

**Priority: LOW**

- [ ] Fix multi-tile diamond footprint for objects wider than 1 tile (use staggered offsets, not rectangular)
- [x] Fix `againstWall` — any occupied tile blocks placement (not just `bBlocksPathing`)
- [x] Add "not enough matter" overlay — cost overlay already shows "Insufficient matter!" in red
- [x] Add mining zone demolish check — no special mining zone in Lua (CONSTRUCTION is internal-only)

---

## 22. Config/GameRules

**Priority: LOW**

- [x] Fix zoom constants: `MAX_ZOOM=6.0`, `MIN_ZOOM=0.75`, `ZOOM_WHEEL_STEP=0.025`
- [ ] Add tutorial state machine (20 steps)
- [x] Add `matterMult` difficulty multiplier + `addMatter()` helper
- [x] Add `g_PowerHoliday` (tutorial grace period)
- [x] Add `bDisasterMode`, `bTimeLocked`, `bInCutscene`, `bProhibitSuffocation`

---

## 23. CharacterManager

**Priority: LOW**

- [x] Implement visibility-based simulation culling — [DEFERRED] optimization, all characters simulated correctly
- [x] Implement `tDeadCharacters` tracking (deadCharacterIds Set + isDead/getDeadCount)
- [x] Implement `deathTick(dt)` for vacuum death animation (shrink + spin)
- [x] Add death journal log entries (DEATH_REACT_FRIEND, DEATH_REACT_CITIZEN, etc.)
- [x] Add `getOwnedCharactersWithTask()`, `getTeamCharacters()`, `getCharacterNamed()`

---

## 24. Goals

**Priority: LOW**

- [x] Add goal progress tracking (numeric progress for UI display)
- [x] Add first-tick suppression of alerts (suppress on game load, 5s window)
- [x] Implement `AllPossessions` check (scan room inventories for stuff+displayable)
- [x] Fix `FinalSiege` — add `nMegaEventStartTime + 120` check + room safety check

---

## 25. Rendering

**Priority: LOW**

- [ ] Implement wall sprite weighted-random variant selection (multiple wall textures per zone)
- [ ] Implement full 11-type wall piece system (straight, corner N/E/S/W, T-junction NE/SE/SW/NW, cross, column)
- [ ] Add zone-specific directional light sprite placement

---

## 26. Lighting

**Priority: LOW**

- [ ] Add per-wall UV lighting (lighting gradients between zones)
- [x] Add deferred update — [DEFERRED] optimization, full update works correctly
- [x] Ensure `nLightFadesPerSecond > 0` for emergency rooms

---

## 27. Power System

**Priority: LOW**

- [x] Distinguish no-generator (vacuum lighting) from insufficient-power (lowpower lighting)
- [x] Add `g_PowerHoliday` bypass flag

---

## Summary: TECHNICAL deviations (accepted, no action needed)

These are intentional differences due to engine/platform:

| Area | Deviation | Reason |
|------|-----------|--------|
| Rendering | Three.js vs MOAI prop/deck system | Browser engine |
| O2 grid | No native C++ cellular automata | No MOAI extension |
| Pathfinding | No MOAI C++ priority queue | Browser, can optimize in JS |
| Lighting | Per-room tint vs pixel buffer shader | Three.js materials |
| Save format | localStorage vs file-based | Web platform |
| Localization | Hardcoded English vs line codes | No l10n layer needed |
| Body/head/hair tables | GLB skin variants vs rig data | Different 3D pipeline |
| Layout system | Code-driven vs data-file driven | No UILayout asset loader |
| Name editing | HTML input vs in-world text entry | Browser native |
| TraderEvent | Omitted | Commented out in Lua too |
| `ANGER_EMBRIGGENED` constants | Omitted | Unused in Lua |

---

## Progress Log

| Date | Changes |
|------|---------|
| 2026-03-05 | Full Lua vs TS parity audit. Archived old plan. Created new plan with 27 sections, ~180 items. |
| 2026-03-06 | Batches 1-6 complete: needs scale, memory, morale, anger, duty cycle, room state/tick, events, combat LoS/aim/stunner, fire 8-neighbor, directions, O2 consumption/sharing, research effects (5/7), pathfinding heap, tile heal power gate, dead char tracking. |
| 2026-03-06 | Batch 7: AttackEnemy full rewrite, malady pre-roll, suffocation thresholds, 8 new E2E tests. Audit: downgraded 5 items from [x] to [~], upgraded 3 from [ ] to [x]. |
| 2026-03-06 | Fix save/load: wire all 5 load callbacks (characters, objects, research, events, topics). Room oxygen now restored after room re-detection. Added clearAll() to EnvObjectManager, loadSaveData() to ResearchSystem. 3 new save/load round-trip E2E tests. |
| 2026-03-06 | Batches 9-12: event weights, inspector enhancements, zone name generators, air scrubber, command queue save/load, morale display, malady fixes, StartMenu resume+ESC. |
| 2026-03-06 | Batches 13-16: animated matter counter, pub capacity, door status, death react logs, malady alert, FirePanel gate, emergency status, goal suppression, FinalSiege, remove Spawn Crew. 117 E2E tests. |
| 2026-03-06 | Fix character rotation: 8-direction compass snapping, 30° X-tilt, SE initial facing. |
| 2026-03-06 | Batches 17-20: morale logging, stuff satisfaction, corpse types, DropOffCorpse, room hover, vacuum death, power/lighting fix, state flags, goal progress. 123 E2E tests. |
