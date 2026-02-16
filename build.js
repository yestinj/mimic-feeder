const fs = require('fs').promises;
const path = require('path');
const htmlMinifier = require('html-minifier');
const CleanCSS = require('clean-css');
const esbuild = require('esbuild');

const OUTPUT_DIR = 'dist';
const ASSET_DIR = 'src/assets';
const JS_DIR = 'src/js';
const BUILD_CACHE_BUSTER = Date.now();
const GAME_SCRIPT_MARKER_START = '<!-- BUILD:GAME_SCRIPTS_START -->';
const GAME_SCRIPT_MARKER_END = '<!-- BUILD:GAME_SCRIPTS_END -->';
const GAME_SCRIPT_TAG_REGEX = /<script src="js\/[^"]+\.js" defer><\/script>\s*/g;

function replaceGameScriptsWithBundle(content, bundleScriptTag) {
    const markerStartIndex = content.indexOf(GAME_SCRIPT_MARKER_START);
    const markerEndIndex = content.indexOf(GAME_SCRIPT_MARKER_END);

    if (markerStartIndex !== -1 && markerEndIndex !== -1 && markerEndIndex > markerStartIndex) {
        const beforeMarkerEnd = markerStartIndex + GAME_SCRIPT_MARKER_START.length;
        const before = content.slice(0, beforeMarkerEnd);
        const after = content.slice(markerEndIndex);
        return `${before}\n    ${bundleScriptTag}\n    ${after}`;
    }

    if (!GAME_SCRIPT_TAG_REGEX.test(content)) {
        return content;
    }

    // Reset regex state after test() on a global regex.
    GAME_SCRIPT_TAG_REGEX.lastIndex = 0;
    const withoutGameScripts = content.replace(GAME_SCRIPT_TAG_REGEX, '');
    if (withoutGameScripts.includes('</head>')) {
        return withoutGameScripts.replace('</head>', `    ${bundleScriptTag}\n</head>`);
    }
    return `${withoutGameScripts}\n${bundleScriptTag}`;
}

// Minify HTML and update script references
async function minifyHTML(inputDir, outputDir) {
    const files = await fs.readdir(inputDir);
    for (const file of files) {
        if (file.endsWith('.html')) {
            const inputPath = path.join(inputDir, file);
            const outputPath = path.join(outputDir, file);
            let content = await fs.readFile(inputPath, 'utf8');

            // Replace game JS script tags with one bundled script tag.
            const bundleScriptTag = `<script src="app.min.js?v=${BUILD_CACHE_BUSTER}" defer></script>`;
            content = replaceGameScriptsWithBundle(content, bundleScriptTag);

            const minified = htmlMinifier.minify(content, {
                collapseWhitespace: true,
                removeComments: true,
                minifyCSS: true,
                minifyJS: true
            });

            await fs.mkdir(outputDir, { recursive: true });
            await fs.writeFile(outputPath, minified);
        }
    }
}

// Minify CSS
async function minifyCSS(inputDir, outputDir) {
    const files = await fs.readdir(inputDir);
    const cssMinifier = new CleanCSS({ level: 2 });
    for (const file of files) {
        if (file.endsWith('.css')) {
            const inputPath = path.join(inputDir, file);
            const outputPath = path.join(outputDir, file);
            const content = await fs.readFile(inputPath, 'utf8');
            const minified = cssMinifier.minify(content).styles;
            await fs.mkdir(outputDir, { recursive: true });
            await fs.writeFile(outputPath, minified);
        }
    }
}

// Bundle and minify JS files
async function bundleJS(inputDir, outputDir) {
    // Define the order of JS files to maintain dependencies
    const jsFileOrder = [
        'constants.js',
        'assets.js',
        'utils.js',
        'player.js',
        'objects.js',
        'abilities.js',
        'ui.js',
        'introScreen.js',
        'nameInputScreen.js',
        'gameOverScreen.js',
        'helpScreen.js',
        'objectInfoScreen.js',
        'aboutScreen.js',
        'achievements.js',
        'sketch.js'
    ];

    // Create a temporary directory for concatenation
    const tempDir = path.join(outputDir, 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    const tempFile = path.join(tempDir, 'temp-bundle.js');
    let concatenatedContent = '';

    for (const file of jsFileOrder) {
        const inputPath = path.join(inputDir, file);
        try {
            const content = await fs.readFile(inputPath, 'utf8');
            concatenatedContent += content + '\n';
        } catch (error) {
            console.warn(`Warning: Could not read file ${inputPath}: ${error.message}`);
        }
    }

    await fs.writeFile(tempFile, concatenatedContent);

    // Use esbuild to minify the concatenated file directly to the js directory
    try {
        await esbuild.build({
            entryPoints: [tempFile],
            bundle: false, // We've already concatenated the files in the correct order
            minify: true,
            outfile: path.join(outputDir, 'app.min.js'), // Output directly to the root directory
            target: ['es2015'], // Target older browsers for better compatibility
        });

        // Remove the temporary directory and its contents
        await fs.rm(tempDir, { recursive: true });

        console.log('JavaScript files bundled and minified successfully!');
    } catch (error) {
        console.error('Error bundling JavaScript:', error);
        throw error;
    }
}

// Copy assets (files and directories) without modification
async function copyAssets(inputDir, outputDir) {
    const items = await fs.readdir(inputDir, { withFileTypes: true });
    for (const item of items) {
        const inputPath = path.join(inputDir, item.name);
        const outputPath = path.join(outputDir, item.name);

        if (item.isDirectory()) {
            if (item.name === '_unused') {
                console.log(`Skipping quarantined assets directory: ${inputPath}`);
                continue;
            }
            await fs.mkdir(outputPath, { recursive: true });
            await copyAssets(inputPath, outputPath);
        } else if (item.isFile()) {
            await fs.mkdir(path.dirname(outputPath), { recursive: true });
            await fs.copyFile(inputPath, outputPath);
        } else {
            console.warn(`Skipping non-file/non-directory item: ${inputPath}`);
        }
    }
}

async function main() {
    try {
        // Create output directory
        await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
        await fs.mkdir(OUTPUT_DIR, { recursive: true });

        // Process files
        await Promise.all([
            minifyHTML('src', OUTPUT_DIR),
            minifyCSS('src', OUTPUT_DIR),
            bundleJS(JS_DIR, OUTPUT_DIR),
            copyAssets(ASSET_DIR, `${OUTPUT_DIR}/assets`),
            fs.copyFile('src/_headers', `${OUTPUT_DIR}/_headers`).catch(() => {})
        ]);

        console.log('Build completed successfully!');
    } catch (error) {
        console.error('Build failed:', error);
        process.exit(1);
    }
}

main();
