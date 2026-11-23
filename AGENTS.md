# AGENTS.md — Mimic Feeder

Guidance for coding agents working in this repository.

## Project

**Mimic Feeder** is a browser arcade game built with **Phaser 4** and **TypeScript**: control a dungeon mimic, eat creatures, collect shinies, dodge bombs, unlock abilities.

- **Live:** https://mimicfeeder.yest.dev/
- **License:** CC BY-NC 4.0 (non-commercial)
- **Status:** Playable beta / portfolio project — keep changes focused; avoid large refactors unless asked
- **Not accepting external contributions** (see `CONTRIBUTING.md`); forks are fine under the license
- **History:** the game was first written with p5.js and rebuilt in Phaser in 2026. The p5.js version was removed when the rebuild replaced it; it is in the git history. Why the game works the way it does (design decisions, and the deliberate differences from the p5.js version) is in `docs/phaser-migration/plan.md`.

## Stack

| Layer | Choice |
|--------|--------|
| Game | **Phaser 4** + **TypeScript** (strict), ES modules |
| Build | **Vite** (`vite.config.mts`) builds into `dist/`; `npm run build` runs it through `build.js` |
| Tests | **Vitest** unit tests; a **Playwright** playtest of the built game |
| Deploy | Static **Cloudflare Pages** from `dist/` (GitHub integration) |
| Backend | **None** — no Pages Functions or D1. **Cloudflare Web Analytics** is on through the domain's automatic setup (no code; the CSP allows it) |

Do **not** reintroduce in-app track beacons, Pages Functions, or D1. Production is static-only: Cloudflare Pages builds `dist/` using the project's dashboard settings (build command, output directory `dist`, Node from `.nvmrc`). There is deliberately no `wrangler.toml`; adding one makes it the source of truth for the project's settings and bindings and locks them in the dashboard. Cloudflare Web Analytics is enabled through the yest.dev zone's automatic setup: Cloudflare adds its script to HTML responses for real browsers, so the repo has no analytics code, and the CSP allows `static.cloudflareinsights.com` and `cloudflareinsights.com` on purpose. Keep those CSP entries; this is not the removed client/D1 metrics pipeline.

## Layout

```
index.html            # The page: meta tags, the game's container, the "needs JavaScript" notice
vite.config.mts       # Vite build (hashed output in /bundle/) + Vitest config
tsconfig.json         # TypeScript (strict)
src/
  main.ts             # Entry: loads the save, checks for WebGL, starts Phaser, shows the keyboard note on touch devices
  scenes/             # One Phaser scene per screen (game, HUD, pause and results run as separate scenes)
  rules/              # Game rules in plain TypeScript, no Phaser imports; unit-tested (*.test.ts)
  game/               # Playfield objects: the mimic, falling objects, the boss, effects
  ui/                 # UI kit (generated SVGs in kit/), buttons, menus, HUD pieces, text; keys.ts for key input
  config.ts           # Design resolution (1920×1080) and the scales from the original 1024×768 numbers
  assets.ts           # Asset keys and files (served at /assets/), animations
  audio.ts            # Sound effects, music and mute
  profile.ts          # The save (localStorage): settings, name, high scores, totals; loaded at boot
  notice.ts           # Plain HTML notices: in place of the game (no WebGL) or over it (the keyboard note)
  testHook.ts         # window.__mimicFeeder: ready scenes and a state snapshot for the playtest; with ?test, debug shortcuts (grant abilities, spawn objects); ?test&floor=N makes every run a practice run from Floor N (rules/practice.ts), never saved
  theme.ts            # Colours, fonts, type scale, spacing, timings
  strings.ts          # All player-facing text
  style.css           # The page's own styles (the notices)
public/               # Copied into dist/ as it is
  assets/             # Images, sound effects, music, favicon and the social image, served at /assets/
  _headers            # Cloudflare Pages headers (the playtest and npm start apply them)
  _redirects          # Cloudflare Pages redirects (the old /next/ preview address to /)
unused-assets/        # Quarantined art and audio, not shipped
build.js              # `npm run build`: runs the Vite build
eslint.config.js      # ESLint flat config: the game (typescript-eslint) and the Node tooling
.nvmrc                # Node major for local dev and CI (26, current LTS)
.claude/settings.json # Claude Code project settings: no attribution in commits or PRs
.github/
  workflows/ci.yml    # GitHub Actions: npm test + playtest (Playwright Chromium)
  workflows/deploy-check.yml  # After each push to main: wait for Cloudflare, then live check
  dependabot.yml      # Weekly grouped npm + GitHub Actions update PRs
scripts/
  lint.js             # node --check on the tooling, then ESLint
  serve.js            # Static server for dist/ with _headers (npm start; used by the playtest)
  pages-headers.js    # Cloudflare Pages _headers matching used by serve.js
  playtest.js         # Playwright against dist/ served with _headers
  live-check.js       # Read-only smoke check of the deployed site (npm run check:live)
docs/phaser-migration/  # The rebuild's plan (design decisions) and the p5.js version's inventory
reviews/              # Dated code reviews
archive/              # Historical notes only
dist/                 # Build output (gitignored)
playtest-output/      # Playtest screenshots (gitignored)
```

