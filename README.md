# Mimic Feeder

**Play now: [mimicfeeder.yest.dev](https://mimicfeeder.yest.dev/)**

Arcade mimic-feeding chaos. Eat creatures, grab shinies, dodge bombs, and unlock powers.

*Played with a keyboard, on a computer.*

## How to Play

Creatures fall from above: catch them in the mimic's mouth before they hit the floor. Treasure is worth points, bombs cost a heart, and every second floor ends with a boss. Eat enough to clear each zone and go deeper.

| Action | Keys |
|---|---|
| Move | ← → or A D |
| Jump (again in the air to double jump) | ↑ or W |
| Dash | Double-tap ← or → |
| Shadow Bolt (once you find the Wizard Staff) | Space |
| Tentacles (from level 5) | Z |
| Magnetism (once you find the Magnet) | X |
| Pause | P or Esc |
| How to Play | H |
| Achievements | K |
| Mute | M |
| Fullscreen | F |
| In menus: choose, select, back | ↑ ↓, Enter, Esc |

How to Play (on the title screen, or H during a run) covers the rules, the controls, every creature and item you've met, and the abilities.

### Achievements and saves

Achievements come in Bronze, Silver and Gold tiers (+25, +50 and +100 score when they unlock), plus a few secret ones. Progress toward the long-term ones counts across all your runs.

Your name, high scores, achievements and settings are saved in your browser (`localStorage`); there are no accounts and nothing is sent anywhere. Settings can put the settings back to their defaults, or erase everything.

## Running it locally

Use the Node version in `.nvmrc`.

1. Clone the repository
2. Install dependencies: `npm install`
3. Either:
   - `npm run dev` for the Vite dev server, which reloads on save (add `?debug` to the URL to outline physics bodies and show frame times), or
   - `npm run build`, then `npm start` to serve `dist/` with the production headers from `public/_headers`, including the Content-Security-Policy. The only difference from the live site is caching: it sends `Cache-Control: no-store`.

The game must be served over HTTP: opening `dist/index.html` directly (`file://`) does not work.

### Quality gates

Run `npm run check` before opening a PR; GitHub Actions (`.github/workflows/ci.yml`) runs the same gates on every PR and on pushes to `main`.

- `npm run lint`: `node --check` on the tooling, then ESLint on the game (typescript-eslint) and the tooling.
- `npm run typecheck`: TypeScript in strict mode.
- `npm run test:unit`: Vitest unit tests for the game's rules and the save.
- `npm test`: all of the above, then the build.
- `npm run playtest`: drives the built game in Playwright's Chromium, the same browser CI uses (run `npm run playtest:install` once first, and again after upgrading Playwright). The local server applies `public/_headers` like Cloudflare Pages, so the run fails on any Content-Security-Policy violation, or if a path would get more than one `Cache-Control` value.
- `npm run check:live`: a read-only smoke test of the deployed site (https://mimicfeeder.yest.dev/, or `LIVE_URL`). GitHub Actions runs it after every deploy of `main` (`.github/workflows/deploy-check.yml`).

### Deploy notes

- Production is a static Cloudflare Pages site, built with `npm run build` into `dist/`.
- Deploys are automatic via the Cloudflare Pages GitHub integration.
- No Pages Functions or D1 are used, and the game's code contains no analytics or tracking.
- Cloudflare Web Analytics is enabled for the domain. Cloudflare adds its script at the edge, and the Content-Security-Policy in `public/_headers` allows it.

## Technologies Used

- [Phaser 4](https://phaser.io/) for rendering, input, audio and physics
- TypeScript (strict), built with Vite
- Vitest for unit tests, Playwright for the browser playtest

The game was first written with p5.js and rebuilt in Phaser in 2026; the p5.js version is in the git history.

## Project Status

This project is in playable beta and shared primarily as a portfolio and learning reference.
While the code is public and may be forked under the license terms, maintenance cadence is variable and major feature requests may not be prioritized.

## Attributions

Art and audio are original, public domain, or used under free licenses. The interface sounds come from [Kenney](https://kenney.nl/)'s CC0 packs (thanked in the game's Credits).

## License

This project is licensed under the
**Creative Commons Attribution-NonCommercial 4.0 International License (CC BY-NC 4.0)**.

You are free to:
- Share and adapt the code for non-commercial purposes
- Fork or modify the project for personal or educational use

You may not:
- Use this project or its derivatives for commercial purposes

See the `LICENSE` file for full details.
