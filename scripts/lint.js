#!/usr/bin/env node
/**
 * `npm run lint`: two gates, both must pass.
 *
 * 1. Syntax: `node --check` on every Node tooling file (build.js,
 *    eslint.config.js, scripts/).
 * 2. ESLint on the tooling and on the game in src/ (see eslint.config.js).
 *
 * TypeScript's own checks run separately (`npm run typecheck`).
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { ESLint } = require('eslint');

const REPO_ROOT = path.join(__dirname, '..');

function collectJsFiles(dirPath, files = []) {
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

function toolingFiles() {
    return [
        path.join(REPO_ROOT, 'build.js'),
        path.join(REPO_ROOT, 'eslint.config.js'),
        ...collectJsFiles(path.join(REPO_ROOT, 'scripts')).sort(),
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
    const files = toolingFiles();
    const failures = files.filter((filePath) => !checkFileSyntax(filePath));
    if (failures.length > 0) {
        return false;
    }
    console.log(`OK  syntax check (${files.length} files)`);
    return true;
}

async function runEslint() {
    const eslint = new ESLint({ cwd: REPO_ROOT });
    const results = await eslint.lintFiles(['build.js', 'eslint.config.js', 'scripts/', 'src/', 'vite.config.mts']);
    const problemCount = results.reduce((sum, r) => sum + r.errorCount + r.warningCount, 0);
    if (problemCount > 0) {
        const formatter = await eslint.loadFormatter('stylish');
        console.error(await formatter.format(results));
        console.error('FAIL ESLint');
        return false;
    }
    console.log(`OK  ESLint (${results.length} files)`);
    return true;
}

async function main() {
    const syntaxOk = runSyntaxCheck();
    // Lint even after a syntax failure: ESLint reports the parse error with context.
    const eslintOk = await runEslint();
    if (!syntaxOk || !eslintOk) {
        process.exit(1);
    }
    console.log('Lint passed.');
}

main().catch((error) => {
    console.error('Lint crashed:', error && error.stack ? error.stack : error);
    process.exit(1);
});
