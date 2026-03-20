# Spacebase DF-9 Web Reimplementation — Full Audit

> Generated 2026-03-20. Compared every TS module against the original Lua source in `spacebase-v2-updated-code-master/`.

## Severity Legend

| Tag | Meaning |
|-----|---------|
| **CRITICAL** | Game-breaking: crashes, core mechanics non-functional, makes the game unplayable or deeply wrong |
| **MAJOR** | Significantly affects gameplay experience — wrong behaviors, missing core features |
| **MODERATE** | Noticeable during play but game is still functional |
| **MINOR** | Cosmetic, polish, or edge-case differences |

---

## Executive Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 18 |
| MAJOR | 38 |
| MODERATE | 32 |
| MINOR | 45 |
| **Total** | **133** |

---

## 1. Character System

### 1.1 Character AI & Decision Making

| # | Sev | Issue | Detail |
|---|-----|-------|--------|
| C-1 | ~~CRITICAL~~ DONE | **~~DestSafe/DestOwned tag enforcement missing~~** | Fixed: `ActivityOption.ts` now rejects unsafe/unowned destinations (fire, breach, hostiles, low O2). |
| C-2 | ~~CRITICAL~~ DONE | **~~Task reassignment 1s delay~~** | Fixed: `CharacterManager.ts` immediately reassigns on task completion via `immediateAIQueue`. |
| C-3 | ~~CRITICAL~~ DONE | **~~No survival threat preemption~~** | Fixed: `CharacterManager.ts` adds `survivalTimer` per character (0.5–1.5s) that interrupts tasks for emergencies. |
| C-4 | ~~MAJOR~~ DONE | **~~Needs scoring uses linear urgency~~** | Fixed: uses sigmoid curve `1/(1+exp(val*0.06))` matching Lua's non-linear urgency. |
| C-5 | ~~MAJOR~~ DONE | **~~No continuous job XP gain~~** | Fixed: `CharacterManager.ts` now awards `JOB_EXPERIENCE_RATE * dt` per frame while on duty. |
| C-6 | ~~MAJOR~~ DONE | **~~Hunger starvation priority elevation missing~~** | Fixed: `ActivityOption.ts` adds +1000 score bonus for Hunger tasks when starving. |
| C-7 | MODERATE | **No `getScaledDutyScore`** | Lua specially scales Duty need scores for work-shift tasks. TS has no equivalent. |
| C-8 | ~~MODERATE~~ DONE | **~~Chat cooldown not enforced~~** | Fixed: `tLastChatTime` map per character; cooldown checked before offering Chat. |
| C-9 | ~~MODERATE~~ DONE | **~~Distance penalty formula differs~~** | Fixed: now uses Lua formula (no penalty <5, -1/tile 5→50, high=-3/tile). |

### 1.2 Missing Tasks (14 total)

| # | Sev | Task | Purpose |
|---|-----|------|---------|
| C-10 | MAJOR | `TearDownEnvObjectForResearch` | Scientist disassembles objects for research data |
| C-11 | MAJOR | `DeliverResearchDatacube` | Scientist carries datacube to research station |
| C-12 | MAJOR | `PutResearchDatacubeWherever` | Scientist places datacube when no station available |
| C-13 | ~~MAJOR~~ DONE | `MonsterPatrol` | Implemented: runMonsterAI with room-wandering patrol. |
| C-14 | ~~MAJOR~~ DONE | `MonsterAttackEquipment` | Implemented: monsters attack nearby objects. |
| C-15 | ~~MAJOR~~ DONE | `MonsterWander` | Implemented: idle wandering between attacks. |
| C-16 | MODERATE | `Starve` | Universal fallback for starving state |
| C-17 | MODERATE | `VoluntarilyWalkToBrig` | Character self-surrender to brig |
| C-18 | MODERATE | `VoluntarilyGetCuffed` | Surrender behavior |
| C-19 | MODERATE | `FleeTemperTantrum` | Flee from rampaging character |
| C-20 | MODERATE | `ViolentRampagePatrol` | Rampage patrol component |
| C-21 | MODERATE | `RaiderOxygenFleeArea` | Raider-specific O2 flee |
| C-22 | MODERATE | `RaiderFleeThreat` | Raider-specific threat flee |
| C-23 | MINOR | `PickUpStuff` / `DisplayInventoryItem` / `DropStuffOnFloor` / `IncinerateStuff` | Entire stuff/inventory AI system (4 tasks) |

### 1.3 Character Mechanics

| # | Sev | Issue | Detail |
|---|-----|-------|--------|
| C-24 | ~~CRITICAL~~ FALSE POSITIVE | **`MORALE_DID_HOBBY = 0`** | Lua also has `MORALE_DID_HOBBY = 0` (CharacterConstants.lua:387). Hobby morale comes from need satisfaction, not direct grants. No fix needed. |
| C-25 | ~~MAJOR~~ DONE | **~~Raider conversion missing~~** | Fixed: timer-based conversion in brig. |
| C-26 | ~~MAJOR~~ DONE | **~~Spacesuit removal not wired~~** | Fixed: 10s timer in CharacterManager removes suit when in pressurized room with O2>200. |
| C-27 | ~~MAJOR~~ FALSE POSITIVE | **Vacuum death animation** | `nVacuumScale` defaults to -1 (not 0). No false trigger. Animation triggers correctly on SUCKED_INTO_SPACE death. |
| C-28 | ~~MODERATE~~ DONE | **~~Prison duty drain missing~~** | Fixed: duty trends toward 0 per morale tick while `inPrison()`. |
| C-29 | ~~MODERATE~~ DONE | **~~Brig anger reduction gated wrong~~** | Fixed: now gates on `inPrison()` instead of `bCuffed`. |
| C-30 | ~~MODERATE~~ DONE | **~~Need decay ignores malady modifiers~~** | Fixed: M-1 already wired `getNeedsReduceMods()` into `Needs.decay()`. |
| C-31 | MODERATE | **No drug system** | Lua calls `_applyDrugs(tx,ty)` on every morale tick. TS has no drug implementation. |
| C-32 | MINOR | **No Stuff need** | Lua has a `Stuff` need driving inventory AI. TS has no equivalent need. |
| C-33 | ~~MINOR~~ DONE | **~~Starting competency cap wrong~~** | Fixed: changed cap from 3 to 2 matching Lua. |
| C-34 | MINOR | **No `generateStartingStuff()`** | New immigrants get no starting inventory items based on affinities. |
| C-35 | ~~MINOR~~ DONE | **~~JOB_NAMES linecode for RAIDER~~** | Fixed: changed to `DUTIES012TEXT`. |
| C-36 | MINOR | **No job history tracking** | Lua tracks `tStats.tHistory['TotalTimeAs'..job]`. TS has none. |

