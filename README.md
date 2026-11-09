# Mimic Feeder

**Play now: [mimicfeeder.yest.dev](https://mimicfeeder.yest.dev/)**

Arcade mimic-feeding chaos. Eat creatures, grab shinies, dodge bombs, and unlock powers.

*Desktop recommended. Keyboard required.*

## How to Play
- **Move**: Left / Right Arrows or A / D
- **Dash**: Double-tap Left / Right Arrows or A / D
- **Jump / Double Jump**: Up Arrow or W
- **Cast Shadow Bolt** (with Wizard Staff): Space
- **Use Tentacles** (at level 5+): Z
- **Use Magnetism** (with Magnet): X
- **Pause / Resume**: P
- **Mute / Unmute**: M
- **Help Overlay**: Esc
- **View Achievements**: K

### First visit vs returning players
- **First visit** (no saved player name): the intro screen is shown before play.
- **Returning players**: if a name was saved after a previous run (browser `localStorage`), the intro is skipped and the run starts immediately.
- Controls and help are always available in-game (**Esc** for Help / Object Info / About, short onboarding tips early in a run, **K** for achievements).

## Achievements
- Achievements are split into three tiers:
- **Early**: +25 score
- **Mid**: +50 score
- **Late / Mastery**: +100 score
- Progression includes quick unlocks, medium milestones, and long-run goals (high floors, long survival, repeated ability usage, and boss clears).
- Center-screen notifications are queued and displayed one at a time to avoid overlap.
- Queued panel notifications auto-size and wrap text to keep the background aligned to content.
- Play-time achievements count active gameplay time only (not intro/pause/help/about/object-info/achievements overlays).
Mastery tracking includes:
- Shadow bolts cast
- Tentacles used
- Dashes used
- Bosses defeated

## Installation and Running
1. Clone the repository
2. Install dependencies: `npm install`
3. Build the project: `npm run build`
4. Start the local server: `npm start` (this will open the game in your browser)

The game must be served over HTTP. Opening `dist/index.html` directly (`file://`) does not work: the browser blocks asset loading and the game stays on "Loading...".

### Deploy notes
- Production is a static Cloudflare Pages site (build output: `dist/`).
- Deploys are automatic via the Cloudflare Pages GitHub integration.
- No Pages Functions or D1 are used, and the game ships no analytics or tracking code.
- The Content Security Policy in `src/_headers` allows Cloudflare Web Analytics, so it can be turned on from the Cloudflare dashboard without a code change.

### Common Issues
- **No Audio**: If audio is muted on first load, click anywhere on the page or press any key to activate the audio context.
- **No intro screen**: Expected for returning players with a saved name (see above). Press **Esc** for controls anytime.

## Development
- Source code is in the `src` directory
- Assets are in the `src/assets` directory
- Build script is in `build.js`

### p5.js CDN
- The game loads **p5.js 1.11.13** and **p5.sound** from cdnjs in `src/index.html` (not from npm).
- The URLs are explicitly versioned and intentionally omit Subresource Integrity. cdnjs previously changed bytes at the same versioned paths, causing browsers to reject the libraries and preventing the game from starting.
- **When upgrading p5 or switching CDN host:** update both script URLs, then run the full build and browser playtest before release.
- Stay on p5 **1.x** unless you plan a dedicated 2.x migration (see `AGENTS.md`).

### Development Workflow
1. Run `npm run dev` to rebuild `dist/` automatically on file changes (this does not serve the game)
2. In a second terminal, run `npm start` to serve `dist/` and open it in your browser
3. Make changes to files in the `src` directory
4. When you see "Build complete" in the console, refresh your browser to see changes

The project uses a simple build process that:
- Concatenates and minifies JavaScript files
- Minifies HTML and CSS
- Copies assets to the dist directory

### Quality gates
Run `npm run check` before opening a PR; GitHub Actions (`.github/workflows/ci.yml`) runs the same gates on every PR and on pushes to `main` / `develop`.

- `npm run lint`: `node --check` on every file, then ESLint. The game is linted as the same concatenation the build ships (`JS_FILE_ORDER`), with browser and p5/p5.sound globals allowed, so it catches undeclared names, implicit globals, cross-file redeclarations, names that shadow p5 functions, unintended `switch` fall-through and similar bugs. Tooling (`build.js`, `scripts/`) is linted with Node globals.
- `npm run lint:p5-globals`: regenerates `scripts/p5-globals.json` (the allowed p5 names) from the CDN URLs in `src/index.html`. Run it after changing the p5 version; lint fails until you do.
- `npm test`: lint, build, and static smoke contracts.
- `npm run playtest`: drives the built game in a headless browser (system Brave locally, or `PLAYTEST_BROWSER_PATH`). The local server applies `src/_headers` like Cloudflare Pages, so the run fails on any Content-Security-Policy violation or if a path would get more than one `Cache-Control` value.

### Documentation
The project uses JSDoc for code documentation:

1. Generate documentation: `npm run docs`
2. View documentation: `npm run serve-docs`

This will create documentation in the `docs` directory and open it in your browser.

## Technologies Used
- p5.js **1.11.13** (pinned cdnjs URLs) for rendering and game logic — see [p5.js CDN](#p5js-cdn) when upgrading
- HTML/CSS for basic structure
- JavaScript for game mechanics
- esbuild for bundling

## Project Status

This project is in playable beta and shared primarily as a portfolio and learning reference.
While the code is public and may be forked under the license terms, maintenance cadence is variable and major feature requests may not be prioritized.

## Attributions

All assets used in this project are either original, public domain, or used under free licenses that do not require attribution.

## License

This project is licensed under the  
**Creative Commons Attribution-NonCommercial 4.0 International License (CC BY-NC 4.0)**.

You are free to:
- Share and adapt the code for non-commercial purposes
- Fork or modify the project for personal or educational use

You may not:
- Use this project or its derivatives for commercial purposes

See the `LICENSE` file for full details.
