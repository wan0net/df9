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
- 233 E2E tests passing
- Audio: lazy loading, WAV playback, music rotation (Revoice tracks), spatial loops
- UI: Lua-correct fonts (Dosis body, Orbitron titles, Nevis inspector), persistent coordinate display, alert panel cleanup

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

### P0.11 Font System (Lua-Correct) ✅
- [x] Local font files in `public/assets/fonts/` (offline-capable, no CDN)
- [x] `fonts.css` with @font-face for Orbitron (Regular/Bold), Dosis (Regular/Medium/SemiBold), League Gothic, Nevis Bold
- [x] UIManager root → `'Dosis',sans-serif` (matches Lua dosisregular)
- [x] HUD values (matter/pop) → Dosis Regular 30px
- [x] Stardate → Dosis SemiBold 14px
- [x] Sidebar labels/hotkeys → Dosis Regular/SemiBold
- [x] InspectorPanel → `'nevis','Dosis',sans-serif` (matches Lua nevis font)
- [x] JobRoster → Dosis
- [x] ResearchPanel → Dosis
- [x] GoalsPanel → Dosis
- [x] DialogSystem → Dosis
- [x] StartMenu / NewGame → Orbitron (titles only, matches Lua orbitronlight)
- [x] Loading screen → Orbitron

### P0.12 Sidebar Layout ✅
- [x] 104px collapsed / 286px expanded / 81px button height (matches SideBarLayout.lua)
- [x] 7 buttons: Inspect, Roster, Research, Goals, Construct, Mine, Beacon
- [x] Hover effect: amber bg + black text/icon inversion (matches Lua onHoverOn/onHoverOff)
- [x] Construct submenu replaces sidebar buttons entirely (Lua ConstructMenu.lua)
- [x] Construct submenu: Cancel/Confirm/Room/Wall/Floor/Object/Tear Down/Vaporize/Erase (matches screenshots)
- [x] Beacon submenu: Done/>> Security/Clear Beacon/Force: Non-lethal/Necessary/Lethal (Lua BeaconMenu)
- [x] Build cost tooltip: "Floor Area: W x H, Cost: N (W wall H floor)" during room drag
- [x] Wall [W] and Vaporize [V] hotkeys added
- [x] Inspector panel replaces sidebar when entity selected (Lua CitizenInspector)
- [x] Back/X buttons on inspector, ">> Inspect" label

### P0.13 Persistent Tile Coordinate Display ✅
- [x] `tileInfoEl` always visible, shows `(x, y) Type` on hover
- [x] Positioned below top HUD bar

### P0.14 Start Menu Refinements ✅
- [x] MOTD panel hidden by default (display:none)
- [x] Title: 42px/74px (reduced from 52px/88px)

### P0.15 New Game Screen Refinements ✅
- [x] Flavor text: SPACEDATE/Fleet/Mission (NEWBAS021TEXT + NEWBAS022TEXT) at top-left above galaxy map
- [x] "Region Selection" header on left sidebar
- [x] Accept/Decline labels visible as black text on sidebar (was transparent, matching Lua Gui.BLACK)
- [x] Inspector panel restructured: amber header (name + age), stats section with colored values, Help folder tab with property descriptions (NEWBAS014TEXT)
- [x] Help text bar at bottom-center with "?" icon (Lua: SelectRegionHelpIcon + SelectRegionHelpText)
- [x] "ACCEPT or DECLINE region for deployment" (NEWBAS004TEXT) shown when zone selected
- [x] Double-colon fix in stats labels (linecodes already contain ":")

### P0.16 Button Hover Effects ✅
- [x] Sidebar: amber bg + black text/icon on hover (matches Lua)
- [x] Construct submenu: same amber/black inversion
- [x] Speed/zoom/bottom buttons: sprite swap on hover

### P0.17 Alert Panel Styling ✅
- [x] Amber background notification cards (matches Lua AlertLayout)
- [x] "!" icon + message text + "Spacedate XXXX.XX" timestamp
- [x] Right-aligned, below HUD
- [x] Minimize/expand toggle

### P0.18 HUD Labels & Layout ✅
- [x] "Matter" label above matter value (Lua HUDHUD002TEXT, dosissemibold26)
- [x] "O2 Capacity" label above population (Lua HUDHUD003TEXT)
- [x] "Spacedate" prefix on stardate line (Lua HUDHUD004TEXT)
- [x] Divider line between row 1 and row 2 (Lua DividerLine)
- [x] "?" help button next to speed buttons (Lua HelpButton)
- [x] Corpse counter format ":( XX" (matches Lua StatusBar)

### P0.19 Inspector & Alert Lua-Parity ✅
- [x] Inspector info fields match Lua layout: Diagnosis/Morale/Location/Activity (INSPEC011-014)
- [x] Morale shows text labels from CharacterConstants thresholds (Ecstatic/Very Happy/Happy/etc.)
- [x] Inspector tabs match Lua: 5 tabs (Duty/Stats/Psych/Spaceface/Actions), needs merged into Stats
- [x] Log tab renamed "Spaceface" (matches Lua CitizenLogTab icon name)
- [x] Spaceface entries show spacedate timestamp before each line
- [x] Object tooltip format "Name · Condition: Good (100%)" (matches Lua ObjectInspector)
- [x] Object inspector shows condition with percentage: "Good (100%)"
- [x] Alert time shows relative format ("X seconds/minutes ago") for recent alerts

