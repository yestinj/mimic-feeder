/// <reference types="vitest/config" />
// Vite config for the Phaser + TypeScript rewrite. It builds into dist/next/,
// which the site serves at /next/ alongside the current p5 game until the swap
// (see docs/phaser-migration/plan.md).
import { createReadStream, statSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const GAME_DIR = fileURLToPath(new URL('.', import.meta.url));
const ASSETS_DIR = resolve(GAME_DIR, '../src/assets');

const ASSET_TYPES: Record<string, string> = {
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.jpg': 'image/jpeg',
    '.mp3': 'audio/mpeg',
    '.ico': 'image/x-icon',
};

// The game reuses the existing art and audio from src/assets/, which the site
// serves at /assets/. In production that path exists already; this serves the
// same files from the dev server so nothing is copied or duplicated.
function serveSharedAssets(): Plugin {
    return {
        name: 'mimic-feeder-shared-assets',
        configureServer(server) {
            server.middlewares.use('/assets', (req, res, next) => {
                let relativePath: string;
                try {
                    relativePath = decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/');
                } catch {
                    res.statusCode = 400;
                    res.end('Bad request');
                    return;
                }
                const filePath = resolve(ASSETS_DIR, `.${relativePath}`);
                if (!filePath.startsWith(ASSETS_DIR + sep)) {
                    res.statusCode = 403;
                    res.end('Forbidden');
                    return;
                }
                try {
                    if (!statSync(filePath).isFile()) {
                        next();
                        return;
                    }
                } catch {
                    next();
                    return;
                }
                res.setHeader('Content-Type', ASSET_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream');
                createReadStream(filePath).pipe(res);
            });
        },
    };
}

export default defineConfig({
    root: GAME_DIR,
    base: '/next/',
    publicDir: false,
    plugins: [serveSharedAssets()],
    build: {
        outDir: resolve(GAME_DIR, '../dist/next'),
        emptyOutDir: true,
        // Hashed output lives under /next/bundle/ (long cache in src/_headers),
        // separate from the shared, unhashed /assets/.
        assetsDir: 'bundle',
        target: 'es2022',
        rolldownOptions: {
            input: {
                main: resolve(GAME_DIR, 'index.html'),
                fonts: resolve(GAME_DIR, 'fonts.html'),
            },
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
