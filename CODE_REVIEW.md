# Mimic Feeder — Full Project Code Review

| Field | Value |
|--------|--------|
| **Date** | 2026-07-09 |
| **Scope** | Full static review of repo as it stands (`src/`, `build.js`, `scripts/`, deploy config, assets) |
| **Branch context** | `develop` @ `60aee26` plus local uncommitted p5 **1.11.13** pin + playtest pause timing fix |
| **Method** | Manual read of game loop, abilities, objects, overlays, storage, build, headers; asset path audit; smoke/playtest contracts; explore pass |
| **Out of scope** | `node_modules/`, generated `dist/` / `docs/`, historical `archive/` contents (except as context) |

---

## Summary

Mimic Feeder is a **playable, coherent p5.js arcade game** with a clear static deploy model, solid recent correctness work (pause freeze, bomb ownership, analytics removal, smoke/playtest), and documentation that largely matches the code (`AGENTS.md`, README). Architecture is intentional global-script style for a hobby portfolio project—not a liability if load order stays disciplined.

No critical security issues (XSS/RCE) for a canvas-only client. The highest practical risks are:

1. **Pause correctness hole after resize** (sim can run while “paused”)
2. **Per-frame full-canvas `get()`** cost for pause snapshots
3. **Build can succeed with missing JS modules** (warn-only)

Assets are in good shape (static path refs resolve; `_unused/` quarantined). Deploy hardening is good baseline CSP/headers with a few cache/CDN/CSP cleanups remaining.

---

## Strengths

1. **Ownership contracts** — Bomb counts via `handleBombCollection`, playTime from frame delta (not wall clock), pause freeze via `lastGameplayFrame`, analytics fully removed; many of these are **smoke- and playtest-enforced**.
2. **Frame-rate independence** — `getFrameDelta` / `getDeltaSeconds` used consistently across movement, cooldowns, spawns, projectiles.
3. **Static-only Cloudflare Pages** — `wrangler.toml` matches product intent; no Functions/D1 in tree.
4. **UX systems** — Center notification queue; adaptive overlays + min-viewport fallback; magnetism snapshot contract documented in help.
5. **Restart path** — Reloads achievements after `initializeStates` (order smoke-checked).
6. **Build markers** — `BUILD:GAME_SCRIPTS_*` primary path for HTML script injection.
7. **Security posture for the domain** — Canvas text for names (alphanumeric filter), no `innerHTML` of user data, path-safe playtest static server, nosniff / DENY frame / referrer policy.
8. **Agent orientation** — `AGENTS.md` accurately describes globals, load order, and guardrails.

---

## Findings

Severity: **High** / **Medium** / **Low** / **Nit**. Status all **open** unless noted.

### High

#### H1 — Pause can fully simulate after window resize — **Fixed (2026-07-09)**
- **Where:** `src/js/sketch.js` (`isPauseGameplayShell`, pause early-return always; `windowResized` keeps snapshot while paused)
- **Was:** Resize cleared `lastGameplayFrame`; pause early-return required a snapshot; fall-through ran full sim under pause UI.
- **Now:** Pause shell always returns without simulation (snapshot or static fallback). Resize does not clear freeze snapshot while paused. Smoke + playtest cover resize-under-pause.

#### H2 — Full-canvas `get()` every active gameplay frame — **Fixed (2026-07-09)**
- **Where:** `src/js/sketch.js` — `captureGameplayFreezeSnapshot()` on P rising edge only
- **Was:** `lastGameplayFrame = get()` at the end of every active gameplay frame.
- **Now:** Snapshot captured once when pause starts (canvas still holds last gameplay draw); `draw()` no longer calls `get()` each frame. Smoke enforces capture-on-edge and no per-frame get in `draw`.

#### H3 — Build continues if a source JS file is missing — **Fixed (2026-07-09)**
- **Where:** `build.js` — `JS_FILE_ORDER` + `assertJsBundleSourcesComplete`
- **Was:** Missing files in the concat list logged a warning and were skipped; build still succeeded.
- **Now:** Build fails on missing modules, unreadable files, duplicates, or orphan `src/js/*.js` not in `JS_FILE_ORDER`. Smoke asserts order matches disk and `src/index.html` BUILD markers.

---

### Medium

#### M1 — Asset cache headers risk year-long stale media — **Fixed (2026-07-09)**
- **Where:** `src/_headers` — `/assets/*`
- **Was:** `max-age=31536000` on unversioned asset paths (stale sprites/SFX after in-place deploys).
- **Now:** `public, max-age=86400, must-revalidate` (1 day). `app.min.js` still uses long cache + `?v=` bust.

#### M2 — CDN p5 scripts have no Subresource Integrity — **Fixed (2026-07-09)**
- **Where:** `src/index.html` p5 + p5.sound script tags
- **Now:** Pinned **1.11.13** on cdnjs with `integrity` (sha384 of those exact cdnjs builds) + `crossorigin="anonymous"`. Recompute hashes when bumping p5; cdnjs and jsDelivr builds can differ by a few bytes — hash must match the CDN URL used.

