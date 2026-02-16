#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function getJavaScriptFiles() {
    const srcDir = path.join(__dirname, '..', 'src', 'js');
    const sourceFiles = fs.readdirSync(srcDir)
        .filter((file) => file.endsWith('.js'))
        .sort()
        .map((file) => path.join(srcDir, file));

    return [
        path.join(__dirname, '..', 'build.js'),
        ...sourceFiles,
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