## Architecture notes

### Scenes

- Scenes are listed in `src/main.ts` bottom to top: the HUD draws over the game, the pause menu and new-ability card over both, and the menu screens over whichever screen opened them.
- `GameScene` runs a run; `HudScene` draws the score, hearts, notices and ability bar over it and redraws only when the game scene reports a change (`RUN_EVENTS`). `SystemScene` runs for the whole session: M to mute and F for fullscreen anywhere, and loading later floors' assets in the background.
- Menu screens open with `ui/screens.ts` (the opener sleeps; closing wakes it). Buttons (`ui/Button.ts`) take one press at a time: a second press before the first has taken effect is ignored.

### Rules and state

- Game rules live in `src/rules/` as plain TypeScript with no Phaser imports, and are unit-tested. Scenes ask the rules what happens (`Run` in `rules/run.ts` returns events) and draw it; keep decisions in the rules, not in scene code.
- All player-facing text is in `src/strings.ts`; colours, fonts, sizes and timings are in `src/theme.ts`.
- The save (`src/profile.ts`) is read once at boot and written on every change. Storage can be blocked, full or hold junk: the game carries on with defaults and just doesn't save. `DELETE_P5_SAVES` stays off until a later release removes the p5.js version's old keys (see `reviews/phaser-migration-review-2026-11-14.md`, R-2).

### Overlays, pause and input

- Anything over a run (the pause menu, a new-ability card, How to Play or Achievements opened with H or K) goes through `GameScene.openOverlay`: the game and HUD scenes pause, the playfield blurs, sounds pause, and the HUD's notices hide. `resumePlay` undoes it; with the resume countdown on (Settings), a 3-2-1 runs first.
- Losing focus, hiding the page, or losing the WebGL context opens the pause menu (and stops a resume countdown).
- A paused scene gets no key presses, so gameplay keys do nothing under an overlay. Listen for keys with `onKeyDown` from `ui/keys.ts`, not Phaser's keyboard events directly: it takes each press exactly once (Phaser 4.2 can replay a frame's earlier key events), and stands down while a text field is typing.

### Timing