#### M3 — CSP still allows Cloudflare Web Analytics — **Won’t fix (intentional)**
- **Where:** `src/_headers` CSP — `static.cloudflareinsights.com` / `cloudflareinsights.com`
- **Decision (2026-07-09):** Keep the Insights allowlist. Cloudflare Web Analytics is desired; only the old in-app / D1 track pipeline was removed.
- **Note:** Configure Web Analytics in the CF dashboard as intended (separate from removed app metrics / D1).

#### M4 — High-score / name `localStorage` writes lack try/catch — **Fixed (2026-07-09)**
- **Where:** `src/js/ui.js` `saveHighScores`, `saveLastUsedName`, `loadHighScores`, `loadLastUsedName`
- **Was:** Score/name `setItem` (and reads) could throw and break game-over submit / setup.
- **Now:** try/catch on read and write; in-memory high scores and `lastUsedName` still update for the session. Smoke covers save/load guards.

#### M5 — Boss fireball speed scales exponentially — **Fixed (2026-07-09, 4× cap)**
- **Where:** `getBossFloorSpeedMultiplier()` in `constants.js`; used for boss move speed, fireball speed, and fireball cooldown
- **Was:** Uncapped `2^floor((floor-2)/2)` → 8×/16×… undodgeable late bosses
- **Now:** Same curve but **clamped to 4×** (reached at floor 6+). Boss HP still gains +2 lives per even-floor spawn; drop speed / spawn rate keep scaling with game level.

#### M6 — Help/about overlays drop the frozen playfield — **Fixed (2026-07-09)**
- **Where:** `src/js/sketch.js` — `isMidRunInfoOverlay`, `drawPlayfieldUnderlay`, `ensureGameplayFreezeSnapshotForOverlay`
- **Was:** Esc/K mid-run (or while paused) drew help/etc. on bare dungeon background only.
- **Now:** Mid-run info overlays sit on the freeze snapshot (captured on open from active play, or kept from pause edge). Simulation still does not run while overlays are open.

#### M7 — Returning players skip intro (undocumented) — **Fixed (2026-07-09, docs only)**
- **Where:** Behavior in `sketch.js` setup; docs in `README.md`, About copy
- **Behavior (unchanged):** Saved last-used name (not default `"Player"`) skips intro on first page load.
- **Docs:** README “First visit vs returning players” + common issue; About notes Esc for help.

#### M8 — Test coverage gaps vs highest risks — **Mostly addressed (2026-07-09 status refresh)**
- **Where:** `scripts/playtest.js`, `scripts/smoke.js` (~90+ smoke contracts + Brave Playwright harness)

**Now covered (was listed as gaps in the original review):**
| Area | How |
|------|-----|
| Pause freezes input / playTime | Playtest + smoke (pause shell before sim) |
| Resize while paused (H1) | Playtest: viewport resize; snapshot kept; X/playTime frozen |
| Pause snapshot not every frame (H2) | Smoke: capture on P edge; no `get()` in `draw` body |
| Missing / orphan JS modules (H3) | `assertJsBundleSourcesComplete` + smoke: `JS_FILE_ORDER` ↔ disk ↔ HTML markers |
| Bomb single-owner / bolt path | Smoke + playtest helper `handleBombCollection` +1 |
| No analytics track | Smoke + playtest: no `/api/track` |
| Mid-run overlay underlay (M6) | Smoke: underlay helpers + open paths |
| Storage try/catch (M4) | Smoke: high scores / name / achievements |
| Boss speed cap (M5) | Smoke: shared capped multiplier |
| p5 SRI (M2) | Smoke: integrity + crossorigin |
| Reduced motion (L5 partial) | Smoke: shake gated |

**Still optional / not automated (fine for post-merge):**
- Playwright path that **opens Esc help while paused** and asserts underlay (visual/M6 integration)
- **True** bolt→bomb collision via gameplay (playtest still calls collection helper)
- Magnetism snapshot contract (help text smoke only)
- Boss fireball / late-floor balance feel
- Restart + high-score persistence E2E in browser
- Manual play pass remains the main gate for “fun and feel”

**Decision:** Do **not** expand the harness further pre-merge unless a regression appears. Smoke + playtest already protect the high-risk contracts from this review pass.

#### M9 — Large first-load preload
- **Where:** `src/js/assets.js` — many animation frame sets + dual BGM
- **Impact:** Desktop portfolio OK; slow networks / low-end devices pay full cost before play.
- **Suggestion:** Defer boss/late-floor packs; compress sprites; optional progress UI beyond p5 default.

---

### Low

#### L1 — Hazard “detonate” achievement counts ground misses
- **Where:** Ground bomb/fireball handling + `getHazardDetonations` / related achievements
- **Impact:** Progress without intentional player action; may be intentional ease, slightly misleading copy.
- **Suggestion:** Split hit vs neutralized if design wants skill-based progress.

