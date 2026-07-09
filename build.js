const fs = require('fs').promises;
const path = require('path');
const { minify: minifyHtml } = require('html-minifier-terser');
const CleanCSS = require('clean-css');
const esbuild = require('esbuild');

const OUTPUT_DIR = 'dist';
const ASSET_DIR = 'src/assets';
const JS_DIR = 'src/js';
const BUILD_CACHE_BUSTER = Date.now();
const GAME_SCRIPT_MARKER_START = '<!-- BUILD:GAME_SCRIPTS_START -->';
const GAME_SCRIPT_MARKER_END = '<!-- BUILD:GAME_SCRIPTS_END -->';
const GAME_SCRIPT_TAG_REGEX = /<script src="js\/[^"]+\.js" defer><\/script>\s*/g;

/**
 * Ordered game sources concatenated into app.min.js.
 * Must stay in sync with script tags between BUILD:GAME_SCRIPTS markers in src/index.html.
 * Every *.js file under src/js must appear here exactly once (no silent orphans or skips).
 */
const JS_FILE_ORDER = [
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

            const minified = await minifyHtml(content, {
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

/**
 * Ensures JS_FILE_ORDER is complete and matches every *.js file under inputDir.
 * Fails the build on missing modules, unreadable files, duplicates, or orphans.
 * @param {string} inputDir
 */
async function assertJsBundleSourcesComplete(inputDir) {
    const uniqueOrdered = new Set(JS_FILE_ORDER);
    if (uniqueOrdered.size !== JS_FILE_ORDER.length) {
        const seen = new Set();
        const duplicates = JS_FILE_ORDER.filter((file) => {
            if (seen.has(file)) {
                return true;
            }
            seen.add(file);
            return false;
        });
        throw new Error(`JS_FILE_ORDER contains duplicates: ${[...new Set(duplicates)].join(', ')}`);
    }

    const dirEntries = await fs.readdir(inputDir);
    const onDiskJs = dirEntries.filter((name) => name.endsWith('.js')).sort();

    const missingFromDisk = JS_FILE_ORDER.filter((file) => !onDiskJs.includes(file));
    if (missingFromDisk.length > 0) {
        throw new Error(
            `Required game JS missing from ${inputDir}/ (listed in JS_FILE_ORDER): ${missingFromDisk.join(', ')}`
        );
    }

    const orphans = onDiskJs.filter((file) => !uniqueOrdered.has(file));
    if (orphans.length > 0) {
        throw new Error(
            `Game JS on disk not listed in JS_FILE_ORDER (would not ship in app.min.js): ${orphans.join(', ')}. ` +
            'Add each file to JS_FILE_ORDER and src/index.html BUILD:GAME_SCRIPTS markers.'
        );
    }

    // Fail closed on unreadable required files (permissions, race, etc.).
    for (const file of JS_FILE_ORDER) {
        const inputPath = path.join(inputDir, file);
        try {
            await fs.access(inputPath);
        } catch (error) {
            throw new Error(`Cannot read required game JS: ${inputPath} (${error.message})`);
        }
    }
}

// Bundle and minify JS files
async function bundleJS(inputDir, outputDir) {
    await assertJsBundleSourcesComplete(inputDir);

    // Create a temporary directory for concatenation
    const tempDir = path.join(outputDir, 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    const tempFile = path.join(tempDir, 'temp-bundle.js');
    let concatenatedContent = '';

    for (const file of JS_FILE_ORDER) {
        const inputPath = path.join(inputDir, file);
        const content = await fs.readFile(inputPath, 'utf8');
        concatenatedContent += content + '\n';
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

        console.log(`JavaScript files bundled and minified successfully (${JS_FILE_ORDER.length} modules)!`);
    } catch (error) {
        // Best-effort cleanup so a failed minify does not leave dist/temp behind.
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        } catch {
            // ignore cleanup errors
        }
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

async function copyOptionalBuildFile(sourcePath, destPath) {
    try {
        await fs.access(sourcePath);
    } catch {
        console.warn(`Warning: optional build file missing, skipping: ${sourcePath}`);
        return;
    }

    try {
        await fs.copyFile(sourcePath, destPath);
    } catch (error) {
        console.warn(`Warning: failed to copy ${sourcePath} -> ${destPath}: ${error.message}`);
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
            copyOptionalBuildFile('src/_headers', `${OUTPUT_DIR}/_headers`),
        ]);

        console.log('Build completed successfully!');
    } catch (error) {
        console.error('Build failed:', error);
        process.exit(1);
    }
}

main();
