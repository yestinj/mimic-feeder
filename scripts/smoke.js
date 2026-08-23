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
        /\(key === 'k' \|\| key === 'K'\)\)\s*\{[\s\S]*?gameState\.showAchievementsScreen = true;/.test(sketchSource),
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
        /recentSpawnXPositions\s*=\s*\[\s*\]/.test(restartBody),
        'restartGame clears recentSpawnXPositions spawn clustering history'
    );

    const loadAchievementsBody = extractFunctionBody(achievementsSource, 'loadAchievements');
    assertContract(!!loadAchievementsBody, 'loadAchievements function exists');

    const storageTryIndex = loadAchievementsBody.indexOf('try {');
    const storageReadIndex = loadAchievementsBody.indexOf("localStorage.getItem('mimicAchievements')");
    assertContract(
        storageTryIndex !== -1 && storageReadIndex !== -1 && storageTryIndex < storageReadIndex &&
        loadAchievementsBody.includes('catch (error)'),
        'Achievements loading guards localStorage reads and parsing'
    );
    assertContract(
        /function clearStoredAchievementsSafely\(\)\s*\{[\s\S]*try\s*\{[\s\S]*localStorage\.removeItem\('mimicAchievements'\)[\s\S]*catch \(error\)/.test(achievementsSource) &&
        loadAchievementsBody.includes('clearStoredAchievementsSafely();'),
        'Achievements cleanup guards unavailable localStorage'
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
        /keyCode === ESCAPE\)\s*\{[\s\S]*?gameState\.showHelpScreen = true;/.test(sketchSource),
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

function extractJsFileOrder(buildSource) {
    const match = buildSource.match(/const JS_FILE_ORDER = \[([\s\S]*?)\];/);
    if (!match) {
        return null;
    }
    return [...match[1].matchAll(/['"]([^'"]+\.js)['"]/g)].map((entry) => entry[1]);
}

function extractHtmlGameScripts(indexSource) {
    const start = indexSource.indexOf('<!-- BUILD:GAME_SCRIPTS_START -->');
    const end = indexSource.indexOf('<!-- BUILD:GAME_SCRIPTS_END -->');
    if (start === -1 || end === -1 || end <= start) {
        return null;
    }
    const block = indexSource.slice(start, end);
    return [...block.matchAll(/src="js\/([^"]+\.js)"/g)].map((entry) => entry[1]);
}

function checkReducedMotionContracts(sketchSource) {
    assertContract(
        /function prefersReducedMotion\(\)/.test(sketchSource) &&
        /prefers-reduced-motion:\s*reduce/.test(sketchSource),
        'prefersReducedMotion helper checks OS reduced-motion preference'
    );
    assertContract(
        /function triggerScreenShake\(intensity\)\s*\{[\s\S]*prefersReducedMotion\(\)/.test(sketchSource),
        'triggerScreenShake no-ops when reduced motion is preferred'
    );
    assertContract(
        /screenShakeAmount > 0 && !prefersReducedMotion\(\)/.test(sketchSource),
        'draw applies screen shake only when reduced motion is not preferred'
    );
}

function checkP5CdnContracts(indexSource) {
    assertContract(
        /cdnjs\.cloudflare\.com\/ajax\/libs\/p5\.js\/1\.11\.13\/p5\.min\.js/.test(indexSource) &&
        /cdnjs\.cloudflare\.com\/ajax\/libs\/p5\.js\/1\.11\.13\/addons\/p5\.sound\.min\.js/.test(indexSource),
        'index.html pins p5.js 1.11.13 and p5.sound on cdnjs'
    );

    const p5ScriptTags = indexSource.match(/<script[^>]+cdnjs\.cloudflare\.com\/ajax\/libs\/p5\.js\/1\.11\.13\/[^>]+><\/script>/g) || [];
    assertContract(
        p5ScriptTags.length === 2 && p5ScriptTags.every((tag) => !/\sintegrity=/.test(tag)),
        'p5 CDN scripts intentionally omit brittle integrity attributes'
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
        /async function assertJsBundleSourcesComplete\(/.test(buildSource) &&
        /throw new Error\(/.test(buildSource) &&
        !/console\.warn\(`Warning: Could not read file/.test(buildSource),
        'build fails closed on missing game JS (no warn-and-skip bundle path)'
    );

    const jsFileOrder = extractJsFileOrder(buildSource);
    assertContract(
        Array.isArray(jsFileOrder) && jsFileOrder.length > 0,
        'build.js defines JS_FILE_ORDER'
    );

    const jsDir = path.join(__dirname, '..', 'src', 'js');
    const onDiskJs = fs.readdirSync(jsDir).filter((name) => name.endsWith('.js')).sort();
    const orderSorted = [...jsFileOrder].sort();

    assertContract(
        new Set(jsFileOrder).size === jsFileOrder.length,
        'JS_FILE_ORDER has no duplicate entries'
    );
    assertContract(
        onDiskJs.length === orderSorted.length &&
        onDiskJs.every((file, index) => file === orderSorted[index]),
        'JS_FILE_ORDER matches every src/js/*.js file (no missing modules or orphans)'
    );

    const htmlScripts = extractHtmlGameScripts(indexSource);
    assertContract(
        Array.isArray(htmlScripts) && htmlScripts.length === jsFileOrder.length,
        'index.html game script tags match JS_FILE_ORDER length'
    );
    assertContract(
        Array.isArray(htmlScripts) &&
        htmlScripts.every((file, index) => file === jsFileOrder[index]),
        'index.html game script order matches JS_FILE_ORDER'
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

function checkPauseContracts(sketchSource) {
    assertContract(
        /gameState\.showIntroScreen \|\| gameState\.gameOver \|\| gameState\.isPaused \|\|/.test(sketchSource),
        'keyPressed inactive guard includes isPaused'
    );
    assertContract(
        /gameState\.isPaused \|\|[\s\S]*gameState\.showHelpScreen \|\| gameState\.showObjectInfoScreen \|\|[\s\S]*gameState\.showAboutScreen \|\| gameState\.showAchievementsScreen/.test(sketchSource),
        'Gameplay keys blocked while paused or overlay screens are open'
    );
    assertContract(
        /function captureGameplayFreezeSnapshot\(\)/.test(sketchSource) &&
        /lastGameplayFrame\s*=\s*get\(\)/.test(sketchSource),
        'Pause freeze snapshot helper captures canvas via get()'
    );
    assertContract(
        /captureGameplayFreezeSnapshot\(\)/.test(sketchSource) &&
        /gameState\.isPaused\s*=\s*true/.test(sketchSource),
        'Pause rising edge captures freeze snapshot before setting isPaused'
    );
    assertContract(
        /function isPauseGameplayShell\(\)/.test(sketchSource) &&
        /if \(isPauseGameplayShell\(\)\)/.test(sketchSource) &&
        /image\(lastGameplayFrame/.test(sketchSource) &&
        /drawPauseScreen\(\)/.test(sketchSource),
        'Pause shell draws freeze snapshot (or static fallback) then pause overlay and returns'
    );
    assertContract(
        /if \(!gameState\.isPaused\)\s*\{\s*lastGameplayFrame\s*=\s*null;/.test(sketchSource),
        'Resize clears lastGameplayFrame only when not paused'
    );
    // Play time is only updated after the pause-shell early return, so it cannot advance while paused.
    const drawBody = extractFunctionBody(sketchSource, 'draw');
    assertContract(
        drawBody &&
        !/lastGameplayFrame\s*=\s*get\(\)/.test(drawBody),
        'draw() does not capture freeze snapshot every active frame'
    );
    assertContract(
        drawBody &&
        /if \(isPauseGameplayShell\(\)\)/.test(drawBody) &&
        drawBody.indexOf('isPauseGameplayShell()') < drawBody.indexOf('gameState.playTime +='),
        'Play time does not accumulate while paused (update is after pause-shell return)'
    );
    assertContract(
        drawBody &&
        drawBody.indexOf('isPauseGameplayShell()') < drawBody.indexOf('updatePlayer()'),
        'Player simulation does not run under pause shell'
    );
    assertContract(
        /function isMidRunInfoOverlay\(\)/.test(sketchSource) &&
        /function drawPlayfieldUnderlay\(\)/.test(sketchSource) &&
        /function ensureGameplayFreezeSnapshotForOverlay\(\)/.test(sketchSource),
        'Mid-run overlay underlay helpers exist (M6)'
    );
    assertContract(
        drawBody &&
        /if \(isMidRunInfoOverlay\(\)\)/.test(drawBody) &&
        /drawPlayfieldUnderlay\(\)/.test(drawBody) &&
        drawBody.indexOf('isMidRunInfoOverlay()') < drawBody.indexOf('updatePlayer()'),
        'Mid-run info overlays draw playfield underlay and skip simulation'
    );
    assertContract(
        /ensureGameplayFreezeSnapshotForOverlay\(\);\s*gameState\.showHelpScreen = true/.test(sketchSource) &&
        /ensureGameplayFreezeSnapshotForOverlay\(\);\s*gameState\.showAchievementsScreen = true/.test(sketchSource),
        'Opening help/achievements ensures freeze snapshot from active play'
    );
}

function checkBombCountContracts(abilitiesSource, utilsSource, objectsSource, achievementsSource) {
    assertContract(
        /function handleBombCollection\(obj\)\s*\{[\s\S]*collectedCounts\.small_bomb\+\+/.test(utilsSource),
        'handleBombCollection owns small_bomb counting'
    );
    assertContract(
        /OBJ_SMALL_BOMB\)\s*\{[\s\S]*?bombExplosions\.push[\s\S]*?objects\.splice/.test(objectsSource) &&
        !/if \(obj\.type === OBJ_SMALL_BOMB\)\s*\{[\s\S]*?collectedCounts\.small_bomb\+\+/.test(objectsSource),
        'Ground bomb path does not increment small_bomb (player detonations only)'
    );
    assertContract(
        /OBJ_FIREBALL\)\s*\{[\s\S]*?type: 'fireball_burst'[\s\S]*?objects\.splice/.test(objectsSource) &&
        !/if \(obj\.type === OBJ_FIREBALL\)\s*\{[\s\S]*?collectedCounts\.fireball\+\+/.test(objectsSource),
        'Ground fireball path does not increment fireball (player detonations only)'
    );
    assertContract(
        /function getHazardDetonations\(collectedCounts\)[\s\S]*small_bomb[\s\S]*fireball/.test(achievementsSource),
        'Hazard detonation achievements use collectedCounts (filled only via handleBombCollection)'
    );

    const boltBombBlock = abilitiesSource.match(
        /else \{\s*\/\/ if its a small bomb[\s\S]*?checkForPlayerLevelUp\(\);\s*\}/
    );
    assertContract(!!boltBombBlock, 'Shadow-bolt small-bomb hit path exists');
    assertContract(
        /handleBombCollection\(obj\)/.test(boltBombBlock[0]),
        'Shadow-bolt bomb path calls handleBombCollection'
    );
    assertContract(
        !/collectedCounts\.small_bomb\+\+/.test(boltBombBlock[0]),
        'Shadow-bolt bomb path does not pre-increment small_bomb (no double-count)'
    );
}

function checkAnalyticsRemovedContracts(buildSource, sketchSource, introSource, gameOverSource) {
    assertContract(
        !/'analytics\.js'/.test(buildSource),
        'Build order no longer includes analytics.js'
    );
    assertContract(
        !fs.existsSync(path.join(__dirname, '..', 'src', 'js', 'analytics.js')),
        'Client analytics module is removed'
    );
    assertContract(
        !fs.existsSync(path.join(__dirname, '..', 'functions', 'api', 'track.js')),
        'Pages Function track endpoint is removed'
    );
    assertContract(
        !/trackIntroViewEvent|trackGameStartEvent|trackGameOverEvent|trackRetryClickEvent|trackAnalyticsSafe|trackEvent\s*\(/.test(sketchSource),
        'sketch.js has no analytics track call sites'
    );
    assertContract(
        !/trackGameStartEvent|trackRetryClickEvent/.test(introSource + gameOverSource),
        'Intro and game-over screens have no analytics track call sites'
    );
    assertContract(
        !fs.existsSync(path.join(__dirname, '..', 'src', '_routes.json')),
        'API _routes.json is removed with Functions'
    );
}

function checkMagnetHelpContracts(helpSource, uiSource) {
    assertContract(
        /snapshots on-screen loot\/hazards/.test(helpSource) ||
        /Marked objects keep pulling/.test(helpSource),
        'Help screen describes magnetism snapshot contract'
    );
    assertContract(
        /including bombs|incl\. bombs|bombs too/i.test(helpSource + uiSource),
        'Magnet help/unlock copy warns that bombs can be pulled'
    );
}

function checkAchievementSaveContracts(achievementsSource) {
    assertContract(
        /function saveAchievements\(\)\s*\{[\s\S]*try\s*\{[\s\S]*localStorage\.setItem\([\s\S]*catch \(error\)/.test(achievementsSource),
        'saveAchievements guards localStorage writes with try/catch'
    );
}

function checkBossTrackingAndContactContracts(constantsSource, sketchSource, abilitiesSource, objectsSource, helpSource) {
    assertContract(
        /\[OBJ_BOSS\]:\s*\{[^}]*countKey:\s*null/.test(constantsSource),
        'Boss objectProperties countKey is null (not dual-tracked via collectedCounts)'
    );
    assertContract(
        /collectedCounts:\s*\{[\s\S]*?magnet:\s*0\s*\}/.test(sketchSource) &&
        !/collectedCounts:[\s\S]*?boss:\s*0/.test(sketchSource),
        'collectedCounts no longer includes unused boss field'
    );
    assertContract(
        /achievementStats\.bossesDefeated\s*\+=\s*1/.test(abilitiesSource),
        'Boss defeats increment achievementStats.bossesDefeated'
    );
    assertContract(
        /Contact-safe boss/.test(objectsSource) &&
        /body contact is safe|only its fireballs/i.test(helpSource),
        'Boss contact-safe design is documented in code and help'
    );
}

function checkBossSpeedCapContracts(constantsSource, objectsSource, utilsSource) {
    assertContract(
        /const BOSS_FLOOR_SPEED_MULTIPLIER_MAX = 4/.test(constantsSource) &&
        /function getBossFloorSpeedMultiplier\(/.test(constantsSource) &&
        /Math\.min\(BOSS_FLOOR_SPEED_MULTIPLIER_MAX/.test(constantsSource),
        'Boss floor speed multiplier is capped at 4×'
    );
    assertContract(
        /getBossFloorSpeedMultiplier\(\)/.test(objectsSource) &&
        /getBossFloorSpeedMultiplier\(\)/.test(utilsSource),
        'Boss fireball and boss spawn use shared capped speed multiplier'
    );
    assertContract(
        !/Math\.pow\(2,\s*Math\.floor\(\(gameState\.dungeonFloor - 2\) \/ 2\)\)/.test(objectsSource + utilsSource),
        'Uncapped boss floor speed pow() is not inlined in objects/utils'
    );
}

function checkWizardStaffProgressionContracts(constantsSource, utilsSource) {
    assertContract(
        /!state\.player\.hasWizardStaff/.test(constantsSource) &&
        /state\.game\.dungeonFloor > DUNGEON_FLOOR_FOR_STAFF_DROP/.test(constantsSource) &&
        /state\.game\.dungeonFloor === DUNGEON_FLOOR_FOR_STAFF_DROP[\s\S]*state\.game\.dungeonZone >= DUNGEON_ZONE_FOR_STAFF_DROP/.test(constantsSource),
        'Wizard staff remains spawn-eligible after its initial dungeon position until collected'
    );

    const levelUpBody = extractFunctionBody(utilsSource, 'checkForGameLevelUp');
    assertContract(!!levelUpBody, 'checkForGameLevelUp function exists');

    const bossBranchIndex = levelUpBody.indexOf('if (shouldSpawnBoss)');
    const missingStaffGuardIndex = levelUpBody.indexOf('if (!playerState.hasWizardStaff)', bossBranchIndex);
    const grantStaffIndex = levelUpBody.indexOf('handleWizardStaffCollection();', missingStaffGuardIndex);
    const createBossIndex = levelUpBody.indexOf('createBoss();', grantStaffIndex);
    assertContract(
        bossBranchIndex !== -1 && missingStaffGuardIndex > bossBranchIndex &&
        grantStaffIndex > missingStaffGuardIndex && createBossIndex > grantStaffIndex,
        'Boss transition guarantees the wizard staff before creating the boss'
    );
}

function checkVersionContracts(constantsSource, packageSource) {
    assertContract(
        /const GAME_VERSION = "1\.0\.0-beta"/.test(constantsSource),
        'GAME_VERSION is 1.0.0-beta'
    );
    assertContract(
        /"version":\s*"1\.0\.0-beta"/.test(packageSource),
        'package.json version is 1.0.0-beta'
    );
}

function checkHighScoreStorageContracts(uiSource) {
    assertContract(
        /function saveHighScores\(\)\s*\{[\s\S]*try\s*\{[\s\S]*localStorage\.setItem\([\s\S]*catch \(error\)/.test(uiSource),
        'saveHighScores guards localStorage writes with try/catch'
    );
    assertContract(
        /function saveLastUsedName\(name\)\s*\{[\s\S]*try\s*\{[\s\S]*localStorage\.setItem\([\s\S]*catch \(error\)/.test(uiSource),
        'saveLastUsedName guards localStorage writes with try/catch'
    );
    assertContract(
        /function loadHighScores\(\)\s*\{[\s\S]*try\s*\{[\s\S]*localStorage\.getItem\([\s\S]*catch \(error\)/.test(uiSource),
        'loadHighScores guards localStorage reads with try/catch'
    );
    assertContract(
        /function loadLastUsedName\(\)\s*\{[\s\S]*try\s*\{[\s\S]*localStorage\.getItem\([\s\S]*catch \(error\)/.test(uiSource),
        'loadLastUsedName guards localStorage reads with try/catch'
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
    const buildSource = readRepoFile('build.js');
    const indexSource = readRepoFile('src/index.html');
    const assetSource = readRepoFile('src/js/assets.js');
    const constantsSource = readRepoFile('src/js/constants.js');
    const packageSource = readRepoFile('package.json');

    checkControlContracts(playerSource, abilitiesSource, sketchSource);
    checkVersionContracts(constantsSource, packageSource);
    checkBossSpeedCapContracts(constantsSource, objectsSource, utilsSource);
    checkWizardStaffProgressionContracts(constantsSource, utilsSource);
    checkBossTrackingAndContactContracts(constantsSource, sketchSource, abilitiesSource, objectsSource, helpSource);
    checkAchievementPersistenceContracts(sketchSource, achievementsSource);
    checkAchievementSaveContracts(achievementsSource);
    checkHighScoreStorageContracts(uiSource);
    checkScreenNavigationContracts(sketchSource, helpSource, objectInfoSource, aboutSource, achievementsSource);
    checkBuildAndAssetContracts(buildSource, indexSource, assetSource);
    checkP5CdnContracts(indexSource);
    checkNotificationQueueContracts(uiSource, sketchSource, utilsSource, abilitiesSource, objectsSource, achievementsSource);
    checkPlayTimeContracts(sketchSource);
    checkPauseContracts(sketchSource);
    checkReducedMotionContracts(sketchSource);
    checkBombCountContracts(abilitiesSource, utilsSource, objectsSource, achievementsSource);
    checkAnalyticsRemovedContracts(buildSource, sketchSource, introSource, gameOverSource);
    checkMagnetHelpContracts(helpSource, uiSource);

    console.log('Smoke checks passed.');
}

main();
