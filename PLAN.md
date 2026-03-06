# Spacebase DF-9 — Master Plan (v3)

## Status Key
- [ ] Not started
- [~] In progress
- [x] Complete
- [TECH] Intentional deviation (engine/platform)
- [DEVIATION] Unconfirmed deviation — needs user approval
- [STUB] Lua feature that is stubbed/simplified in TS

---

## What's Done (v2 Plan — All Complete)

All 27 sections from the v2 plan are complete (180+ items). Key systems working:
- Character needs (-100..+100), memory, morale, anger, duty cycle, competency
- Room system (tick pipeline, flood fill, metadata preservation, visibility)
- Oxygen (per-tile Uint16Array grid, inter-room sharing, breach drain, save/load)
- Combat (16 weapons, LoS, aim/cooldown, dodge, stunner, AttackEnemy rewrite)
- Events (forecast queue, 8 event types, difficulty scaling, malady pre-roll)
- Fire (8-neighbor spread, O2 drain, wall blocking, sound, save/load)
- Doors (auto-open proximity, vacuum lock, lockdown, brig, sabotage)
- Pathfinding (A* with binary heap, bPathToNearest, Chebyshev heuristic)
- Research (7 effect types wired, datacube discovery)
- Task interaction (3-phase walk→interact→tick, reservation system)
- Power (contiguity BFS via doors + wall-blob adjacency)
- UI (start menu, new game, sidebar, inspector, job roster, alerts, HUD)
- Save/Load (full state, fire, O2 grid RLE, commands, inventory, export/import)
- 172 E2E tests passing
- Audio: lazy loading, WAV playback, music rotation (Revoice tracks), spatial loops
- UI: Orbitron font everywhere, persistent coordinate display, alert panel cleanup

---

## Priority Tiers

```
P0 — AUDIO & UI POLISH (first impression, most noticeable)
P1 — VISUAL POLISH (second impression, immersion)
P2 — MISSING CORE MECHANICS (gameplay gaps)
P3 — MISSING CONTENT & SYSTEMS (completeness)
P4 — NICE-TO-HAVE (AI graphics, extra polish)
```

---

## P0: Audio System (Currently Silent)

**The game currently plays ONLY procedural beeps. All 419 extracted WAV files sit unused.**

### P0.1 Audio Loading Pipeline ✅
- [x] `ensureLoaded()` — fetch WAV, decode, cache on first call
- [x] `playOneShotLazy()` / `playLoopLazy()` — lazy-load then play
- [x] `preloadCues()` — batch startup loading (UI, menu, alarms, doors)
- [x] Per-cue volume from AudioCueData

### P0.2 Music System Fixes ✅
- [x] Track selection: `Track1_Revoice`, `Track2`, `Track3_Revoice`, `Track4`, `Track5` (matches Lua)
- [x] Timing: `MUSIC_TIME=400`, `MUSIC_SILENCE_TIME=450` (matches Lua)
- [x] Track ordering: sequential (not shuffled, matches Lua)
- [x] Menu music: `Intro_GuitarTrack` plays with lazy loading
- [x] `onMusicTrackEnd` callback via AudioBufferSourceNode.onended

### P0.3 Spatial Audio Loop Playback ✅
- [x] `SpatialAudio.startLoop()` now creates real `AudioBufferSourceNode` with 3D panning
- [x] `stopLoop()` properly disconnects source
- [x] Door open/close wired in Door.ts `_updateDoorState()`
- [x] Object build completion wired in `EnvObject.markBuilt()`

### P0.4 UI Sound Triggers ✅
- [x] Sidebar expand → `UI_Expand`
- [x] Sidebar button click → `UI_Select`
- [x] Button hover → `UI_Hilight`
- [x] Construct mode → `UI_ShortStatic`
- [x] Construct sub-menu click/hover → `UI_Select`/`UI_Hilight`

### P0.5 Game Event Sounds ✅
- [x] Meteor: `MeteorAppear` on first + `MeteorImpact` per impact
- [x] Immigration: `SpaceTaxi` on event start
- [x] Breaching: `Raider_Docking` + `Raider_Drill` on event start

### P0.6 Character Sounds ✅
- [x] Spacesuit equip: `SpaceSuitEquip` at tile
- [x] Take damage: `Brawl_Impact` (with 10 variants)
- [x] Death: `Citizen_FireDeath` / `Citizen_ShotDeath` + voice line