### 1.4 Combat

| # | Sev | Issue | Detail |
|---|-----|-------|--------|
| C-37 | ~~MAJOR~~ DONE | **~~No bravery gating on combat~~** | Fixed: 3-tier bravery scoring (ranged/brave/fallback) in CharacterManager. |
| C-38 | ~~MAJOR~~ DONE | **~~SPACE tiles block line of sight~~** | Fixed: removed SPACE tile LoS block in `CombatSystem.ts`. |
| C-39 | ~~MAJOR~~ DONE | **~~Melee 50% stun chance is invented~~** | Fixed: removed invented melee stun in `CombatSystem.ts`. |
| C-40 | ~~MAJOR~~ DONE | **~~ArmorLevel2 dodge double-applied~~** | Fixed: removed separate dodge roll in `CombatSystem.ts`. |
| C-41 | ~~MODERATE~~ DONE | **~~Stunner incapacitation wrong~~** | Fixed: stunner now infects with `KnockedOut` malady in addition to setting incapacitated. |
| C-42 | MODERATE | **`LaserPistol` / `TurretLaser` invented** | TS-only additions not in Lua. Used as default weapons — removing would break combat. Accepted deviation. |
| C-43 | MINOR | **Rey5w0rd/Sonicdirk range unused** | Both have `nRange: 3` but `ATTACK_TYPE.Grapple` skips range check, so range is ignored. |

---

## 2. Rooms, Oxygen & Power

### 2.1 Oxygen System

| # | Sev | Issue | Detail |
|---|-----|-------|--------|
| O-1 | ~~CRITICAL~~ DONE | **~~O2 consumption is tile-local, not room-distributed~~** | Fixed: `OxygenSystem.ts` now distributes char+fire O2 drain evenly across all room tiles. |
| O-2 | MODERATE | **O2 tick is fixed 500ms** | Lua ticks O2 every frame via native C grid. TS uses a fixed 500ms accumulator regardless of game speed. |
| O-3 | MINOR | **O2 generation model differs** | Lua uses per-tile generators in C grid. TS distributes total output evenly across room tiles. Approximate but adequate. |

### 2.2 Room System

| # | Sev | Issue | Detail |
|---|-----|-------|--------|
| O-4 | MAJOR | **Room flood fill is full re-scan** | Lua incrementally updates dirty tiles preserving room identity. TS tears down and rebuilds all rooms on any change, re-matching by overlap. Room state (zone, morale history) can be lost on splits. |
| O-5 | ~~MAJOR~~ FALSE POSITIVE | **Character familiarity** | Already implemented: `tickFamiliarity()` runs every FAMILIARITY_TICK_RATE (5s), groups chars by room, adds FAMILIARITY_TICK_INCREASE (0.1) per pair. |
| O-6 | MODERATE | **`tAdjoining` never populated** | Declared but never used. Wall-adjacency O2 sharing path is bypassed. |
| O-7 | MODERATE | **No auto-team assignment** | Lua: friendly characters in visible rooms are auto-assigned to player team. TS does not do this. |
| O-8 | ~~MINOR~~ DONE | **~~Walla threshold off by 2~~** | Fixed: changed to `>4` in `Room.ts`. |
| O-9 | MINOR | **Visibility constants offset** | TS: 0/1/2. Lua: 1/2/3. Internal only, no functional impact. |

### 2.3 Power System

| # | Sev | Issue | Detail |
|---|-----|-------|--------|
| O-10 | ~~MAJOR~~ DONE | **~~`Room.hasPower()` returns full-power-only~~** | Fixed: `hasPowerFlag` now returns true if ANY power OR produces power. Added `hasFullPower`. |
| O-11 | ~~MODERATE~~ DONE | **~~`canProvidePower()` guard missing~~** | Fixed: LOWPOWER check now exempts rooms with nPowerOutput>0. |
| O-12 | MODERATE | **No `g_PowerHoliday` in EnvObject** | Global power override for tutorials/debug not implemented. |
| O-13 | MINOR | **No sabotage timer** | `nTempPowerLossEnd` not implemented. Sabotage power loss is permanent until manually repaired. |

### 2.4 Door System

| # | Sev | Issue | Detail |
|---|-----|-------|--------|
| O-14 | ~~CRITICAL~~ DONE | **~~No door vacuum auto-lock~~** | Fixed: `Door.ts` now continuously checks vacuum on each side and auto-locks when one side is vacuum. |
| O-15 | ~~MAJOR~~ DONE | **~~Doors not ticked per room~~** | Fixed: `Room.ts` now ticks all doors in `tickSlow()`. |
| O-16 | ~~MAJOR~~ DONE | **~~Doors fail-closed without power~~** | Fixed: `Door.ts` now fails-open (safety) when unpowered in non-vacuum context. |
| O-17 | MODERATE | **Brig door job restriction missing verification** | Lua restricts brig door access to Emergency/Doctor/Technician/Builder. TS implementation needs verification. |

### 2.5 Fire System

| # | Sev | Issue | Detail |
|---|-----|-------|--------|
| O-18 | MODERATE | **No global fire ambient sound** | Lua maintains a single spatial fire loop at the average position of all burning tiles. TS has no equivalent. |
| O-19 | MINOR | **Fire heat/flame not separated** | Lua separates heat accumulation from visible flames. TS collapses both. No functional difference currently. |

### 2.6 Building System

| # | Sev | Issue | Detail |
|---|-----|-------|--------|
| O-20 | ~~MODERATE~~ DONE | **~~Demolish doesn't cancel pending commands~~** | Fixed: `CommandQueue.cancelAt()` called in demolish. |
| O-21 | MODERATE | **Cannot build room on existing floor** | TS skips non-SPACE/WALL tiles. Lua allows rezoning existing floor through the build system. |
| O-22 | MINOR | **Wall cost uses `MAT_BUILD_FLOOR`** | Should use a dedicated wall cost constant. |

### 2.7 Wall Rendering

| # | Sev | Issue | Detail |
|---|-----|-------|--------|
| O-23 | MODERATE | **Only 2 wall direction types** | Lua defines 12 (NWSE, NESW, V, CARAT, etc.). TS only has NWSE and NESW. Complex wall topologies (corners, T-junctions, pillars) render incorrectly. |

