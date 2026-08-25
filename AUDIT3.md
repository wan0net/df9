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

This pass reviewed the renderer, extracted assets, primary game screens, room lighting, character presentation, held-object presentation, construction ghosts, environment-object geometry and hover states, particle presentation, post-processing, and the timing paths adjacent to those systems. It fixed twenty-five graphics/UI parity defects and four timing/input defects. The highest-impact visual defects were the compressed new-base map, approximate menu geometry, disabled source skeletal animations, invented character aura, incorrect character and spacesuit rig-subset selection, missing portrait/accessory/face layers, missing or half-darkened race/job/prop/effect textures, absent or incorrectly uploaded source colour grading, fluorescent HUD icon tint, invented research glyphs, grey/placeholder construction ghosts, stretched environment props, missing object/HappyBot hover feedback, and object damage tints being erased by room lighting.

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
| GFX-14 | **Fixed + tested** | Bundled prop `.brig` materials and the extracted `Props/**/Textures` sheets | Audited every public prop GLB material and restored all available original sheets, including the body bag, food items/tray/crate, Weldammer/fire-extinguisher tools, plasma cannon, weights, cigarette, present, handheld game, probe, wand, and primitives. Prop sheets now render as opaque depth-writing surfaces, eliminating rear-face bleed and the prior pale/transparent appearance. | `prop renderer applies every available extracted source texture as an opaque surface`; `held prop renderer textures source models and replaces changed equipment` |
| GFX-15 | **Fixed + tested** | `World.lua:playExplosion`, `AnimatedSprite.lua`, and extracted `flame01`, `spark01`, and 32-frame `explode01_` assets | Replaced generated radial-gradient particle bitmaps and the square-point explosion burst with the original visible effect sheets. Explosions now play the 32 source frames at the source 30 FPS, random 1.65–1.95 scale, horizontal flip, and 40-pixel vertical offset. | `meteor trail effect uses the original spark01 particle sheet`; `explosion system plays the original 32-frame explode01 animation`; `explosion sparks use the original spark01 particle sheet` |
| GFX-16 | **Fixed + tested** | `Data/Scripts/PostFX/Post.lua:ScenePlusUI`, `Post.SetPostColorLUT`, and extracted `Neutral2D_256`, `WarmSpace2D_256`, and `ColdSpace2D_256` sheets | Replaced the claim that colour grading had no reusable source asset with a source-LUT shader pass. The original neutral sheet is now the active default before bloom/output, and the two other publicly extracted presets can be selected through the source-compatible post-processing path. Missing magenta/green-punch sheets are not fabricated. | `postfx uses the source LUT and Lua amber character outlines` |
| GFX-17 | **Fixed + tested** | `CharacterConstants.BACKGROUND_RENDER_LAYER = 'WorldOutlines'` and `Post.lua:OutlineFilter` | Restored the missing character-silhouette buffer. Every visible character rig now receives Lua's amber `{1.0, 0.7, 0.0, 0.2}` edge at the source two-pixel width, composited after colour grading. A half-resolution one-texel mask yields the same two-screen-pixel result without the full-resolution mask's unacceptable GPU cost. | `postfx uses the source LUT and Lua amber character outlines`; complete four-worker WebGL suite |
| GFX-18 | **Fixed + tested** | `ResearchData.lua:sIcon`, `UI/ResearchProjectEntry.lua`, and extracted `UI/JobRoster` sprites | Removed Unicode research symbols and restored every Lua project-to-job-icon assignment. Projects without `sIcon` and available disease work use `ui_jobs_iconHelp`; completed technology/disease entries use the source `ui_jobs_icon_checkCircle`; hover tint follows the source amber/black button states. | `research panel is full-screen overlay with tabs` now verifies source-sprite-backed entries |
| GFX-19 | **Fixed + tested** | `EnvObject.lua` pending-build opacity and the extracted environment/door sheets | Pending objects incorrectly prefixed their sprite key twice, forcing every construction ghost to a grey fallback quad. Door placeholders also won before the already-loaded source door textures. Ghosts now resolve the original object frame or Door/Heavy Door/Airlock tile texture first and apply Lua-style translucent construction opacity; generated placeholders remain only for genuinely absent hidden/debug sprites. | `placed-object ghosts use original object and door textures` covers a normal object and all three door types |
| GFX-20 | **Fixed + tested** | `DFCommon/Graphics.lua:loadSpriteSheet`, `DFCommon/Graphics.lua:alignSprite`, `EnvObject.lua`, and the munged environment sprite metadata | Environment artwork was stretched to the logical tile footprint instead of being drawn at its source sprite-deck dimensions. This enlarged Juke by 24%, HappyBot by 39%, and distorted several higher-tier machines. Source frames now render at their exact pixel dimensions, and condition/interact swaps replace geometry as well as UVs so differently sized damaged/destroyed frames are not stretched over the healthy mesh. | `environment sprites keep Lua source dimensions across condition frames` covers Juke, HappyBot healthy/damaged/destroyed, ReactorGen3, and O2Gen3 |
| GFX-21 | **Fixed + tested** | `EnvObject.lua:hover`/`unHover`, `HappyBot.lua:setLoc`/`hover`, and `GridUtil.CalculateIsoToSquare` | Environment objects did not receive Lua's pulsing amber cursor tint, and HappyBot omitted its entire affected-area display. Hover now applies the source amber sine pulse and restores the composed condition/room tint on exit. HappyBot converts through Lua's square grid, draws the exact 29-tile Euclidean radius for `nRange=3`, and changes the coverage from green to red when it is not functioning. | `environment hover pulses amber and HappyBot shows its Lua radius` |
| GFX-22 | **Fixed + tested** | `Post.lua:ScenePlusUI`, `Post.SetPostColorLUT`, and `Neutral2D_256` row order | Three's default texture upload inversion made black sample the LUT's green row, washing the world lime. The extracted 2D LUT now preserves its authored top-to-bottom orientation and neutral black maps to black. | `postfx uses the source LUT and Lua amber character outlines` verifies `flipY=false`; live 1280x720 capture |
| GFX-23 | **Fixed + tested** | Original character/prop sheets and the converted GLB placeholder materials | Every converted GLB carried a neutral `0.5,0.5,0.5` base-colour factor. Restoring a source texture without clearing that placeholder multiplied all character and prop pixels to half brightness. Textured surfaces now use a white material multiplier while room/state tint remains separately composable. | character and prop source-material sweeps assert `#ffffff`; live spacesuit comparison |
| GFX-24 | **Fixed + tested** | `Character.lua:_setJobOutfit`, `CharacterConstants.SPACESUITS`, `SPACESUIT_JOB_EQUIPMENT`, and the seven source spacesuit subsets | Material-name selection conflated suit body subset 1 with default equipment subset 4. Default crew wore the brown builder body; miner/emergency equipment overlapped the default pack; miners permanently showed a rock; builders permanently showed a tool. Visibility now follows subset order, body texture follows the exact job table, and held tools remain task-driven props. | `character renderer uses extracted race textures and job outfits` covers default, miner, and emergency bodies/equipment |
| GFX-25 | **Fixed + tested** | `Gui.AMBER`, `NewInspectMenu.lua`, and HUD/ObjectMenu linecodes | The white source icons were filtered to fluorescent `#c3c700` rather than Lua amber `#dfa200`; inspector controls also displayed Submit/Inspect where Lua requests Back/Cancel. The shared HUD, research, and inspector filters now land within two RGB values of source amber, and the affected controls use the source linecodes. | `HUD source icons are tinted to Lua Gui.AMBER rather than yellow-green`; inspector/object-menu text assertions; live 1280x720 capture |

