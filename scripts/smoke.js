#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function readRepoFile(relativePath) {
    return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

function assertContract(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
    console.log(`OK  ${message}`);
}

function extractFunctionBody(source, functionName) {
    const signature = `function ${functionName}()`;
    const start = source.indexOf(signature);
    if (start === -1) {
        return null;
    }

    const braceStart = source.indexOf('{', start);
    if (braceStart === -1) {
        return null;
    }

    let depth = 0;
    for (let i = braceStart; i < source.length; i++) {
        const char = source[i];
        if (char === '{') {
            depth += 1;
        } else if (char === '}') {
            depth -= 1;
            if (depth === 0) {
                return source.slice(braceStart + 1, i);
            }
        }
    }

    return null;
}

function checkControlContracts(playerSource, abilitiesSource, sketchSource) {
    assertContract(
        /keyIsDown\(LEFT_ARROW\)\s*\|\|\s*keyIsDown\(65\)/.test(playerSource),
        'Movement supports LEFT_ARROW and A'
    );
    assertContract(
        /keyIsDown\(RIGHT_ARROW\)\s*\|\|\s*keyIsDown\(68\)/.test(playerSource),
        'Movement supports RIGHT_ARROW and D'
    );
    assertContract(
        /\(keyCode === UP_ARROW \|\| keyCode === 87\)/.test(playerSource),
        'Jump supports UP_ARROW and W'
    );
    assertContract(
        /leftDashPressed = keyCode === LEFT_ARROW \|\| keyCode === 65/.test(abilitiesSource),
        'Dash supports LEFT_ARROW double-tap and A double-tap'
    );
    assertContract(
        /rightDashPressed = keyCode === RIGHT_ARROW \|\| keyCode === 68/.test(abilitiesSource),
        'Dash supports RIGHT_ARROW double-tap and D double-tap'
    );
    assertContract(
        /\(key === 'k' \|\| key === 'K'\)\)\s*\{\s*gameState\.showAchievementsScreen = true;/.test(sketchSource),
        'Achievements screen opens with K'
    );
}