---

## 3. Events & Hazards

### 3.1 Event Controller

| # | Sev | Issue | Detail |
|---|-----|-------|--------|
| E-1 | ~~MODERATE~~ DONE | **~~Consecutive event check off-by-one~~** | Fixed: changed `>=` to `>` in `EventController.ts`. |
| E-2 | ~~MODERATE~~ DONE | **~~`EVENT_CHECK_INTERVAL = 5s` polling~~** | Fixed: reduced to 1s (max 1s late instead of 5s). |
| E-3 | MINOR | **No `preAlertSetup` support** | Lua events can abort alerts (e.g. immigration at pop-cap). TS shows alerts unconditionally. |
| E-4 | MINOR | **Population estimate incomplete** | Forecast uses static `nPopulationDelta` instead of pre-rolled spawn counts. |

### 3.2 Immigration Event

| # | Sev | Issue | Detail |
|---|-----|-------|--------|
| E-5 | MAJOR | **No spacebus animation** | Lua has full ship fly-in over 1.5s, pause 2s, fly-away 6s. TS just waits 10s. |
| E-6 | MAJOR | **No immigration character lineup** | Lua shows arriving immigrants as 3D characters in a lineup before dialog. TS shows only text. |
| E-7 | ~~MAJOR~~ DONE | **~~Spawn position is (0,0)~~** | Fixed: DockingSystem/DerelictSystem now spawn at random room tiles. |
| E-8 | MODERATE | **Dialog not blocking** | Lua pauses during dialog with 4s post-dialog delay. TS shows dialog non-blocking. |
| E-9 | MINOR | **Alert click-to-accelerate missing** | Lua: clicking alert starts event immediately. TS has no click-through. |

### 3.3 Hostile / Breaching Events

| # | Sev | Issue | Detail |
|---|-----|-------|--------|
| E-10 | ~~MAJOR~~ DONE | **~~BreachingEvent spawns exactly 1 raider~~** | Fixed: now uses `getScaledRaiderCount()` (1-5 by difficulty). |
| E-11 | MAJOR | **No BreachShip visual** | Lua has full cinematic: fly-in, drill animation, ladder, raiders climb out with 5s gaps. TS plays two sounds and waits. |
| E-12 | ~~MAJOR~~ DONE | **~~Default raider count wrong~~** | Fixed: default changed to 1; EventController provides scaled count. |
| E-13 | ~~MAJOR~~ DONE | **~~BreachingEvent `nDefaultWeight` wrong~~** | Fixed: changed to 10 in `EventData.ts`. |
| E-14 | MODERATE | **No target tile selection** | Lua picks a safe room tile for breach point. TS has no tile-based targeting. |

### 3.4 Meteor Event

| # | Sev | Issue | Detail |
|---|-----|-------|--------|
| E-15 | ~~CRITICAL~~ DONE | **~~Meteor count formula wrong~~** | Fixed: `MeteorEvent.ts` rewritten with duration-based shower, intensity curve, per-tile damage, fire chance, camera shake. |
| E-16 | ~~MAJOR~~ DONE | **~~No per-tile damage~~** | Fixed: MeteorEvent computes `TILE_STARTING_HIT_POINTS * nSize * 0.3` damage, applied via `grid.damageTile()`. |
| E-17 | ~~MAJOR~~ DONE | **~~No fire from meteor impact~~** | Fixed: 25% fire chance for nSize>0.5, wired in main.ts onMeteorLand callback. |
| E-18 | MAJOR | **No meteor approach animation** | Lua shows asteroid sprites flying in. TS has none. |
| E-19 | MODERATE | **No target tile indicator** | Lua shows `meteor_highlight` sprite on target. TS has none. |

### 3.5 Derelict Event

| # | Sev | Issue | Detail |
|---|-----|-------|--------|
| E-20 | CRITICAL | **Completely reimplemented** | Lua calls `Docking.spawnModule()` to physically attach a ship module with real rooms, objects, and crew. TS invents a "choose your own adventure" branching system (discovery/hostileEncounter/friendlySurvivors/etc.) that does not exist in Lua at all. |
| E-21 | ~~MAJOR~~ DONE | **~~DerelictSystem bypasses EventController~~** | Fixed: removed independent spawn timer. Derelicts now only come from event queue. |
| E-22 | MAJOR | **Loot tables invented** | TS generates matter/food/research numbers. Lua spawns actual physical objects (crates, datacubes). |
| E-23 | MODERATE | **Ship types invented** | TS has 5 ship types with probability tables. Lua uses pre-built module data. |

### 3.6 Docking Event

| # | Sev | Issue | Detail |
|---|-----|-------|--------|
| E-24 | MAJOR | **No module spawning** | Lua physically attaches a ship module to the station. TS spawns characters at (0,0). |
| E-25 | MODERATE | **`nMinUndiscoveredRooms = 2` gate missing** | Lua only fires when >=2 undiscovered rooms. TS has no gate. |
| E-26 | ~~MINOR~~ DONE | **~~Wrong accepted alert code~~** | Fixed: Docking event uses `ALERTS029TEXT`. |

### 3.7 Compound Event

| # | Sev | Issue | Detail |
|---|-----|-------|--------|
| E-27 | ~~MAJOR~~ DONE | **~~No point-budget scaling~~** | Fixed: point budget scaling instead of hardcoded 3 events. |
| E-28 | ~~MAJOR~~ DONE | **~~Sub-events not staggered~~** | Fixed: `CompoundEvent.ts` now staggers sub-events 0-60s apart. |
| E-29 | ~~MODERATE~~ DONE | **~~`bRanMegaEvent` set too early~~** | Fixed: set via compound.onCompleteCallback after all sub-events finish. |
| E-30 | MODERATE | **Dialog doesn't block sub-events** | Lua pauses, plays dialog first. TS shows dialog and immediately fires sub-events. |

### 3.8 Trader Event

| # | Sev | Issue | Detail |
|---|-----|-------|--------|
| E-31 | ~~MAJOR~~ DONE | **~~Spawns citizen instead of trader~~** | Fixed: onTraderSpawn callback spawns character with bTrader flag and UNEMPLOYED job. |

### 3.9 Brig System

| # | Sev | Issue | Detail |
|---|-----|-------|--------|
| E-32 | ~~CRITICAL~~ DONE | **~~BrigZone entirely missing~~** | Fixed: full BrigZone with prisoner slots, Cuff→brig assignment, door access restriction, updatePrison validation. |

