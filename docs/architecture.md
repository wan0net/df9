# Architecture

## Directory Structure

```
src/
├── main.ts              # Three.js entry point, game loop, scene routing
├── config.ts            # Constants (grid size, tile size, costs)
├── audio/               # SoundManager, MusicSystem, SpatialAudio, AudioCueData
├── building/            # Floor/door placement, drag cursor, object placement
├── characters/          # Characters, needs, manager, personality, citizen names
├── combat/              # CombatSystem, Squad, SquadList, WeaponData
├── core/                # GameRules, Base, CommandQueue, ObjectList
├── envobjects/          # Environment object manager, door, object data
├── events/              # EventController (forecast queue), 8 event types
├── goals/               # GoalSystem, GoalData (12 achievements)
├── hazards/             # Fire (iso spread), Projectile manager
├── hints/               # HintSystem (contextual tutorials)
├── input/               # InputManager (keyboard, mouse, pointer)
├── inventory/           # Inventory system, InventoryData
├── lighting/            # Room lighting
├── malady/              # Malady (disease), MaladyData, contagion
├── oxygen/              # Per-room O2 simulation
├── pathfinding/         # A* on diamond grid
├── pickups/             # Corpse, Debris, Rock, Food pickups
├── power/               # Power system
├── renderer/            # ThreeRenderer, CameraController3D, TileRenderer3D, CharacterRenderer, EnvObjectRenderer
├── research/            # ResearchSystem, ResearchData
├── rooms/               # Room detection (BFS flood fill)
├── save/                # SaveLoad (full state), AutoSave
├── ui/                  # StartMenu, NewGameScreen, UIManager, InspectorPanel, JobRoster, CreditsScreen, SettingsPanel, DebugMenu, TutorialSystem
├── utility/             # Task base, UtilityAI, ActivityOption, 20 task types
├── world/               # TileGrid, TileTypes, IsometricUtils, WallAutoGen, WorldGen, ZoneType, Asteroid
└── zones/               # Zone, BedZone, BrigZone, FitnessZone, HospitalZone, Pub, ResearchZone, Airlock
e2e/
└── game.spec.ts         # 213+ Playwright E2E tests
```

## Key Systems

| System | Key Files | Description |
|--------|-----------|-------------|
| Events | `src/events/EventController.ts` | Forecast queue (15 events), difficulty scaling, 8 event types |
| Combat | `src/combat/CombatSystem.ts` | Melee grapple + ranged projectiles, faction hostility checks |
| Fire | `src/hazards/Fire.ts` | Isometric adjacency spread, wall blocking, character damage |
| Disease | `src/malady/Malady.ts` | Contagion (range 3 tiles), incubation, doctor curing |
| Goals | `src/goals/GoalSystem.ts` | 12 achievements, checked 1/second, alert on completion |
| Audio | `src/audio/SoundManager.ts` | Web Audio API, 4 category gains, procedural fallback beeps |
| Music | `src/audio/MusicSystem.ts` | 5-track rotation with gaps, exterior/interior ambience |
| Spatial | `src/audio/SpatialAudio.ts` | 3D positioned sounds for doors, machines, combat, Jukebox |
| Save | `src/save/SaveLoad.ts` | Full state persistence: grid, characters, objects, research, events |

## Coordinate Systems

- **Offset coords** `(x, y)`: staggered grid positions used in `TileGrid`
- **Screen coords** `(px, py)`: pixel positions on screen
- **Iso-axial coords** `(a, b)`: axis-aligned to the diamond grid's NE/NW axes; used for rectangular drag selection

## Walls

Walls exist as tile type `WALL=4` in the grid for room boundary logic, but render as raised edges baked into floor tile textures. 16 floor variants are pre-generated (one per combination of NW/NE/SW/SE wall edges).