### P0.7 Ambient Sound System ✅
- [x] Interior ambience: `InteriorAmbience` loop on separate keyed channel
- [x] Room walla: `WallaPos`/`WallaNeg` 3D loop when room has ≥3 characters
- [x] Room alert sounds: `Alarm_Fire`/`Alarm_Breach`/`Alarm_LowOxygen`/`Alarm_Alert` on lighting scheme change

### P0.8 Sound Variation ✅
- [x] `variants` field in AudioCue interface
- [x] Random variant selection in `resolveVariantBuffer()`
- [x] DoorOpen (3), DoorClose (3), GunShot (4), Brawl_Impact (10) wired

### P0.9 Zoom-Based Volume Scaling ✅
- [x] sfx scales with zoomDepth (0 far → 1 close)
- [x] music scales inversely (1.0 far → 0.65 close)

### P0.10 Voice System ✅
- [x] 70+ voice WAVs mapped (Male/Female × Greeting/Positive/Negative/Panic/ShotDeath)
- [x] `playVoice()` helper with gender/type selection
- [x] Death voice lines wired in Character.kill()

---

## P0: UI Polish ✅

### P0.11 Font: Orbitron Throughout ✅
- [x] Orbitron loaded in main.ts (early)
- [x] UIManager root → `'Orbitron',monospace`
- [x] InspectorPanel → Orbitron
- [x] JobRoster → Orbitron
- [x] ResearchPanel → Orbitron
- [x] GoalsPanel → Orbitron
- [x] Loading screen → Orbitron
- [x] StartMenu version label → Orbitron

### P0.12 Sidebar Button Layout
- [ ] Original shows 3-column layout — current TS collapse/expand approach is close but not exact match

### P0.13 Persistent Tile Coordinate Display ✅
- [x] `tileInfoEl` always visible, shows `(x, y) Type` on hover
- [x] Bottom-right positioning

### P0.14 Start Menu Refinements ✅
- [x] MOTD panel hidden by default (display:none)
- [x] Title: 42px/74px (reduced from 52px/88px)

### P0.15 New Game Screen Refinements
- [ ] Missing hazard-stripe borders on help text bar
- [ ] Button label visibility
- [ ] Bottom help bar position

### P0.16 Button Hover Effects
- [ ] Original brightens text without full background fill

### P0.17 Alert Panel Styling ✅
- [x] Removed border, simplified to borderless dark panel

---

## P1: Visual Polish

### P1.1 Space Background ✅
- [x] Nebula tile (Backgrounds.png) tiled across world with additive blending for brighter stars
- [x] Elements.png nebula cloud overlays scattered as decorative overlays

### P1.2 Character Blob Shadows ✅
- [x] Procedural elliptical shadow texture under each character
- [x] Hidden on SPACE tiles, visible on floor (matches Lua visibility logic)
- [x] Positioned below character Z, follows movement

### P1.3 Selection Highlighting ✅
- [x] Amber pulsing diamond highlight on selected character/object
- [x] Amber tile tint overlay on selected room tiles (Lua: Lighting.setRoomHighlight 0.3)
- [x] Cached room meshes (only rebuilt on selection change, not per-frame)

### P1.4 Character Emoticon/Thought Bubbles ✅
- [x] CSS2DObject thought bubble above each character showing task name
- [x] Shows for 5 seconds on task change (Lua EMOTICON_INITIAL_DURATION=5)
- [x] Friendly display names for 23 task types (Building, Mining, Fighting!, etc.)

### P1.5 Fire Particles ✅
- [x] `FireParticles.ts` — procedural flame particle system using Three.js Points
- [x] 12 particles per tile with upward drift, yellow→red fade, random flicker
- [x] Additive blending, auto-synced with active fire tiles from Fire.ts

### P1.6 Build Grid Overlay ✅
- [x] Already implemented in BuildCursor.ts with cursor_grid textures

### P1.7 Projectile Visuals ✅
- [x] `ProjectileRenderer.ts` — colored beam meshes between source and target
- [x] Color-coded by damage type (green laser, orange bullet, blue stunner, purple plasma)
- [x] Additive blending, auto-synced with ProjectileManager active list

