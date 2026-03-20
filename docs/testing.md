# Testing

## E2E Tests (Playwright)

- Config: `playwright.config.ts` — Chromium only, WebGL via SwiftShader for headless
- Tests: `e2e/game.spec.ts` — 37 serial tests with shared browser page
- Dev server auto-starts via `webServer` config (port 5173)

## Test API Surface

Game state exposed via `window.__df9` in `src/main.ts` for test assertions:

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

## Running Tests

```bash
npm run test:e2e              # Headless (CI-friendly)
npx playwright test --headed  # Visible browser (debugging)
npx playwright test --ui      # Interactive trace viewer
```
