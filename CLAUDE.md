# Spacebase DF-9 Web Prototype

## Overview
Web reimplementation of Spacebase DF-9 using TypeScript + Three.js. The original Lua source is the reference at `spacebase-v2-updated-code-master/`.

## Guiding Principle
**Adhere to the original Lua source code as closely as possible.** When implementing game mechanics (tile adjacency, room detection, oxygen, AI), always reference the original Lua files first. Do not invent new mechanics or deviate from the original game's behavior unless explicitly asked.

### Key Reference Files (original Lua)
| File | Contains |
|------|----------|
| `Data/Scripts/WorldConstants.lua` | Tile types, direction enums, adjacency offsets |
| `Data/Scripts/World.lua` | `_getAdjacentTile`, tile operations, coordinate math |
| `Data/Scripts/Room.lua` | `_floodRoom`, breach detection, room updates |
| `Data/Scripts/GameRules.lua` | Matter costs, starting values, game tick structure |
| `Data/Scripts/Oxygen.lua` | O2 thresholds, vacuum simulation |
| `Data/Scripts/CharacterConstants.lua` | Character O2 drain, need thresholds |

### Original Adjacency Convention
The original uses `xLeft = -(y % 2)` for the staggered diamond grid. Our rendering shifts odd rows RIGHT (`screenX = tx*128 + (ty&1)*64`), and our adjacency matches this geometry:
- Even rows: `xLeft = -1` (NW neighbor at `x-1`, NE at `x`)
- Odd rows: `xLeft = 0` (NW neighbor at `x`, NE at `x+1`)

## Commands
```bash
npm run dev      # Start Vite dev server (http://localhost:5173)
npm run build    # TypeScript check + production build
npx tsc --noEmit # Type-check only
npm run test:e2e # Run Playwright E2E tests (headless Chromium)
```

## Architecture
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
├── ui/                  # StartMenu, NewGameScreen, UIManager, InspectorPanel, JobRoster
├── utility/             # Task base, UtilityAI, ActivityOption, 20 task types
├── world/               # TileGrid, TileTypes, IsometricUtils, WallAutoGen, WorldGen, ZoneType, Asteroid
└── zones/               # Zone, BedZone, BrigZone, FitnessZone, HospitalZone, Pub, ResearchZone, Airlock
e2e/
└── game.spec.ts         # 37 Playwright E2E tests
```

### Key Systems

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

### Coordinate Systems
- **Offset coords** `(x, y)`: staggered grid positions used in `TileGrid`
- **Screen coords** `(px, py)`: pixel positions on screen
- **Iso-axial coords** `(a, b)`: axis-aligned to the diamond grid's NE/NW axes; used for rectangular drag selection

### Walls
Walls exist as tile type `WALL=4` in the grid for room boundary logic, but render as raised edges baked into floor tile textures. 16 floor variants are pre-generated (one per combination of NW/NE/SW/SE wall edges).

## Controls
| Key | Action |
|-----|--------|
| B | Toggle floor build mode |
| C | Toggle room build mode |
| D | Toggle door placement mode |
| X | Toggle demolish mode |
| M | Toggle mine mode |
| Z | Toggle zone assignment mode |
| P | Toggle object placement mode |
| I | Inspect mode (none) |
| R | Toggle job roster |
| O | Toggle O2 overlay |
| 1/2/3 | Game speed 1x/2x/4x |
| ESC | Cancel build mode / clear selection |
| Arrow keys | Pan camera |
| Scroll wheel | Zoom |
| Right/middle drag | Pan camera |

## Testing

### E2E Tests (Playwright)
- Config: `playwright.config.ts` — Chromium only, WebGL via SwiftShader for headless
- Tests: `e2e/game.spec.ts` — 37 serial tests with shared browser page
- Dev server auto-starts via `webServer` config (port 5173)
- Game state exposed via `window.__df9` in `src/main.ts` for test assertions:
  - **Core**: `getPopulation()`, `getMatter()`, `getRoomCount()`, `getBuildMode()`, `getCharacters()`
  - **Objects**: `getEnvObjects()`, `getPickups()`, `getRooms()`, `getCommands()`, `getWallTiles()`
  - **Actions**: `placeObject()`, `createBuiltObject()`, `setZone()`, `killCharacter()`, `spawnCharacterAt()`, `triggerImmigration()`
  - **Combat**: `spawnHostiles()`, `spawnHostileAt()`, `getHostileCount()`, `getAllCharacters()`, `getCombatEngagements()`
  - **Events**: `getEventForecast()`, `getActiveEvents()`, `getFireCount()`, `getActiveFires()`, `startFire()`
  - **Disease**: `infectCharacter()`, `getCharacterMaladies()`, `getDiseasedCount()`
  - **Research**: `getResearch()`, `startResearch()`
  - **Goals**: `getGoals()`, `getHints()`
  - **Save**: `saveGame()`, `loadGame()`, `hasSave()`, `deleteSave()`
  - **Audio**: `getAudioState()`, `toggleMute()`, `setMasterVolume()`, `getMusicState()`, `getSpatialLoops()`, `triggerDoorSound()`, `triggerJukebox()`

### Workflow
**After building any new feature**, always:
1. Add a new E2E test covering the feature in `e2e/game.spec.ts`
2. Run the full suite with `npm run test:e2e` to check for regressions

### Running Tests
```bash
npm run test:e2e              # Headless (CI-friendly)
npx playwright test --headed  # Visible browser (debugging)
npx playwright test --ui      # Interactive trace viewer
```