### 3.10 Squad System

| # | Sev | Issue | Detail |
|---|-----|-------|--------|
| E-33 | MODERATE | **Squad status states missing** | Lua has AVAILABLE/MOVING/BREACHING/EXPLORING states. TS has no status enum. Characters don't consult squad status before taking tasks. |

---

## 4. Malady / Disease System

| # | Sev | Issue | Detail |
|---|-----|-------|--------|
| M-1 | ~~CRITICAL~~ DONE | **~~Disease need modifiers never applied~~** | Fixed: `Needs.ts` now calls `Malady.getNeedsReduceMods()` and applies modifiers to decay rates. |
| M-2 | ~~CRITICAL~~ DONE | **~~Doctors never cure diseases~~** | Fixed: `FieldScanAndHeal.ts` and `BedHeal.ts` now call `Malady.diagnoseMalady()` and `Malady.cureMalady()`. |
| M-3 | ~~CRITICAL~~ DONE | **~~`bRefuseDoctor` / `bHideSigns` never written~~** | Fixed: `Malady.ts` sets these flags when malady becomes symptomatic. `Character.ts` has fields. |
| M-4 | ~~MAJOR~~ DONE | **~~`CheckInToHospital` guard missing~~** | Fixed: `tickMaladies()` returns early when character task is CheckInToHospital. |
| M-5 | ~~MAJOR~~ DONE | **~~Thing/Parasite spawn timers wrong~~** | Fixed: 15s cooldown timer; Parasite always spawns, Thing has 10% chance. |
| M-6 | ~~MAJOR~~ DONE | **~~`getFriendlyName` returns strain key~~** | Fixed: returns `sFriendlyName` from strain data. |
| M-7 | ~~MAJOR~~ DONE | **~~Sneeze spread range too large~~** | Fixed: 5-tile horizontal strip, same room only. |
| M-8 | ~~MAJOR~~ DONE | **~~Immigration disease selection unweighted~~** | Fixed: uses weighted `nChanceOfAffliction` selection. |
| M-9 | ~~MAJOR~~ DONE | **~~Staged disease end time wrong~~** | Fixed: only sets `nMaladyEnd` for non-staged diseases. |
| M-10 | ~~MODERATE~~ DONE | **~~Fire special calls `damage()` not `catchFire()`~~** | Fixed: now calls catchFire() instead of damage(). |
| M-11 | ~~MODERATE~~ DONE | **~~Doctor zero-infection during treatment missing~~** | Fixed: 0% infection during FieldScanAndHeal/BedHeal. |
| M-12 | ~~MODERATE~~ DONE | **~~`tImmuneRaces` never checked in spread~~** | Fixed: checked during spread. |
| M-13 | ~~MODERATE~~ DONE | **~~Sneeze requires only `bContagious`, not `bSymptomatic`~~** | Fixed: requires both bContagious AND bSymptomatic. |
| M-14 | MINOR | **SleepyDisease `nSpeed` placement** | Lua has it inside `tReduceMods` (a bug — never applied). TS correctly places it outside (applies speed modifier). Faithful reproduction would mean NOT applying speed. |
| M-15 | MINOR | **Crazies/SocialWorm lowercase `social` key** | Lua uses lowercase (silent bug — never applied). TS uses uppercase (works). Same faithfulness issue. |
| M-16 | MINOR | **Research time calculation differs** | Lua: `random(0, nForceResearch) + 500`. TS: uses `nForceResearch` directly. |

---

## 5. UI System

### 5.1 Inspector Panel

| # | Sev | Issue | Detail |
|---|-----|-------|--------|
| U-1 | MAJOR | **Character portraits completely absent** | Lua shows layered portrait sprites (face/hair/accessory). TS shows only text. Major visual gap. |
| U-2 | MAJOR | **Object portraits absent** | Lua shows object sprite with tint overlay and offset. TS has none. |
| U-3 | ~~MAJOR~~ FALSE POSITIVE | **CitizenLogTab (Spaceface)** | Already implemented — scrollable feed with timestamps from `tLog`. Log entries added for morale, death, join events. |
| U-4 | ~~MAJOR~~ DONE | **~~CitizenActionTab incomplete~~** | Fixed: Execute now requires cuffed state (disabled when !bCuffed). |
| U-5 | ~~MAJOR~~ DONE | **~~Object action tab generic~~** | Fixed: door Lock/Unlock/Normal, brig Release Prisoner, vaporize Cancel buttons added. |
| U-6 | MODERATE | **No emergency status bar on objects** | Lua shows "On Fire" / "Unpowered" status with background. TS omits. |
| U-7 | MODERATE | **Camera center is one-shot** | Lua sets continuous camera tracking. TS fires once. |
| U-8 | MINOR | **Tab spacer not implemented** | Lua dynamically fills unused tab slots. |
| U-9 | MINOR | **InventoryItem inspection missing** | Lua hides all tabs and shows owner/description for pickup items. |

### 5.2 Research Panel

| # | Sev | Issue | Detail |
|---|-----|-------|--------|
| U-10 | MAJOR | **Two-pane layout missing** | Lua has zone list (left) + project list (right). Clicking a zone filters projects. TS has a single flat list. No zone-based assignment. |
| U-11 | ~~MAJOR~~ DONE | **~~Game doesn't pause on research open~~** | Fixed: showPanel pauses, hideActivePanel restores. |
| U-12 | MODERATE | **No per-room research capacity display** | Lua shows `getResearchCapacity(rRoom)` per zone entry. |

### 5.3 Construct Menu

| # | Sev | Issue | Detail |
|---|-----|-------|--------|
| U-13 | MODERATE | **Airlock build mode missing** | Lua has dedicated `rAirlockButton` in construct menu. TS requires building a room then rezoning via inspector. Functional workaround exists. |
| U-14 | MODERATE | **No "Not enough matter!" label** | Lua shows `rNoFundsLabel`. TS has no visual feedback. |
| U-15 | MODERATE | **Matter cost breakdown missing** | Lua shows 3 lines (build/vaporize/undo). TS shows single total. |

### 5.4 Start Menu

| # | Sev | Issue | Detail |
|---|-----|-------|--------|
| U-16 | ~~MAJOR~~ DONE | **~~ESC doesn't open start menu~~** | Fixed: S-9 added pause menu overlay. ESC shows it when nothing selected. |
| U-17 | MODERATE | **Quit button missing** | Lua has Quit → SaveYesNo dialog. |
| U-18 | MODERATE | **Save/Load uses simplified slot picker** | Lua has full directory browser with thumbnails and timestamps. |
| U-19 | MINOR | **MOTD system absent** | Lua fetches from `spacebasehub.net/motd.json`. |
| U-20 | MINOR | **Website button missing** | |

