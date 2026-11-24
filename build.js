// `npm run build`: builds the game into dist/ with Vite (vite.config.mts).
// Workers Builds runs this before deploying dist/ (wrangler.jsonc). Kept as a
// script so the build command stays the same whatever the build does.
const path = require('path');

async function main() {
    const { build } = await import('vite');
    await build({ configFile: path.join(__dirname, 'vite.config.mts'), logLevel: 'warn' });
    console.log('Build completed: dist/');
}

main().catch((error) => {
    console.error('Build failed:', error);
    process.exit(1);
});
