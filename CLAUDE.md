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
├── renderer/            # ThreeRenderer, CameraController3D, TileRenderer3D, CharacterRenderer
├── world/               # Tile grid, iso math, rendering, wall auto-gen
├── rooms/               # Room detection (BFS flood fill)
├── oxygen/              # Per-room O2 simulation
├── building/            # Floor/door placement, drag cursor
├── characters/          # Characters, needs, manager
├── pathfinding/         # A* on diamond grid
├── input/               # InputManager (keyboard, mouse, pointer)
├── ui/                  # StartMenu, NewGameScreen, UIManager (HUD, toolbar)
├── core/                # GameRules, Base
├── envobjects/          # Environment object manager
├── power/               # Power system
├── lighting/            # Room lighting
├── hazards/             # Fire, projectiles
├── events/              # Event controller, immigration, meteor
├── pickups/             # Corpse, debris pickups
└── save/                # Save/load system
e2e/
└── game.spec.ts         # Playwright E2E tests
```

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
| D | Toggle door placement mode |
| X | Toggle demolish mode |
| ESC | Cancel build mode |
| O | Toggle O2 overlay |
| 1/2/3 | Game speed 1x/2x/4x |
| Arrow keys | Pan camera |
| Scroll wheel | Zoom |
| Right/middle drag | Pan camera |
| C | Toggle room build mode |
| M | Toggle mine mode |
| Z | Toggle zone assignment mode |
| P | Toggle object placement mode |

## Testing

### E2E Tests (Playwright)
- Config: `playwright.config.ts` — Chromium only, WebGL via SwiftShader for headless
- Tests: `e2e/game.spec.ts` — serial test suite with shared browser page
- Dev server auto-starts via `webServer` config (port 5173)
- Game state exposed via `window.__df9` in `src/main.ts` for test assertions:
  - `getPopulation()`, `getMatter()`, `getRoomCount()`, `getBuildMode()`, `getCharacters()`
  - `getEnvObjects()`, `getPickups()`, `getRooms()`, `getCommands()`, `getWallTiles()`
  - `placeObject()`, `createBuiltObject()`, `setZone()`
  - `killCharacter()`, `spawnCharacterAt()`, `triggerImmigration()`

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
