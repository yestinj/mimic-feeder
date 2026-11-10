#!/usr/bin/env node
/**
 * `npm run lint`: three gates, all must pass.
 *
 * 1. Syntax: `node --check` on every JS file one at a time (src/index.html
 *    loads the game files separately in dev, so each must parse on its own).
 * 2. ESLint on the Node tooling (build.js, eslint.config.js, scripts/) with
 *    Node globals.
 * 3. ESLint on the game exactly as shipped: src/js concatenated in build.js
 *    JS_FILE_ORDER, with browser + p5/p5.sound globals (see eslint.config.js).
 *    Findings are reported against the original src/js file and line.
 *
 * Gate 3 first checks scripts/p5-globals.json was generated from the p5 CDN
 * pins currently in src/index.html (regenerate with `npm run lint:p5-globals`).
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { ESLint } = require('eslint');
const { JS_DIR, JS_FILE_ORDER } = require('../build.js');
const { GAME_BUNDLE_PATH } = require('../eslint.config.js');
const { readP5ScriptUrls } = require('./generate-p5-globals.js');

const REPO_ROOT = path.join(__dirname, '..');

function collectJsFiles(dirPath, files = []) {
    if (!fs.existsSync(dirPath)) {
        return files;
    }

    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            collectJsFiles(fullPath, files);
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
            files.push(fullPath);
        }
    }

    return files;
}

function getJavaScriptFiles() {
    const srcDir = path.join(REPO_ROOT, 'src', 'js');
    const scriptsDir = path.join(REPO_ROOT, 'scripts');

    const sourceFiles = fs.readdirSync(srcDir)
        .filter((file) => file.endsWith('.js'))
        .sort()
        .map((file) => path.join(srcDir, file));

    const scriptFiles = collectJsFiles(scriptsDir).sort();

    return [
        path.join(REPO_ROOT, 'build.js'),
        path.join(REPO_ROOT, 'eslint.config.js'),
        ...sourceFiles,
        ...scriptFiles,
    ];
}

function checkFileSyntax(filePath) {
    try {
        execFileSync(process.execPath, ['--check', filePath], { stdio: 'pipe' });
        return true;
    } catch (error) {
        console.error(`FAIL ${path.relative(REPO_ROOT, filePath)}`);
        if (error.stdout) {
            process.stderr.write(error.stdout.toString());
        }
        if (error.stderr) {
            process.stderr.write(error.stderr.toString());
        }
        return false;
    }
}

function runSyntaxCheck() {
    const files = getJavaScriptFiles();
    const failures = files.filter((filePath) => !checkFileSyntax(filePath));
    if (failures.length > 0) {
        return false;
    }
    console.log(`OK  syntax check (${files.length} files)`);
    return true;
}

/**
 * Fails when scripts/p5-globals.json was generated from different p5 script
 * URLs than src/index.html now loads (e.g. after a p5 version bump).
 */
function checkP5GlobalsFresh() {
    const indexHtml = fs.readFileSync(path.join(REPO_ROOT, 'src', 'index.html'), 'utf8');
    const pinnedUrls = readP5ScriptUrls(indexHtml);
    const { sources, p5Version } = require('./p5-globals.json');
    if (JSON.stringify(pinnedUrls) !== JSON.stringify(sources)) {
        console.error(
            'FAIL scripts/p5-globals.json is stale.\n' +
            `  generated from: ${sources.join(', ')}\n` +
            `  index.html now: ${pinnedUrls.join(', ')}\n` +
            '  Run `npm run lint:p5-globals` and commit the result.'
        );
        return false;
    }
    console.log(`OK  p5 globals match index.html pins (p5 ${p5Version})`);
    return true;
}

/**
 * Concatenates the game sources the way build.js bundleJS does
 * (`content + '\n'` per file) and records where each file starts.
 */
function buildGameBundle() {
    const segments = [];
    let code = '';
    let nextLine = 1;
    for (const file of JS_FILE_ORDER) {
        const filePath = path.join(REPO_ROOT, JS_DIR, file);
        const content = fs.readFileSync(filePath, 'utf8') + '\n';
        const lineCount = content.split('\n').length - 1;
        segments.push({ filePath, startLine: nextLine, endLine: nextLine + lineCount - 1 });
        code += content;
        nextLine += lineCount;
    }
    return { code, segments };
}

function findSegment(segments, line) {
    return segments.find((segment) => line >= segment.startLine && line <= segment.endLine)
        || segments[segments.length - 1];
}

/**
 * Splits one bundle lint result into per-source-file results so the formatter
 * prints real paths and line numbers.
 */
function mapBundleResult(bundleResult, segments) {
    const byFile = new Map();
    for (const message of bundleResult.messages) {
        const segment = findSegment(segments, message.line || 1);
        const offset = segment.startLine - 1;
        const mapped = { ...message, line: (message.line || 1) - offset };
        if (typeof message.endLine === 'number') {
            mapped.endLine = message.endLine - offset;
        }
        // Autofix ranges index into the bundle text; drop them rather than mislead.
        delete mapped.fix;
        delete mapped.suggestions;
        if (!byFile.has(segment.filePath)) {
            byFile.set(segment.filePath, []);
        }
        byFile.get(segment.filePath).push(mapped);
    }

    return [...byFile.entries()].map(([filePath, messages]) => ({
        filePath,
        messages,
        suppressedMessages: [],
        errorCount: messages.filter((m) => m.severity === 2).length,
        fatalErrorCount: messages.filter((m) => m.fatal).length,
        warningCount: messages.filter((m) => m.severity === 1).length,
        fixableErrorCount: 0,
        fixableWarningCount: 0,
        usedDeprecatedRules: [],
    }));
}

async function runEslint() {
    const eslint = new ESLint({ cwd: REPO_ROOT });

    const toolingResults = await eslint.lintFiles(['build.js', 'eslint.config.js', 'scripts/']);

    const { code, segments } = buildGameBundle();
    const [bundleResult] = await eslint.lintText(code, {
        filePath: path.join(REPO_ROOT, GAME_BUNDLE_PATH),
        warnIgnored: true,
    });
    const gameResults = mapBundleResult(bundleResult, segments);

    const results = [...toolingResults, ...gameResults];
    const problemCount = results.reduce((sum, r) => sum + r.errorCount + r.warningCount, 0);
    if (problemCount > 0) {
        const formatter = await eslint.loadFormatter('stylish');
        console.error(await formatter.format(results));
        console.error('FAIL ESLint');
        return false;
    }

    console.log(`OK  ESLint tooling (${toolingResults.length} files)`);
    console.log(`OK  ESLint game bundle (${JS_FILE_ORDER.length} files concatenated in JS_FILE_ORDER)`);
    return true;
}

async function main() {
    const syntaxOk = runSyntaxCheck();
    const globalsOk = checkP5GlobalsFresh();
    // Lint even after a syntax failure: ESLint reports the parse error with context.
    const eslintOk = globalsOk ? await runEslint() : false;

    if (!syntaxOk || !globalsOk || !eslintOk) {
        process.exit(1);
    }
    console.log('Lint passed.');
}

main().catch((error) => {
    console.error('Lint crashed:', error && error.stack ? error.stack : error);
    process.exit(1);
});