### P1.8 Camera Shake ✅
- [x] `CameraController3D.shake(mag, dur)` — random offset per frame while active
- [x] Triggered from MeteorEvent (mag=15, dur=0.2s) matching Lua Camera.lua
- [x] Shake offset applied in updateCamera() via scrollX/scrollY adjustment

### P1.9 Character/Object Room Lighting ✅
- [x] `CharacterRenderer.setCharacterTint()` applies room tint color to character meshes
- [x] `applyCharacterRoomLighting()` in game loop reads room scheme per character
- [x] Characters in emergency rooms (fire, vacuum, low power) get matching tint
- [x] Door lighting — tints door tiles via room tDoors set (Lua `_updateDoorLights`)
- [x] Object lighting — `EnvObjectRenderer.setObjectTint()` applies room tint to env objects

### P1.10 Per-Tile Light Gradients ✅
- [x] `Lighting.computeTileLightMap()` places virtual ceiling lights at zone-defined gap intervals with linear distance falloff
- [x] `Lighting.getTileTint()` combines room scheme + ceiling light gradient (DARKNESS_BASE=0.3 matching Lua kCOLOR_DARKNESS)
- [x] Zone-specific ceiling light configs from Lua Zone.lua (13 zones: gap, radius, color)
- [x] `renderRoomLighting()` applies per-tile tints to floor tiles, env objects, and door tiles

### P1.11 Smooth Camera ✅
- [x] Smooth zoom interpolation via zoomBuffer + ZOOM_RATE drain (Lua Camera)
- [x] Zoom-toward-cursor preserves world point under mouse
- [x] Edge panning: N/A — confirmed NOT in original Lua Camera.lua (no edge pan logic exists)

### P1.12 Missing Animations [TECH]
- [ ] Skeletal animation clips blocked — `.banim` binary format not reverse-engineered. Characters use procedural walk/idle fallback.
- [x] Door open/close: confirmed instant sprite swap in Lua (no transition animation) — our implementation matches
- [ ] Animated object sprites (Jukebox pulsing, generators) — low priority

### P1.13 Other Particles (partial) ✅
- [x] Meteor trail effect — `EffectParticles.spawnMeteorTrail()` (orange-white falling trail, wired to MeteorEvent)
- [x] Construction danger sparks — `EffectParticles.spawnSparks()` (8 bright sparks at ≤DANGER_ZONE condition, every 6s)
- [x] Disease sneeze: N/A — confirmed NO visual particle in original Lua (only contagion logic)
- [ ] Shuttle/docking approach — skipped (low priority, needs docking bay animation)

---

## P2: Missing Core Mechanics

### P2.1 Emergency Beacon System [STUB]
- [ ] **Entirely missing** — primary command mechanism for security squads
- [ ] Beacon placement modes (travel-to, explore)
- [ ] Violence levels (lethal/nonlethal/default)
- [ ] CircleBeacon task for security response
- [ ] BeaconMenu UI (placement, editing)
- Lua files: `EmergencyBeacon.lua`, `CircleBeacon.lua`, `BeaconMenu.lua`

### P2.2 Dialog System [STUB]
- [ ] **No dialog UI at all** — all events auto-resolve without player choice
- [ ] Immigration accept/reject dialog
- [ ] Hostile immigration deception detection
- [ ] Trader interaction dialog
- [ ] Compound event negotiation/ultimatums
- Lua files: `DialogSets.lua`, `GameScreen.lua`

### P2.3 Docking/Ship Module System [STUB]
- [ ] `Docking.ts` is a simple state machine — no physical ship placement
- [ ] DerelictEvent auto-completes with random matter reward (no explorable ship)
- [ ] HostileDockingEvent has no dialog, no dock mechanics
- [ ] TraderEvent just sets immigrant count (no trading)
- [ ] No bridge construction between ships
- [ ] No airlock detection for docking points
- Lua files: `DockingEvent.lua`, `ModuleData.lua` (17 asteroid templates, ship layouts)

### P2.4 Fire Extinguisher Tool
- [ ] `ExtinguishFireWithTool` task — characters equip fire extinguisher and use it
- [ ] `ExtinguishFireBareHanded` task — bare-handed firefighting (less effective)
- [ ] Fire extinguisher as inventory tool item
- Lua files: `ExtinguishFireWithTool.lua`, `ExtinguishFireBareHanded.lua`

