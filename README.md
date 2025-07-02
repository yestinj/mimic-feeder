# Mimic Feeder

A fun little game created with the help of AI - Grok, Copilot, Google AI Studio (Claude), and Jetbrains Junie.

## Game Description
Dungeon mimics are greedy, hungry creatures. They need to eat anything edible and love collecting shinies. Control the dungeon mimic to collect food and shinies, and avoid or destroy bombs. Letting perfectly good food (creatures) perish will cause damage.

## How to Play
- **Move**: Left / Right Arrows
- **Jump / Double Jump**: Up Arrow
- **Cast Shadow Bolt** (with Wizard Staff): Space
- **Use Tentacles** (at level 5+): Z
- **Use Magnetism** (with Magnet): X

## Installation and Running
1. Clone the repository
2. Install dependencies: `npm install`
3. Build the project: `npm run build`
4. Start the local server: `npm start` (this will open the game in your browser)

Alternatively, after building, you can open `dist/index.html` directly in your browser.

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

## Contributing
Interested in contributing? Check out the [CONTRIBUTING.md](CONTRIBUTING.md) file for guidelines.

## License
GPLv3
