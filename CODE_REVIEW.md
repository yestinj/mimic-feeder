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

#### M1 — Asset cache headers risk year-long stale media
- **Where:** `src/_headers` — `/assets/*` → `max-age=31536000`
- **Evidence:** JS is query-cache-busted (`app.min.js?v=…`); assets are **not** fingerprinted.
- **Impact:** Replacing `explode.mp3` or sprites under the same path may leave players on old media until hard refresh / cache expiry.
- **Suggestion:** Shorter asset max-age, `must-revalidate`, or content-hash / query bust for assets.

#### M2 — CDN p5 scripts have no Subresource Integrity
- **Where:** `src/index.html` p5 / p5.sound script tags (currently **1.11.13** in working tree)
- **Impact:** Pinned URL is good; without SRI, CDN compromise or wrong object is not browser-detectable. CSP allows cdnjs.
- **Suggestion:** Add `integrity` + `crossorigin` for exact 1.11.13 builds, or vendor p5 under `src/` and serve from `'self'`.

#### M3 — CSP still allows Cloudflare Web Analytics
- **Where:** `src/_headers` CSP — `static.cloudflareinsights.com` / `cloudflareinsights.com`
- **Impact:** App analytics code is gone, but CF dashboard Web Analytics injection remains permitted.
- **Suggestion:** Drop those origins if zero-analytics is the product goal; confirm CF Web Analytics is off (alongside D1 unbind in `PRE_MERGE_PLAN.md` §7).

#### M4 — High-score / name `localStorage` writes lack try/catch
- **Where:** `src/js/ui.js` `saveHighScores`, `saveLastUsedName` vs guarded `saveAchievements`
- **Impact:** Private mode / quota throws can break name submit / game-over flow.
- **Suggestion:** Same try/catch degrade-to-memory pattern as achievements.

#### M5 — Boss fireball speed scales exponentially
- **Where:** `src/js/objects.js` — `floorSpeedMultiplier = 2^floor((floor-2)/2)` on fireball speed and cooldown
- **Impact:** Later floors become effectively undodgeable; balance/fairness issue more than crash.
- **Suggestion:** Cap multiplier (e.g. 3–4×) or switch to linear/log scaling; separate speed vs fire-rate knobs.

#### M6 — Help/about overlays drop the frozen playfield
- **Where:** `src/js/sketch.js` draw routing — pause freeze only when no help/about/etc.
- **Impact:** Esc while paused shows background + chrome only; live entities disappear until help closes (snapshot returns if still paused). Cosmetic/UX inconsistency.
- **Suggestion:** Draw `lastGameplayFrame` (or capture once) under any overlay opened mid-run/pause.

#### M7 — Returning players skip intro (undocumented)
- **Where:** `src/js/sketch.js` setup — if last used name ≠ `"Player"`, intro skipped
- **Impact:** Onboarding / control reminders may never show for returning players; README assumes intro flow.
- **Suggestion:** Document in README; optional “show intro once per version” or short first-run tip strip.

#### M8 — Test coverage gaps vs highest risks
- **Where:** `scripts/playtest.js`, `scripts/smoke.js`
- **Covered well:** Pause input freeze (happy path), mute while paused, bolt bomb +1 ownership, no `/api/track`, many control/overlay smoke contracts.
- **Gaps:** Resize-while-paused (H1), help under pause (M6), restart/high-score persistence, real bolt→bomb collision (playtest calls collection helper), magnetism, boss fireballs, missing-file build fail (H3).
- **Suggestion:** Playwright case for resize under pause; smoke assert complete `jsFileOrder`; optional magnet/boss probes.

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

#### L2 — Boss body never collides with player
- **Where:** Boss branch in `updateObjects` continues before general collision; fireballs only
- **Impact:** Contact is free. Dead hitbox comments remain.
- **Suggestion:** Document contact-safe boss, or add contact damage and remove dead code.

#### L3 — `collectedCounts.boss` never increments
- **Where:** `objectProperties[OBJ_BOSS].countKey` vs kill path only updating `achievementStats.bossesDefeated`
- **Suggestion:** Increment on defeat or remove unused count key.

#### L4 — Restart does not clear `recentSpawnXPositions`
- **Where:** `src/js/objects.js` module state vs `restartGame`
- **Impact:** Minor spawn clustering memory across runs.
- **Suggestion:** Reset in `restartGame`.

#### L5 — Accessibility limits (expected for canvas game)
- **Positive:** `lang`, noscript, canvas `role`/`aria-label`, keyboard controls, desktop note in README.
- **Gaps:** No live region for score/lives; canvas-drawn hit targets; no `prefers-reduced-motion` for shake.
- **Suggestion:** Optional reduced-motion; ensure canvas focus on start; long-term optional DOM HUD for critical state.

#### L6 — Version / package drift
- **Where:** `GAME_VERSION = "0.1.0-beta"` vs `package.json` `"version": "1.0.0"`
- **Suggestion:** Single source of truth for public version string.

#### L7 — `.DS_Store` not gitignored
- **Where:** `.gitignore` — untracked `.DS_Store` files appear in status
- **Suggestion:** Add `.DS_Store` (and optionally `**/.DS_Store`).

#### L8 — OG image slightly heavy
- **Where:** `src/assets/og-image.png` ~563 KB at 1200×630
- **Suggestion:** Recompress toward ~200–400 KB if share-card weight matters.

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
| CSP | Solid baseline; analytics origins residual (M3) |
| CDN | Pinned version; no SRI (M2) |
| Cache | Long-lived assets (M1) |

---

## Suggested priority order

1. **H1** — Gate simulation on pause (fix resize hole).
2. **H2** — Snapshot on pause edge only (perf + clearer contract).
3. **H3** — Fail build on missing JS modules (+ smoke).
4. **M4** — localStorage try/catch parity for scores/name.
5. **M1 / M2 / M3** — cache + SRI/CSP cleanup as deploy hygiene.
6. **M8** — Playtest resize-under-pause; expand contracts for H1/H3.
7. **M5 / M6 / M7** — Balance and overlay UX polish when convenient.
8. **Lows / nits** — hygiene and docs drift as drive-bys.

---

## Residual follow-ups (not code bugs)

- Manual Cloudflare D1 / analytics dashboard cleanup (`PRE_MERGE_PLAN.md` §7).
- Optional human play pass: audio mute, magnetism, late-floor boss fireballs after any balance change.
- Merge `develop` → `main` when ready (not reviewed as a PR here).

---

## Bottom line

The project is in **good playable-beta shape**: core loop, progression, and recent correctness fixes hang together, and automated gates catch several of the historical footguns. Treat **pause simulation gating**, **`get()` cost**, and **strict build completeness** as the main engineering follow-ups; everything else is polish, balance, deploy hygiene, or a11y/docs drift appropriate for a portfolio hobby game.
