# Testing

## E2E Tests (Playwright)

- Config: `playwright.config.ts` — Chromium only, WebGL via SwiftShader for headless
- Tests: `e2e/game.spec.ts` — 261 discovered tests in one serial Chromium suite
  with shared page state (refresh this count with `npx playwright test --list`)
- Dev server auto-starts via `webServer` config (port 5173)
- CI rejects skipped tests unless their exact title is documented in
  `scripts/assert-playwright-skips.mjs`.

## Unit Tests and Coverage

Vitest provides deterministic branch-level checks for logic that should not
depend on browser state. Current suites cover save validation and durable
object fields, oxygen/vacuum timing, door side sampling, A* topology and door
changes, power distribution, event eligibility/lifecycle, UtilityAI and task
contracts, and independent per-lab research progress.

Coverage explicitly includes those high-risk save, oxygen/vacuum, door,
pathfinding, power, event, research, and utility/task targets. The enforced
aggregate baseline is recorded in `vitest.config.ts`; thresholds are a ratchet
and must only move upward as coverage improves.

GitHub Actions runs a clean install, high-severity dependency audit, typecheck,
production build, unit coverage, and the full Playwright suite on pushes and
pull requests. Coverage is always retained; Playwright reports, traces, and
screenshots are retained on failure.

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
npm test                      # Unit tests
npm run test:coverage         # Unit tests with enforced coverage thresholds
npm run typecheck             # TypeScript only
npm run audit                 # Fail on high/critical dependency advisories
npm run test:e2e              # Headless (CI-friendly)
npm run test:e2e:ci           # JSON report plus unexpected-skip gate
npx playwright test --headed  # Visible browser (debugging)
npx playwright test --ui      # Interactive trace viewer
```
