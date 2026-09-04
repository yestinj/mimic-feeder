#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

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
    const repoRoot = path.join(__dirname, '..');
    const srcDir = path.join(repoRoot, 'src', 'js');
    const scriptsDir = path.join(repoRoot, 'scripts');

    const sourceFiles = fs.readdirSync(srcDir)
        .filter((file) => file.endsWith('.js'))
        .sort()
        .map((file) => path.join(srcDir, file));

    const scriptFiles = collectJsFiles(scriptsDir).sort();

    return [
        path.join(repoRoot, 'build.js'),
        ...sourceFiles,
        ...scriptFiles,
    ];
}

function checkFileSyntax(filePath) {
    try {
        execFileSync(process.execPath, ['--check', filePath], { stdio: 'pipe' });
        console.log(`OK  ${path.relative(path.join(__dirname, '..'), filePath)}`);
        return true;
    } catch (error) {
        console.error(`FAIL ${path.relative(path.join(__dirname, '..'), filePath)}`);
        if (error.stdout) {
            process.stderr.write(error.stdout.toString());
        }
        if (error.stderr) {
            process.stderr.write(error.stderr.toString());
        }
        return false;
    }
}

function main() {
    const files = getJavaScriptFiles();
    let hasFailure = false;

    for (const filePath of files) {
        const passed = checkFileSyntax(filePath);
        if (!passed) {
            hasFailure = true;
        }
    }

    if (hasFailure) {
        process.exit(1);
    }

    console.log(`Syntax lint passed for ${files.length} files.`);
}

main();
