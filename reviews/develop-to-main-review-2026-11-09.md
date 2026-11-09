# Code review: `develop` → `main` (PR #2)

Independent review of the full `develop` branch as it will merge into `main`. It is written to be acted on without access to the conversation that produced it.

> **Status update (2026-11-09, after fixes).** The review below was performed at `a0bb76d`. Every finding has since been resolved or decided by the owner, in these commits on `develop`:
>
> | Item | Resolution | Commit(s) |
> |---|---|---|
> | M-1 overlays hidden on laptop viewports | Fixed | `f86e4e9` |
> | M-2 blocking preload doubled | Fixed (deferred loading + compression) | `5c349f9`, `064ed73` |
> | L-1 mute cleared on retry | Fixed | `203b0e0` |
> | L-2 implicit globals | Fixed | `faebfca` |
> | L-3 dead `masterVolume` call | Fixed | `eda05a0` |
> | P-1 duplicate `Cache-Control` | Fixed; confirm on Pages preview | `f9e9d4c` |
> | P-2 double image fetch (p5) | Accepted | — |
> | P-3 no SRI on p5 CDN | Accepted for now | — |
> | Minor: staff re-offer pacing | Changed at owner's request | `cb18c39` |
> | Minor: banners over the Judgment | Fixed | `ff635fd` |
> | Minor: voice cut on pause; high-score time semantics | Accepted | — |
>
> After each fix: `npm test` and `npm run playtest` pass, plus targeted browser verification as described per item. See **Merge-readiness** at the end for the current recommendation.

## Scope

| Field | Value |
|---|---|
| Date | 2026-11-09 |
| PR | https://github.com/yestinj/mimic-feeder/pull/2 ("Merge develop"), open, `MERGEABLE`, Cloudflare Pages preview check passing |
| Base | `main` @ `bcbde2ac65d2667b6ee74eb603d9c87a2bdf03b5` |
| Head | `develop` @ `a0bb76d7412f55d68438bdc28a98b46748e28c3e` |
| Merge base | `bcbde2ac65d2667b6ee74eb603d9c87a2bdf03b5` (`main` is an ancestor of `develop`, so the merge is a fast-forward-equivalent with no conflicts) |
| Commits | 53 (2026-02-11 → 2026-11-09) |
| Diff | 165 files, about +6.9k / −1.7k. Game JS: 15 files, +3655 / −1397, plus the new `src/js/judgment.js`. The remainder is assets, docs, `build.js`, `scripts/`, `_headers` and `wrangler.toml`. |
| Reviewed | Every changed game file under `src/js/` (diff and surrounding code), `build.js`, `src/index.html`, `src/_headers`, `wrangler.toml`, `package.json`, `scripts/*.js`, and the asset changes (sizes and references). |
| Not reviewed line-by-line | Pure layout/drawing code in the rewritten screens (`gameOverScreen.js`, `introScreen.js`, `aboutScreen.js`, the bodies of `helpScreen.js` and `objectInfoScreen.js`). These were checked by rendering in a browser instead. Historical docs under `archive/` were also skipped. |

## Summary of the change

`develop` turns the February `main` (an early alpha) into the current beta:

- **Frame-rate independence.** Movement, timers, animations, spawns and cooldowns use `getFrameDelta()` / `getDeltaSeconds()` (`src/js/constants.js:36-50`, clamped at 2.5 frames). On `main` most of these were per-frame, so the game ran faster on high-refresh displays.
- **New controls and states.** Pause (P), with a frozen playfield snapshot. Mute (M). Achievements moved from `a` to K. Tentacles and magnetism moved from 1/2 to Z/X. A/D movement and dash added.
- **Audio rework.** Audio starts only after a user gesture (`startAudioIfNeeded`). Every `playSound` call is gated on mute, pause and overlays. Music is exclusive (`playExclusiveMusic`). New boss music and a death cue.
- **Progression.** Ten per-floor backgrounds. Cats from Floor 2. The staff stays eligible until collected, and is granted at a boss if it is missing. The boss floor speed multiplier is capped at 4×. Level-ups use a `while` loop.
- **Ninefold Judgment** (`src/js/judgment.js`). Ten deliberate Shadow Bolt cat kills trigger a one-time, nine-wave meteor event that suspends the world and restores it afterwards.
- **UI.** Queued centre notifications replace the ad-hoc notification globals. HUD panels. Adaptive overlay layouts with a minimum-viewport fallback. Tiered achievements, expanded to 32.
- **Hardening.** `localStorage` access wrapped in try/catch. The build fails closed if `JS_FILE_ORDER` and `src/js/*.js` disagree. The p5 CDN moved from 1.9.4 to 1.11.13, without SRI by design.
- **Tooling.** `npm test` runs a syntax lint (`node --check`), the build, and 123 regex smoke contracts. `npm run playtest` runs 64 Playwright checks in system Brave. The analytics, D1 and Pages Functions pipeline was added and then fully removed within the branch.

