// Builds the Phaser spike into dist/spike/phaser/ so the Cloudflare preview
// serves it next to the current game. The page reuses the game's dist/assets.
const fs = require('fs').promises;
const path = require('path');
const esbuild = require('esbuild');

const SPIKE_DIR = __dirname;

async function buildSpike(outputRoot) {
    const outDir = path.join(outputRoot, 'spike', 'phaser');
    await fs.mkdir(outDir, { recursive: true });
    await esbuild.build({
        entryPoints: [path.join(SPIKE_DIR, 'src', 'main.js')],
        bundle: true,
        minify: true,
        format: 'iife',
        target: 'es2022',
        outfile: path.join(outDir, 'game.js'),
        logLevel: 'warning'
    });
    await fs.copyFile(path.join(SPIKE_DIR, 'index.html'), path.join(outDir, 'index.html'));
    await fs.copyFile(path.join(SPIKE_DIR, 'style.css'), path.join(outDir, 'style.css'));
    console.log('Phaser spike built into dist/spike/phaser/');
}

module.exports = { buildSpike };