### P2.5 Prerequisite Chain Resolution
- [ ] Lua UtilityAI has `Satisfies`/`Prerequisites` that chain tasks (need suit → GoOutside → PutOnSuit; need empty hands → DropEverything → PickUpFloorItem)
- [ ] TS picks from flat list with no prerequisite chains
- Lua file: `OptionData.lua`

### P2.6 Vacuum Pull / Decompression
- [ ] When rooms breach, characters get pulled toward space
- [ ] `VacuumPull` task with vacuum vector sampling
- [ ] Elevated spacewalk (level 2)
- Lua files: `VacuumPull.lua`, `Character.lua`

### P2.7 Missing Tasks (23 referenced in Lua OptionData with no TS file)
Critical:
- [ ] `RunTo` — generic run-to-location (used by many flee/emergency tasks)
- [ ] `ExtinguishFireWithTool` / `ExtinguishFireBareHanded`
- [ ] `VacuumPull`

High:
- [ ] `ChatPartner` — partner side of cooperative chat
- [ ] `DestroyEnvObject` — vaporize/demolish objects
- [ ] `CircleBeacon` — security beacon response
- [ ] `PanicOnFire` — fire panic reaction
- [ ] `WalkTo` / `GoOutside` / `GoInside` — movement primitives
- [ ] `MaintainPub` — bartender serving
- [ ] `EatAtFoodReplicator` — distinct from generic Eat
- [ ] `DropEverything` — drop all held items

Medium:
- [ ] `CheckInToHospital` / `GetFieldScanned` — medical
- [ ] `CollectResearchDatacube` / `DeliverResearchDatacube`
- [ ] `EatPlant` / `WorkOutInGym` / `PlayGameSystem`
- [ ] `PutItemInTarget` — display case items
- [ ] `Puppet` — controlled state for cinematics

### P2.8 Room Claiming/Unclaiming
- [ ] Derelict rooms can be claimed for player team
- [ ] `canClaim()` / `claim()` / `unclaim()` on Room
- [ ] Room float-away after `FLOAT_AWAY_TIME = 720` seconds if unclaimed

### P2.9 Cooperative Tasks
- [ ] Two-character tasks: ChatPartner, GetFieldScanned (patient/doctor pair)
- [ ] Pending task negotiation

### P2.10 Work Shift Gating in UtilityAI
- [ ] Lua UtilityAI has hierarchical priority (PUPPET > SURVIVAL_NORMAL > SURVIVAL_LOW > NORMAL)
- [ ] Personality-based activity filtering
- [ ] Distance penalties in scoring
- [ ] Per-activity gate functions

---

## P3: Missing Content & Systems

### P3.1 GlobalObjects Activity Registry
- [ ] `GlobalObjects.lua` — central utility activity registry with room scoring, nearby safe location finding, idle fallback logic. No TS equivalent.

### P3.2 Food/Plant Data
- [ ] `FoodData.lua` — food types (Corn, Pod, Glowfruit, CandyCane) with quality/morale
- [ ] `PlantData.lua` — growth stages with sprites, harvest quantities, plant lifetimes
- [ ] `EatPlant` task, food quality morale (`MORALE_ATE_MEAL_BASE=1` to `MAX=10`)

### P3.3 HappyBot Custom Class
- [ ] Tile-radius morale boost system
- [ ] Hover visualization of affected area
- Lua: `HappyBot.lua`

### P3.4 Jukebox Custom Class
- [ ] Music playback on/off control
- [ ] Listener detection within range
- [ ] Mood boosting of nearby listeners
- Lua: `Jukebox.lua`

### P3.5 RefineryDropoff Custom Class
- [ ] Rock drop-off, corpse incineration, stuff incineration
- [ ] Advertises DropOffRocks, DropOffCorpse, IncinerateStuff options
- Lua: `RefineryDropoff.lua`

### P3.6 SpaceRoom Singleton
- [ ] Exterior "space room" managing power from exterior generators, visibility for characters in space
- Lua: `SpaceRoom.lua`

### P3.7 Object Condition/Decay
- [ ] Per-object decay rates with condition levels
- [ ] Danger zone at 20% condition, fire chance at 0%
- [ ] Damaged/destroyed sprite variants

### P3.8 Blood Decals
- [ ] 5 blood decal sprites placed on combat damage tiles

### P3.9 Object Sabotage
- [ ] Characters on rampage sabotage objects (`DEFAULT_SABOTAGE_DURATION=60`)