**Overall assessment:** the branch is coherent and well structured for its global-script architecture, and it is a large improvement on `main`. The riskiest new logic is pause/overlay freezing, the audio-start state machine, and the Judgment's suspend/restore cycle. All three behaved correctly under targeted browser tests. No Critical or High issues were found. Two Medium regressions are user-facing and cheap to fix (one is a one-line change). Three Low issues are minor.

## Findings

Severity counts: **Critical 0 · High 0 · Medium 2 · Low 3**. All five are confirmed by reproduction, and all five are now fixed (see the status notes). Pre-existing issues and observations are listed separately and are not counted.

### Medium

#### M-1 — Help, Object Info and About are unavailable on common laptop viewports (regression)

> **Status: Fixed in `f86e4e9`.**
> - **Change:** removed the hard pre-checks from Help, Object Info, About and the intro. Each screen now relies on `computeAdaptiveOverlayLayout`'s `null` fallback. Also dropped the misleading "Minimum canvas" line from the fallback notice, the unused `isOverlayViewportSupported()`, and `MIN_OVERLAY_VIEWPORT_*`.
> - **Verification:** all five overlays render content at 1280×800, 1366×625, 1280×610 and 1024×600. At 640×480, Help and Object Info show the notice, while the intro, About and Achievements render. No page errors. `npm test` and `npm run playtest` pass.

- **Where:**
  - `src/js/utils.js:17`: `isOverlayViewportSupported()` defaults to `MIN_OVERLAY_VIEWPORT_WIDTH` × `MIN_OVERLAY_VIEWPORT_HEIGHT` = **840 × 630** (`src/js/constants.js:257-259`).
  - Hard early returns at `src/js/helpScreen.js:6`, `src/js/objectInfoScreen.js:6` and `src/js/aboutScreen.js:6`. The intro uses a 760 × 560 gate (`src/js/introScreen.js:16`).
- **What happens:** the canvas is fitted to the window at 4:3, so any viewport shorter than 630 px or narrower than 840 px gets a canvas below the threshold. Esc then shows only "Resize window for full overlay view. Minimum canvas: 840 x 630". Help, Object Info and About cannot be read at all.
- **Trigger:** viewports such as 1280 × 610 (a 1920 × 1080 laptop at the default 150% Windows scaling, minus browser chrome) or 1366 × 625 (a 1366 × 768 screen with a bookmarks bar).
- **Impact:**
  - Players on common laptop setups lose all in-game documentation. That includes the controls, the ability unlocks, and the new magnetism and contact-safe boss explanations. Help is the only place some of those are explained, and README points players to "Esc for controls anytime".
  - On `main`, the same viewports render the full help (slightly clipped).
- **Evidence:**
  - At 1366 × 625 (canvas 833 × 625) and 1280 × 610 (canvas 813 × 610), `develop` shows the warning. `main` at 1366 × 625 shows the full help text. At 1366 × 657 (canvas 876 × 657) `develop` renders normally.
  - In the test page only, I overrode `isOverlayViewportSupported` to return `true`. `develop`'s own `computeAdaptiveOverlayLayout` then rendered the complete help at 813 × 610 with no clipping. The hard pre-check is stricter than the adaptive layout it guards, which already returns `null` and shows the same warning when content cannot fit at `minScale`.
