# Spacebase DF-9 — Graphics-first source parity audit (round 3)

> Review date: 2026-08-24
> Review base: `f6f5ef5` on `codex/fix-full-audit`
> Authority: the bundled Lua source and its public game assets. The three deviations listed in `AGENTS.md` remain intentional.

This is the current audit record. `AUDIT.md` and `AUDIT2.md` preserve the earlier discovery passes, but some of their open findings were fixed by `31366bc`; they should not be read as current status lists.

## Status language

| Status | Meaning |
|---|---|
| **Fixed + tested** | TypeScript was changed and a focused automated regression test covers the source behavior. |
| **Previously verified** | Covered by the prior full audit and unchanged in this pass. |
| **Residual** | A known fidelity boundary remains; it is not being represented as complete parity. |
| **Approved deviation** | Deliberately differs from the original, as recorded in `AGENTS.md`. |

## Outcome

This pass reviewed the renderer, extracted assets, primary game screens, room lighting, character presentation, held-object presentation, and the timing paths adjacent to those systems. It fixed thirteen graphics/UI parity defects and three timing/state defects. The highest-impact visual defects were the compressed new-base map, approximate menu geometry, disabled source skeletal animations, invented character aura, incorrect character rig-subset selection, missing portrait/accessory/face layers, missing race/job textures, and object damage tints being erased by room lighting.

## Graphics and UI findings

| ID | Status | Source authority | Finding and correction | Regression evidence |
|---|---|---|---|---|
| GFX-01 | **Fixed + tested** | `Data/UILayouts/StartMenuLayout.lua`, `Data/Scripts/UI/StartMenu.lua` | Replaced the approximate responsive menu arrangement with the source's centre-origin logo, MOTD band, website text, and 80-pixel button stack. | `start menu keeps Lua reference regions separated at 1280x720` |
| GFX-02 | **Fixed + tested** | `Data/UILayouts/NewBaseLayout.lua`, `Data/UILayouts/NewBaseInspectorLayout.lua`, `Data/Scripts/UI/NewBase.lua:setMapLoc` | Restored the 405-pixel left console, 158-pixel right console, full-height stretched galaxy map, source telemetry placement, 550-pixel inspector, button positions, and the original `galaxy_zoom01` preview. | `new-base map and consoles use the Lua native layout at 1280x720` |
| GFX-03 | **Fixed + tested** | Character `.banim` clips and rig assets in the public source data | Citizens now use the source skeletal clips. Spacesuit, bad-alien, and killbot rigs select their own idle/walk/work clips; procedural motion is only a fallback when a source clip is unavailable. | `character renderer plays rig-specific original animation clips` |
| GFX-04 | **Fixed + tested** | Public character body/head/job textures and Lua character variation structure | Removed whole-model species tinting. Cat, Bird, Jelly, and Shamon meshes receive their extracted body/head textures, while builder, technician, miner, emergency, raider, doctor, scientist, and tourist clothing is shown from source assets. | `character renderer uses extracted race textures and job outfits` |
| GFX-05 | **Fixed + tested** | `Character.lua:_setUpBlobShadow` | Removed the invented yellow selection aura and restored the extracted `ui_blobshadow` sprite at the source dimensions and offset. | `character renderer uses the original blob shadow without an invented aura` |
| GFX-06 | **Fixed + tested** | `GuiManager.lua` character selection path | Replaced the generated diamond with the extracted `character_selected` sprite. | `selection highlight uses the original character_selected sprite` |
| GFX-07 | **Fixed + tested** | Public hand-prop models/textures and Lua task/equipment state | Held props now load available source textures, replace stale models when equipment changes, show build/mine/maintenance tools for their tasks, and only draw weapons during attack tasks. | `held prop renderer textures source models and replaces changed equipment` |
| GFX-08 | **Fixed + tested** | `Room.lua` lighting plus environment-object damage/vaporize presentation | Room lighting is now multiplied with the object's visual state. It no longer overwrites red damage or translucent vaporize tint on the following frame. | `room lighting preserves object damage and vaporize tints` |
| GFX-09 | **Fixed + tested** | `Character.lua` thought/dialog construction around lines 3167 and 4536 | Replaced the generic black emoji pill with source bubble/end-cap/tail assets, amber Dosis text, dialog/thought variants, and hover-only task bubbles. | `character renderer handles thought bubble creation` |
| GFX-10 | **Fixed + tested** | `Character.lua:_setSpacesuitRigActive`, per-rig animation tables, and the extracted opaque character textures | Spacesuit animation selection now follows Lua's active-rig precedence even for monster/killbot races. Character body, outfit, and suit textures now write depth as opaque surfaces, preventing rear subsets from bleeding through the visible model. | `changing character race remounts the matching original rig`; `character renderer uses extracted race textures and job outfits` |
| GFX-11 | **Fixed + tested** | `Character.lua:_setRig`, `Character.lua:_setPortrait`, `CharacterConstants.lua` body/head/hair tables, original `.brig` subset order, and `UI/Portraits.lua` | Replaced ID-derived sex/tone/hair guesses and first-material mesh selection with a Lua-compatible saved appearance tuple. The renderer now selects the original ordered body, head, hair, helmet, and outfit subsets (including fat/female variants), applies their matching source textures, persists them through save/load, and builds the inspector portrait from the original base/facial-hair/hair layer stack. The complete generated-character portrait atlas is now packaged. | `character appearance mounts the saved Lua body tuple and layered portrait`; `character renderer uses extracted race textures and job outfits`; `save and load restores game state`; unit portrait-atlas sweep |
| GFX-12 | **Fixed + tested** | `Character.lua:_getValidAccessories`, `Character.lua:_setAccessories`, `Character.lua:_setJobOutfit`, `CharacterConstants.lua` accessory pools/conflicts, and original `.brig` subset order | Restored the source's independent 60/101 top and bottom accessory selection, exact race/body pools, source subset and texture mappings, and per-job conflict visibility. Removed the invented unconditional tourist shirt/shorts from off-duty and non-suited characters, and corrected the remaining three female hair primitive indices. | `character appearance mounts Lua accessory subsets and respects job conflicts`; unit accessory-pool, texture, conflict, no-invented-outfit, and female-hair subset checks |
| GFX-13 | **Fixed + tested** | `Character.lua:_setHead`, `CharacterConstants.lua` `FACE_TOP_TYPE`/`FACE_BOTTOM_TYPE`, and the extracted RGBA head-layer sheets | Replaced the unusable grayscale public copies with the source RGBA beard, chicken-comb, and chicken-beak sheets. The Three.js head material now composites Lua's `g_samTop` and `g_samBottom` textures over the selected base head atlas while retaining normal skinning, lighting, depth, and tint behavior. | `character head material composites Lua beard, comb, and beak layers`; unit variation-to-layer and RGBA asset validation |