### P0.20 Full-Screen Overlay Panels ✅
- [x] Job Roster: full-screen overlay (was centered modal), "Done/ESC" back button matching Lua BackButton
- [x] Job Roster: star ratings (★1-5) replacing decimal numbers, matching Lua tJobLevels thresholds (0/.16/.28/.60/.90)
- [x] Job Roster: competency-colored backgrounds matching Lua JOB_COMPETENCY_COLORS (5 levels: brown-red→teal)
- [x] Job Roster: affinity emoticons (:D/:):/:|/:(/>:() matching Lua AFFINITY_ICONS with colored text
- [x] Job Roster: full job name column headers, job count row, Unassigned column
- [x] Research Panel: full-screen overlay (was sidebar), "Done/ESC" back button, Tech/Disease tabs
- [x] Goals Panel: full-screen overlay matching GoalsList.lua + GoalEntryLayout.lua
- [x] Goals Panel: sort toggle buttons (Complete First / Incomplete First) matching Lua bCompletedFirst
- [x] Goals Panel: numeric progress "X / Y" format matching GoalEntry.lua string.format
- [x] Goals Panel: "Completed" label for done goals (GOALSS009TEXT), empty for target=1
- [x] Goals Panel: goals sorted by progress ratio (higher first) with completed-at-bottom default
- [x] Goals Panel: entry layout with rounded name bar, progress bar (300px), description shade box
- [x] Goals Panel: hover effects (amber fill on name bar, darkened text) matching GoalEntryLayout.lua
- [x] ESC key closes full-screen overlays before clearing build mode (matching Lua ESC→closeSubmenu)

### P0.21 Lua Parity Audit: Construction, Mining, Objects, Map Gen ✅
- [x] Asteroid decay: 2-level decay system matching Asteroid.vaporizeTile (partial mining before removal)
- [x] Mining: miner skill level passed to getMiningYield (level 2+ miners get 40-60 vs 30-50)
- [x] Mining: nJobExperience=24 matching Lua OptionData.lua MineInside
- [x] BuildTile: nJobExperience=24 matching Lua OptionData.lua
- [x] BuildTile: triggers wallAutoGen.update() on completion (Lua: World._setTile triggers wall blob updates)
- [x] BuildEnvObject: nJobExperience=24 matching Lua OptionData.lua
- [x] Demolition: door refunds MAT_BUILD_DOOR * MAT_VAPE_OBJECT_PCT (9 matter, was 4)
- [x] Demolition: objects on demolished tiles are removed and refunded (Lua: World._demolishTile:1199-1201)
- [x] Demolition: asteroid tiles use vaporizeTile(bCompletely=false) decay instead of instant removal
- [x] Object placement: auto-zone PLAIN rooms when placing zone-specific objects (Lua: World.lua:1631-1633)
- [x] Object placement: hidden room check blocks placement (Lua: World.lua:1625-1627 VISIBILITY_HIDDEN)
- [x] Initial crew: bBaseFounder=true, bImmuneToParasite=true (Lua: ModuleData.lua SpacewalkingSettler)
- [x] Initial crew: nMorale=50, Energy=80, Hunger=80 (Lua: ModuleData.lua:89-90)
- [x] Character: added bBaseFounder and bImmuneToParasite flags

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

### P1.12 Skeletal Animations ✅
- [x] `.banim` binary format fully reverse-engineered (306/306 files parse successfully)
- [x] Format: ANM header → zlib payload → bone descriptors → CONSTANT/CURVE tracks → visibility curves
- [x] TRACK_CURVE: u16 keyframe count + f32 min/max + quantized u16 time/value pairs
- [x] `extract_banim.py` rewritten with correct parser
- [x] `convert_to_gltf.py` updated: embeds animations in GLB (Citizen_Base: 140 clips, Spacesuit: 12, Bad_Alien: 9, Murder_Robot: 6)
- [x] CharacterRenderer wires skeletal animations via THREE.AnimationMixer
- [x] STATE_CLIP_MAP covers 17 activity states (walk, idle, build, eat, fight, heal, research, etc.)
- [x] Door open/close: confirmed instant sprite swap in Lua (no transition animation) — our implementation matches
- [ ] Animated object sprites (Jukebox pulsing, generators) — low priority

### P1.13 Other Particles (partial) ✅
- [x] Meteor trail effect — `EffectParticles.spawnMeteorTrail()` (orange-white falling trail, wired to MeteorEvent)
- [x] Construction danger sparks — `EffectParticles.spawnSparks()` (8 bright sparks at ≤DANGER_ZONE condition, every 6s)
- [x] Disease sneeze: N/A — confirmed NO visual particle in original Lua (only contagion logic)
- [ ] Shuttle/docking approach — skipped (low priority, needs docking bay animation)

---

## P2: Missing Core Mechanics

### P2.1 Emergency Beacon System ✅
- [x] `EmergencyBeacon.ts` — beacon placement, violence levels, squad tracking
- [x] Beacon placement modes (MODE_TRAVELTO, MODE_EXPLORE)
- [x] Violence levels (VIOLENCE_DEFAULT/LETHAL/NONLETHAL) with color coding
- [x] `CircleBeacon.ts` task for security response (DURATION=200, run-then-patrol)
- [x] Sidebar Beacon button wired to 'beacon' build mode
- [x] Auto-creates squad from EMERGENCY job characters when placing first beacon
- [x] Save/load support, tick lifecycle
- Lua files: `EmergencyBeacon.lua`, `CircleBeacon.lua`, `BeaconMenu.lua`

### P2.2 Dialog System ✅
- [x] `DialogSystem.ts` — full accept/reject dialog UI with three-outcome flow
- [x] Immigration accept/reject dialog (15 dialog sets from Lua EventData.lua)
- [x] Hostile immigration dialog (11 dialog sets, nChanceObey=0.33)
- [x] Docking dialog (ambiguous: 4 sets, hostile: 9 sets)
- [x] Compound event dialog (2 sets, always fires regardless of choice)
- [x] Trader dialog (1 set)
- [x] `screwYouResponse` — forced-boarding dialog when immigrants ignore rejection
- [x] `nChanceObey` logic: Math.random() > nChanceObey → show screwYou, spawn anyway
- [x] Three dialog results: `accepted` / `rejected` / `ignored` (Lua dialogTick match)
- [x] Lua-correct EVENT linecodes (EVENT002-042, TRADE001-010) replacing placeholder DOCKUI codes
- [x] Alert linecodes: ALERTS024 (rejection), ALERTS025 (rejection ignored), ALERTS030 (accepted), ALERTS041 (skipped)
- Lua files: `EventData.lua`, `ImmigrationEvent.lua`

### P2.3 Docking/Ship Module System [STUB]
- [ ] `Docking.ts` is a simple state machine — no physical ship placement
- [ ] DerelictEvent auto-completes with random matter reward (no explorable ship)
- [ ] HostileDockingEvent has no dialog, no dock mechanics
- [ ] TraderEvent just sets immigrant count (no trading)
- [ ] No bridge construction between ships
- [ ] No airlock detection for docking points
- Lua files: `DockingEvent.lua`, `ModuleData.lua` (17 asteroid templates, ship layouts)

### P2.4 Fire Extinguisher Tool ✅
- [x] `ExtinguishFireWithTool` task — characters equip fire extinguisher and use it
- [x] `ExtinguishFireBareHanded` task — bare-handed firefighting (less effective)
- [x] Tasks wired in CharacterManager gatherOptions
- Lua files: `ExtinguishFireWithTool.lua`, `ExtinguishFireBareHanded.lua`

### P2.5 Prerequisite Chain Resolution [STUB]
- [x] Key prerequisite tasks exist: PutOnSuit, DropEverything, GoOutside, GoInside
- [x] CharacterManager handles spacesuit requirement checks (PutOnSuit before spacewalk)
- [ ] Full Satisfies/Prerequisites chaining system (low priority — key chains covered by explicit checks)
- Lua file: `OptionData.lua`

### P2.6 Vacuum Pull / Decompression ✅
- [x] `VacuumPull` task — characters in breached rooms pulled toward nearest space tile
- [x] Wired in CharacterManager gatherOptions (PUPPET priority 500)
- [x] PanicOnFire task wired (SURVIVAL_NORMAL priority 200)
- Lua files: `VacuumPull.lua`, `Character.lua`

### P2.7 Missing Tasks (23 referenced in Lua OptionData with no TS file) ✅
Critical:
- [x] `RunTo` — generic run-to-location
- [x] `ExtinguishFireWithTool` / `ExtinguishFireBareHanded`
- [x] `VacuumPull`

High:
- [x] `ChatPartner` — partner side of cooperative chat
- [x] `DestroyEnvObject` — vaporize/demolish objects
- [x] `CircleBeacon` — security beacon response (wired with P2.1)
- [x] `PanicOnFire` — fire panic reaction (wired)
- [x] `GoOutside` / `GoInside` — movement primitives
- [x] `MaintainPub` — bartender serving
- [x] `EatAtFoodReplicator` — distinct from generic Eat
- [x] `DropEverything` — drop all held items

Medium:
- [x] `CheckInToHospital` — medical (wired for HP<50%)
- [x] `GetFieldScanned` — patient wait-state for cooperative scan (walks to infirmary, waits for doctor)
- [x] `CollectResearchDatacube` — [N/A] commented out in Lua OptionData
- [x] `DeliverResearchDatacube` — [STUB] enabled in OptionData but no class file exists in Lua source
- [x] `EatPlant` / `WorkOutInGym` / `PlayGameSystem`
- [x] `PutItemInTarget` — [STUB] enabled in OptionData but no class file exists in Lua source
- [x] `Puppet` — priority-override state via forcePuppet()/releasePuppet() on Character

### P2.8 Room Claiming/Unclaiming ✅
- [x] `claim()` — sets team to TEAM_ID_PLAYER (Lua Room:claim)
- [x] `unclaim()` — reverts to TEAM_ID_PLAYER_ABANDONED or nOriginalTeam (Lua Room:unclaim)
- [x] `nOriginalTeam` field tracks original ownership for unclaim revert
- [x] Float-away timer: `nFloatAwayTimerStart` + `tickFloatAway()` (FLOAT_AWAY_TIME=720s, Lua Room:_attemptFloatAway)
- [x] Contiguity check prevents float-away if connected to different-team rooms

### P2.9 Cooperative Tasks ✅
- [x] ChatPartner — partner side of cooperative chat (already wired)
- [x] GetFieldScanned — patient wait-state, doctor performs FieldScanAndHeal
- [x] Cooperative flow: doctor finds wounded patient → patient walks to infirmary → doctor scans/heals

### P2.10 Work Shift Gating in UtilityAI ✅
- [x] Hierarchical priority (PUPPET > SURVIVAL_NORMAL > SURVIVAL_LOW > NORMAL) in ActivityOption
- [x] Personality-based activity filtering via job gates in gatherOptions
- [x] Distance penalties via pathfinding cost in AI scoring
- [x] Per-activity gate functions (job checks, room checks, state checks) in gatherOptions

---

## P3: Missing Content & Systems

### P3.1 GlobalObjects Activity Registry ✅
- [x] All global activities (Starve, SleepOnFloor, WanderAround, Breathe, Patrol, etc.) wired in CharacterManager.gatherOptions
- [x] Room scoring integrated into AI decision system (proximity, morale, danger)
- [x] Beacon activity options wired via EmergencyBeacon.getBeacon()
- Note: Lua has ActivityOptionList pattern; TS uses flat gatherOptions approach

### P3.2 Food/Plant Data ✅
- [x] `FoodData.ts` — 4 food types (Corn, Pod, Glowfruit, CandyCane) matching Lua
- [x] `PlantData.ts` — growth stages, sprites, harvest quantities, plant lifetimes matching Lua
- [x] `EatPlant` task implemented and wired in CharacterManager

### P3.3 HappyBot Custom Class [STUB]
- [x] EnvObjectData has nMoraleScore=15, nRange=3, customClass='HappyBot'
- [x] Room morale scoring already integrates object morale scores
- [ ] Hover visualization of affected tile area (cosmetic, low priority)
- Note: Lua HappyBot custom class mainly adds hover radius visualization; morale boost comes from room nMoraleScore
- Lua: `HappyBot.lua`

### P3.4 Jukebox Custom Class [STUB]
- [x] ListenToJukebox task already wired (gives Fun need satisfaction)
- [x] Spatial audio plays jukebox_music at object location
- [ ] On/off toggle in object inspector (cosmetic, low priority)
- Note: Lua Jukebox.boostMoodOfListeners gives MORALE_DID_HOBBY/2 = 0 (no effect). Real benefit is ListenToJukebox task.
- Lua: `Jukebox.lua`

### P3.5 RefineryDropoff Custom Class ✅
- [x] DropOffRocks task wired with lerp yield formula, refinery level routing
- [x] DropOffCorpse task wired for janitors
- [x] RefineryDropoff objects advertise both activities
- Lua: `RefineryDropoff.lua`

### P3.6 SpaceRoom Singleton [STUB]
- [x] Characters in space (bSpacewalking) handled by CharacterManager
- [x] Exterior power for wall-mounted objects handled by PowerSystem
- [ ] Full SpaceRoom singleton (low priority — main functionality covered by existing systems)
- Lua: `SpaceRoom.lua`

### P3.7 Object Condition/Decay ✅
- [x] Per-object decay rates with condition levels (EnvObject.onTick)
- [x] Danger zone at 20% condition, spontaneous fire at 0%
- [ ] Damaged/destroyed sprite variants (cosmetic, low priority)

### P3.8 Blood Decals ✅
- [x] 5 blood decal sprites (blood01-05) placed on combat death tiles
- [x] DecalRenderer.ts with save/load support
- [x] Wired in CharacterManager.processDeaths()

### P3.9 Object Sabotage ✅
- [x] Sabotage task — rampage characters damage target objects (30 condition per sabotage)
- [x] Wired in CharacterManager for rampaging characters

### P3.10 Brig Escape [N/A]
- Not present in original Lua source — "brig escape" doesn't exist in codebase

### P3.11 Drug Effects [N/A]
- Not present in original Lua source — no drug tile mechanic exists

### P3.12 Emergency Alarm Object ✅
- [x] `Room.setEmergencyAlarmOn(bOn)` — toggle alarm, updates lighting scheme (Lua Room:setEmergencyAlarmOn)
- [x] `Room.isEmergencyAlarmOn()` — query alarm state
- [x] `Room.hasFunctioningEmergencyAlarm()` — checks if room has working EmergencyAlarm object
- [x] `Room.onEmergencyAlarmDestroyed()` — disables alarm if no functioning alarms remain
- [x] `isDangerous()` returns true when alarm is on (Lua Room:isDangerous)
- [x] `FleeEmergencyAlarm` task wired in gatherOptions — SURVIVAL_NORMAL priority, EMERGENCY job exempt (Lua Character:1260-1266)
- [x] Room lighting scheme switches to FIRE (flashing) when alarm on (Lua Room:updateEmergency)
- [x] `Alarm_Alert` sound plays on alarm activation

### P3.13 OptionData Centralized Scoring [STUB]
- [x] Individual task files implement Lua OptionData scoring (needs, duration, job gates)
- [x] CharacterManager.gatherOptions handles priority levels, personality gates, distance penalties
- [ ] Full centralized OptionData table (low priority — functionality covered by individual task implementations)

### P3.14 Room Danger/Visibility State ✅
- [x] `isDangerous()` — checks breach, low O2, hostiles, alarm, spacesuit status
- [x] `hasHostiles()` — tracks hostile characters in room per frame
- [x] `getRoomScore()` — safety scoring for AI decisions
- [x] Visibility fog-of-war (HIDDEN/DIM/FULL with timers, nLastSeen tracking)
- [x] Room lighting scheme updates based on danger state

### P3.15 Character Speed Formulas ✅
- [x] `getEffectiveSpeed()` matches Lua `getAdjustedSpeed()`: BASE_SPEED=1.5, RUN_SPEED=2.2
- [x] Morale modifier (±50 threshold → 0.7x/1.1x), disease modifier, bRunning flag
- [x] Running skips morale modifier (matches Lua)

### P3.16 Familiarity System ✅
- [x] `FAMILIARITY_TICK_RATE=5`, `FAMILIARITY_TICK_INCREASE=0.1` constants matching Lua
- [x] `FAMILIARITY_CHAT=4`, `FAMILIARITY_SERVE_MEAL=0.5` constants matching Lua
- [x] Character relationship tracking via `addFamiliarity()` / `getFamiliarity()`
- [x] Passive familiarity tick — characters in same room gain familiarity
- [x] Death morale impact scaled by familiarity × affinity (Lua lerp formula)

---

## P4: Nice-to-Have / Extras

### P4.1 Character Portraits [DEFERRED]
- [ ] Original uses premade + procedural portraits from body/head/hair tables (Portraits.lua)
- [ ] Requires extraction of portrait sprite sheets from UI/Portraits atlas
- [ ] ~200 portrait variants (human male/female × 5 skin tones × 10 faces + alien races)
- [ ] Portrait overlay system: base face + hair layer + facial hair layer

### P4.2 Enhanced Music
- [ ] [DEVIATION] Could add more ambient music tracks beyond the original 5. **Not in original — needs user approval.**

### P4.3 PostFX/Bloom ✅
- [x] `PostFX.ts` — Three.js EffectComposer with UnrealBloomPass
- [x] Bloom: strength=0.3, radius=0.4, threshold=0.85 (subtle glow matching Lua Post:SuperBlur)
- [x] RenderPass + UnrealBloomPass + OutputPass compositing chain
- [x] Can be toggled on/off (threeRenderer.postfx.enabled)
- [x] Wired into ThreeRenderer.render() — replaces direct renderer.render() when enabled
- Lua `Post.lua` also has: SceneLight material, Color LUT (5 presets), Outlines (amber), FXAA — [TECH] shader-level effects not replicated

### P4.4 Animated 3D Start Menu Backdrop [N/A]
- [x] Confirmed: original Lua StartMenu.lua does NOT render a 3D station backdrop
- [x] Original just shows dark overlay (rgba(0,0,0,0.83)) over the game world
- [x] Our implementation matches: space_bg tiled + dark overlay + gradient bars

### P4.5 Tutorial System ✅
- [x] `TutorialSystem.ts` — 20-stage guided tutorial matching Lua GameRules.lua
- [x] All 20 stages with TRAING001-020 linecodes
- [x] Completion conditions: zoom, pan, select, deselect, time speed, build O2, confirm, assign builders, viz modes, food replicator, flip, airlock, speed up, repair breach, zone residence, mine, assign techs, explore derelict, final messages
- [x] Timer-based final stages (30s delay, matching Lua)
- [x] Persistent tutorial panel at bottom of screen
- [x] Triggered from "LEARN TO PLAY" start menu button
- [x] Tutorial condition triggers wired into input handlers (zoom, pan, select, ESC, speed, flip, O2 overlay)

### P4.6 Credits Screen ✅
- [x] `CreditsScreen.ts` — scrolling credits matching Lua Credits.lua
- [x] All 9 sections from CreditsLayout.lua (Derelict v1.09, SBRS v1.08, Original Team, Double Fine, Indie Fund, Special Thanks, Additional Thanks, Citizens, Open Source Team)
- [x] Auto-scroll at 120px/s (Lua SCROLL_SPEED = -SCROLL_AMOUNT/SCROLL_TIME = 15000/125)
- [x] SCROLL_DELAY=5s before scrolling starts
- [x] Click (second click) or ESC to close (Lua bGotUpClick pattern)
- [x] CREDITS button added to start menu (UIMISC026TEXT)

### P4.7 Audio/Video Settings Panel ✅
- [x] `SettingsPanel.ts` — settings overlay matching Lua AudioVideoSettings.lua + AudioVideoSettingsLayout.lua
- [x] Music Volume slider (SETMENU02TEXT), SFX Volume slider (SETMENU03TEXT), Master Volume slider
- [x] Autosave checkbox (SETMENU04TEXT) — wired to AutoSave.setEnabled()
- [x] Fullscreen checkbox (SETMENU06TEXT, Web Fullscreen API)
- [x] Colorblind Mode checkbox (SETMENU07TEXT) — stored in localStorage, stub
- [x] Header uses SETMENU01TEXT linecode, all labels use linecodes
- [x] Done button / ESC / click-outside to close
- [x] Volume getters added to SoundManager (getMasterVolume, getMusicVolume, getSfxVolume)
- [x] SETTINGS button added to start menu (UIMISC025TEXT)
- Hardware Mouse (SETMENU05TEXT) skipped — N/A for web (always OS cursor)

### P4.8 Save Slot Directory ✅
- [x] `SaveSlotPanel.ts` — multi-slot save/load panel matching Lua SaveBase.lua + LoadBase.lua
- [x] Lists all localStorage save slots (df9_save_* prefix + legacy AutoSave)
- [x] Each slot shows: name, date, population, matter count
- [x] LOAD mode: select slot + LOAD button (L hotkey), DELETE, CANCEL (ESC/C)
- [x] SAVE mode: select existing slot (OVERWRITE) or enter new name (SAVE NEW)
- [x] Metadata stored alongside saves (df9_meta_* prefix)
- [x] Start menu LOAD SAVE BASE button opens SaveSlotPanel in load mode
- [x] Start menu SAVE AND QUIT button opens SaveSlotPanel in save mode
- [x] Load from start menu properly restores saved game state (fixed bug: loadSave was passed but never consumed)

### P4.9 Debug Menu ✅
- [x] `DebugMenu.ts` — 6-button debug panel matching Lua DebugMenu.lua + DebugMenuLayout.lua
- [x] Finish Research (DEBUG002TEXT) — completes next available research
- [x] Finish All Research (DEBUG003TEXT) — completes all research recursively
- [x] Finish All Malady Research (DEBUG004TEXT) — Malady.researchAllCures()
- [x] All Base is Happy (DEBUG005TEXT) — addMorale(100) all characters
- [x] All Base is Sad (DEBUG006TEXT) — addMorale(-100) all characters
- [x] Add 1000 Matter (DEBUG009TEXT) — GameRules.addMatter(1000)
- [x] Backtick key toggles debug menu (top-left panel)
- [x] Number hotkeys 1-6 for quick actions
- [x] Layout: 330px wide, 81px button height, amber-on-black style

### P4.10 Localization System ✅
- [x] Localization module (`src/localization/Localization.ts`) mirrors `LinecodeManager.lua`
- [x] 3502 linecodes merged from `MainGame_enUS.lua` (String + Linecodes files)
- [x] Start menu wired: buttons use UIMISC linecodes (RESUME, NEW BASE, LEARN TO PLAY, SAVE AND QUIT)
- [x] New game screen wired: inspector labels, deploy text, severity/distance codes all from linecodes
- [x] E2E test: localization system provides original game strings (175 tests passing)
- [x] GoalData.ts: all 16 goals wired to GOALSS linecodes with lazy getter pattern
- [x] GoalSystem.ts: goal completion alert uses ALERTS039TEXT
- [x] ResearchData.ts: all 20 research items wired to RESRCH/PROPSX/RECYCLE linecodes
- [x] CharacterManager.ts: death alerts per-cause (ALERTS004-018), rampage alerts (ALERTS037/038)
- [x] EventController.ts: all event alerts wired to ALERTS linecodes
- [x] MeteorEvent.ts: ALERTS033TEXT
- [x] ResearchSystem.ts: ALERTS019TEXT
- [x] Malady.ts: ALERTS021TEXT (disease encountered)
- [x] HintSystem.ts: all 5 hints wired to HINTSX linecodes
- [x] EnvObjectData.ts: all 40 objects wired to PROPSX/ZONEUI/RECYCLE/JUKEX linecodes (resolved at construction time)

### P4.11 Warble Effect (UI Screen Distortion) ✅
- [x] `WarbleEffect.ts` — CSS-based approximation of Lua `GuiManager.createEffectMaskBox()` / `UIEffectMask` system
- [x] `playWarble(element)` — localized region warble (horizontal scale oscillation + brightness flash)
- [x] `playWarbleFullscreen(container)` — fullscreen amber scanline overlay with fade-out
- [x] Wired to all Lua call sites:
  - StartMenu button clicks (Lua `StartMenu:playWarbleEffect`)
  - Sidebar expand + button clicks (Lua `NewSideBar:playWarbleEffect`)
  - Credits/Settings/SaveSlot panel open (Lua `Credits/AudioVideoSettings/SaveBase/LoadBase:playWarbleEffect`)
  - NewGameScreen: zone selection, confirm, deploy (Lua `NewBase:playWarbleEffect`)
  - JobRoster, ResearchPanel, GoalsPanel show (Lua `JobRoster/ResearchAssignment:createEffectMaskBox`)
- [x] Duration/intensity match Lua defaults (0.3s, 0.3 intensity; 0.6s/1.2s for confirm/deploy)
- [x] E2E test: warble CSS styles injected on demand (218 tests passing)

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
| Localization | enUS only (game shipped English only) | Linecodes wired via Localization.ts |
| Body/head/hair tables | GLB skin variants vs rig data | Different 3D pipeline |
| Layout system | Code-driven vs data-file driven | No UILayout asset loader |
| Name editing | HTML input vs in-world text entry | Browser native |
| Skeletal animation | Full `.banim` skeletal clips | Format reversed, 306 animations embedded in GLBs |

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
| `ZoneActionTab.lua` + Rezone | Zone inspection actions | ✅ (in InspectorPanel room tabs) |
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
| 2026-03-07 | Skeletal animations: reverse-engineered .banim binary format (306/306 files), rewrote parser, rebuilt GLBs with embedded clips, wired CharacterRenderer AnimationMixer. 173 tests. |
| 2026-03-07 | Localization system: 3502 linecodes from original game, Localization.ts mirrors LinecodeManager.lua, start menu + new game screen wired to use linecodes. 175 tests. |
| 2026-03-07 | Dialog system rewrite: switched from DOCKUI to correct EVENT linecodes (EventData.lua), added screwYouResponse/nChanceObey logic (3-outcome flow matching Lua dialogTick), wired all event types (immigration/hostile/docking/trader/compound) to DialogSystem. Population cap checks on immigration/docking. 176 tests. |
| 2026-03-07 | Linecode wiring sweep: GoalData (16 goals → GOALSS), ResearchData (20 items → RESRCH/PROPSX/RECYCLE), CharacterManager death alerts (per-cause ALERTS004-018), rampage (ALERTS037/038), MeteorEvent (ALERTS033), ResearchSystem (ALERTS019), Malady (ALERTS021), HintSystem (5 hints → HINTSX), EnvObjectData (40 objects → PROPSX/ZONEUI/RECYCLE/JUKEX names+descriptions), ZoneType (12 zone names → ZONEUI linecodes). 175 tests. |
| 2026-03-07 | Sidebar Lua-parity: 104px collapsed / 286px expanded / 81px button height (was 60/220/60). 7 buttons matching SideBarLayout.lua (Inspect/Roster/Research/Goals/Construct/Mine/Beacon). Demolish moved to Construct submenu. |
| 2026-03-07 | Font system: local copies of 7 font files (Orbitron, Dosis, League Gothic, Nevis). fonts.css @font-face rules. Lua Gui.lua font mapping applied: Dosis=body UI, Orbitron=titles, Nevis=inspector, League Gothic=inspector names. All CDN dependencies removed — fully offline-capable. 175 tests. |
| 2026-03-07 | UI alignment sprint: HUD labels (Matter/O2 Capacity/Spacedate prefix/? button), alert amber cards, construct submenu replaces sidebar, inspector replaces sidebar, sidebar hover amber/black inversion, corpse ":(" format, tile info repositioned. Compared against 5 original Double Fine screenshots. 179 tests. |
| 2026-03-07 | UI alignment round 2: Inspector info fields match Lua (Diagnosis/Morale/Location/Activity), morale text labels (Ecstatic/Very Happy/etc.), 5 tabs matching Lua (Duty/Stats/Psych/Spaceface/Actions), Spaceface log timestamps, object tooltip "Name · Condition: Good (100%)", alert relative time ("X seconds ago"). 182 tests. |
| 2026-03-07 | UI alignment round 3: Job Roster rewrite (full-screen overlay, star ratings, competency colors, affinity emoticons). Research + Goals panels converted to full-screen overlays with "Done/ESC" back buttons. ESC key closes overlays. 185 tests. |
| 2026-03-07 | Goals Panel Lua-parity: sort toggle (Complete/Incomplete First), numeric progress "X/Y", sorted by progress ratio, entry layout matching GoalEntryLayout.lua (name bar, progress bar 300px, shade box, hover). 185 tests. |
| 2026-03-07 | Lua parity audit: construction/demolition/mining/objects/mapgen. 14 fixes: asteroid 2-level decay, door refunds (9 not 4), object removal on demolish, miner skill yield, wall auto-gen after build, auto-zone PLAIN rooms, hidden room block, initial crew flags (bBaseFounder/bImmuneToParasite/morale50/energy80/hunger80), job experience on BuildTile/Mine/BuildEnvObject. 189 tests. |
| 2026-03-07 | Lua parity audit round 2: DropOffRocks rewrite (lerp yield formula, 8-12s duration, SuperBuilder 2x, rock count multiply, refinery level routing). BuildTile fix (nJobExperience=2, competency-scaled duration 2-5s, tile HP clearing). Wall placement validation (canBuildWall: WALL_DESTROYED rebuild, object/door blocking). Demolish clears tile HP. GameRules.init() resets all state fields. BuildSystem accepts WALL_DESTROYED for room/floor/wall placement. 193 tests. |
| 2026-03-07 | Lua parity audit round 3: Demolish walls→FLOOR (Lua _demolishTile→ZONE_LIST_START, not SPACE). Demolish if/elseif/else chain (object removal doesn't change tile). BuildEnvObject: nJobExperience=0, Duty=10 (Lua OptionData). Mine duration competency-scaled (8-20s). Ghost door rendering fix. Model texture suffix fix. AirlockLocker matterCost=50. Wall object PLAIN room auto-zone. 195 tests. |
| 2026-03-07 | Core mechanics sprint: Emergency Beacon system (EmergencyBeacon.ts + CircleBeacon.ts), beacon sidebar button, violence levels, squad auto-creation. Door placement fix (WALL only, not WALL_PENDING). Zone assignment fix (FLOOR only, not FLOOR_PENDING). FoodData.ts + PlantData.ts matching Lua. Room danger state (isDangerous/hasHostiles/getRoomScore). Familiarity system verified complete. 15+ P2/P3 items marked done. 199 tests. |
| 2026-03-07 | Remaining mechanics: Emergency alarm system (Room.setEmergencyAlarmOn, FleeEmergencyAlarm wired in gatherOptions, lighting scheme flashing). Room claim/unclaim with float-away timer (720s). Puppet task (forcePuppet/releasePuppet on Character). GetFieldScanned patient wait-state. CollectResearchDatacube marked N/A (commented out in Lua), DeliverResearchDatacube/PutItemInTarget marked STUB (no class files in Lua). 203 tests. |
| 2026-03-07 | UI screenshot comparison: Construct submenu rewritten to match Lua ConstructMenu.lua exactly (Cancel/Confirm/Room/Wall/Floor/Object/Tear Down/Vaporize/Erase). Beacon submenu added (Done/Security/Clear Beacon/Violence levels). Build cost tooltip shows "Floor Area: W x H" during room drag. Wall [W] and Vaporize [V] hotkeys added. 203 tests. |
| 2026-03-07 | P0.15 New Game Screen polish: flavor text (SPACEDATE/Fleet/Mission), "Region Selection" header, visible Accept/Decline labels, inspector panel restructured (amber header + Help tab with NEWBAS014TEXT descriptions), help text bar with "?" icon. Mine submenu added (Confirm/Mine/Erase). 205 tests. |
| 2026-03-07 | Room inspector rezone: ZoneInspector tabs (Info/Rezone/Actions) in InspectorPanel matching Lua ZoneRezoneTab + ZoneActionTab. Zone assignment moved from Z key floating picker to room inspector Rezone tab (click floor → room details → rezone). Actions tab has Claim/Unclaim + Seal/Unseal. Z key zone mode removed. 206 tests. |
| 2026-03-07 | P4 sprint: Credits screen (9 sections from CreditsLayout.lua, 120px/s auto-scroll). Settings panel (3 volume sliders + fullscreen). Debug menu (6 buttons: research/morale/matter, backtick toggle). Tutorial system (20 stages from GameRules.lua, condition-based progression). Start menu: SETTINGS + CREDITS buttons. Volume getters added to SoundManager. Malady.researchAllCures() debug helper. 213 tests. |
| 2026-03-07 | P4 continued: PostFX bloom (EffectComposer+UnrealBloomPass, subtle glow matching Lua Post:SuperBlur). Settings panel enhanced (SETMENU linecodes, Autosave/Colorblind checkboxes). Multi-slot save directory (SaveSlotPanel.ts, localStorage df9_save_* prefix, metadata, load/save/delete/overwrite). Fixed loadSave bug (initData.loadSave was passed but never consumed). Start menu backdrop confirmed N/A (original has no 3D station). 217 tests. |
| 2026-03-07 | P4.11 Warble Effect: CSS-based screen distortion matching Lua UIEffectMask system. playWarble (element-level scaleX oscillation + brightness flash) and playWarbleFullscreen (amber scanline overlay fade). Wired to all original call sites: StartMenu buttons, sidebar expand/click, Credits/Settings/SaveSlot/NewGameScreen panels, JobRoster/Research/Goals show. 218 tests. |
| 2026-03-07 | Vaporize/Demolish split: separated into distinct build modes matching Lua MODE_DEMOLISH (walls→FLOOR, objects removed) vs MODE_VAPORIZE (everything→SPACE). BuildSystem.vaporize() added. BuildCursor updated with vaporize+mine mode support. V key toggles vaporize. vaporizeTiles API exposed on __df9. Tests updated. 220 tests. |
| 2026-03-08 | Comprehensive Lua parity audit (3 research agents). Fixes: (1) Erase mode implemented — BuildSystem.erase() cancels pending build/mine commands, reverts PENDING tiles to SPACE, refunds matter. CommandQueue.cancelAt() added. E key hotkey. (2) Oxygen system rewritten to match Lua Character.updateOxygen: 0.25s tick accumulator (OXYGEN_TICK), three-tier thresholds (OXYGEN_SUFFOCATING=100, OXYGEN_LOW=400), bonus suffocation (+15/tick) for SPACE tiles, spacesuit drain logic. Fixed: suffocation was running every frame instead of every 0.25s, wrong O2 threshold comparisons using squared vacuum values instead of direct tile O2. (3) Event timing integer random fixed (Math.floor(Math.random()*41)-20 matching Lua math.random(-20,20)). 223 tests. |
| 2026-03-08 | Build system Lua parity audit (BuildHelper.lua, ConstructMenu.lua, World.lua, GameRules.lua). 7 fixes: (1) buildscroll sfx on drag resize. (2) Linecodes in cost tooltip (HUDHUD039-043). (3) Projected capacity display for room mode (8 objects, getCapacityInDimension matching Lua). (4) _cheatOxygen O2 averaging from diagonal neighbors on demolish/vaporize (Lua World._cheatOxygen). (5) Wall-mounted object cascade on wall vaporize (Lua _getEnvObjectOnWall). (6) canBuildWall prop margin + againstWall checks (Lua World.canBuildWall). (7) Confirm/cancel build flow with tile state save/restore (Lua GameRules.confirmBuild/cancelBuild via CommandObject). Room drag cost fix (dragged area IS the full room). 225 tests. |
| 2026-03-08 | UI Lua fidelity audit (all 32 UILayout files + 9 reference screenshots vs TypeScript UI). 15 fixes: (1) BRIGHT_AMBER #ffcc44→#FFE696 (Gui.BRIGHT_AMBER=rgba(255,230,150,1)) in StartMenu/Settings/DebugMenu. (2) Inspector panel width 280→418px (CitizenInspectorLayout nButtonWidth=418). (3) HUD label color #888→#AF7F00 (Gui.GREY = dimmed amber) for Matter/O2 Capacity labels. (4) HUD divider 2px→4px, removed opacity:0.5 (Lua DividerLine scale=490,4). (5) Morale emoticon colors per threshold (RED/ORANGE/AMBER/AMBERGREEN/GREEN matching Lua StatusBar). (6) Alert card backgrounds use Lua ALERTLOG_BG (#B57700) / ALERTLOG_BG_ALT (#CA8400) alternating. (7) Door/Airlock [D] button added to construct submenu (Lua ConstructMenu). (8) Construct submenu width 286→430px (SelectObjectSubmenuLayout nButtonWidth=430). (9) Object picker width 280→330px, height 44→72px (ObjectMenuLayout nButtonWidth=330, nButtonHeight=72). (10) Cancel button color #ff4444→#FF3D00 (CONSTRUCT_CANCEL = Gui.RED). (11) Confirm button color #44ff44→#A5D318 (CONSTRUCT_CONFIRM = Gui.GREEN). (12) Matter flash colors to exact Lua GREEN/RED. (13) Pop overcapacity red #f44→#FF3D00. (14) Machine health text uses AMBER (not #888). (15) SUB_OFFSET bug fix (3→2) for construct submenu highlighting. Construct toggle now covers all construct modes. 233 tests. |