- **Confidence:** high.
- **Suggested resolution:** remove the hard pre-check in the three screens and rely on the existing `computeAdaptiveOverlayLayout(...) === null` fallback. Alternatively, lower the defaults (for example to about 640 × 480) after checking Object Info and About at those sizes.

#### M-2 — Blocking preload roughly doubles first-load time (regression)

> **Status: Fixed in `5c349f9` (deferred loading) and `064ed73` (compression).**
> - **`5c349f9`:** `preload()` now fetches only Floor 1 assets. `loadDeferredAssets()`, called from `setup()` before `setupSoundMap()`, loads the Floor 2–10 backgrounds, Floor 3+ and boss music, and the apparition in the background. `drawDungeonBackground()` reuses the closest earlier loaded floor until a later one arrives. New smoke contracts pin this.
> - **`064ed73`:**
>   - Backgrounds: JPEG → WebP q90 (4.2 → 2.0 MB, SSIM 0.981–0.988).
>   - Apparition: PNG → WebP q85 with lossless alpha (1.8 MB → 115 KB).
>   - `background2.mp3` and ten SFX: 256 → 128 kbps (6.8 → 3.4 MB). Onset is unchanged, with no loop gap.
>
>   Quality was approved by the owner after A/B comparison.
> - **Result** (10 Mbps / 40 ms, cache disabled):
>   - Before first screen: 17.5 MB → 2.67 MB.
>   - Time to first screen: 21.3 s → 4.65 s (`main`: 9.9 s).
>   - All deferred assets loaded by 12.9 s.
>   - `dist/assets`: 20 MB → 13 MB.

- **Where:** `src/js/assets.js` `preload()`, specifically:
  - `:120`: all 10 floor backgrounds.
  - `:121`: `ninefold_judgment.png`, 1.78 MB.
  - `:223`: `assets/music/boss.mp3`, 2.62 MB.
  - Plus new SFX at `:213-218`.
- **What happens:** p5 holds `setup()` (and the intro screen) until every `preload()` asset has downloaded and decoded. `develop` adds assets that are only needed later or rarely:
  - Backgrounds for Floors 2–10.
  - The boss track, first needed at the Floor 2 boss.
  - The Judgment apparition, needed only after 10 deliberate cat kills.
- **Impact:** first-time visitors wait about twice as long on a black "Loading..." page before seeing anything. The cost scales linearly with bandwidth.
- **Evidence (headless Brave, local static server, unique bytes per URL, game origin only):**

  | Build | Unique preload | Music | Background images | Judgment PNG | Theoretical at 10 Mbps | Measured time-to-ready, 10 Mbps / 40 ms, cache disabled |
  |---|---|---|---|---|---|---|
  | `main` | 8.81 MB | 7.22 MB | 0.15 MB | — | 7.4 s | 9.9 s |
  | `develop` | 17.53 MB | 9.84 MB | about 4.15 MB | 1.78 MB | 14.7 s | 21.3 s |

  Of the +8.7 MB, only `upper-dungeon.jpg` (0.38 MB) is needed for Floor 1. Time-to-ready without throttling is about 1 s for both builds.
- **Confidence:** high for the measurement. The impact depends on visitors' bandwidth.
- **Suggested resolution:** keep only the Floor 1 background, core sprites, SFX and Floor 1 music in `preload()`. Load the remaining backgrounds, `boss.mp3` and `ninefold_judgment.png` lazily after `setup()` with `loadImage` / `loadSound` callbacks. Every consumer already null-checks: `drawDungeonBackground` falls back to `background()`, `drawNinefoldApparition` checks `.width`, and `playExclusiveMusic` checks `isLoaded()`. Recompressing `ninefold_judgment.png` (a 1.78 MB PNG) is also worthwhile. The 6.2 MB `background2.mp3` is pre-existing.

### Low

#### L-1 — Mute is silently cleared when the player retries

> **Status: Fixed in `203b0e0`.**
> - **Change:** `restartGame()` saves `isMuted` before `initializeStates()` and restores it afterwards. Mute is kept for the session; it is deliberately not persisted between visits. A smoke contract pins the order.
> - **Verification:** in the browser, muting, dying and retrying stays silent, and M restores the music. An unmuted player still gets music after a retry.