## Gameplay and timing findings found during the same review

| ID | Status | Source authority | Finding and correction | Regression evidence |
|---|---|---|---|---|
| SIM-01 | **Fixed + tested** | `Room.lua:856`, `Room.lua:1104`, `Room.lua:2364-2380` | Combat awareness was written using wall-clock Unix seconds but read using game elapsed time, so a room could remain in the recent-combat state indefinitely. Initialization is now `-9999`, and alerts store `GameRules.elapsedTime`. | `room combat awareness uses game elapsed time` |
| SIM-02 | **Fixed + tested** | `Character.lua:2332-2345`, `Character.lua:_convert` | Raider conversion previously decreased every frame. It now decreases by exactly one per survival evaluation, runs for all living factions, converts only below zero, assigns a fresh citizen name, applies the citizen job transition, and preserves brig state as Lua does. | `raider conversion decrements once per survival evaluation and preserves brig state` |
| SIM-03 | **Fixed + tested** | Lua's `dt`-driven UI updates | Tile-tip expiry used an assumed 60 FPS and therefore drifted with real frame rate. `UIManager.update` now consumes the game-loop delta. | TypeScript, unit, and full E2E regression suite |
| SIM-04 | **Fixed + tested** | Browser pointer events and Lua's single-frame touch transitions | A normal browser click could press and release between animation frames. Although the edge flags were recorded, the public `leftJustPressed`/`leftJustReleased` queries ignored them, so live character inspection frequently did nothing. Both edges now survive until the next input frame. | `inspect mode selects entity on click` uses an ordinary zero-delay click and verifies the selected character pane |

