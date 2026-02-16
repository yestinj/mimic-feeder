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

## Installation and Running
1. Clone the repository
2. Install dependencies: `npm install`
3. Build the project: `npm run build`
4. Start the local server: `npm start` (this will open the game in your browser)

Alternatively, after building, you can open `dist/index.html` directly in your browser.

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
