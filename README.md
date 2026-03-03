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

Alternatively, after building, you can open `dist/index.html` directly in your browser.

### Metrics Caveat (Local vs Cloudflare)
- `npm start` uses `http-server` to serve static files only. It does not run Pages Functions, so `/api/track` is unavailable in that mode.
- To run analytics ingestion locally (Functions + D1), use `npx wrangler pages dev dist`.
- Production/preview deployments on Cloudflare Pages run the Function and write analytics events to Cloudflare D1.
- Analytics should be fail-open: if tracking is blocked or unavailable, gameplay must continue normally.

### Metrics and Privacy
- We collect a small set of gameplay analytics events (`intro_view`, `game_start`, `game_over`, `retry_click`) to understand gameplay flow and balance.
- Analytics uses anonymous random identifiers (`session_id`, `run_id`) and does not include player-entered names.
- Client analytics respects browser privacy signals (`Global Privacy Control` and `Do Not Track`) and skips sending metrics when enabled.
- Client payloads are allowlisted per event before sending to reduce accidental extra data collection.

### Common Issues
- **No Audio**: If audio is muted on first load, click anywhere on the page or press any key to activate the audio context.

## Development
- Source code is in the `src` directory
- Assets are in the `src/assets` directory
- Build script is in `build.js`

### Development Workflow
1. Run `npm run dev` to start the development server with auto-rebuild on file changes
2. Open `dist/index.html` in your browser
3. Make changes to files in the `src` directory
4. When you see "Build complete" in the console, refresh your browser to see changes

The project uses a simple build process that:
- Concatenates and minifies JavaScript files
- Minifies HTML and CSS
- Copies assets to the dist directory

### Documentation
The project uses JSDoc for code documentation:

1. Generate documentation: `npm run docs`
2. View documentation: `npm run serve-docs`

This will create documentation in the `docs` directory and open it in your browser.

## Technologies Used
- p5.js for rendering and game logic
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