## Cross-system review matrix

| Area | Current disposition |
|---|---|
| Grid coordinates, adjacency, wall/room flood fill | **Previously verified** against `WorldConstants.lua`, `World.lua`, and `Room.lua`; the approved staggered-rendering convention is preserved. |
| Oxygen, fire, power, doors | **Previously verified** by the earlier audit and its regression tests; renderer-side room-light composition was rechecked here. |
| Character needs, survival, AI, jobs, inventory | **Previously verified**, with survival scheduling and raider conversion corrected in this pass. |
| Combat, raids, factions | **Previously verified**, with room combat-awareness timing corrected in this pass. |
| Events, goals, research, maladies | **Previously verified**; the 24-disease roster, active TraderEvent, and active HostilesFedToMonster goal remain **approved deviations**. |
| Building, mining, object placement, zoning | **Previously verified**; all available source prop sheets, held tools, object-state tint, and pending object/door ghost textures were rechecked here. |
| Start/new-base/HUD/inspector/research UI | **Reviewed in this pass**; the two visually dominant pre-game screens received source-coordinate fixes, and research project/status icons now use Lua's exact sprites. |
| Character/environment rendering | **Reviewed in this pass**; original rig subsets, appearance, accessory, and face-layer textures, layered portraits, clips, shadow, selection, bubbles, native environment-sprite geometry, props, visible effect sheets/animation, source colour grading, and light/tint composition are now used where assets exist. |
| Audio, save/load, input | **Reviewed/previously verified**; character appearance persistence was added and exercised through load/remount, while the remaining paths retain their earlier coverage. |

## Known residual fidelity boundaries

These are explicit limits, not hidden “done” items:

1. **Datapad source texture.** The Datapad GLB requests `Datapad01`, but no matching texture exists anywhere in the bundled extraction. Every other public prop material with an available original sheet is now wired and tested; the Datapad retains its model material rather than using an invented replacement.
2. **Particle emitter motion.** The original visible `flame01`, `spark01`, and `explode01_` assets are now used, and explosions reproduce the Lua animated-sprite parameters. Fire, meteor, construction, and spark emitter motion remains a Three.js procedural equivalent because no original `.pex` definitions exist in the bundled source or extraction.
3. **Remaining post-processing composition.** The default source neutral LUT, extracted warm/cold presets, and Lua-character outline constants/order are now applied by tested WebGL passes. The original `SceneLight.material`, `Outlines.material`, separate light/background buffers, and missing magenta/green-punch sheets are not in the public extraction, so the shader internals and wider multi-buffer composition remain Three.js equivalents.
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
| Focused appearance/save/render scenarios | **PASS — 8/8** |
| Complete Playwright E2E suite | **PASS — 282/282 in 10.8 minutes** |
| Generated portrait source-atlas sweep | **PASS — 2,500 generated appearances checked** |
| Restored head-layer source assets | **PASS — all 33 beard/comb/beak sheets validated as RGBA** |
| Prop source-material sweep | **PASS — all 16 tested models use their extracted sheets with opaque depth writes** |
| Diff whitespace validation | **PASS** |
| In-app manual capture after reload | **INCOMPLETE — blocked by the in-app browser URL safety policy; no visual PASS is claimed from that capture** |

### Source-effect continuation — 2026-08-24

| Gate | Result |
|---|---|
| TypeScript compilation | **PASS** |
| Production build (`tsc` + Vite) | **PASS** |
| Unit suite | **PASS — 95/95** |
| Focused source-effect scenarios | **PASS — 3/3** |
| Complete Playwright E2E suite | **PASS — 282/282 in 9.3 minutes** |
| Extracted effect-asset sweep | **PASS — `flame01`, `spark01`, and all 32 `explode01_` RGBA frames packaged** |
| Diff whitespace validation | **PASS** |

### Source-LUT continuation — 2026-08-24

| Gate | Result |
|---|---|
| TypeScript compilation | **PASS** |
| Production build (`tsc` + Vite) | **PASS** |
| Unit suite | **PASS — 95/95** |
| Focused source-LUT WebGL scenario | **PASS — 1/1** |
| Complete Playwright E2E suite | **PASS — 282/282 in 8.3 minutes** |
| Extracted LUT sweep | **PASS — neutral, warm-space, and cold-space 256×256 RGBA sheets packaged exactly** |
| Diff whitespace validation | **PASS** |

