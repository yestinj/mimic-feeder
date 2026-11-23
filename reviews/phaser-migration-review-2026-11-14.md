# Independent review: p5.js → Phaser 4 migration (`/next/`)

An independent engineering review of the Phaser 4 + TypeScript rewrite in `game/`, served at `/next/`, before it replaces the p5.js game at `/`. It is written to be acted on without access to the conversation that produced it.

> **Paths have moved since.** The swap (#42) moved the game to the repository root: `game/src/` is now `src/`, `game/index.html` is `index.html`, `game/vite.config.mts` is `vite.config.mts`, and `src/_headers` is `public/_headers`. The p5.js files this review cites (`src/js/`, `src/index.html`, `scripts/smoke.js`) were removed and are in the git history. What was done about each finding is in [Follow-ups](#follow-ups).

## Scope

| Field | Value |
|---|---|
| Date | 2026-11-14 |
| Commit reviewed | `main` @ `45ccf0a` ("M4d: the final text review…", PR #27). Milestones M0–M4 are merged; M5 (the swap) has not started. |
| Reference implementation | The p5.js game in `src/js/` (16 files, about 7,500 lines), live at `/` |
| Implementation under review | `game/` (about 9,000 lines of TypeScript excluding tests; Phaser 4.2.1, Vite 8, Vitest 5) |
| Read in full | All of `src/js/constants.js`, `objects.js`, `utils.js`, `player.js`, `abilities.js`, `judgment.js`, `sketch.js`. In `game/src/`: every file under `rules/`, `game/`, `scenes/GameScene`, `HudScene`, `TitleScene`, `PauseScene`, `ResultsScene`, `UnlockScene`, `CountdownScene`, `SystemScene`, `BootScene`, `PreloadScene`, plus `audio.ts`, `assets.ts`, `profile.ts`, `testHook.ts`, `main.ts`, `config.ts`, and `ui/` `keys`, `Button`, `Menu`, `TextField`, `ConfirmDialog`, `Notifications`, `screens`, `kit`, `cursor`. Also `build.js`, `game/vite.config.mts`, `src/_headers`, both `index.html` files, the CI workflow, `docs/phaser-migration/plan.md` and `inventory.md`. |
| Skimmed or checked by rendering only | `SettingsScene` (data and fullscreen handling read; layout not), `HowToPlayScene`, `AchievementsScene`, `HighScoresScene`, `CreditsScene`, `ui/Row`, `Tabs`, `AbilityBar`, `BossBar`, `Hearts`, `Medal`, `strings.ts`, and the p5 screen files (`ui.js`, `helpScreen.js`, `gameOverScreen.js`, `achievements.js` and similar). These were judged from screenshots and the inventory. |
| How it was tested | `npm test` and `npm run playtest` as they are, then about a dozen throwaway Playwright scripts against `dist/` served with `_headers` (see [Testing and verification gaps](#testing-and-verification-gaps)). Nothing in the repository was changed apart from adding this file. |

Findings use these labels:

- **Confirmed**: reproduced by running the game, or shown conclusively by the code.
- **Likely**: strongly supported by the code, not reproduced.
- **Potential**: plausible, needs checking on hardware or browsers that were not available.
- **Improvement**: not a defect.

## Executive summary

The migration is in good shape. The Phaser version is a real rewrite in Phaser's own idiom, not a port of p5's redraw loop: one scene per screen, rules in plain tested TypeScript, events between the game and the HUD, and careful cleanup. Every gameplay system in the inventory is present, the tuning numbers match the p5 game once converted to the new resolution, and the interface is far better than the original.

The existing gates all pass: lint, strict typecheck, 112 unit tests, the build, the smoke contracts and all 136 playtest checks. A 12-run restart soak found no leaks in listeners, sounds, physics colliders, game objects or heap. Under about ten times the normal object count the game scene's update cost stayed near 0.16 ms a frame.

Independent testing found a small set of real defects that the existing tests do not cover. None is severe, and each has a contained fix:

1. **Pausing does not freeze two gameplay timers** (F-1). A cat waiting on the floor is rescued, and a dragon's flight ends, while the game is paused. This breaks the "pause freezes everything" contract the p5 game is tested for.
2. **A fast double press on a menu button fires it twice** (F-2). A screen reopens after it is closed, and Restart or Quit stack two confirm dialogs, one of which is left behind.
3. **A failed sprite download leaves a black screen** (F-3), and **a browser without WebGL gets a blank page** (F-4). The p5 game tolerated the first and did not need WebGL.
4. Two visual clashes: the "Paused" title draws over a HUD notice that was showing (V-1), and notices cover the boss as it arrives (V-2).

**Release readiness: not ready to swap today, but close.** No defect found blocks the release on its own. What blocks it is the M5 work itself, which has more parts than the plan lists (R-1), and a manual check in Firefox and Safari, which no automated test here covers (R-3). F-1 to F-4 should be fixed first because they are cheap and visible. The recommendation is to proceed with the swap after those.

## Migration completeness

### Functional parity

Checked against `inventory.md` and the p5 source. Everything below is present in the Phaser version and behaves the same unless a later table says otherwise.

| Area | Result |
|---|---|
| Movement, gravity, double jump, growth per level | Same values after conversion (`rules/tuning.ts`, `config.ts`). Fall time across the screen is 6.4 s in both. |
| Objects, points, spawn weights, unlock floors | Same (`rules/objects.ts` keeps the p5 probabilities). |
| Spawn timing, hazard roll, anti-clustering, hazard clearance | Same. |
| Zones, floors, difficulty, backgrounds, late asset loading | Same. |
| Boss: health, speed cap, fireball timing, hit stun, contact safe, staff guarantee, death then next floor | Same. |
| Dash, Shadow Bolt, Tentacles, Magnetism: unlocks, cooldowns, targets | Same, except Tentacles (see undocumented differences). |
| Cats, rescue, dragons | Same rules. Timing is affected by F-1. |
| Ninefold Judgment: thresholds, phases, nine waves, gap, damage grace, suspended objects, held notices, blocked abilities | Same. The gap's spare room is scaled with run speed, which is documented. |
| XP, levels, extra lives, potions, staff and magnet offers | Same, with the documented Magnet change. |
| Audio: effects, volumes, voice lines, music per floor, boss cue, unlock on first gesture | Present. Music mapping differs (see below). |
| Saves, achievements, high scores | Replaced as planned (one versioned save, lifetime counters, top 10). |

### Intentional differences (in the plan)

These are decisions recorded in `plan.md`, listed so nobody mistakes them for regressions: the 16:9 fixed resolution with horizontal movement scaled; the title menu; pause menu on P or Esc; the Magnet re-offered like the Staff; spawns across the full width; a dash sound; food eaten only over the rim; side hits costing a life; achievements counted across runs with tuned goals; secret achievements; the name asked once; mute saved across reloads; no onboarding overlays; old saves not carried over.

Two effects of the first group are worth knowing when balance is looked at later:

- **Catching is tighter.** Sizes scale by 1.41 (screen height) and run speed by 1.88 (screen width), so the mimic is about 25% narrower relative to the playfield. The time window to line up under a falling creature drops from roughly 0.45 s to 0.34 s (mimic width plus a typical creature width, divided by run speed).
- **The stricter eating rule and the side-hit penalty compound with that.** A creature that would have been eaten or bumped for free in the p5 game now costs a heart if it meets the chest below the top 30%.

Together they make the Phaser game harder at the same level than the p5 game. That may be what is wanted; the plan already defers balance to after the swap.

One correction to an assumption in the plan: the p5 game does not scale gameplay with its canvas. The mimic is 113 px wide and moves 6 px a frame whatever the canvas size, so the live game is easier in a small window and harder in a large one. The "reference 1024×768" the conversion uses is one point on that range. The fixed design resolution removes this, which is an improvement.

### Differences not recorded in the plan

| # | Difference | Assessment |
|---|---|---|
| D-1 | **Music by floor.** p5 uses `dungeonFloor % 4 < 2` (`sketch.js:1055`), which plays track 1 on Floors 1, 4, 5, 8, 9 and track 2 on Floors 2, 3, 6, 7. Phaser uses `(floor - 1) % 4 < 2` (`rules/progression.ts:56`): track 1 on Floors 1, 2, 5, 6. | The p5 comment and the inventory both describe the Phaser behaviour, so p5 has an off-by-one and Phaser implements the intent. Players of the live game will hear a different track on Floors 2 and 4. Confirm it is wanted and note it in the plan. |
| D-2 | **Tentacles.** The chain reaches its target in 0.18 s (p5: 0.5 s), and a grabbed creature can no longer land or hit the chest (`game/Tentacles.ts:6-12`). | Deliberate, and explained in the code, but it is a gameplay change that §3.9 of the plan does not list. Add it there. |
| D-3 | **Extra life.** p5 checks the human count before incrementing it (`utils.js:246`, called before the count at `:566`), so the heart arrives on the 51st human. Phaser grants it on the 50th. | A p5 bug fixed. |
| D-4 | **Boss hit while idle.** In p5 the boss goes back to idling after the hit animation; in Phaser it starts flying (`game/Boss.ts:100-106`). | Negligible. |
| D-5 | **Results tally** shows counts per creature but not points per creature, which the p5 game-over screen did. | Fits the new design; noted for completeness. |
| D-6 | **Small-window message.** Plan §1 promises a "make the window bigger" message. There is none; at 480×270 the game simply renders small and still works. | Either drop the line from the plan or build it (F-8). |
| D-7 | **Canvas accessibility attributes.** The p5 canvas has `role="application"` and an `aria-label`; the Phaser canvas has neither (the wrapping `div` has a label). | Restore at the swap (R-1). |

### Regressions

Things that work in the p5 game and are worse in the Phaser version: F-1 (pause no longer freezes every timer), F-3 (no fallback for a missing image), F-4 (WebGL is now required, with no message when it is missing). Everything else found is new behaviour with a defect, not a regression.

## Prioritised findings

Severity reflects impact on players of a small browser game: **Medium** is a visible defect in normal use or a hard failure for some visitors; **Low** is cosmetic, rare, or needs unusual conditions. Nothing was rated High.

### F-1 Pausing does not freeze cat rescues or dragon flights

| | |
|---|---|
| Category / severity | Gameplay correctness, regression. **Medium.** |
| Status / confidence | **Confirmed** by test. High confidence. |
| Where | `game/src/scenes/GameScene.ts:732` and `:766` (cat lands, cat rescue), `:781` and `:796` (dragon flight), `:919` and `:936` (cards after a boss); `game/src/game/FallingObject.ts` (`landedAt`, `flightEndsAt`); lid timers in `game/src/game/Mimic.ts`. |

**Issue.** These deadlines are stored as absolute values of `this.time.now`. Phaser's scene clock sets `now` from the game loop's time on every update (`node_modules/phaser/src/time/Clock.js`, `update`: `this.now = time`), so it does not stop while the scene is paused: it jumps forward by the length of the pause when the scene resumes. Cooldowns, the boss, the Judgment and play time are unaffected because they accumulate `delta`.

**Evidence.** With spawning off, a cat was dropped away from the mimic and allowed to land.

| Case | Cats rescued 350 ms later | Score |
|---|---|---|
| No pause | 0 | 0 |
| Paused for 3.5 s, then resumed | 1 | 100 |

**Impact.** Any pause of three seconds or more (P, losing focus, a new-ability card, How to Play or Achievements opened mid-run) rescues every waiting cat at once for 100 points and XP each, without the player having to avoid touching it. A dragon in flight drops back the moment play resumes. The same applies to objects set aside during the Ninefold Judgment. The p5 game is tested for "pause freezes everything" (inventory §13).

**Fix.** Give gameplay one clock that only advances while the run is being played. The smallest change is to keep a `waitedMs` on a landed cat and a `flightLeftMs` on a dragon and advance them by `delta` in `update`, as `Cooldowns` does. Do the same for `cardsAfterBoss`. The lid timers are cosmetic and can stay.

**Verify.** Add a playtest check: land a cat, pause for 4 s, resume, and assert `catsRescued` is still 0 and becomes 1 only after about 3 s of play. Repeat with a window `blur` instead of P.

### F-2 A double press fires a menu button twice

| | |
|---|---|
| Category / severity | UI input. **Medium** (easy to hit with a double-click). |
| Status / confidence | **Confirmed** by test. High confidence. |
| Where | `game/src/ui/Button.ts:94-106` (`select`), `game/src/ui/screens.ts:27-30` (`openScreen`), `game/src/scenes/PauseScene.ts:118-131` (`confirmAbandon`). Check the rows in `game/src/ui/Row.ts` for the same pattern. |

**Issue.** `Button.select()` plays a 120 ms press animation and runs the action from a `delayedCall`. Nothing stops a second `select()` during those 120 ms, so two actions are queued. When the first one puts the scene to sleep (`openScreen`), the second timer is frozen with it and fires when the scene wakes.

**Evidence.**

| Input | Result |
|---|---|
| Enter twice on "How to Play", 40 ms or 90 ms apart | How to Play opens; after Esc it opens again by itself |
| Mouse double-click on "How to Play" | Same |
| Enter twice on "Restart" in the pause menu | Two confirm dialogs stacked. One Esc closes one; the other stays on screen with the pause menu active underneath, and the test hook reports no dialog |

**Impact.** A player who double-clicks a menu item, which is a common habit, has to close the screen twice. The orphaned dialog is confusing but harmless: its buttons still work. "Play" is not affected because `TitleScene.play()` guards with `leaving`.

**Fix.** In `Button.select()`, ignore calls while a press is pending (a flag set on entry and cleared in the delayed callback). That one guard covers every caller. Apply the same to any `Row` that defers its action.

**Verify.** Playtest: press Enter twice within 50 ms on a title item, close the screen, and assert the title is the running scene and the screen's `ready` count is 1. Do the same for Restart and assert one dialog.

### F-3 A failed sprite download gives a black screen

| | |
|---|---|
| Category / severity | Reliability, regression. **Medium** impact, low likelihood per visit. |
| Status / confidence | **Confirmed** by test. High confidence. |
| Where | `game/src/scenes/PreloadScene.ts` (no error handling), `game/src/main.ts:43` (`imageLoadType: 'HTMLImageElement'`), `game/src/game/Mimic.ts:48-50`. |

**Issue.** About 180 images load before the title. With the `HTMLImageElement` loader a failed image is not retried (audio, loaded by XHR, was retried three times in the test). The preload scene carries on to the title regardless. If the missing image is one the code measures, the run cannot start.

**Evidence.** Each request was blocked in turn:

| Blocked file | Result |
|---|---|
| `chest_closed.png` | Title appears. Pressing Play throws `TypeError: Cannot read properties of undefined (reading 'width')` in the game scene's `create`; the screen stays black |
| One animation frame | Plays on with a console warning |
| `goblin.png` (404) | Plays on with Phaser's placeholder texture |
| `collect.mp3`, all music | Plays on silently |
| Fonts | Title appears after the 4 s timeout with fallback fonts |

**Impact.** One dropped request among 180 on a poor connection can leave a visitor with a black screen and no explanation. The p5 game drew a fallback shape for a missing image.

**Fix.** In `PreloadScene`, listen for `FILE_LOAD_ERROR`, retry the failed files once, and if any core file is still missing show a short "Couldn't load the game. Check your connection and reload." panel instead of starting the title.

**Verify.** Playtest with `page.route` aborting `chest_closed.png`: assert the message appears and no page error is thrown.

### F-4 No WebGL means a blank page

| | |
|---|---|
| Category / severity | Compatibility, regression. **Medium** impact for the visitors affected. |
| Status / confidence | **Confirmed** by test (Chromium started with WebGL disabled). |
| Where | `game/src/main.ts:31-47` (`type: Phaser.WEBGL`), `game/index.html`. |

**Issue.** Phaser throws `Cannot create WebGL context, aborting.` from the game's boot. Nothing catches it, and the page shows only its black background. The game uses WebGL-only features (blur and vignette filters, additive particles), so falling back to Phaser's canvas renderer is not an option without more work.

**Impact.** Visitors whose browser has WebGL switched off or blocked (hardware acceleration disabled, some remote desktops and locked-down machines) see nothing. The p5 game used a 2D canvas and worked for them.

**Fix.** Wrap `new Phaser.Game(...)` in a `try`/`catch` (or test for a WebGL context first) and show a plain HTML message in `#game`: the game needs WebGL, and how to check it. Keep it outside Phaser so it cannot fail the same way.

**Verify.** Playtest with Chromium launched with `--disable-gpu --disable-webgl --disable-3d-apis`: assert the message is visible.

### F-5 Strong screen shakes are dropped while a weak one is running

| | |
|---|---|
| Category / severity | Game feel. **Low.** |
| Status / confidence | **Confirmed** from code. |
| Where | `game/src/game/effects.ts:17-24`; `node_modules/phaser/src/cameras/2d/effects/Shake.js` (`start`: returns early when `!force && this.isRunning`). |

**Issue.** `camera.shake()` ignores a new shake while one is in progress unless `force` is passed. `shake()` never passes it. A dash shake (about 220 ms) therefore swallows a hazard hit that follows it, and during the Ninefold Judgment the strength-9 hit shake is nearly always swallowed by the strength-3 shakes from fireballs landing around it.

**Fix.** Track the strength of the shake in progress and pass `force = true` when the new one is stronger.

**Verify.** By eye: take a hit during the Judgment with screen shake on.

### F-6 Late-loading music ignores the boss fight and the Judgment

| | |
|---|---|
| Category / severity | Audio robustness. **Low** (very slow connections only). |
| Status / confidence | **Likely** from code; not reproduced. |
| Where | `game/src/scenes/GameScene.ts:1161-1167` (`onDeferredLoaded`), `:825` (`music.play('boss')`). |

**Issue.** When the second floor track finishes loading, the scene calls `music.play(musicForFloor(floor))` whatever is happening. If that lands during a boss fight it replaces the boss music; during the Judgment or the boss's death cue it starts music that should be silent. In the other direction, if the boss track has not loaded when the fight starts, the floor track keeps playing and nothing starts the boss track when it arrives. The deferred files total about 7.6 MB, and the first boss is several minutes into a run, so this needs a connection well under 1 Mbps.

**Fix.** One function that returns the track that should be playing now (none, boss, or the floor's), used by every caller including `onDeferredLoaded`.

### F-7 The run carries on unseen while the WebGL context is lost

| | |
|---|---|
| Category / severity | Reliability. **Low** (rare event). |
| Status / confidence | **Confirmed** by test (`WEBGL_lose_context`). |

**Issue.** Losing the context blanks the screen but the game keeps running: play time went from 4.6 s to 7.3 s during a simulated loss. Recovery itself is good: after the context was restored the playfield, HUD, textures and the pause blur all came back correctly.

**Fix.** Open the pause menu on the renderer's context-lost event, as losing focus already does.

### F-8 The "make the window bigger" message in the plan does not exist

**Low. Confirmed.** See D-6. At 480×270 the title and a run render and work, just small. Decide whether the message is still wanted and update the plan or build it.

### F-9 Motion may judder on displays that are not 60 Hz

| | |
|---|---|
| Category / severity | Rendering smoothness. **Low to Medium** if it shows; unknown. |
| Status / confidence | **Potential.** Not verifiable here: the test browser renders at 60 Hz. |
| Where | `game/src/scenes/GameScene.ts:153` (Arcade Physics defaults: `fps: 60`, `fixedStep: true`); `node_modules/phaser/src/physics/arcade/World.js` (`update`). |

**Issue.** Arcade Physics steps at a fixed 60 Hz with no interpolation between steps. On a 144 Hz or 75 Hz display some frames get a physics step and some do not, so the mimic and everything falling can appear to stutter slightly. The Judgment's fireballs move on the frame's own delta (`game/Judgment.ts:216`) while the mimic moves on physics steps, so the two would look different side by side. The fixed step is also what keeps collisions and the eating rule consistent, so it should not simply be switched off.

**Next step.** Play a run on a 120 Hz or 144 Hz display. If motion looks uneven, try `arcade: { fps: 120 }` and re-check the eating rule (a creature must not be able to pass through the mouth band in one step; at 60 Hz the worst case is about 34 px a step against a band of 36 px or more).

### Checked and found sound

These were tested because they are common failure points, and no problem was found.

- **Resource cleanup.** Over 12 runs (abilities, bolts, tentacles, magnet, pause, How to Play over the run, a boss fight, game over, results, restart) the counts of listeners on the game, sound manager, scale manager and every scene, the sounds held by the sound manager, physics colliders and bodies, tweens, timers and textures were identical in run 2 and run 12. Heap went from 16.2 MB to 17.2 MB.
- **Per-frame cost.** With about 95 objects falling at once (normal play has 5 to 15), the game scene's update averaged 0.16 ms and the whole frame 2.1 ms in a software-rendered headless browser, with no frame over 17 ms. Everything drained back afterwards.
- **Keys held through a pause.** Holding a direction, pausing (by P and by window blur), releasing the key while paused and resuming does not leave the mimic running.
- **Storage.** Blocked `localStorage`, a corrupt save and a full quota all play through a run to the results with no errors.
- **Loading.** To the title: 225 requests and 4.1 MB, against 390 requests and 4.5 MB for the p5 game to become playable. Phaser's chunk is 276 KB with Brotli.
- **Eating rule and step size.** Food cannot skip the mouth band at any speed reachable in play.
- **A boss collider left behind after each fight** (`GameScene.ts:818`) is inert once the boss is destroyed and is discarded with the physics world when the run ends. Not worth changing.

## Architecture and improvement opportunities

### Assessment

The architecture suits the game and should be kept.

- **Scenes** map to screens, with the HUD, pause menu, ability card and countdown as overlay scenes. Pausing the game scene replaces p5's frame snapshot, as the plan intended.
- **Rules are separated from Phaser.** `rules/run.ts` returns a list of events for each action, and the scene turns them into sounds, effects and HUD updates. This is what makes 112 unit tests possible and is the best decision in the codebase.
- **Phaser is used for what it provides:** Arcade Physics overlaps with process callbacks, animations, tweens, the sound manager, nine-slice panels, particles, camera effects and filters, the Scale Manager. The custom code that exists has a stated reason: `ui/keys.ts` works around Phaser 4.2 delivering a key event more than once, images load as plain `<img>` and SVGs as images to keep `blob:` out of the CSP, and `playSound` returns the sound so callers can chain on it.
- **Cleanup is disciplined.** Every listener added to a longer-lived emitter is removed on `SHUTDOWN`, and scenes reset their fields in `create` because Phaser reuses the scene object. The soak test bears this out.
- **Code quality** is high: strict TypeScript with `noUncheckedIndexedAccess`, comments that explain why, one theme module and one strings module.

`GameScene.ts` is 1,279 lines and owns a lot (spawning, contact, abilities, boss, Judgment, music, overlays, saving, the debug API). It is still readable because the rules live elsewhere. It does not need splitting now.

### Recommendations

| # | Recommendation | Why | When |
|---|---|---|---|
| A-1 | **One gameplay clock.** After F-1, make it a rule that gameplay timing never reads `this.time.now`, only accumulated `delta`. | Removes the whole class of pause bugs. | With F-1 |
| A-2 | **Add the four missing playtest checks** (F-1 to F-4). | Each is a few lines with the existing test hook, and these are exactly the cases the suite missed. | With each fix |
| A-3 | **Give Phaser its own Dependabot PR**, as esbuild has. `.github/dependabot.yml` groups every minor and patch update, and `phaser` is `^4.2.1`. | `ui/keys.ts` depends on 4.2's keyboard behaviour, and Phaser 4 is young. A Phaser bump should be reviewed alone. | Before or at M5 |
| A-4 | **Unit tests for `rules/dragon.ts`** (`shouldFlee`, `flight`). | The only rule module with logic and no test. | Any time |
| A-5 | **Pack the frame sequences into texture atlases.** 164 of the 180 images are single animation frames. | Fewer requests on first load, and one failed request matters less (F-3). The p5 game loads the same files, so this is not a regression. | After the swap |
| A-6 | **If `GameScene` grows further,** move the boss fight and the Judgment's glue (start, end, music, suspended objects) into small controllers the scene owns, as `Tentacles` and `ShadowBolts` already are. | Keeps the scene to orchestration. | Only when needed |
| A-7 | **After the swap, remove what only the p5 game needs:** `src/js/`, `scripts/smoke.js`, `scripts/generate-p5-globals.js`, `scripts/p5-globals.json`, the bundle half of `scripts/lint.js` and `eslint.config.js`, the p5 half of `scripts/playtest.js`, and the `cdnjs`, `blob:` and `worker-src` entries in the CSP. | Less tooling to maintain, and a tighter CSP. | M5 or just after |
| A-8 | **Look at balance with the numbers in [Intentional differences](#intentional-differences-in-the-plan)** when the planned tuning pass happens. | The tighter catch window and the side-hit penalty were decided separately and add up. | After the swap |
| A-9 | **A message for touch devices** that a keyboard is needed. The title's buttons work by touch but a run cannot be played. | Same limitation as the p5 game, so optional. | Later |

## Visual presentation findings

Judged from screenshots of every screen at 1600×900, plus 480×320, 700×1100, 1280×640, 2560×1080 and a 2× pixel-ratio display, with the p5 game alongside.

**Overall.** The new interface is consistent and suitable for release: the panel, button, tab, slider, toggle, keycap, medal and bar art all read as one kit, the two fonts load and render correctly, and the title, pause menu, How to Play, Achievements, Settings, High Scores, Credits and results are well laid out with no clipped or overflowing text found. Letterboxing is correct at every size tried. The per-floor lights sit on the torches and lanterns painted into the backgrounds. Compared with the p5 game's grey overlay boxes this is a large improvement.

### V-1 The "Paused" title draws over HUD notices

**Low to Medium. Confirmed** by screenshot.

`GameScene.openOverlay` blurs the game scene's camera only (`GameScene.ts:1196-1198`); its comment says the HUD is blurred too, but the HUD is a separate scene and stays sharp under the pause menu's 45% veil. The pause title is at y = 150 (`PauseScene.ts:47`) and toasts are at y = 132, so pausing while a toast is up puts "Paused" on top of "Achievement unlocked! First Blood +25". A floor banner (y = 300) shows through between the title and the panels in the same way.

**Fix.** Hide the HUD's notices while an overlay is open (they are already frozen), or blur and dim the HUD camera as well. **Verify** by pausing during the opening floor banner.

### V-2 Notices cover the boss as it arrives

**Low. Confirmed** by screenshot.

The boss appears at the top centre (y ≈ 140) and flies along that line. Toasts sit at y = 150 in the centre while the boss bar is up, on an opaque panel. The score and hearts fade when the boss passes behind them (`HudScene.ts:152-161`), but toasts do not. It is most visible at the start of a fight: when the missing Staff is granted, the "Staff Initiate" achievement toast lands exactly on the boss during its entrance.

**Fix.** During a boss fight, put toasts lower or to one side, or fade them with the same rule as the other HUD blocks.

### V-3 The canvas is always 1920×1080

**Low. Confirmed** (measured). The backing store stays 1920×1080 at any window size and pixel ratio, and CSS scales it. On a 1440p or 4K display, or fullscreen on a high-density screen, text and UI are upscaled and slightly soft; a 1.33× upscale was inspected and is acceptable. Rendering text at the device's resolution would be a real change to the Scale Manager setup, so treat it as a later improvement, not a release item.

### For the separate art review, not this one

- Creature sprites are small pixel art scaled up with smoothing, so they look soft beside the crisp UI. The p5 game draws them the same way.
- The 4:3 backgrounds are scaled to the width and lose the top quarter. Floor 1 reads well; the plan already expects new 16:9 art.

## Testing and verification gaps

### What was run

| Check | Result |
|---|---|
| `npm test` (lint, `tsc`, 112 unit tests in 14 files, build, smoke) | Pass |
| `npm run playtest` (Playwright's Chromium, `dist/` with `_headers`) | Pass, 136 checks across the p5 game and `/next/` |
| Screenshot tour of every Phaser screen and of a run through abilities, a boss, the Judgment, game over and results | No console or page errors |
| Screenshot tour of the p5 game for comparison | — |
| Double press on menus; timers across a pause; keys held through a pause | F-2, F-1, no issue |
| Blocked sprite, animation frame, sound, music, fonts | F-3 |
| WebGL disabled; WebGL context lost and restored | F-4, F-7 |
| Blocked, corrupt and full `localStorage` | No issue |
| Five window sizes and a 2× pixel ratio | V-3, D-6 |
| 12-run restart soak with listener, object and heap counts | No leak |
| Frame cost with about 95 objects | No issue |
| Request counts and sizes for both versions | On par |

All browser testing used Playwright's bundled Chromium in headless mode, which renders WebGL in software.

### What could not be verified

| Gap | Why it matters | Suggested check |
|---|---|---|
| **Firefox and Safari** | The playtest is Chromium-only by design, and Phaser 4's filters, audio unlock, fullscreen and the custom cursor are the usual places browsers differ. | Play one full run and open every menu in each before the swap (R-3). |
| **Real GPU performance and non-60 Hz displays** | Frame times here come from software rendering at 60 Hz. | F-9, and `?debug` on a low-end laptop. |
| **Sound as heard** | Only the audio context's state and the absence of errors were checked. Mix, clipping and the music change (D-1) were not. | Listen through a run to Floor 3 and a boss. |
| **Long real sessions** | The soak ran 12 short scripted runs, not 30 minutes of play to deep floors. | One long manual run with `?debug` on. |
| **Cloudflare itself** | Headers were applied by the local emulation in `scripts/serve.js`. | The preview deployment of the M5 pull request, then the live deploy check. |
| **Menu scenes' code** | Settings, How to Play, Achievements, High Scores and Credits were judged mostly by rendering. | Covered in part by the existing playtest. |
| **Gameplay feel against the live game** | Parity was established from code and constants, not by a person playing both. | The owner has played `/next/` throughout; no further action. |

### Gaps in the existing automated tests

The suite is good at state and flow. It does not cover: repeated activation of a control (F-2), time passing while paused (F-1), failed loads (F-3), a missing WebGL context (F-4), or any browser but Chromium.

## Release readiness

**Assessment: not ready to replace the p5 game today; ready once the items in the first two groups below are done.** The gameplay, saves, menus and tooling are complete and stable. The remaining work is the swap itself and four contained fixes.

### Must be done before the swap

**R-1 The swap has more parts than the plan's M5 row lists.** These are the places that assume `/next/` or "preview". A missed one ships a broken or unindexed site.

| Where | Change |
|---|---|
| `game/vite.config.mts:63` | `base: '/next/'` to `'/'`; `outDir` to `dist/` |
| `game/vite.config.mts` and `build.js` | `publicDir` is `false` and `build.js` copies `src/assets` to `dist/assets`. Whatever replaces `build.js` must still put the shared assets at `/assets/` (the game loads from the absolute `ASSET_BASE = '/assets/'`), and still skip `_unused/`. |
| `src/_headers` | `/next/bundle/*` to `/bundle/*`; remove the `/next/`, `/next/index.html` and `/next/* noindex` rules; remove `/app.min.js` and `/styles.css`. Keep one `Cache-Control` rule per path (the playtest checks this). |
| `game/index.html` | Remove `<meta name="robots" content="noindex">` and "(preview)" from the title. Carry over from `src/index.html`: the description, Open Graph and Twitter tags, the author, the fuller `<noscript>` text. Add `role="application"` and a label to the canvas (D-7). |
| `game/src/strings.ts:19` and `TitleScene.ts:164` | Remove "Preview of the new version. Work in progress." |
| `scripts/live-check.js`, `scripts/playtest.js` | Point the Phaser checks at `/`; remove the p5 checks and the `noindex` assertion. |
| `README.md`, `AGENTS.md`, `CONTRIBUTING.md` | Rewrite for the new game, as planned. |
| `.github/workflows/ci.yml` | Keep the job name `Lint, build, smoke, playtest` (the branch ruleset requires it). |
| `game/src/profile.ts:13` | See R-2 before turning `DELETE_P5_SAVES` on. |

**R-3 A manual pass in Firefox and Safari.** See the gaps table. This is the largest unknown in the review.

### Should be fixed before the swap

In this order: **F-1** (pause timers), **F-2** (double press), **F-4** (WebGL message), **F-3** (load failure), **V-1** (pause over notices). Each is small, and each is something a visitor to the public site can run into in the first few minutes. Add the playtest check with each fix (A-2).

Also decide and record **D-1** (music by floor) and **D-2** (Tentacles) in the plan, so the swap does not ship undocumented gameplay changes.

### Can follow the swap

F-5, F-6, F-7, F-8, F-9 (unless the check shows visible judder), V-2, V-3, and all of A-3 to A-9.

### R-2 Rollback

- **Mechanism.** Cloudflare Pages can roll back to the previous deployment from the dashboard. The live deploy check after the merge is the signal to use it.
- **Saves make rollback lossy if the old keys are deleted.** The two games use different `localStorage` keys on the same origin, so today they coexist. `DELETE_P5_SAVES` removes the p5 game's high scores, name and achievements the first time the Phaser game loads. If the swap is then rolled back, returning players find the old game with their progress gone. **Leave `DELETE_P5_SAVES` off for the first release** and turn it on in a later one, once rolling back is no longer on the table. The three keys are tiny, so keeping them costs nothing.
- **Cached pages.** `/` is cached for an hour. A returning visitor may see the p5 page for up to that long after the swap; it keeps working because `app.min.js` is cached for a year and `/assets/` stays where it is. Do not rename or delete shared assets in the same release.
- **`/next/` bookmarks.** After the swap `/next/` returns 404. A `_redirects` rule sending `/next/*` to `/` is a courtesy to anyone who has the preview link. Saves carry over because the origin and key are the same.

### Other release notes

- **The `?test` hook ships in production.** `?test` exposes `window.__mimicFeeder.debug` (grant abilities, add points, end the run). The playtest and the practice mode rely on it. Scores are local to the browser, so the only person a player can cheat is themselves. Keep it, as a known choice.
- **The CSP can be tightened** once p5 is gone (A-7). Not required for the swap.

## Prioritised action plan

Each step is sized for one small pull request, with `npm run check` green before moving on. Steps 1 to 5 do not depend on each other; the order is by player impact.

| Step | Work | Findings | Done when |
|---|---|---|---|
| 1 | Move cat rescue, dragon flight and the after-boss delay to `delta` accumulators. Add the pause playtest check. | F-1, A-1, A-2 | A cat is not rescued during a 4 s pause; existing cat and dragon checks still pass |
| 2 | Guard `Button.select()` (and deferred rows) against a second call while pressed. Add the double-press playtest check. | F-2, A-2 | A double Enter or double-click opens a screen once and shows one dialog |
| 3 | Catch a failed WebGL start and show an HTML message. Add the playtest check with WebGL disabled. | F-4, A-2 | The message shows; no uncaught error |
| 4 | Handle `FILE_LOAD_ERROR` in `PreloadScene`: retry once, then show a reload message. Add the playtest check with a blocked sprite. | F-3, A-2 | The message shows instead of a black screen |
| 5 | Hide or blur HUD notices under overlays. | V-1 | Pausing during a banner or toast shows a clean pause menu |
| 6 | Record D-1 and D-2 in `plan.md` (and change D-1 back if the old mapping is preferred). Settle D-6. | D-1, D-2, F-8 | The plan lists every gameplay difference |
| 7 | Give Phaser its own Dependabot PR. | A-3 | `phaser` excluded from the `dev-tools` group |
| 8 | Manual pass in Firefox and Safari, and on a high-refresh display. Fix what it finds. | R-3, F-9 | A full run and every menu work in each |
| 9 | **M5, the swap**, using the R-1 table as the checklist. Leave `DELETE_P5_SAVES` off. Add the `/next/*` redirect. | R-1, R-2 | The Cloudflare preview serves the Phaser game at `/` with correct headers; the live deploy check passes after merging |
| 10 | Remove the p5 code and its tooling; tighten the CSP. | A-7 | `npm run check` green with no p5 files |
| 11 | A later release: turn `DELETE_P5_SAVES` on. | R-2 | Old keys removed on load |
| 12 | Polish, in any order: shake strength, late music, pause on context loss, toasts during a boss, dragon unit tests. | F-5, F-6, F-7, V-2, A-4 | — |
| 13 | Later, with the art and balance passes: texture atlases, canvas resolution on dense displays, balance. | A-5, V-3, A-8 | — |

## Follow-ups

Worked through with the owner after the review, one item at a time. Status on 2026-11-23:

### Done before the swap

| Item | Outcome | PR |
|---|---|---|
| F-1 | Cat rescues, dragon flights and the wait for cards after a boss count play time, not the scene clock. | #30 |
| F-2 | A menu button ignores further presses until its action has taken effect. | #31 |
| F-4 | Without WebGL the page says "Mimic Feeder needs WebGL" and what to try; without JavaScript it shows a styled `<noscript>` message. | #32 |
| F-3 | A file that fails to load is tried once more; if an image still fails, the loading screen says so, with a Reload button. Missing sounds are skipped. | #33 |
| V-1 | Banners, toasts and the Judgment's panels hide while an overlay is open over the run, and come back with the time they had left. The score, hearts and ability bar stay. | #34 |
| A-2 | Each fix above came with playtest checks, each shown to fail without the fix. | #30–#34 |
| D-1 | `/next/`'s pairing is kept (track 1 on Floors 1–2, track 2 on 3–4) and recorded in plan §3.9; the inventory now says what the p5 game actually plays. | #36 |
| D-2 | The 0.18 s reach and claimed targets are kept and recorded in plan §3.9. | #37 |
| D-6, F-8 | The "make the window bigger" message is dropped from plan §1. A-9's keyboard note for phones and tablets is in the plan's Later list instead. | #38 |
| A-3 | Phaser updates get their own Dependabot PR. | #38 |
| F-5 | A stronger screen shake takes over from a weaker one that's running; a weaker one leaves it to finish. | #39 |
| F-6 | Music that finishes loading late plays only if it's the track wanted now: the boss's starts when it arrives, a floor's waits for its floor, the silences stay silent. | #39 |
| F-7 | Losing the WebGL context opens the pause menu (and stops the resume countdown). | #39 |
| A-1 | The mimic's lid timings run on play time, and `AGENTS.md` states the rule: gameplay timing in `game/` never reads `this.time.now`. | #39 |
| A-4 | Unit tests for the dragon rules. | #39 |
| V-2 | Toasts fade while the boss flies behind them, as the score and hearts do. | #40 |
| A-9 | On phones and tablets a note over the game says it's played with a keyboard, until Continue is pressed once. | #41 |
| M5, R-1 | The swap: the game is served at `/` from the repository root (`index.html`, `src/`, `public/`), the R-1 checklist done (base path, headers, page metadata, no preview line, playtest and live check at `/`, docs rewritten), with `/next/` redirected to `/` and `DELETE_P5_SAVES` left off (R-2). | #42 |
| D-7 | The game's container has `role="application"` and a label. | #42 |
| A-7 | The p5.js code and its tooling are removed (bundle lint, p5 globals, smoke contracts, the p5 half of the playtest), and the CSP no longer allows cdnjs, `blob:` or workers. | #42 |

### Still open

- **R-3:** the manual pass in Firefox and Safari, and on a high-refresh display, which also settles F-9.
- **A later release:** `DELETE_P5_SAVES` on, once rolling back to the p5.js version is no longer on the table (R-2).
- **A-8, the balance pass:** after the swap, starting from a table of the current numbers (plan, Later).
- **A-6:** only if `GameScene` grows.

### Decided against, for now

- **A-5, texture atlases:** their main gain is on slow connections, which aren't a priority, and failed loads are already handled (F-3).
- **V-3, a sharper canvas on dense screens:** a change to every scene at 2–4 times the drawing cost, sharpening mostly text and UI edges. Left as it is; worth another look with the art pass if the softness ever bothers.