### 5.5 New Game Screen

| # | Sev | Issue | Detail |
|---|-----|-------|--------|
| U-21 | ~~MAJOR~~ FALSE POSITIVE | **Sandbox mode** | Already implemented in NewGameScreen with checkbox toggle + GameRules.bSandboxMode. |
| U-22 | MODERATE | **Cursor crosshair lines missing** | Lua shows horizontal/vertical crosshair on hover. |
| U-23 | MINOR | **Tutorial marker missing** | Lua shows tutorial marker at grid position (12,34). |
| U-24 | MINOR | **Confirm/Decline glow animations missing** | |

### 5.6 Sidebar

| # | Sev | Issue | Detail |
|---|-----|-------|--------|
| U-25 | MAJOR | **DisasterMenu is empty stub** | Button shows/hides but submenu has no content. |
| U-26 | MODERATE | **Beacon entry editing missing** | Lua allows assigning beacons to individual characters. TS only has Done/Clear/Violence buttons. |
| U-27 | MODERATE | **Mine submenu simplified** | Lua has MineTile/MineArea/MineSurround. TS has Mine/Erase only. |
| U-28 | MODERATE | **Inspector hides sidebar** | Lua keeps sidebar visible, pushes inspect submenu in front. TS hides sidebar entirely. |
| U-29 | MINOR | **SmallBarHighlight element absent** | Visual indicator on collapsed sidebar. |
| U-30 | MINOR | **Utility Save/Load/Export buttons are TS-only** | Not in Lua sidebar. |

### 5.7 HUD

| # | Sev | Issue | Detail |
|---|-----|-------|--------|
| U-31 | MODERATE | **Matter counter sound missing** | Lua plays `mattercounter` SFX on each lerp tick. TS is silent. |
| U-32 | MODERATE | **Matter counter lerp rate fixed** | Lua uses 4-tier multiplier table (1x–6x based on delta size). TS uses fixed step of 2. |
| U-33 | MODERATE | **Population capacity not shown** | No `getCapacity()` implementation. HUD doesn't show O2 recycler-derived capacity. |
| U-34 | MINOR | **Alert layout shift not implemented** | Lua shifts speed/zoom buttons when alerts expand. |
| U-35 | MINOR | **Help "?" button is TS-only** | |

### 5.8 Other UI

| # | Sev | Issue | Detail |
|---|-----|-------|--------|
| U-36 | ~~MAJOR~~ DONE | **~~Tooltip doesn't follow cursor~~** | Fixed: tooltip now follows cursor at Lua offset (68, -30). |
| U-37 | ~~MAJOR~~ FALSE POSITIVE | **`getHostileImmigrationDialogs()`** | Function IS defined at line 144 of `DialogSystem.ts`. No crash. |
| U-38 | MODERATE | **Alert icons missing** | Lua shows sprite icons per alert type. TS shows text only. |
| U-39 | MODERATE | **Alert count limit differs** | Lua: 5 max. TS: 10 max. |
| U-40 | MODERATE | **Goal reward display missing** | Lua shows reward text per goal. TS shows name and progress only. |
| U-41 | MODERATE | **Job Roster name click doesn't open inspector** | Lua navigates to citizen inspector. TS does nothing. |
| U-42 | MODERATE | **Job Roster missing character portraits** | |
| U-43 | MODERATE | **No building preview cursor** | Lua shows object sprite ghost following mouse during placement. TS shows tile highlight only. |
| U-44 | MINOR | **Credits/Settings don't pause game** | Lua pauses on both. |
| U-45 | MINOR | **Master Volume slider is TS-only** | Lua has only Music + SFX. |
| U-46 | MINOR | **Goal icon uses text symbols** | Lua shows sprite icons. TS shows `'★'` or `'○'`. |

---

## 6. Audio System

### 6.1 Architecture

| # | Sev | Issue | Detail |
|---|-----|-------|--------|
| A-1 | ~~MAJOR~~ DONE | **~~Fire loop architecture wrong~~** | Fixed: now uses a single averaged-position global fire loop matching Lua. |
| A-2 | ~~MAJOR~~ DONE | **~~Ambience zoom scaling absent~~** | Fixed: ambience gain now scales inversely with zoom depth (1.0 far → 0.0 close). |
| A-3 | MODERATE | **Interior ambience not screen-sampled** | Lua samples screen positions for room coverage. TS plays interior ambience at constant volume. Exterior ambience already zoom-scaled (A-2). |
| A-4 | ~~MAJOR~~ DONE | **~~Room alarms are one-shot~~** | Fixed: now persistent loops that stop when condition clears. |
| A-5 | MODERATE | **Music state not saved/restored** | Track index and ambience index reset to 0 on every load. Lua saves and restores these. |
| A-6 | MODERATE | **No sound priority/polyphony system** | Lua FMOD limits concurrent voices. TS has no limit — sounds can stack excessively. |
| A-7 | ~~MINOR~~ DONE | **~~Initial music track always index 0~~** | Fixed: random starting track index. |
| A-8 | MINOR | **No voice volume category** | Lua has separate voice gain. TS routes voice through sfx. |

### 6.2 Sound Cues Never Triggered (defined in AudioCueData.ts but never played)

| # | Sev | Cue | When it should play |
|---|-----|-----|---------------------|
| A-9 | ~~MAJOR~~ DONE | `GunShot` | Wired to CombatSystem ranged attack. |
| A-10 | MODERATE | `TurretFire` (10 variants unused) | Turret system not fully implemented — sounds wired but turrets don't auto-attack yet. |
| A-11 | ~~MAJOR~~ DONE | `PowerDown` / `PowerUp` | Wired to PowerSystem room state changes. |
| A-12 | ~~MAJOR~~ DONE | `MonsterAttack`/`BadAlien_Attack`/`Killbot_Attack` | Wired to monster/hostile AI attack resolution. |
| A-13 | ~~MODERATE~~ DONE | `Citizen_Drink` | Wired to Eat/GetDrink task completion |
| A-14 | ~~MODERATE~~ DONE | `OutofBed` | Wired to SleepInBed task completion |
| A-15 | ~~MODERATE~~ DONE | `DoctorScan` | Wired to FieldScanAndHeal start |
| A-16 | ~~MODERATE~~ DONE | `TechMaintain` | Wired to MaintainEnvObject start |
| A-17 | ~~MODERATE~~ DONE | `DropOffBody` | Wired to DropOffCorpse completion |
| A-18 | ~~MODERATE~~ DONE | `Firefight_Stomp` | Wired to ExtinguishFireBareHanded completion |
| A-19 | MODERATE | `TurretRotate` (4 variants unused) | Turret tracks target |
| A-20 | MODERATE | `Raider_Engine` | Raider ship engine loop during breach |
| A-21 | MODERATE | `BuildZone` / `NewBuildZone` | Zone established |