- **Where:** `src/js/sketch.js:47` (`isMuted: false` inside `initializeStates`), called from `restartGame()` at `src/js/sketch.js:1068`.
- **What happens:** M sets `gameState.isMuted`. Retrying after a game over calls `initializeStates()`, which recreates `gameState` with `isMuted: false`. The next `draw()` sees the silenced-to-audible transition and restarts music.
- **Impact:** a player who muted the game gets audio back on every retry and has to press M again. Mute is new on `develop`; `main` has no mute.
- **Evidence:** in the browser, I muted during play, forced a game over, submitted a name and pressed Enter to retry. The result was `isMuted: false`, with `background_music1` playing.
- **Confidence:** high.
- **Suggested resolution:** carry `isMuted` across `restartGame()`, as is done for `lastUsedName`. Optionally persist it in `localStorage` alongside the other preferences.

#### L-2 — Help and Object Info leak four implicit globals (regression)

> **Status: Fixed in `faebfca`.**
> - **Change:** both destructurings now use `let`, matching the other screens.
> - **Verification:** after opening Help, Object Info and About, no `overlay*` properties are on `window`, and all three still render content. The ESLint `no-undef` scan reports only L-3.

- **Where:** `src/js/helpScreen.js:138` and `src/js/objectInfoScreen.js:103`: `({ overlayWidth, overlayHeight, overlayX, overlayY } = layout);` with no `let` / `const`.
- **What happens:** in sloppy-mode classic scripts this creates `window.overlayX`, `overlayY`, `overlayWidth` and `overlayHeight`, which both screens share. `aboutScreen.js:103`, `introScreen.js:137` and `achievements.js:459` correctly use `let`. On `main` these were `let` locals.
- **Impact:** nothing visible today. It adds hidden shared mutable state between screens, and it would throw `ReferenceError` if the bundle ever runs in strict mode (for example, if it is converted to ES modules).
- **Evidence:**
  - ESLint `no-undef`, run over the shipped concatenation with the live page's globals as allowed globals, reports exactly these two sites. It is the only real `no-undef` result besides L-3.
  - In the browser, none of the four names are on `window` before Esc, and all four are after Esc. On `main`, there are none either way.
- **Confidence:** high.
- **Suggested resolution:** use `let { overlayWidth, overlayHeight, overlayX, overlayY } = layout;`, matching the other screens.

#### L-3 — `masterVolume` does not exist in p5.sound 1.11.13; the intended master mute never runs

> **Status: Fixed in `eda05a0`.**
> - **Change:** `syncGameAudioState()` now calls `outputVolume(...)`, so the master gain backs up the per-call gating. A smoke contract was added.
> - **Verification:** an `AnalyserNode` on the master output measured gain 0 and RMS 0 while muted, paused or with Help open, even for a direct `jumpSound.play()` that bypasses `playSound()`. Gain returned to 1, with audible music, after unsilencing. The ESLint `no-undef` scan is now clean.

- **Where:** `src/js/sketch.js:232-233`: `if (typeof masterVolume === 'function') masterVolume(shouldSilence ? 0 : 1);`.
- **What happens:**
  - p5.sound renamed `masterVolume` to `outputVolume`. On the running page, `outputVolume` is defined and `masterVolume` is not, so the guarded call is dead code.
  - Silencing works only because every playback path is gated separately: `playSound` checks mute, pause and overlays, `stopAllSounds` runs on the transition, and `updateBackgroundMusic` returns early. The only direct `.loop()` is inside `playExclusiveMusic`, which is reached only through `updateBackgroundMusic`.
- **Impact:** no user-visible bug today; this was verified. The live gain is never forced to 0 on mute, so any future direct `.play()` that bypasses `playSound` would be audible while muted.
- **Evidence:** a live-page globals probe found `outputVolume: true` and `masterVolume: false`. The mute test let music start, pressed M, played on for 3 s with jumps (12 samples), checked that nothing was playing, then unmuted and confirmed music resumed.
- **Confidence:** high.
- **Suggested resolution:** call `outputVolume(...)`, or remove the block and document that `playSound` is the single gate.

## Pre-existing issues (present on `main`; not regressions)