function checkAchievementPersistenceContracts(sketchSource, achievementsSource) {
    assertContract(
        /setup\(\)[\s\S]*loadAchievements\(\);\s*\/\/ Load achievements from localStorage/.test(sketchSource),
        'Achievements load during setup'
    );

    const restartBody = extractFunctionBody(sketchSource, 'restartGame');
    assertContract(!!restartBody, 'restartGame function exists');

    const initializeStatesIndex = restartBody.indexOf('initializeStates();');
    const loadAchievementsIndex = restartBody.indexOf('loadAchievements();');
    assertContract(initializeStatesIndex !== -1, 'restartGame reinitializes game state');
    assertContract(loadAchievementsIndex !== -1, 'restartGame reloads achievements');
    assertContract(
        initializeStatesIndex < loadAchievementsIndex,
        'restartGame reloads achievements after state initialization'
    );

    assertContract(
        /function loadAchievements\(\)[\s\S]*try\s*\{[\s\S]*JSON\.parse\(savedAchievements\)[\s\S]*catch \(error\)/.test(achievementsSource),
        'Achievements loading handles malformed storage safely'
    );
}

function checkScreenNavigationContracts(sketchSource, helpSource, objectInfoSource, aboutSource, achievementsSource) {
    assertContract(
        /gameState\.showHelpScreen && handleHelpScreenKeyPressed\(\)/.test(sketchSource),
        'keyPressed delegates to Help screen handler'
    );
    assertContract(
        /gameState\.showObjectInfoScreen && handleObjectInfoScreenKeyPressed\(\)/.test(sketchSource),
        'keyPressed delegates to Object Info screen handler'
    );
    assertContract(
        /gameState\.showAboutScreen && handleAboutScreenKeyPressed\(\)/.test(sketchSource),
        'keyPressed delegates to About screen handler'
    );
    assertContract(
        /gameState\.showAchievementsScreen && handleAchievementsScreenKeyPressed\(\)/.test(sketchSource),
        'keyPressed delegates to Achievements screen handler'
    );
    assertContract(
        /keyCode === ESCAPE\)\s*\{\s*gameState\.showHelpScreen = true;/.test(sketchSource),
        'Escape opens Help screen during gameplay'
    );

    assertContract(
        /if \(keyCode === ESCAPE\)\s*\{\s*gameState\.showHelpScreen = false;/.test(helpSource),
        'Help screen closes on Escape'
    );
    assertContract(
        /if \(keyCode === RIGHT_ARROW\)\s*\{\s*gameState\.showHelpScreen = false;\s*gameState\.showObjectInfoScreen = true;/.test(helpSource),
        'Help screen navigates right to Object Info'
    );
    assertContract(
        /if \(keyCode === LEFT_ARROW\)\s*\{\s*gameState\.showHelpScreen = false;\s*gameState\.showAboutScreen = true;/.test(helpSource),
        'Help screen navigates left to About'
    );

    assertContract(
        /if \(keyCode === ESCAPE\)\s*\{\s*gameState\.showObjectInfoScreen = false;/.test(objectInfoSource),
        'Object Info screen closes on Escape'
    );
    assertContract(
        /if \(keyCode === LEFT_ARROW\)\s*\{\s*gameState\.showObjectInfoScreen = false;\s*gameState\.showHelpScreen = true;/.test(objectInfoSource),
        'Object Info screen navigates left to Help'
    );
    assertContract(
        /if \(keyCode === RIGHT_ARROW\)\s*\{\s*gameState\.showObjectInfoScreen = false;\s*gameState\.showAboutScreen = true;/.test(objectInfoSource),
        'Object Info screen navigates right to About'
    );

    assertContract(
        /if \(keyCode === ESCAPE\)\s*\{\s*gameState\.showAboutScreen = false;/.test(aboutSource),
        'About screen closes on Escape'
    );
    assertContract(
        /if \(keyCode === LEFT_ARROW\)\s*\{\s*gameState\.showAboutScreen = false;\s*gameState\.showObjectInfoScreen = true;/.test(aboutSource),
        'About screen navigates left to Object Info'
    );
    assertContract(
        /if \(keyCode === RIGHT_ARROW\)\s*\{\s*gameState\.showAboutScreen = false;\s*gameState\.showHelpScreen = true;/.test(aboutSource),
        'About screen navigates right to Help'
    );

    assertContract(
        /if \(keyCode === ESCAPE\)\s*\{\s*gameState\.showAchievementsScreen = false;/.test(achievementsSource),
        'Achievements screen closes on Escape'
    );
}

function checkBuildAndAssetContracts(buildSource, indexSource, assetSource) {
    assertContract(
        indexSource.includes('<!-- BUILD:GAME_SCRIPTS_START -->') &&
        indexSource.includes('<!-- BUILD:GAME_SCRIPTS_END -->'),
        'index.html includes build markers for game script replacement'
    );
    assertContract(
        /item\.name === '_unused'/.test(buildSource),
        'build skips quarantined _unused assets'
    );
    assertContract(
        !assetSource.includes('assets/mimic/') &&
        !assetSource.includes('assets/bosses/flying_demon/attack_') &&
        !assetSource.includes('assets/music/8-bit-heaven-26287.mp3'),
        'Runtime asset loader does not reference quarantined assets'
    );
}

function checkNotificationQueueContracts(uiSource, sketchSource, utilsSource, abilitiesSource, objectsSource, achievementsSource) {
    assertContract(
        /function updateAndDrawCenterNotifications\(\)/.test(uiSource),
        'Center notification queue renderer exists'
    );
    assertContract(
        /updateAndDrawCenterNotifications\(\);/.test(sketchSource),
        'Gameplay draw loop uses queued center notifications'
    );
    assertContract(
        /queueBossDefeatedNotification\(\)/.test(abilitiesSource),
        'Boss defeat enqueues queue-managed notification'
    );
    assertContract(
        /queueTentacleNotification\(/.test(utilsSource),
        'Tentacle unlock enqueues queue-managed notification'
    );
    assertContract(
        !/text\("Boss Defeated!", width \/ 2, height \/ 2\)/.test(objectsSource),
        'Boss defeated legacy center draw path is removed'
    );
    assertContract(
        /function showAchievementNotification\(name, points\)\s*\{\s*queueAchievementNotification\(name, points\);/.test(achievementsSource),
        'Achievement notifications enqueue into shared queue'
    );
    assertContract(
        /function measureCenterNotificationTextBlock\(/.test(uiSource),
        'Center notification panel uses text measurement helper'
    );
    assertContract(
        !/rect\(centerX - 170, centerY - 80, 340, 80, 10\)/.test(uiSource),
        'Fixed-size center notification panel is removed'
    );
}

function checkPlayTimeContracts(sketchSource) {
    assertContract(
        /gameState\.playTime\s*\+=\s*frameDelta\s*\/\s*TARGET_FPS;/.test(sketchSource),
        'Play time accumulates from active frame delta'
    );
    assertContract(
        !/gameState\.playTime\s*=\s*\(millis\(\)\s*\/\s*1000\)\s*-\s*gameState\.startTime;/.test(sketchSource),
        'Play time is not recomputed from wall-clock startTime'
    );
}

function checkAnalyticsContracts(analyticsSource, buildSource, sketchSource, introSource, gameOverSource, utilsSource, objectsSource) {
    assertContract(
        /'analytics\.js'/.test(buildSource),
        'Build order includes analytics.js before gameplay scripts'
    );
    assertContract(
        /trackIntroViewEvent\(\);/.test(sketchSource),
        'setup tracks intro_view when intro screen is shown'
    );
    assertContract(
        /trackGameStartEvent\('auto'\)/.test(sketchSource),
        'setup tracks game_start for auto-start paths'
    );
    assertContract(
        /trackGameStartEvent\('retry'\)/.test(sketchSource),
        'restartGame tracks game_start with retry input'
    );
    assertContract(
        /trackGameOverEvent\([^)]*\);/.test(sketchSource),
        'triggerGameOver tracks game_over event'
    );
    assertContract(
        /trackRetryClickEvent\('keyboard'\)/.test(sketchSource),
        'Keyboard retry tracks retry_click event'
    );
    assertContract(
        /trackAnalyticsSafe\('retry_click',[\s\S]*version:\s*GAME_VERSION/.test(sketchSource),
        'retry_click payload includes version'
    );
    assertContract(
        /pendingGameOverCause\s*=/.test(sketchSource) &&
        /pendingGameOverCause\s*=/.test(utilsSource) &&
        /pendingGameOverCause\s*=/.test(objectsSource),
        'Game over cause is set in lethal paths'
    );
    assertContract(
        /trackGameStartEvent\('keyboard'\)/.test(introSource) &&
        /trackGameStartEvent\('mouse'\)/.test(introSource),
        'Intro handlers track game_start for keyboard and mouse input'
    );
    assertContract(
        /trackRetryClickEvent\('mouse'\)/.test(gameOverSource),
        'Game-over retry click tracks retry_click event'
    );
    assertContract(
        /function trackEvent\(eventName, fields\)/.test(analyticsSource),
        'Analytics helper exposes trackEvent(eventName, fields)'
    );
}

function main() {
    const playerSource = readRepoFile('src/js/player.js');
    const abilitiesSource = readRepoFile('src/js/abilities.js');
    const sketchSource = readRepoFile('src/js/sketch.js');
    const introSource = readRepoFile('src/js/introScreen.js');
    const gameOverSource = readRepoFile('src/js/gameOverScreen.js');
    const achievementsSource = readRepoFile('src/js/achievements.js');
    const helpSource = readRepoFile('src/js/helpScreen.js');
    const objectInfoSource = readRepoFile('src/js/objectInfoScreen.js');
    const aboutSource = readRepoFile('src/js/aboutScreen.js');
    const uiSource = readRepoFile('src/js/ui.js');
    const utilsSource = readRepoFile('src/js/utils.js');
    const objectsSource = readRepoFile('src/js/objects.js');
    const analyticsSource = readRepoFile('src/js/analytics.js');
    const buildSource = readRepoFile('build.js');
    const indexSource = readRepoFile('src/index.html');
    const assetSource = readRepoFile('src/js/assets.js');

    checkControlContracts(playerSource, abilitiesSource, sketchSource);
    checkAchievementPersistenceContracts(sketchSource, achievementsSource);
    checkScreenNavigationContracts(sketchSource, helpSource, objectInfoSource, aboutSource, achievementsSource);
    checkBuildAndAssetContracts(buildSource, indexSource, assetSource);
    checkNotificationQueueContracts(uiSource, sketchSource, utilsSource, abilitiesSource, objectsSource, achievementsSource);
    checkPlayTimeContracts(sketchSource);
    checkAnalyticsContracts(analyticsSource, buildSource, sketchSource, introSource, gameOverSource, utilsSource, objectsSource);

    console.log('Smoke checks passed.');
}

main();