## Gameplay and timing findings found during the same review

| ID | Status | Source authority | Finding and correction | Regression evidence |
|---|---|---|---|---|
| SIM-01 | **Fixed + tested** | `Room.lua:856`, `Room.lua:1104`, `Room.lua:2364-2380` | Combat awareness was written using wall-clock Unix seconds but read using game elapsed time, so a room could remain in the recent-combat state indefinitely. Initialization is now `-9999`, and alerts store `GameRules.elapsedTime`. | `room combat awareness uses game elapsed time` |
| SIM-02 | **Fixed + tested** | `Character.lua:2332-2345`, `Character.lua:_convert` | Raider conversion previously decreased every frame. It now decreases by exactly one per survival evaluation, runs for all living factions, converts only below zero, assigns a fresh citizen name, applies the citizen job transition, and preserves brig state as Lua does. | `raider conversion decrements once per survival evaluation and preserves brig state` |
| SIM-03 | **Fixed + tested** | Lua's `dt`-driven UI updates | Tile-tip expiry used an assumed 60 FPS and therefore drifted with real frame rate. `UIManager.update` now consumes the game-loop delta. | TypeScript, unit, and full E2E regression suite |

## Cross-system review matrix

| Area | Current disposition |
|---|---|
| Grid coordinates, adjacency, wall/room flood fill | **Previously verified** against `WorldConstants.lua`, `World.lua`, and `Room.lua`; the approved staggered-rendering convention is preserved. |
| Oxygen, fire, power, doors | **Previously verified** by the earlier audit and its regression tests; renderer-side room-light composition was rechecked here. |
| Character needs, survival, AI, jobs, inventory | **Previously verified**, with survival scheduling and raider conversion corrected in this pass. |
| Combat, raids, factions | **Previously verified**, with room combat-awareness timing corrected in this pass. |
| Events, goals, research, maladies | **Previously verified**; the 24-disease roster, active TraderEvent, and active HostilesFedToMonster goal remain **approved deviations**. |
| Building, mining, object placement, zoning | **Previously verified**; visual tools/held props and object-state tint were rechecked here. |
| Start/new-base/HUD/inspector UI | **Reviewed in this pass**; the two visually dominant pre-game screens received source-coordinate fixes. |
| Character/environment rendering | **Reviewed in this pass**; original rig subsets, appearance, accessory, and face-layer textures, layered portraits, clips, shadow, selection, bubbles, props, and light/tint composition are now used where assets exist. |
| Audio, save/load, input | **Reviewed/previously verified**; character appearance persistence was added and exercised through load/remount, while the remaining paths retain their earlier coverage. |

