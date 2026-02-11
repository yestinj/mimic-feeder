# Mimic Feeder

A fun little game created with the help of AI - Grok, Copilot, Google AI Studio (Claude), and Jetbrains Junie.

## Game Description
Arcade monster-feeder. Eat creatures, nab shinies, dodge bombs, and unlock powers. Dungeon mimics are greedy, hungry creatures - keep them fed!

## How to Play
- **Move**: Left / Right Arrows
- **Dash**: Double-tap Left / Right Arrows
- **Jump / Double Jump**: Up Arrow
- **Cast Shadow Bolt** (with Wizard Staff): Space
- **Use Tentacles** (at level 5+): Z
- **Use Magnetism** (with Magnet): X
- **View Achievements**: A

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

## Project Status

This project is feature-complete and shared primarily as a portfolio and learning reference.
While the code is public and may be forked under the license terms, I’m not actively seeking contributions or maintaining feature requests.

## License

This project is licensed under the  
**Creative Commons Attribution-NonCommercial 4.0 International License (CC BY-NC 4.0)**.

You are free to:
- Share and adapt the code for non-commercial purposes
- Fork or modify the project for personal or educational use

You may not:
- Use this project or its derivatives for commercial purposes

See the `LICENSE` file for full details.
