# Contributing to Mimic Feeder

I'm not open to contributions, but if you'd like to fork the project and make your own updates, keep reading.

## Development Setup

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/mimic-feeder.git`
3. Install dependencies: `npm install`
4. Run the game: `npm run dev` (Vite's dev server, reloads on save), or `npm run build && npm start` to serve the production build

## Development Workflow

1. Create a new branch for your feature or bugfix: `git checkout -b feature/your-feature-name`
2. Make your changes
3. Test your changes: `npm run check` (lint, typecheck, unit tests, build and the browser playtest; run `npm run playtest:install` once first)
4. Commit your changes with a descriptive commit message
5. Push to your fork: `git push origin feature/your-feature-name`

## Code Style Guidelines

- Use consistent indentation (4 spaces, per `.editorconfig`)
- Use meaningful variable and function names
- Add comments for complex logic
- Keep functions small and focused on a single task
- Follow the existing code organization pattern

## Project Structure

- `src/`: the game, in TypeScript with Phaser 4 (`src/scenes/` for screens, `src/rules/` for the game rules, unit-tested)
- `public/assets/`: art, sounds and music, served from `assets/`
- `index.html`: the page
- `vite.config.mts`: the Vite build (`npm run build` writes `dist/`)
- `AGENTS.md`: a fuller guide to the layout and conventions