### 6.3 Missing Sound Cues (not in AudioCueData.ts at all)

| # | Sev | Lua Cue | Purpose |
|---|-----|---------|---------|
| A-22 | MODERATE | `placewall` | Wall placement sound |
| A-23 | MODERATE | `placereactorserver` | Reactor placement (file exists on disk) |
| A-24 | MODERATE | `menu` / `jobs` / `done` / `inspect` / `rezone` | Various UI panel sounds |
| A-25 | MODERATE | `clickairlock` / `clicklifesupport` / `clickreactor` | Zone-specific click sounds |
| A-26 | MODERATE | `assignnewduty` | Duty assignment sound |
| A-27 | MINOR | `inspectordoornormal` | Door set to normal mode |

### 6.4 Sound Variant Arrays Incomplete

| # | Sev | Cue | Available | Used |
|---|-----|-----|-----------|------|
| A-28 | MODERATE | `OutofBed` | 5 variants | 1 used |
| A-29 | MODERATE | `Citizen_Drink` | 2 variants | 1 used |
| A-30 | MODERATE | `SpaceSuitEquip` | 2 variants | 1 used |
| A-31 | MODERATE | `MeteorExplode` | 3 variants | 1 used |
| A-32 | MODERATE | `Laser_Impact` | 9 variants | 1 used |
| A-33 | MODERATE | `Taser_Impact` | 5 variants | 1 used |
| A-34 | MODERATE | `TurretFire` | 11 variants | 1 used |
| A-35 | MODERATE | `BadAlien_Attack` | 6 variants | 1 used |
| A-36 | MINOR | `UI_Select` | 5 variants | 1 used |
| A-37 | MINOR | `UI_Hilight` | 4 variants | 1 used |
| A-38 | MINOR | `WallaPos` / `WallaNeg` | 3 each | 1 each used |
| A-39 | MINOR | `PowerDown` / `PowerUp` | 2 each | 1 each used |

### 6.5 Sound Trigger Issues

| # | Sev | Issue | Detail |
|---|-----|-------|--------|
| A-40 | MODERATE | **All damage types play `Brawl_Impact`** | Lua distinguishes laser, taser, and melee impact sounds. TS plays the same brawl sound for all. |
| A-41 | MODERATE | **Immigration `SpaceTaxi` played non-spatially** | Lua plays 3D at ship position. TS plays flat. |
| A-42 | MODERATE | **Meteor impact non-spatial** | Lua plays at world coordinates. TS plays flat. |

---

## 7. Rendering & Visuals

### 7.1 Character Rendering

| # | Sev | Issue | Detail |
|---|-----|-------|--------|
| R-1 | ~~CRITICAL~~ PARTIAL | **Skeletal animation** | Full skeletal anim has Three.js/asset issues. Added procedural death pose (90° rotation). Characters lie flat when dead instead of freezing upright. Full skeleton work deferred. |
| R-2 | ~~MAJOR~~ DONE | **~~Only 2 of 5 skin tone variants used~~** | Fixed: `toneIdx = (charId % 5) + 1` uses all 5 variants. |
| R-3 | MAJOR | **Alien races render as humans** | `getVisibleSubsets()` uses `char.id % 2` for male/female. Ignores `tStats.nRace`. Cat, Jelly, Tobian, Birdshark, Shamon, Chicken all look human. |
| R-4 | MAJOR | **No held-item rendering** | Lua renders weapons/tools in character hands. TS shows nothing. |
| R-5 | MAJOR | **Hostile characters use citizen model** | Lua has `Bad_Alien.glb`, `Murder_Robot.glb` with separate textures. TS uses Citizen_Base for everyone. |
| R-6 | MAJOR | **Dead characters show no death pose** | Skeletal animation disabled means no lying-down pose. Dead characters freeze in last procedural position. |
| R-7 | ~~MODERATE~~ DONE | **~~Thought bubbles use wrong font~~** | Fixed: changed to Dosis (body font). |
| R-8 | MODERATE | **Thought bubbles show text, not icons** | Lua uses sprite emoticons (food, sleep, etc.). TS shows text labels. |

### 7.2 Object Rendering

| # | Sev | Issue | Detail |
|---|-----|-------|--------|
| R-9 | ~~MAJOR~~ DONE | **~~No "no power" blinking icon~~** | Fixed: red "NO POWER" indicator with sin() blink on unpowered objects. |
| R-10 | ~~MAJOR~~ DONE | **~~No interact sprites~~** | Fixed: objects swap to interact sprite variant when bInUse. |
| R-11 | MODERATE | **No "slated for vaporize" red tint** | Objects queued for demolition should show red tint. |
| R-12 | MODERATE | **No hover amber pulse** | Lua pulses amber on mouse hover. |
| R-13 | MODERATE | **`spriteOffsetX`/`spriteOffsetXFlipped` not applied** | Some objects have pixel offsets that are ignored. |
| R-14 | MODERATE | **`bSortBack`/`bSortDownOneTile` not applied** | Z-sorting flags for rugs, large objects ignored. |
| R-15 | MINOR | **Display slots not rendered** | Dresser/WallShelf show no placed items. |

### 7.3 Sprite Atlas Issues