### Character-outline continuation — 2026-08-24

| Gate | Result |
|---|---|
| TypeScript compilation | **PASS** |
| Production build (`tsc` + Vite) | **PASS** |
| Unit suite | **PASS — 95/95** |
| Focused outline/LUT WebGL scenario | **PASS — 1/1** |
| Four-parallel-render smoke | **PASS — 4/4** |
| Complete fail-fast Playwright E2E suite | **PASS — 282/282 in 9.4 minutes** |
| Full-resolution outline-mask trial | **REJECTED — functionally correct but too expensive; replaced by the verified half-resolution mask with the same two-screen-pixel edge** |
| Diff whitespace validation | **PASS** |

### Research-icon continuation — 2026-08-24

| Gate | Result |
|---|---|
| TypeScript compilation | **PASS** |
| Production build (`tsc` + Vite) | **PASS** |
| Unit suite | **PASS — 95/95** |
| Focused research-panel source-sprite scenario | **PASS — 1/1** |
| Complete fail-fast Playwright E2E suite | **PASS — 282/282 in 9.5 minutes** |
| Source-icon sweep | **PASS — all Lua `sIcon` assignments resolve to exact extracted 32×32 RGBA JobRoster sprites** |
| Diff whitespace validation | **PASS** |

### Construction-ghost continuation — 2026-08-24

| Gate | Result |
|---|---|
| TypeScript compilation | **PASS** |
| Production build (`tsc` + Vite) | **PASS** |
| Unit suite | **PASS — 95/95** |
| Focused source-ghost scenario | **PASS — 1/1**, covering Standing Table, Door, Heavy Door, and Airlock |
| Complete fail-fast Playwright E2E suite | **PASS — 282/282 in 8.8 minutes** |
| Renderer fallback inventory | **PASS — only the hidden Spawner/DockPoint lack source frames; all placeable visible objects and doors resolve original artwork** |
| Diff whitespace validation | **PASS** |

### Native environment-sprite continuation — 2026-08-25

| Gate | Result |
|---|---|
| TypeScript compilation | **PASS** |
| Production build (`tsc` + Vite) | **PASS** |
| Unit suite | **PASS — 95/95** |
| Focused source-dimension scenario | **PASS — 1/1**, covering Juke, HappyBot healthy/damaged/destroyed, ReactorGen3, and O2Gen3 |
| Complete stable Playwright E2E suite | **PASS — 283/283 in 13.4 minutes with two WebGL workers** |
| Four-worker trial | **INCOMPLETE — browser-context teardown exceeded the harness timeout after 55 passing tests; no assertion failed, and the complete stable run above supersedes it** |
| Diff whitespace validation | **PASS** |

### Environment-hover continuation — 2026-08-25

| Gate | Result |
|---|---|
| TypeScript compilation | **PASS** |
| Production build (`tsc` + Vite) | **PASS** |
| Unit suite | **PASS — 95/95** |
| Focused EnvObject/HappyBot hover scenario | **PASS — 1/1**, including the exact 29-tile `nRange=3` radius and functioning/deactivated colours |
| Complete stable Playwright E2E suite | **PASS — 284/284 in 12.3 minutes with two WebGL workers** |
| Diff whitespace validation | **PASS** |

### Live graphics/model continuation — 2026-08-25

| Gate | Result |
|---|---|
| Production build (`tsc` + Vite) | **PASS** |
| Unit suite | **PASS — 95/95** |
| Focused LUT/input/material/suit/HUD/inspector scenarios | **PASS — 7/7**, plus a separate spacesuit-variant rerun |
| Complete stable Playwright E2E suite | **PASS — 286/286 in 8.7 minutes with two WebGL workers** |
| Source spacesuit mapping | **PASS — default, miner, and emergency body/equipment subset tuples match the Lua tables; permanent hand-prop subsets are absent** |
| Source-colour material sweep | **PASS — all tested textured character and prop surfaces use a neutral `#ffffff` multiplier** |
| HUD icon colour capture | **PASS — `#dea400` measured at 1280×720 versus Lua `#dfa200`** |
| In-app browser inspection | **PASS — localhost safety issue resolved; neutral world colour, corrected suit variants, normal click selection, Back controls, and music at 0% verified live** |
| Diff whitespace validation | **PASS** |
