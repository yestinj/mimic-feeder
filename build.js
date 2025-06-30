const fs = require('fs').promises;
const path = require('path');
const htmlMinifier = require('html-minifier');
const CleanCSS = require('clean-css');

const OUTPUT_DIR = 'dist';
const ASSET_DIR = 'src/assets';
const JS_DIR = 'src/js';

// Minify HTML
async function minifyHTML(inputDir, outputDir) {
    const files = await fs.readdir(inputDir);
    for (const file of files) {
        if (file.endsWith('.html')) {
            const inputPath = path.join(inputDir, file);
            const outputPath = path.join(outputDir, file);
            const content = await fs.readFile(inputPath, 'utf8');
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

// Copy JS files without modification
async function copyJS(inputDir, outputDir) {
    const files = await fs.readdir(inputDir);
    for (const file of files) {
        if (file.endsWith('.js')) {
            const inputPath = path.join(inputDir, file);
            const outputPath = path.join(outputDir, file);
            await fs.mkdir(outputDir, { recursive: true });
            await fs.copyFile(inputPath, outputPath);
        }
    }
}

// Copy assets (files and directories) without modification
async function copyAssets(inputDir, outputDir) {
    const items = await fs.readdir(inputDir, { withFileTypes: true });
    for (const item of items) {
        const inputPath = path.join(inputDir, item.name);
        const outputPath = path.join(outputDir, item.name);

        if (item.isDirectory()) {
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
            copyJS(JS_DIR, `${OUTPUT_DIR}/js`),
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