| # | Sev | Issue | Detail |
|---|-----|-------|--------|
| R-16 | ~~MAJOR~~ DONE | **~~Jukebox sprite name mismatch~~** | Fixed: added `Juke` → `Jukebox` alias in `SpriteAtlasData.ts`. |
| R-17 | ~~MAJOR~~ DONE | **~~HappyBot case mismatch~~** | Fixed: added `HappyBot` → `happybot` alias in `SpriteAtlasData.ts`. |
| R-18 | ~~MAJOR~~ FALSE POSITIVE | **OxygenRecycler sprite** | Alias `O2Gen` → `oxygen_recycler` already exists at line 84. |
| R-19 | ~~MAJOR~~ FALSE POSITIVE | **HousePlant sprite** | Aliases `HousePoint` and `HousePlant` → `residence_houseplant` already exist at lines 92-93. |
| R-20 | ~~MAJOR~~ DONE | **~~WallMountedTurret2 sprite wrong~~** | Fixed: added `TurretLv2` → `turret_lv2_frames0003` alias. |
| R-21 | ~~MODERATE~~ DONE | **~~Turret shows wrong frame~~** | Fixed: changed `Turret` alias to `turret_frames0003` (idle state). |
| R-22 | MINOR | **SpaceTree sprite mismatch** | Lua `'SpaceTree_Healthy.png'` (with .png suffix). TS `'space_tree'`. |

### 7.4 Lighting

| # | Sev | Issue | Detail |
|---|-----|-------|--------|
| R-23 | ~~MAJOR~~ DONE | **~~Zone light values wrong in ZoneType.ts~~** | Fixed: updated all 8 zone `roomLights` in `ZoneType.ts` to match `Zone.ts`/Lua values. |
| R-24 | MODERATE | **Object tint missing +0.3 brightness boost** | Lua boosts object color by +0.3 over ambient. TS uses ambient directly. Objects appear darker. |
| R-25 | MODERATE | **No directional wall darkening** | Lua darkens walls facing away from light by 0.8x. TS applies uniform lighting. |
| R-26 | MINOR | **No `LIGHTING_SCHEME_DIM` trigger** | Zone-specific DIM scheme never returned. |

### 7.5 Camera

| # | Sev | Issue | Detail |
|---|-----|-------|--------|
| R-27 | MODERATE | **No edge-scroll pan** | Lua pans camera when cursor near screen edge. TS only uses arrow keys and middle-mouse drag. |
| R-28 | MODERATE | **No follow-character mode** | Lua supports continuous camera tracking of selected character. |
| R-29 | ~~MINOR~~ DONE | **~~Camera shake uses wall-clock time~~** | Fixed: uses `GameRules.elapsedTime`. |
| R-30 | MINOR | **Camera shake rate 2x too fast** | Lua updates at 30Hz game tick. TS updates at 60Hz render frame. |

### 7.6 Background & PostFX

| # | Sev | Issue | Detail |
|---|-----|-------|--------|
| R-31 | MODERATE | **No parallax background** | Lua uses separate background camera at z=500 creating parallax. TS scrolls 1:1 with world. |
| R-32 | MODERATE | **No color LUT grading** | Lua has 5 presets (neutral, warmspace, coldspace, magenta, greenpunch). TS has none. |
| R-33 | MODERATE | **No object outline pass** | Lua renders amber outlines on characters/objects. |
| R-34 | MINOR | **No planet/celestial body** | Lua renders planet/moon in background. |
| R-35 | MINOR | **No individual star field** | Lua renders star sprites. TS only has nebula texture. |
| R-36 | MINOR | **Bloom bleeds onto UI** | PostFX applied to entire scene including CSS2D overlay. |
| R-37 | MINOR | **No oxygen venting visual** | Lua plays VacuumPull effect on decompression. |
| R-38 | MINOR | **No explosion flash/bloom** | Lua explosions trigger screen flash. |

### 7.7 Tile Rendering

| # | Sev | Issue | Detail |
|---|-----|-------|--------|
| R-39 | MODERATE | **No tile damage states** | Lua renders 4 damage states (healthy, light damage, heavy damage, destroyed) with distinct sprites. TS shows no damage. |
| R-40 | MODERATE | **No WorldAnalysis overlay layer** | Lua renders zone overlays, O2 heatmaps, mine range circles. TS has basic O2 overlay only. |
| R-41 | MINOR | **No build grid overlay** | Lua shows structural grid pattern during build mode. |

---

## 8. Research, Goals & Objects

### 8.1 Research

| # | Sev | Issue | Detail |
|---|-----|-------|--------|
| G-1 | MODERATE | **Single global `activeResearch`** | Lua assigns research per ResearchZone. TS uses one global slot. |
| G-2 | MODERATE | **No competence-scaled research progress** | Lua scales progress by scientist competency. TS uses flat delta. |
| G-3 | MINOR | **`bHasStartedResearch` not set** | `ResearchZone.setActiveResearch()` doesn't set the flag. Hints may not trigger. |

### 8.2 Goals

| # | Sev | Issue | Detail |
|---|-----|-------|--------|
| G-4 | ~~MAJOR~~ DONE | **~~Goal thresholds wrong~~** | Fixed: BuiltEverything=44, AllTechs=20, AllPossessions=30 in `GoalData.ts`. |
| G-5 | ~~MODERATE~~ DONE | **~~Goal check rate 60x slower~~** | Fixed: check interval 0.05s (~20Hz) instead of 1s. |
| G-6 | ~~MINOR~~ DONE | **~~Suppress duration 18x too long~~** | Fixed: 0.3s instead of 5s. |

### 8.3 Environment Objects

| # | Sev | Issue | Detail |
|---|-----|-------|--------|
| G-7 | ~~MAJOR~~ DONE | **~~Pub `hasBar()` never auto-set~~** | Fixed: `EnvObjectManager.createObject/removeObject` now auto-sets `hasBar` when Bar placed/removed in Pub zone. |
| G-8 | ~~MAJOR~~ DONE | **~~WorkOutInGym not zone-gated~~** | Fixed: now requires gym equipment to be in FITNESS zone. |
| G-9 | ~~MAJOR~~ DONE | **~~Airlock functional check simplified~~** | Fixed: now requires AirlockLocker in room. |
| G-10 | MODERATE | **No HappyBot subclass** | Passive morale radius effect (`nRange`) not implemented. |
| G-11 | MODERATE | **No RefineryDropoff subclass** | Activity availability not gated on `isFunctioning()`. |
| G-12 | MODERATE | **No spark visual at DANGER_ZONE** | Objects at condition <=20 should spark every 6s. |
| G-13 | MINOR | **Corpse `nMoraleScore=-20` not tracked** | Citizens passing a corpse should take morale hit. |

### 8.4 Pickups

| # | Sev | Issue | Detail |
|---|-----|-------|--------|
| G-14 | MODERATE | **`TransientCrate` missing** | Universal item container for carried items absent as renderable pickup. |
| G-15 | MINOR | **`CookedMeal`/`FryingPan`/`FoodBar` absent** | Cooking tool/food visuals broken. |
| G-16 | MINOR | **`Debris`/`Food` are TS-only** | Not in Lua PickupData. |