#### L2 — Boss body never collides with player — **Fixed (2026-07-09, intentional + docs)**
- **Where:** `objects.js` boss branch `continue` before player collision; help copy
- **Behavior (unchanged):** Contact-safe by design; only boss fireballs damage. Comment + Help screen document this.

#### L3 — `collectedCounts.boss` never increments — **Fixed (2026-07-09, dropped)**
- **Where:** `constants.js` / `initializeStates` collectedCounts
- **Decision:** Unused — game-over item breakdown never showed bosses; achievements use `achievementStats.bossesDefeated`. Removed dead `countKey` and `collectedCounts.boss` field rather than dual-tracking.

#### L4 — Restart does not clear `recentSpawnXPositions` — **Fixed (2026-07-09)**
- **Where:** `restartGame` in `sketch.js` clears `recentSpawnXPositions` (module state from `objects.js`)
- **Was:** Spawn anti-clustering history carried across runs.
- **Now:** Array reset on restart; smoke asserts the clear.

#### L5 — Accessibility limits (expected for canvas game) — **Partial (2026-07-09)**
- **Positive:** `lang`, noscript, canvas `role`/`aria-label`, keyboard controls, desktop note in README.
- **Done:** `prefers-reduced-motion: reduce` disables screen shake (`prefersReducedMotion` / `triggerScreenShake`).
- **Won’t do for now:** canvas auto-focus on start; real HTML buttons for retry/name; live regions / DOM HUD — not worth pre-merge effort for this canvas portfolio game.

#### L6 — Version / package drift — **Fixed (2026-07-09)**
- **Where:** `constants.js` `GAME_VERSION`, `package.json` `version`
- **Now:** Both **`1.0.0-beta`**. Smoke asserts the shared string.

#### L7 — `.DS_Store` not gitignored — **Fixed (2026-07-09)**
- **Where:** `.gitignore`
- **Now:** `.DS_Store` ignored.

#### L8 — OG image slightly heavy — **Fixed (2026-07-09)**
- **Where:** `src/assets/og-image.png`
- **Was:** ~563–577 KB RGB PNG at 1200×630
- **Now:** ~132 KB palette PNG (pngquant quality 65–80), same dimensions; meta URLs unchanged.

---

### Nits

- `soundMap['bling']` alias → `castSpellSound` is opaque but works for crown/diamond spawn cue.
- Smoke is regex-heavy (good regression net; brittle on pure formatting refactors).
- `PRE_MERGE_PLAN.md` is correctly “active” for CF dashboard follow-up; code items Done.

---

## Assets

| Check | Result |
|--------|--------|
| Static path strings in JS/HTML | Resolve under `src/assets/` (0 missing static refs) |
| Frame sequences | Loaded via path templates in `assets.js` (bomb_explosion, boss, fireball sets, etc.) |
| `_unused/` quarantine | Present (~112 files); build skips; smoke asserts no runtime refs to known quarantined packs |
| HTML-only | `favicon.ico`, `og-image.png` referenced |
| Active asset count | ~200 files under non-`_unused` tree |

No urgent asset integrity issues. Optional later: defer late-game packs (M9), recompress OG (L8).

---

## Build & tooling

| Item | Assessment |
|------|------------|
| `build.js` | Concat order → esbuild minify → HTML markers → CSS → assets → optional `_headers` |
| Missing JS files | **Warn-only (H3)** |
| Minifiers | esbuild + clean-css + html-minifier-terser — appropriate |
| Scripts | `lint` / `smoke` / `test` / `playtest` (Brave) — valuable; extend for H1/H3 |
| p5 | 1.11.13 CDN (local uncommitted at review time); stay off 2.x without a dedicated project |

---

## Security (brief)

| Topic | Assessment |
|--------|------------|
| XSS | Low risk — names filtered; drawn with p5 `text` |
| Secrets | No app secrets in client; `.dev.vars` gitignored |
| CSP | Solid baseline; CF Web Analytics origins intentional (M3) |
| CDN | Pinned 1.11.13 + SRI (M2) |
| Cache | `app.min.js` long + `?v=`; assets 1 day + must-revalidate (M1) |

---

## Suggested priority order (historical — mostly complete)

Original engineering order (H1 → H3 → M4 → deploy hygiene → polish) was executed across the 2026-07-09 pass. Remaining optional items: **L1** (design), **M9** (preload if boot hurts), deeper playtest cases under M8 “optional.”

---

## Residual follow-ups (not blocking automated review work)

- Manual Cloudflare D1 unbind if still bound (`PRE_MERGE_PLAN.md` §7).
- Human playtest: mute, magnetism, late-floor boss feel (4× cap), general fun.
- Merge `develop` → `main` when ready.

---

## Bottom line

The project is in **good playable-beta shape**. High-risk items from this review (pause correctness, per-frame `get()`, fail-closed bundle, storage, overlays, boss speed cliff, SRI, reduced motion, deploy asset cache) are addressed. What remains is optional design (L1), optional preload work (M9), manual CF cleanup, and a human play pass before merge.
