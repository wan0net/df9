# Spacebase DF-9 — Algorithmic Fidelity Audit (Round 2)

> Generated 2026-03-21. Line-by-line comparison of TS algorithms against Lua source.
> Focus: exact formulas, constants, conditional branches — not features but ALGORITHMS.

## Severity Legend

| Tag | Meaning |
|-----|---------|
| **CRITICAL** | Algorithm produces wrong results — gameplay noticeably differs from Lua |
| **HIGH** | Important behavioral difference affecting balance or game feel |
| **MEDIUM** | Subtle difference, may affect edge cases or rare scenarios |
| **LOW** | Cosmetic or negligible difference |

---

## 1. Combat System

| # | Sev | Bug | Detail |
|---|-----|-----|--------|
| CC-1 | CRITICAL | **Damage reduction formula completely wrong** | Lua: `(toughness+armor)/(toughness+armor+2)` (hyperbolic). TS: flat +0.5 for security with ArmorLevel2. Ignores inventory armor entirely. |
| CC-2 | CRITICAL | **TeamTactics defense bonus wrong** | Lua: `count * 0.05` (max +0.25). TS: flat +0.75 if ANY nearby security (3-15x too high). |
| CC-3 | HIGH | **TeamTactics offensive bonus missing** | Lua: attacker deals `1 + count*0.1` multiplier (up to 1.5x). TS: no offensive bonus. |
| CC-4 | HIGH | **50% melee stun IS in Lua** | Was incorrectly removed from TS with comment "not in Lua". Lua line 5604: `math.random() < 0.5` stuns on melee kill. |
| CC-5 | HIGH | **Brawl always stuns** | Lua: brawling partners always get KnockedOut, never killed. TS: brawls can kill. |
| CC-6 | HIGH | **Minor/serious injury on hit missing** | Lua: 75% chance of minor injury malady on any hit; proportional chance of serious injury on big hits. TS: no injury maladies from combat. |
| CC-7 | HIGH | **Dodge ignores inventory armor** | Lua: `dodgeAttackChance` reads equipped armor's `nDodgeChance`. TS: fixed 0.1 for humanoids, 0.3 for monsters. |
| CC-8 | MEDIUM | **Killbots get 30% dodge** | Lua: only RACE_MONSTER gets 30%. TS: all non-breathing races get 30%. |
| CC-9 | LOW | **95% damage reduction cap invented** | Lua has no cap (hyperbolic formula naturally limits). |
| CC-10 | HIGH | **Raider point-buy equipment system missing** | Lua: raiders get armor, weapons, toughness via point-buy based on `nChallengeLevel`. TS: flat HP, default weapon, no armor. |

## 2. Event System

| # | Sev | Bug | Detail |
|---|-----|-----|--------|
| EV-1 | HIGH | **`rollRandomRaiders` is dead code** | TS defines it but `EventController` uses `getScaledRaiderCount/HP` instead. Per-raider challenge levels never used. |
| EV-2 | HIGH | **Raider count scales to 5** | Lua caps at 3 (via `math.random(1,3)`). TS: `1 + floor(diff*4)` = up to 5 at max difficulty. |
| EV-3 | HIGH | **Raider HP is invented formula** | Lua: per-raider point-buy equipment. TS: `100 + floor(diff*50)`. |
| EV-4 | MEDIUM | **BreachingEvent never spawns killbots** | Lua passes `bAllowKillbots=true`. TS has no killbot logic in raider spawning. |
| EV-5 | MEDIUM | **CompoundEvent point deduction per-group not per-raider** | Lua deducts points per individual raider. TS deducts per event type. |
| EV-6 | HIGH | **CompoundEvent bypasses forecast queue** | Lua fires compound through normal event pipeline. TS fires by timer outside pipeline. |
| EV-7 | MEDIUM | **Consecutive event limit off-by-one** | TS `> 3` allows 3; should be Lua's `< 3` allowing 2. |
| EV-8 | MEDIUM | **Population > 0 gate missing** | TS fires events even with 0 citizens. |
| EV-9 | MEDIUM | **No open-space tile validation for immigration spawn** | Lua validates spawn tile is pathable. |

## 3. Oxygen System