### P3.10 Brig Escape
- [ ] Imprisoned characters attempt escape

### P3.11 Drug Effects
- [ ] Characters stepping on drug tiles get STATUS_DRUGGED

### P3.12 Emergency Alarm Object
- [ ] Room alarm objects triggering flee behavior for all characters

### P3.13 OptionData Centralized Scoring
- [ ] Lua has master table of ~80 activities with Needs, ScoreMods, Prerequisites, Tags, PersonalityMods
- [ ] TS has individual task files but no centralized scoring/gating data

### P3.14 Room Danger/Visibility State
- [ ] `isDangerous()`, `hasHostiles()`, combat awareness spreading
- [ ] Full room visibility fog-of-war (HIDDEN/DIM/FULL with timers)

### P3.15 Character Speed Formulas
- [ ] `getAdjustedSpeed()` accounts for morale, health, encumbrance, brawling, spacewalking
- [ ] TS has partial morale speed modifier only

### P3.16 Familiarity System
- [ ] `FAMILIARITY_TICK_RATE=5`, `FAMILIARITY_TICK_INCREASE=0.1`
- [ ] `FAMILIARITY_CHAT=4`, `FAMILIARITY_SERVE_MEAL=0.5`
- [ ] Character relationship tracking

---

## P4: Nice-to-Have / Extras

### P4.1 AI-Generated Character Portraits
- [ ] [DEVIATION] Original uses premade + procedural portraits from body/head/hair tables. Could use AI image generation for unique character portraits. **Not in original — needs user approval.**

### P4.2 Enhanced Music
- [ ] [DEVIATION] Could add more ambient music tracks beyond the original 5. **Not in original — needs user approval.**

### P4.3 PostFX/Bloom
- [ ] Lua `Post.lua` has bloom, scene compositing, blend modes
- [ ] Three.js EffectComposer could replicate

### P4.4 Animated 3D Start Menu Backdrop
- [ ] Original renders rotating station scene behind menu
- [ ] Could use Three.js scene with orbiting station model

### P4.5 Tutorial System
- [ ] Lua has 20-stage tutorial progression
- [ ] TS hint system provides contextual tips but no guided tutorial

### P4.6 Credits Screen
- [ ] Lua has `Credits.lua`

### P4.7 Audio/Video Settings Panel
- [ ] Lua has `AudioVideoSettings.lua`

### P4.8 Save Slot Directory
- [ ] Lua has multi-slot save UI with directory listing
- [ ] TS uses single localStorage slot + export/import

### P4.9 Debug Menu
- [ ] Lua has spawn monster, add XP, randomize morale, etc.

### P4.10 Localization System
- [ ] Lua uses linecodes (`LinecodeManager.lua`) for all UI text
- [ ] TS uses hardcoded English
- [ ] [TECH] Acceptable deviation for now

---

## Known TECHNICAL Deviations (Accepted)

These are engine/platform differences, not missing features:

| Area | Deviation | Reason |
|------|-----------|--------|
| Rendering | Three.js vs MOAI prop/deck system | Browser engine |
| O2 grid | JS Uint16Array vs C++ cellular automata | No MOAI extension |
| Pathfinding | JS binary heap vs MOAI C++ priority queue | Browser, optimized in JS |
| Lighting | Per-room tint vs pixel buffer shader | Three.js materials |
| Save format | localStorage + export/import vs file-based | Web platform |
| Localization | Hardcoded English vs line codes | No l10n layer needed |
| Body/head/hair tables | GLB skin variants vs rig data | Different 3D pipeline |
| Layout system | Code-driven vs data-file driven | No UILayout asset loader |
| Name editing | HTML input vs in-world text entry | Browser native |
| Skeletal animation | Procedural fallback vs `.banim` clips | Binary format not reversed |

---

## DEVIATIONS (User Decisions)

| Item | Decision | Notes |
|------|----------|-------|
| P0.10 | **YES** | Implement voice system — even though Lua never calls it. |
| P0.14 | **YES** | Build 3D animated start menu backdrop (rotating station). |
| P4.1 | **NO AI** | Implement original premade+procedural portrait system, NOT AI generation. |
| P4.2 | **YES** | Add more music if only 5 tracks exist. |
| P0.12 | **KEEP** | Sidebar collapse is allowed — keep current behavior. |
| — | **KEEP** | Export/Import buttons stay — usability for web localStorage saves. |
| — | **KEEP** | TraderEvent stays — even though commented out in Lua. |

