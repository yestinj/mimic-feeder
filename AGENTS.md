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
| Rendering / audio | p5.js **1.11.13** + p5.sound (CDN) |
| Build | Custom `build.js` (esbuild JS, clean-css CSS, html-minifier-terser HTML) |
| Deploy | Static **Cloudflare Pages** from `dist/` (GitHub integration) |
| Backend | **None** — no Pages Functions or D1; optional **Cloudflare Web Analytics** via dashboard/CSP only |

Do **not** reintroduce in-app track beacons, Pages Functions, or D1. Production is static-only (`wrangler.toml` documents this). Cloudflare Web Analytics (Insights) is allowed in CSP on purpose — not the removed client/D1 metrics pipeline.

## Layout

```
src/
  index.html          # Source HTML; game scripts between BUILD markers
  styles.css
  _headers            # Cloudflare Pages headers (copied to dist; playtest applies them)
  js/                 # Game source (load order matters — see build.js)
  assets/             # Images, SFX, music (copied to dist; _unused/ skipped)
build.js              # Full build pipeline (exports JS_FILE_ORDER for lint)
eslint.config.js      # ESLint flat config: Node tooling + concatenated game bundle
.nvmrc                # Node major for local dev and CI (26, current LTS)
.github/
  workflows/ci.yml    # GitHub Actions: npm test + playtest (Playwright Chromium)
  workflows/deploy-check.yml  # After each push to main: wait for Cloudflare, then live check
  dependabot.yml      # Weekly grouped npm + GitHub Actions update PRs
scripts/
  lint.js             # node --check + ESLint (tooling and the JS_FILE_ORDER bundle)
  generate-p5-globals.js  # Regenerates p5-globals.json from the index.html p5 pins
  p5-globals.json     # Generated p5 + p5.sound global-mode names (commit it)
  smoke.js            # Static source contracts (no browser)
  serve.js            # Static server for dist/ with _headers (npm start; used by playtest)
  playtest.js         # Playwright against dist/ served with _headers
  live-check.js       # Read-only smoke check of the deployed site (npm run check:live)
  pages-headers.js    # Cloudflare Pages _headers matching used by serve.js
dist/                 # Build output (gitignored)
playtest-output/      # Playtest screenshots (gitignored)
```

### JS module map (load / bundle order)

Order is enforced in `build.js` and `src/index.html`:

1. `constants.js` → `assets.js` → `utils.js`
2. `player.js` → `objects.js` → `abilities.js` → `judgment.js` → `ui.js`
3. Screens: `introScreen`, `nameInputScreen`, `gameOverScreen`, `helpScreen`, `objectInfoScreen`, `aboutScreen`
4. `achievements.js` → `sketch.js` (entry / main loop)

When adding a new `.js` file under `src/js/`, update **both** `build.js` (`JS_FILE_ORDER`) and the script tags between `BUILD:GAME_SCRIPTS_START` / `END` in `src/index.html`. The build **fails** if disk files and `JS_FILE_ORDER` diverge (missing module or orphan).

## Architecture notes

### Globals, not modules

Files share state via top-level `let` / `const` / `function` declarations. They are **not** attached to `window`.

- In-browser playtests must evaluate bare names (e.g. `gameState`), not `window.gameState`.
- esbuild runs with `bundle: false` after concatenation — treat the bundle as one global script.
- ESLint checks that same concatenation (`npm run lint`) with ESLint's recommended rules plus a few game-specific settings (`eslint.config.js`), so a name used in one file and declared in another is fine, but an undeclared name, an implicit global (assignment without a declaration), a duplicate top-level declaration across files, or a declaration that shadows a browser/p5 global (e.g. `function random()`) fails. Findings are reported against the original `src/js` file and line.

### Game loop ownership

- `sketch.js` owns p5 lifecycle (`setup` / `draw` / `keyPressed` / etc.), `gameState`, pause freeze (`lastGameplayFrame`), and screen routing.
- Collection / damage / bomb counting: prefer single ownership. Bomb tallies go through `handleBombCollection` (do not pre-increment elsewhere — smoke contracts guard this).
- Achievements persist to `localStorage` (wrap reads, writes, and cleanup in try/catch).

### Overlays and input

Pause, help, about, object-info, achievements, and game-over should block gameplay input. While paused:

- **Allowed:** P (resume), M (mute), Esc (help), K (achievements) as designed
- **Blocked:** movement, jump, dash, abilities, etc.
- Pause shell (`isPauseGameplayShell`) always returns from `draw` without simulation — use `lastGameplayFrame` when present, otherwise a static background fallback (never fall through into updates)
- Freeze snapshot is captured on the pause rising edge and when opening help/achievements from active play (`captureGameplayFreezeSnapshot` / `get()`), not every active frame
- Mid-run info overlays (help / object info / about / achievements) draw `drawPlayfieldUnderlay()` under chrome so the world does not vanish
- Resize must not clear `lastGameplayFrame` while paused (snapshot is stretched to the new canvas size)

### p5 version

Stay on **p5.js 1.11.x** CDN pins in `src/index.html` (currently **1.11.13** on cdnjs). The script tags intentionally omit Subresource Integrity because cdnjs changed bytes at the same versioned paths and the stale hashes prevented the game from starting. Do not reintroduce `integrity` attributes unless the libraries move to immutable, self-hosted files. Do not upgrade to p5 2.x without an explicit request and full playtest; any version or CDN change requires `npm run build && npm run playtest`.