| # | Sev | Bug | Detail |
|---|-----|-----|--------|
| OX-1 | CRITICAL | **Breached rooms skip character/fire O2 drain** | Lua drains char/fire O2 THEN returns early from sharing. TS skips the drain entirely for breached rooms. |
| OX-2 | HIGH | **`MIN_O2_FOR_SHARING` scale mismatch** | Value 200 on 0-65535 scale is 0.3% of max. Lua's 200 on 0-1000 scale is 20%. Should be ~13107 in TS. |
| OX-3 | MEDIUM | **`MIN_O2_DIFF` scale mismatch** | Same issue — 10 on 0-65535 vs 0-1000 scale. Should be ~655. |

## 4. Door System

| # | Sev | Bug | Detail |
|---|-----|-----|--------|
| DR-1 | CRITICAL | **Unpowered doors fail-closed** | Lua: unpowered + no vacuum = OPEN (fail-safe). TS: stays CLOSED. Characters get trapped. |
| DR-2 | HIGH | **Vacuum detection ignores O2 level** | Lua `_testLowOxygen` checks `o2 < OXYGEN_SUFFOCATING`. TS only checks breach flag. Low-O2 rooms don't trigger vacuum lock. |
| DR-3 | MEDIUM | **`bIsObstructed` flag missing** | Lua locks doors on pathfinding obstructions. TS has no obstruction check. |
| DR-4 | MEDIUM | **Brig door per-character job exemption missing** | Lua: EMERGENCY/DOCTOR/TECHNICIAN/BUILDER can pass brig doors. TS: no per-character check. |
| DR-5 | MEDIUM | **`refreshLockdown` doesn't preserve sabotage** | Lua checks `_isSabotaged()` first. TS doesn't. |

## 5. Fire System

| # | Sev | Bug | Detail |
|---|-----|-----|--------|
| FR-1 | LOW | **Fire spread loop processes all tiles** | Lua returns entire loop on first spread. TS collects candidates then picks first. Same result (1 spread/tick) but different probability weighting. |
| FR-2 | LOW | **`getNearbyFire` checks active flames only** | Lua checks heat tiles (pre-ignition). TS checks active flames. |

## 6. Malady System

| # | Sev | Bug | Detail |
|---|-----|-----|--------|
| MD-1 | CRITICAL | **`diseaseEncountered` sets research time too high** | Lua: `nResearchCure=0` (immediately curable after encounter). TS: `Math.max(200, severity*1000)`. Makes all diseases require research. |
| MD-2 | CRITICAL | **Air scrubber checks WRONG tile** | Lua: uses SOURCE character's tile. TS: uses TARGET's tile. Protection is backwards. |
| MD-3 | HIGH | **Sneeze timer reset in wrong function** | Lua: reset in `getSymptomAnim`. TS: reset in `playedSymptomAnim`. If anim skipped, TS checks continuously. |
| MD-4 | HIGH | **First sneeze delayed 45-90s** | Lua: `nNextSneezeTime = elapsedTime` (immediate). TS: `nNextSneeze = start + randRange(45,90)`. |
| MD-5 | HIGH | **Stage advancement copies only 5 fields** | Lua: copies ALL fields except `tTimeToSymptoms`. TS: only `tReduceMods, sSpecial, nSpeed, bHidden, sSymptomLog`. |
| MD-6 | HIGH | **Multi-stage advance per tick** | Lua: advances max 1 stage per tick. TS: can advance multiple stages if timers overlap. |
| MD-7 | HIGH | **`getSymptomAnim` returns malady ref** | Lua returns specific malady to spread. TS returns only anim name — spreads ALL sneeze maladies at once. |
| MD-8 | MEDIUM | **ProcSyn immediately symptomatic in Lua** | Lua typo `tTimeToSymptions` means no delay. TS uses correct spelling = 2-5s delay. |
| MD-9 | MEDIUM | **Crazies/SocialWorm lowercase `social` key** | Lua bug: `social=0` never locks Social need. TS: `Social: 0` does lock it. |
| MD-10 | MEDIUM | **SleepyDisease `nSpeed` inside `tReduceMods`** | Lua bug: speed modifier never applied. TS: applied correctly. |
| MD-11 | MEDIUM | **`bStagesLoop` not implemented** | No current disease uses it, but the feature is absent. |
| MD-12 | LOW | **Death special missing disease name** | Lua passes `sDiseaseName` to kill. TS doesn't. |
| MD-13 | LOW | **Integer vs float random in thing/fire specials** | Lua: `math.random(0,100) < 10` (9.9%). TS: `Math.random() < 0.1` (10%). |

---

*Sections 7-9 (Character AI, UI/Audio, Rendering) pending agent completion.*