## Known residual fidelity boundaries

These are explicit limits, not hidden “done” items:

1. **Incomplete prop texture extraction.** Source textures are available for the rifle/pistol, builder tool, asteroid chunk, and mug paths used here. Some public models, including the Weldammer, body bag, and several food items, do not have a corresponding extracted texture in the current asset tree and therefore retain their model material.
2. **Particle effects.** Fire, meteor, construction, and related effects remain Three.js procedural equivalents because the original `.pex`/engine particle pipeline is not represented as directly usable web assets.
3. **Post-processing.** Bloom is present, but the proprietary source colour-LUT/material pipeline has no directly reusable public web asset and remains an approximation.
4. **Module layout ingestion.** Several `.sav` docking/module arrangements are represented by TypeScript generation logic rather than a generic reader for every Lua-era module save.
5. **UILayout runtime.** Screens are implemented directly in TypeScript/DOM. There is no generic Lua `UILayout` parser, so parity depends on explicit per-screen transcription and regression tests.

## Acceptance and verification

- TypeScript compilation must pass with no emitted files.
- All unit tests must pass.
- The complete Playwright suite must pass against the production-like Vite test build.
- The graphics-focused tests listed above must pass at the explicit 1280×720 reference viewport.
- Visual inspection must show no overlap on the start menu, a full-height new-base map between native-width consoles, source character shadows without yellow auras, and stable object-state tint under room lighting.

The implementation should be called **source-complete for the fixes in this document**, not “pixel-perfect everywhere,” until the residual boundaries above are resolved and separately tested.

### Completed verification — 2026-08-22

| Gate | Result |
|---|---|
| Production build (`tsc` + Vite) | **PASS** |
| Unit suite | **PASS — 87/87** |
| Complete Playwright E2E suite | **PASS — 278/278 in 4.6 minutes** |
| Independent-order Playwright shards | **PASS — 135/135 + 135/135** with the configured two workers |
| Timing-race stress checks | **PASS — 10/10 injury-timing runs and 10/10 imported-save safety runs** |
| Focused graphics/timing scenarios | **PASS — 11/11**, then included in the complete run |
| Production test-bridge isolation | **PASS** |
| Diff whitespace validation | **PASS** |

The production build reports the existing large-bundle advisory for the 1.6 MB main chunk; it does not fail the build and is unrelated to the source-parity corrections in this pass.

### Character appearance continuation — 2026-08-24

| Gate | Result |
|---|---|
| Production build (`tsc` + Vite) | **PASS** |
| Unit suite | **PASS — 95/95** |
| Focused appearance/save/render scenarios | **PASS — 7/7** |
| Complete Playwright E2E suite | **PASS — 281/281 in 9.3 minutes** |
| Generated portrait source-atlas sweep | **PASS — 2,500 generated appearances checked** |
| Restored head-layer source assets | **PASS — all 33 beard/comb/beak sheets validated as RGBA** |
| Diff whitespace validation | **PASS** |
| In-app manual capture after reload | **INCOMPLETE — blocked by the in-app browser URL safety policy; no visual PASS is claimed from that capture** |