- **P-1: `_headers` rules are concatenated, so `Cache-Control` gets two `max-age` values.**
  - Cloudflare Pages appends the `/*` block (`src/_headers:9-14`) to the specific `/app.min.js` and `/assets/*` blocks. On the PR preview (`https://4a585524.mimic-feeder.pages.dev`):
    - `/app.min.js` → `public, max-age=31536000, public, max-age=3600`.
    - `/assets/*` → `public, max-age=86400, must-revalidate, public, max-age=3600`.
  - RFC 9111 leaves duplicate directives to cache discretion: the first one may be used, or the response treated as stale. The production custom domain currently returns `public, max-age=14400` for these paths, which appears to be a zone-level Browser Cache TTL override. The `/assets/*` change on `develop` (1-day revalidate) therefore does not do what its comment says.
  - Fix: move `Cache-Control` out of `/*` into explicit path rules (for example `/` and `/index.html`), or use `! Cache-Control` detach syntax so each path has a single policy.
  - **Status: Fixed in `f9e9d4c`.** `Cache-Control` was removed from `/*`, and explicit `/`, `/index.html` and `/styles.css` rules were added. The security headers are unchanged. A simulation of the documented rule-matching gives one value per path. **Still to confirm** with `curl -sI` on the next Pages preview deploy; there is no local emulator.
- **P-2: p5 1.x `loadImage` issues two requests per image** (a `fetch`, then the `<img>` load). This is library behaviour in both builds. It is harmless when HTTP caching works, but doubles image bandwidth when it doesn't. **Decision: accepted as-is** (owner, 2026-11-09). Avoiding it would need a custom image loader, and P-1 makes caching more reliable.
- **P-3: The p5 CDN scripts have no SRI.** `main` (1.9.4) has none either. `develop` deliberately keeps it that way (`AGENTS.md`, README, and a smoke contract) because cdnjs bytes changed under fixed URLs. This is an accepted supply-chain risk, mitigated by an exact version pin and the CSP. **Decision: risk accepted for now** (owner, 2026-11-09). Self-hosting p5 is a low-priority future investigation; the concern is keeping p5 easy to update without manual vendoring steps.

## Things checked that are working correctly

These were the riskier areas, and each was validated rather than assumed:

- **Pause / overlay freeze:**
  - Simulation does not run while paused, including after a resize.
  - P / M / Esc / K work while paused. Movement, jumps and abilities are blocked.
  - The snapshot is captured only on the pause rising edge.
  - These are covered by the playtest at the PR head and by code tracing in `sketch.js` `draw()` / `keyPressed()`.
- **Audio start:**
  - No AudioContext autoplay warnings occur.
  - Music starts after the first gesture, even when a returning player skips the intro.
  - `restartGame()` re-confirms the running context.
- **Ninefold Judgment (end to end, with real inputs):**
  - A real Space-key Shadow Bolt into a cat increments `shadowBoltCatsDestroyed`.
  - A real 10th kill suspends exactly the on-screen objects. Pause freezes `phaseTimer`.
  - After the encounter, the same objects are restored, floor music resumes, and spawning restarts.
  - An 11th kill does not re-trigger it.
  - No page errors occurred.
- **Judgment fairness:**
  - Method: a bot learns the opening only when that wave's meteors become visible, waits a reaction delay, then moves at the mimic's real speed (dash allowed).
  - Results: it took **0 hits across all 9 waves** in every configuration: 1067×800, 1440×1080 and 813×610 canvases; player level 1 and level 5; reaction 0 ms and 250 ms. Frame delta averaged 1.0.
  - Control: a stationary player takes exactly 1 hit per wave (9 in total), which confirms the hit counter and the 45-frame damage cooldown work.
  - Conclusion: the event is harsh by design, but survivable at the sizes tested.
- **Data compatibility with production `localStorage`:**
  - The high-score schema is unchanged from `main`.
  - All 10 of `main`'s achievement IDs still exist, so stored unlocks carry over.
  - Malformed or denied storage is handled; this is covered by the playtest.