Gameplay timing runs on play time, which stops while paused: accumulate the frame's `delta` in `update` (as `Run.playTimeMs` does; `GameScene` reads it as `playClock`), or use the scene's timers and tweens (`this.time.delayedCall`, `this.tweens`), which pause with the scene. Never time gameplay against `this.time.now`: the scene clock keeps running through a pause, so anything timed from it runs out while the game is paused. Purely visual loops (the background lights' flicker) may read it.

### Assets, loading and the CSP

- Art and audio are in `public/assets/`, served unhashed at `/assets/` (revalidated within a day). The code is content-hashed under `/bundle/` (cached for a year); Phaser has its own chunk.
- Floor 1's assets load before the title; later floors' backgrounds, the second music track and the boss music load in the background (`SystemScene`). Code that needs one of those must cope with it not having arrived yet.
- A file that fails to load is retried once; if an image still fails, the loading screen says so with a Reload button. A missing sound is skipped (`playSound` returns null).
- The CSP (`public/_headers`) allows only the site itself, plus Cloudflare's analytics. No inline scripts or `<style>`; images from the site or `data:`. Phaser loads images as plain `<img>` requests (`imageLoadType: 'HTMLImageElement'`) so `blob:` isn't needed.
- WebGL is required. Without it, `main.ts` shows a notice in place of the game.

### Testing hooks

The playtest can't reach module state, so scenes report to `src/testHook.ts`: `markReady(scene)` when a scene has created, and views for the snapshot (`window.__mimicFeeder.snapshot()`). With `?test`, `window.__mimicFeeder.debug` grants abilities, spawns objects, starts a boss and so on; `?test&floor=N` makes every run a practice run from Floor N that is never saved. When a check needs new state, add it to the snapshot rather than reaching into the game.

## Commands

```bash
npm install
npm run playtest:install # once (and after Playwright upgrades): Playwright's Chromium
npm run dev            # Vite dev server, reloads on save (add ?debug to outline physics bodies and show frame times)
npm run build          # Vite build into dist/
npm start              # serve dist with _headers (CSP etc.; Cache-Control: no-store)
npm run lint           # node --check on the tooling + ESLint
npm run typecheck      # tsc (strict)
npm run test:unit      # Vitest unit tests (the rules and the save)
npm test               # lint + typecheck + unit tests + build
npm run playtest       # Playwright on dist/ with _headers applied (requires build first)
npm run check          # npm test + playtest (what CI runs)
npm run check:live     # smoke-test the live site (LIVE_URL overrides)
```

### Verification defaults

Run `npm run check` before opening a PR. For a change to behaviour, add a playtest check (or a unit test, for a rule) that fails without the change, and confirm it does.

The playtest serves `dist/` with `dist/_headers` applied using Cloudflare Pages semantics (every matching rule applies; same-name headers are joined with commas), fails on any `securitypolicyviolation`, and fails if any served path would get `Cache-Control` from more than one rule. It always uses **Playwright's own Chromium** (`channel: 'chromium'`), locally and in CI, so a local pass means the same engine passed. There is deliberately no option to use another browser. If it is missing, or Playwright was upgraded, run `npm run playtest:install`. CI renders WebGL in software at a few frames per second, so checks wait for the game's state, not for fixed times.

### CI

`.github/workflows/ci.yml` runs on pushes to `main` and on every PR: `npm ci`, `npm test`, then `npm run playtest` with the same Playwright Chromium as local runs, on the Node version in `.nvmrc`. Screenshots are uploaded as an artifact when it fails. Keep it green; a red check means a gate above failed.

`.github/workflows/deploy-check.yml` runs after each push to `main`. It waits (up to 15 minutes) for Cloudflare's own **Cloudflare Pages** check on that commit to succeed, then runs `npm run check:live` against https://mimicfeeder.yest.dev/: the page loads with its CSP and without noindex, the game reaches its title and starts a run, `/next/` redirects to `/`, and there are no CSP violations, errors, failed requests or HTTP errors. A failed deploy, a missing deploy, or a broken live site turns that run red. It is not a required check (it runs after merging). To verify a deploy, read that run's result rather than probing the site locally.

Work on short-lived branches off `main` (there is no `develop` branch). PRs are squash-merged: it is the only merge method enabled, the squash commit takes the PR title, and the head branch is deleted automatically after merging. The squash commit's body is the branch's commit messages, so they land on `main` as written.

`main` is protected by the **Protect main** repository ruleset (GitHub → Settings → Rules): changes arrive only through PRs (0 approvals required), the `Lint, build, smoke, playtest` check must pass, and force pushes and branch deletion are blocked. Repo admins can bypass it on a PR for emergencies; agents must never use or suggest the bypass. The job keeps that name ("smoke" is historical) because the ruleset requires it: if you rename the CI job, update the ruleset's required check in the same change, or every PR to `main` will wait forever for the old check name.

Dependabot (`.github/dependabot.yml`) opens weekly PRs: one grouped PR for minor/patch npm updates, separate PRs for npm majors and for every Phaser update (the game engine: try the preview before merging), and one for GitHub Actions. CI tests each. After pulling a merged Playwright bump, run `npm run playtest:install` before the next local playtest.

## Coding conventions

- **Indent:** 4 spaces (see `.editorconfig`); LF, UTF-8, trailing whitespace trimmed
- Match existing naming and file organization; prefer small, focused functions
- Comment complex game logic; avoid drive-by refactors and unrelated files
- Prefer editing existing files over adding new layers of abstraction
- Lint findings get fixed, or a narrow `// eslint-disable-next-line <rule> -- reason`; unused disable comments are errors
- Quarantine unused assets under `unused-assets/` (not shipped)

## Do / don’t

| Do | Don’t |
|----|--------|
| Keep rules in `src/rules/` and unit-test them | Put game decisions in scene or drawing code |
| Time gameplay on play time | Time gameplay against `this.time.now` |
| Put player-facing text in `src/strings.ts` | Hard-code text in scenes |
| Keep deploy static-only; CF Web Analytics OK | Add Functions, D1, or in-app track beacons |
| Read game state in tests through `window.__mimicFeeder` | Reach into module state from the playtest |
| Fix or narrowly annotate lint findings | Disable ESLint rules or skip `npm test` |
| Commit sources, `public/` and docs | Commit `dist/`, `playtest-output/`, `node_modules/` |
| Keep repo files, commits, PRs and comments about the project | Mention the owner's machine, OS, installed tools, network setup or other personal details anywhere public (the repo is public) |
| End commit messages and PR descriptions with their own content | Add AI attribution: "Generated with …" lines or `Co-Authored-By` trailers for AI tools |

## Deploy

- Cloudflare Pages builds from the repo; output directory is `dist/`
- No Wrangler publish step is required for normal deploys
- The Pages project should have no bindings in either environment (there are no Functions). Open Cloudflare clean-up is tracked in GitHub issues.

## Related docs

- `README.md` — player-facing controls and setup
- `CONTRIBUTING.md` — fork workflow (not open contribution)
- `docs/phaser-migration/plan.md` — the rebuild's design decisions, including the deliberate gameplay differences from the p5.js version (§3.9); `inventory.md` there describes the p5.js version, for reference
- `reviews/` — dated code reviews: `develop-to-main-review-2026-11-09.md` (the p5.js version), and `phaser-migration-review-2026-11-14.md` (the rebuild before it replaced the p5.js version). Each has a follow-ups section recording what is done and what is still open
- `archive/` — historical notes only (not living todos or current assessments)
- GitHub issues — open follow-ups