---

## 9. Save/Load, Game Loop & Input

### 9.1 Game Loop

| # | Sev | Issue | Detail |
|---|-----|-------|--------|
| S-1 | ~~CRITICAL~~ DONE | **~~No frame cap~~** | ~~Lua caps `deltaTime` at 100ms. TS passes uncapped delta when tab is backgrounded.~~ Fixed: added `MAX_FRAME_TIME = 100ms` cap in `gameLoop()`. |
| S-2 | MODERATE | **Most systems not in ordered tick slots** | Systems are ticked directly in main.ts gameLoop. Correct functionally; ordered slots are a code organization concern. |

### 9.2 Save/Load

| # | Sev | Issue | Detail |
|---|-----|-------|--------|
| S-3 | ~~MAJOR~~ DONE | **~~Autosave interval 5min vs 90s~~** | Fixed: `AutoSave.ts` changed to 90s, added pause/event skip guards. |
| S-4 | ~~MODERATE~~ DONE | **~~Autosave doesn't skip during pause~~** | Fixed in `AutoSave.ts` with pause check. |
| S-5 | ~~MODERATE~~ DONE | **~~Autosave doesn't skip during events~~** | Fixed in `AutoSave.ts` with event-active check. |
| S-6 | MODERATE | **Missing save fields** | `nLastDutyAccident`, `nLastNewShip`, `tLandingZone`, `tSquadData` not serialized. |
| S-7 | MINOR | **Sound state not fully saved** | Category volumes, music track index, ambience index not saved. |

### 9.3 Input

| # | Sev | Issue | Detail |
|---|-----|-------|--------|
| S-8 | ~~CRITICAL~~ DONE | **~~KeyE double-binding~~** | ~~Both bound to KeyE.~~ Fixed: research panel moved to KeyT, erase keeps KeyE. |
| S-9 | ~~MAJOR~~ DONE | **~~ESC doesn't return to start menu~~** | Fixed: `UIManager.ts` adds pause menu overlay with Resume/Save/Load. ESC opens it when nothing selected. |
| S-10 | MODERATE | **No Shift+,/. to cycle rooms** | Lua supports room cycling. TS does not. |
| S-11 | MODERATE | **No Shift+]/[ to cycle items in room** | |
| S-12 | MINOR | **Number keys 1/2/3 repurposed** | Lua: debug info (dev only). TS: time speed presets. |

### 9.4 Hints

| # | Sev | Issue | Detail |
|---|-----|-------|--------|
| S-13 | ~~MAJOR~~ DONE | **~~20+ hints missing~~** | Fixed: added 20+ hints from Lua HintData.lua with correct linecodes and conditions. |
| S-14 | MODERATE | **Hint linecode mappings wrong** | NoFitnessZone uses `HINTSX019TEXT` (Lua: PubAtCapacity). NoJukebox uses `HINTSX020TEXT` (Lua: PubButNoBar). Several others mismatched. |
| S-15 | MODERATE | **Hint logic conditions differ** | notEnoughTechnicians missing total decay check. notEnoughBeds triggers on count instead of actual floor-sleeping. lowOxygen uses raw value instead of `MORALE_LOW_OXYGEN_THRESHOLD`. |

### 9.5 Pathfinding

| # | Sev | Issue | Detail |
|---|-----|-------|--------|
| S-16 | MODERATE | **`maxNodes` cap of 1000** | Lua has no explicit cap. Large maps may fail to find distant paths. |
| S-17 | MODERATE | **Path cache not invalidated on grid changes** | Paths remain cached for 1s TTL. Characters may briefly walk through newly-built walls. |
| S-18 | MINOR | **No bidirectional search** | Lua uses bidirectional A*. TS uses single-direction. Slower for long paths. |

---

## Priority Fix Order (Recommended)

### P0 — Fix before playing (game-breaking)

1. **S-1**: Add frame cap (`MAX_FRAME_TIME = 100ms`)
2. **S-8**: Fix KeyE double-binding (reassign erase to different key)
3. **S-9 + U-16**: Wire ESC to open start menu
4. **C-24**: Set `MORALE_DID_HOBBY` to correct nonzero Lua value
5. **M-2**: Wire `Malady.cureMalady()` into FieldScanAndHeal and BedHeal
6. **M-1**: Hook `getNeedsReduceMods` into `Needs.decay()`
7. **O-14**: Implement door vacuum auto-lock
8. **O-1**: Change O2 consumption to room-distributed
9. **U-37**: Fix `getHostileImmigrationDialogs()` crash
10. **E-32**: Implement BrigZone basics
11. **R-1**: Re-enable skeletal animation (or at minimum death pose)

### P1 — Fix for gameplay fidelity

12. **C-1**: Implement DestSafe/DestOwned tag enforcement
13. **C-2**: Immediate task reassignment on completion
14. **C-3**: Add survival threat preemption
15. **C-5**: Wire continuous job XP gain
16. **E-15**: Fix meteor count formula (duration-based shower)
17. **E-20**: Replace derelict event with module-spawn system
18. **O-16**: Fix doors to fail-open without power
19. **O-15**: Add continuous door ticking
20. **C-37**: Add bravery gating on combat tasks
21. **C-38**: Fix LoS to not block on SPACE tiles
22. **M-3**: Wire `bRefuseDoctor`/`bHideSigns`
23. **M-5**: Fix Thing/Parasite spawn timers (15s cooldown)
24. **G-7**: Auto-set `hasBar()` when Bar object placed
25. **G-4**: Fix goal thresholds (44/20/30)

### P2 — Fix for visual/audio polish

26. **R-2**: Use all 5 skin tone variants
27. **R-3**: Render alien race models
28. **R-5**: Use hostile character models (Bad_Alien, Murder_Robot)
29. **R-9**: Add "no power" blinking icon on objects
30. **R-10**: Implement interact sprites
31. **R-16–R-20**: Fix sprite name mismatches
32. **A-1**: Fix fire loop to single averaged-position loop
33. **A-2**: Wire ambience zoom scaling
34. **A-4**: Make room alarms persistent loops
35. **A-9–A-12**: Wire combat sound cues (GunShot, TurretFire, etc.)
36. **U-1**: Add character portraits to inspector
37. **U-36**: Make tooltip follow cursor

### P3 — Polish and completeness

Everything else — missing tasks, missing hints, variant sound arrays, cosmetic UI differences, visual effects, etc.