---

## UI Files Gap (7 TS vs 48 Lua)

The UI system has the largest file count gap. Key missing UI components:

| Lua File | Purpose | Priority |
|----------|---------|----------|
| `GuiManager.lua` | Central UI coordination | P2 (partially in UIManager) |
| `BeaconMenu.lua` + Edit/Entry | Beacon placement UI | P2.1 |
| `SquadEditMenu.lua` + entries | Squad management | P2 |
| `ZoneActionTab.lua` + Rezone | Zone inspection actions | P3 |
| `ResearchAssignment.lua` + entries | Research assignment UI | P3 |
| `ObjectActionTab.lua` | Object action buttons | P3 |
| `WorldToolTip.lua` | Hover tooltip | P0.13 |
| `Portraits.lua` | Character portrait generation | P4 |
| `SaveDirectory.lua` + Load | Multi-slot save/load | P4.8 |
| `AudioVideoSettings.lua` | Settings panel | P4.7 |
| `Credits.lua` | Credits screen | P4.6 |
| `DebugMenu.lua` | Debug tools | P4.9 |
| ~36 more | Base UI framework, scrolling, buttons | [TECH] HTML/CSS replaces |

---

## Recommended Implementation Order

```
Sprint 1 — Audio & UI (P0): Make it sound and look right
  1. Audio loading pipeline (P0.1)
  2. Music fixes (P0.2)
  3. Spatial audio loops (P0.3)
  4. UI sound triggers (P0.4)
  5. Orbitron font everywhere (P0.11)
  6. Sidebar layout fix (P0.12)
  7. Persistent coordinate display (P0.13)
  8. Ambient/walla/alert sounds (P0.7)
  9. Start menu/new game refinements (P0.14, P0.15)

Sprint 2 — Visual Polish (P1): Make it look alive
  1. Space background (P1.1)
  2. Blob shadows (P1.2)
  3. Selection highlighting (P1.3)
  4. Thought bubbles (P1.4)
  5. Fire particles (P1.5)
  6. Build grid overlay (P1.6)
  7. Camera shake (P1.8)
  8. Room lighting on characters/objects (P1.9)

Sprint 3 — Core Mechanics (P2): Fill gameplay gaps
  1. Fire extinguisher tool (P2.4)
  2. Missing critical tasks (P2.7)
  3. Prerequisite chains (P2.5)
  4. Dialog system (P2.2)
  5. Emergency beacon (P2.1)
  6. Docking/modules (P2.3)

Sprint 4 — Content & Systems (P3): Completeness
  1. Food/plant data (P3.2)
  2. Custom object classes (P3.3-P3.5)
  3. OptionData centralized scoring (P3.13)
  4. Remaining tasks and mechanics
```

---

## Progress Log

| Date | Changes |
|------|---------|
| 2026-03-05 | Full Lua vs TS parity audit. Created v2 plan with 27 sections, ~180 items. |
| 2026-03-06 | v2 plan completed: all 27 sections done. 150 E2E tests. |
| 2026-03-06 | 9 architectural features: per-tile O2, task interaction, reservations, doors, power, culling. |
| 2026-03-06 | v3 plan created: comprehensive audit from 5 sources (UI screenshots, Lua file-by-file, audio system, wiki, renderer). Organized by P0-P4 priority. |
| 2026-03-06 | Fix 3 critical bugs: door construction (WALL→DOOR deferred to build completion, pathToNearest for wall targets), wall-object placement order (SE first for NESW walls to match Lua), sprite bFlipX mirroring. 159 tests. |
| 2026-03-06 | Sprint 2 visual polish: blob shadows (P1.2), selection highlighting (P1.3), enhanced space background (P1.1). 161 tests. |
| 2026-03-06 | Sprint 2 continued: camera shake (P1.8), smooth zoom (P1.11), thought bubbles (P1.4), fire particles (P1.5), projectile visuals (P1.7), room lighting on characters (P1.9), build grid (P1.6). 167 tests. |
| 2026-03-06 | Sprint 2 final: per-tile light gradients (P1.10), door+object lighting (P1.9), meteor trails+construction sparks (P1.13), zone ceiling light configs. 172 tests. All P1 items complete or blocked (P1.12 .banim). |
