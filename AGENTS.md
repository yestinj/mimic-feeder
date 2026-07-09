# AGENTS.md — Mimic Feeder

Guidance for coding agents working in this repository.

## Project

**Mimic Feeder** is a browser arcade game (p5.js): control a dungeon mimic, eat creatures, collect shinies, dodge bombs, unlock abilities.

- **Live:** https://mimicfeeder.yest.dev/
- **License:** CC BY-NC 4.0 (non-commercial)
- **Status:** Playable beta / portfolio project — keep changes focused; avoid large refactors unless asked
- **Not accepting external contributions** (see `CONTRIBUTING.md`); forks are fine under the license

## Stack

| Layer | Choice |
|--------|--------|
| Runtime | Vanilla JS (global scripts, **not** ES modules) |
| Rendering / audio | p5.js **1.9.4** + p5.sound (CDN) |
| Build | Custom `build.js` (esbuild JS, clean-css CSS, html-minifier-terser HTML) |
| Deploy | Static **Cloudflare Pages** from `dist/` (GitHub integration) |
| Backend | **None** — no Pages Functions, D1, or analytics |

Do **not** reintroduce analytics, Cloudflare Functions, or D1. Production is static-only (`wrangler.toml` documents this).

## Layout

```
src/
  index.html          # Source HTML; game scripts between BUILD markers
  styles.css
  _headers            # Optional Cloudflare headers (copied to dist)
  js/                 # Game source (load order matters — see build.js)
  assets/             # Images, SFX, music (copied to dist; _unused/ skipped)
build.js              # Full build pipeline
scripts/
  lint.js             # Syntax check (node --check style)
  smoke.js            # Static source contracts (no browser)
  playtest.js         # Playwright against dist/ (system Brave)
dist/                 # Build output (gitignored)
docs/                 # JSDoc output (gitignored)
playtest-output/      # Playtest screenshots (gitignored)
```

### JS module map (load / bundle order)

Order is enforced in `build.js` and `src/index.html`:

1. `constants.js` → `assets.js` → `utils.js`
2. `player.js` → `objects.js` → `abilities.js` → `ui.js`
3. Screens: `introScreen`, `nameInputScreen`, `gameOverScreen`, `helpScreen`, `objectInfoScreen`, `aboutScreen`
4. `achievements.js` → `sketch.js` (entry / main loop)

When adding a new `.js` file under `src/js/`, update **both** `build.js` (`jsFileOrder`) and the script tags between `BUILD:GAME_SCRIPTS_START` / `END` in `src/index.html`.

## Architecture notes

### Globals, not modules

Files share state via top-level `let` / `const` / `function` declarations. They are **not** attached to `window`.

- In-browser playtests must evaluate bare names (e.g. `gameState`), not `window.gameState`.
- esbuild runs with `bundle: false` after concatenation — treat the bundle as one global script.

### Game loop ownership

- `sketch.js` owns p5 lifecycle (`setup` / `draw` / `keyPressed` / etc.), `gameState`, pause freeze (`lastGameplayFrame`), and screen routing.
- Collection / damage / bomb counting: prefer single ownership. Bomb tallies go through `handleBombCollection` (do not pre-increment elsewhere — smoke contracts guard this).
- Achievements persist to `localStorage` (wrap writes in try/catch).

### Overlays and input

Pause, help, about, object-info, achievements, and game-over should block gameplay input. While paused:

- **Allowed:** P (resume), M (mute), Esc (help), K (achievements) as designed
- **Blocked:** movement, jump, dash, abilities, etc.
- Pause should draw a frozen playfield snapshot (`lastGameplayFrame`), not a blank or live-simulating field

### p5 version

Stay on **p5.js 1.9.x** CDN pins in `src/index.html`. Do not upgrade to p5 2.x without an explicit request and full playtest.

## Commands

```bash
npm install
npm run build          # src → dist
npm run dev            # watch src, rebuild on change
npm start              # serve dist (http-server)
npm run lint           # syntax-check build.js, src/js, scripts
npm run smoke          # static contracts on source
npm test               # lint + build + smoke
npm run playtest       # Playwright (requires build first)
npm run docs           # JSDoc → docs/
```

### Verification defaults

After non-trivial game or build changes, run at least:

```bash
npm test
```

For pause, input, bomb-count, or audio-gating changes, also:

```bash
npm run build && npm run playtest
```

Playtest uses **system Brave** by default (`/Applications/Brave Browser.app/...`). Override with `PLAYTEST_BROWSER_PATH`. Do not download Playwright Chromium unless the user asks.

## Coding conventions

- **Indent:** 4 spaces (see `.editorconfig`); LF, UTF-8, trailing whitespace trimmed
- Match existing naming and file organization; prefer small, focused functions
- Comment complex game logic; avoid drive-by refactors and unrelated files
- Prefer editing existing files over adding new layers of abstraction
- Minifier settings in `build.js` are intentional — do not “optimize” them without discussion
- Quarantine unused assets under `src/assets/_unused/` (build skips that tree)

## Do / don’t

| Do | Don’t |
|----|--------|
| Edit sources under `src/` | Commit `dist/`, `docs/`, `playtest-output/`, `node_modules/` |
| Keep bomb counting single-owner | Double-count bombs on bolt/explosion paths |
| Guard gameplay keys when paused / overlays open | Let movement or abilities run under pause |
| Keep deploy static-only | Add Functions, D1, analytics, or track beacons |
| Update smoke contracts when changing control contracts | Leave smoke asserting removed behavior |
| Use bare globals in browser automation | Assume `window.gameState` etc. |

## Deploy

- Cloudflare Pages builds from the repo; output directory is `dist/`
- No Wrangler publish step is required for normal deploys
- After any historical D1/Functions cleanup in Cloudflare dashboard, confirm bindings stay empty (see `PRE_MERGE_PLAN.md` follow-ups if present)

## Related docs

- `README.md` — player-facing controls and setup
- `CONTRIBUTING.md` — fork workflow (not open contribution)
- `PRE_MERGE_PLAN.md` — active develop→main decisions (analytics removal, pause/bomb fixes, CF follow-up)
- `archive/plan.md` / `archive/tech-review.md` — historical polish checklist and Feb 2026 tech review (not living todos)