ESLint's allowed p5 names come from `scripts/p5-globals.json`, generated by loading the exact CDN URLs from `src/index.html` in a headless browser and diffing `window` before/after p5 global-mode setup. After changing a p5 pin, run `npm run lint:p5-globals` (needs network and Playwright's Chromium) and commit the JSON; `npm run lint` fails while the JSON's source URLs differ from the pins. Never hand-edit the JSON.

## Commands

```bash
npm install
npm run playtest:install # once (and after Playwright upgrades): Playwright's Chromium
npm run build          # src → dist
npm run dev            # watch src, rebuild on change (node --watch-path)
npm start              # serve dist with _headers (CSP etc.; Cache-Control: no-store)
npm run lint           # node --check + ESLint (tooling + concatenated game bundle)
npm run lint:p5-globals # regenerate scripts/p5-globals.json after a p5 pin change
npm run smoke          # static contracts on source
npm test               # lint + build + smoke
npm run playtest       # Playwright on dist/ with _headers applied (requires build first)
npm run check          # npm test + playtest (what CI runs)
npm run check:live     # smoke-test the live site (LIVE_URL overrides)
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

For `src/_headers`, CSP, or new external resources (scripts, fonts, workers, fetches), also run the playtest: it serves `dist/` with `dist/_headers` applied using Cloudflare Pages semantics (every matching rule applies; same-name headers are joined with commas), fails on any `securitypolicyviolation`, and fails if any served path would get `Cache-Control` from more than one rule.

The playtest and `npm run lint:p5-globals` always use **Playwright's own Chromium** (`channel: 'chromium'`), locally and in CI, so a local pass means the same engine passed. There is deliberately no option to use another browser. If it is missing, or Playwright was upgraded, run `npm run playtest:install`.

### CI

`.github/workflows/ci.yml` runs on pushes to `main` and on every PR: `npm ci`, `npm test`, then `npm run playtest` with the same Playwright Chromium as local runs, on the Node version in `.nvmrc`. Screenshots are uploaded as an artifact when it fails. Keep it green; a red check means a gate above failed.

`.github/workflows/deploy-check.yml` runs after each push to `main`. It waits (up to 15 minutes) for Cloudflare's own **Cloudflare Pages** check on that commit to succeed, then runs `npm run check:live` against https://mimicfeeder.yest.dev/: the page loads with its CSP, p5 loads, the game reaches active play, and there are no CSP violations, errors, failed requests or HTTP errors. A failed deploy, a missing deploy, or a broken live site turns that run red. It is not a required check (it runs after merging). To verify a deploy, read that run's result rather than probing the site from the owner's Mac; there, a newly installed Playwright Chromium must first be approved in Little Snitch.

Work on short-lived branches off `main` (there is no `develop` branch). PRs are squash-merged: it is the only merge method enabled, the squash commit takes the PR title, and the head branch is deleted automatically after merging.

`main` is protected by the **Protect main** repository ruleset (GitHub → Settings → Rules): changes arrive only through PRs (0 approvals required), the `Lint, build, smoke, playtest` check must pass, and force pushes and branch deletion are blocked. Repo admins can bypass it on a PR for emergencies (e.g. a cdnjs outage breaking CI); agents must never use or suggest the bypass. If you rename the CI job, update the ruleset's required check in the same change, or every PR to `main` will wait forever for the old check name.

Dependabot (`.github/dependabot.yml`) opens weekly PRs: one grouped PR for minor/patch npm updates, separate PRs for npm majors and for every esbuild update (still 0.x, where minor releases can break), and one for GitHub Actions. CI tests each. After pulling a merged Playwright bump, run `npm run playtest:install` before the next local playtest.

### Lint false positives

Handle them explicitly and narrowly, never by turning a rule off for the bundle:

- p5 lifecycle/event callbacks (`setup`, `draw`, `keyPressed`, …) are listed in `P5_CALLBACKS` in `eslint.config.js`; add a name there if the game starts defining a new p5 callback.
- Intentional `switch` fall-through gets a `// falls through` comment as the last line before the next `case` (see `collectObject` in `utils.js`).
- A one-off exception gets an inline `// eslint-disable-next-line <rule> -- reason`; unused disable directives are errors in the bundle.

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
| Edit sources under `src/` | Commit `dist/`, `playtest-output/`, `node_modules/` |
| Keep bomb counting single-owner | Double-count bombs on bolt/explosion paths |
| Guard gameplay keys when paused / overlays open; never simulate under pause shell | Let movement, spawns, or hazards run while paused (incl. after resize) |
| Keep deploy static-only; CF Web Analytics OK | Add Functions, D1, or in-app track beacons |
| Update smoke contracts when changing control contracts | Leave smoke asserting removed behavior |
| Use bare globals in browser automation | Assume `window.gameState` etc. |
| Fix or narrowly annotate lint findings | Disable ESLint rules for the game bundle or skip `npm test` |

## Deploy

- Cloudflare Pages builds from the repo; output directory is `dist/`
- No Wrangler publish step is required for normal deploys
- After any historical D1/Functions cleanup in Cloudflare dashboard, confirm bindings stay empty (see `PRE_MERGE_PLAN.md` follow-ups if present)

## Related docs

- `README.md` — player-facing controls and setup
- `CONTRIBUTING.md` — fork workflow (not open contribution)
- `PRE_MERGE_PLAN.md` — active develop→main decisions (analytics removal, pause/bomb fixes, CF follow-up)
- `archive/` — historical notes only (not living todos or current assessments): `plan.md` polish checklist, `tech-review.md` Feb 2026 tech review, `code-review-2026-07-09.md` superseded July 2026 review
