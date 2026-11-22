/// <reference types="vitest/config" />
// Vite builds the game into dist/, which Cloudflare Pages serves. Everything in
// public/ (the art and audio in public/assets/, and the _headers and
// _redirects files) is copied to dist/ as it is.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
/** The game's version, from package.json (shown in Credits). */
const { version: GAME_VERSION } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
    root: ROOT,
    base: '/',
    define: { __GAME_VERSION__: JSON.stringify(GAME_VERSION) },
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        // Hashed output lives under /bundle/ (long cache in public/_headers),
        // separate from the unhashed /assets/.
        assetsDir: 'bundle',
        target: 'es2022',
        rolldownOptions: {
            output: {
                // Phaser in its own chunk: it changes rarely, so returning
                // players keep it cached across game updates.
                codeSplitting: {
                    groups: [{ name: 'phaser', test: /node_modules[\\/]phaser[\\/]/ }],
                },
            },
        },
        // Phaser alone is ~1.4 MB minified; that chunk is expected.
        chunkSizeWarningLimit: 1600,
    },
    test: {
        include: ['src/**/*.test.ts'],
    },
});