- **CSP:** a first-visit session under the exact `/*` headers from `_headers` produced no CSP violations, console errors or failed requests. The session covered intro, movement, jump, audio, game over, name entry, high-score persistence and retry.
- **Deploy config:**
  - `wrangler.toml` declares no bindings. The Cloudflare Pages preview build of `a0bb76d` succeeded.
  - Production uses the same `_headers` structure as today (production already serves the CSP).
- **Build:** `JS_FILE_ORDER` matches `src/js/*.js` and the HTML markers. The build fails closed on drift.

## Minor observations (no action required)

- Pausing or opening an overlay during the Judgment's summoning stops the dungeon voice line (`stopAllSounds` → `stopDungeonVoice`), and it does not resume. The story cue is lost if the player pauses at that moment. **Decision: leave as-is** (owner, 2026-11-09). The same message is shown on screen, and the window is rare.
- High-score `playTime` now records active play time. On `main` it recorded wall-clock time since start, so old and new entries in the same table measure different things. **Decision: leave as-is** (owner, 2026-11-09). It is display only, ranking is by score, and old entries age out of the top 5.
- From Floor 2 Zone 1, the staff takes priority over every spawn tick until it is collected. This is intentional (commit `470abd8`, playtest contract), and a boss also grants it. **Changed in `cb18c39`** (owner's request): the first offer is still immediate, but re-offers after a miss now have a 0.2 chance per spawn tick instead of happening every tick. The boss guarantee is unchanged. A seeded playtest measures a re-offer rate of 0.21. Play-feel is to be checked in the combined manual test.
- The PR description ("Many new improvements, metrics, and changes.") is stale: metrics were removed. Consider rewriting it before merge. **Decision:** rewrite it with an accurate summary after the final push (approved by the owner).
- Centre notifications are not suppressed during the Judgment. An achievement unlocked mid-encounter (for example a play-time one) draws its panel over the summoning or attack text. This was seen while verifying M-2, using a forced floor change. **Fixed in `ff635fd`.** Notifications are now held (neither drawn nor timed) during the Judgment and shown afterwards. The encounter no longer discards the queue, except for a still-queued five-kill warning, which it supersedes. Covered by the playtest and smoke tests, and checked visually.

## Tests and validation performed

All results are at head `a0bb76d` unless noted. Browser runs used headless system Brave via Playwright 1.61.1 (no Playwright browser download), Node 26.13.0 and npm 11.20.0, on macOS.

| Check | Command / method | Result |
|---|---|---|
| Syntax lint | `npm test` → `node scripts/lint.js` | Pass (20 files) |
| Build | `npm run build` | Pass (16 modules) |
| Smoke contracts | `npm run smoke` | Pass (123 contracts) |
| Browser playtest | `npm run build && npm run playtest` | Pass (64 checks, about 17 s) |
| Static scan | ESLint 9.39.1 (scratch install, not in repo): `no-undef`, `no-redeclare`, `no-unused-vars`, `no-fallthrough` and others, over the 16 files concatenated in `JS_FILE_ORDER`, with allowed globals taken from the live page (2,033 names). Also run over `build.js` and `scripts/*.js`. | Only real issues: L-2 and L-3. The 7 "unused" results are p5 callbacks. The `utils.js:558` fall-through is intentional and commented. The scripts are clean. |
| Base comparison | Detached worktree of `main` @ `bcbde2a`, `npm ci`, `npm run build`, served side by side with `develop` | Used for M-1, M-2, L-2 and data compatibility |
| First-visit + CSP smoke | Serve `dist/` with the `/*` headers from `_headers`, clean storage | No CSP violations, errors or failed requests |
| Preload size / time | CDP network throttling (10 Mbps / 40 ms) and per-URL byte accounting | See M-2 |
| Viewport overlays | 1366×625, 1280×610, 1366×657, 1024×600 on both builds, plus a gate-bypass render | See M-1 |
| Mute | Live gameplay sampling of `soundMap[*].isPlaying()`; mute → game over → retry | See L-1 and L-3 |
| Judgment | Real-input kill path; restore check; bot survivability matrix with a stationary control | All pass |
| Production / preview headers | `curl -sI` against `https://mimicfeeder.yest.dev` and the PR preview | See P-1 |

**How to reproduce the key experiments** (no repo changes needed):

1. Build both trees. For `main`: `git worktree add --detach <tmp> bcbde2a && cd <tmp> && npm ci && npm run build`.
2. Serve each `dist/` over HTTP. `file://` does not work.
3. Drive Brave with Playwright, reading game state via bare globals (`gameState`, `player`, `ninefoldJudgmentState`), not `window.*`.
4. For M-1, use viewport `{width: 1280, height: 610}`, press Enter, then Escape.
5. For L-1, press M, run `gameState.shouldTriggerGameOver = true`, press Enter twice, then read `gameState.isMuted`.
6. For L-2, compare `Object.hasOwn(window, 'overlayX')` before and after Escape.
7. For the Judgment bot, wrap the global `updatePlayer` (function declarations are writable window properties) to steer toward `ninefoldJudgmentState.corridorCenter` once meteors are visible, then trigger with `gameState.shadowBoltCatsDestroyed = 9; recordShadowBoltCatKill();`.

**Limitations:**
- No real-device, low-end-CPU or sub-60 fps testing. The frame-delta clamp means the game slows down below 24 fps; this is by design and unverified in practice.
- Only Chromium-family browsers were tested; Safari and Firefox audio behaviour was not checked.
- Audio was verified only by `isPlaying()` state, not by listening.
- Long-run progression past the first boss was exercised only through state injection.
- The Cloudflare production-environment settings (D1 binding, `PRE_MERGE_PLAN.md` §7) could not be inspected. The preview deploy succeeding is indirect evidence that the static config builds.
- The repository has no CI; all gates are local.

## Remaining risks

- **Production Pages settings:** if the production environment still has the old D1 binding, the first production deploy after merge could behave differently from the passing preview. Check it in the dashboard as `PRE_MERGE_PLAN.md` §7 describes. The zone's Browser Cache TTL setting currently overrides `_headers` on the custom domain (`max-age=14400` observed).
- **Test coverage gaps:**
  - The fixes added smoke contracts for mute across retry, deferred loading, staff pacing, the master-gain mute and notification holding. They added playtest checks for deferred assets, staff pacing and notification holding.
  - Still not automated:
    - Small-viewport overlay rendering (M-1 was verified by screenshots).
    - A preload byte budget.
    - High-score persistence end to end.
    - The CSP and cache headers under the playtest; `scripts/playtest.js` serves `dist/` without `_headers`.
  - The smoke suite is regex-on-source, so behaviour-preserving refactors may break it and behaviour changes may pass it.
- **Global-script architecture:** cross-file name collisions and undeclared names are not caught by `npm test` (`node --check` is syntax-only). The scratch ESLint scan is clean after L-2 and L-3, but nothing enforces it.
- **No CI:** all gates are local.
- **Not yet play-tested by a human:** the fixes as a whole, especially staff pacing feel and first-load behaviour on a real connection.

## Agreed follow-ups (after merge)

1. **Tooling branch:**
   - A GitHub Actions workflow running `npm test` and the playtest, using Playwright's Chromium in CI.
   - ESLint with `no-undef`/`no-redeclare` in `npm test`.
   - The playtest server applying `_headers`.
   - Optionally, a local Cloudflare Pages emulator (`wrangler pages dev`).
2. **Analytics:** check why Cloudflare Web Analytics is allowed by the CSP but not active on production.
3. **p5 self-hosting (P-3):** low-priority investigation. It must keep p5 updates easy.
4. **Housekeeping:**
   - `npm audit fix` for the dev-only tooling advisories.
   - Archive `PRE_MERGE_PLAN.md` once its Cloudflare follow-up is done.

## Merge-readiness recommendation

**Ready to merge once the owner's manual playtest of the preview passes and the Cloudflare checks are done.**

- There were no Critical or High defects. All Medium and Low findings are fixed and verified, and `npm test` and the playtest pass at the fix commits.
- **Before merge:**
  - Owner playtest of the PR preview. Cover small-window overlays, first load, mute across retry, staff re-offers, and banners around the Judgment.
  - Confirm the P-1 headers on the preview with `curl -sI`.
- **Before or right after merge:** confirm the Cloudflare production settings (`PRE_MERGE_PLAN.md` §7).
