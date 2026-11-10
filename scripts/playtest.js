#!/usr/bin/env node
/**
 * Lightweight Playwright playtest for Mimic Feeder (Playwright's Chromium).
 *
 * Checks:
 * - page loads with a canvas
 * - intro can be dismissed and gameplay starts
 * - pause freezes input side-effects (playTime, player position)
 * - mute still works while paused
 * - bolt-style bomb collection increments small_bomb by 1
 * - wizard staff remains available and is guaranteed before a boss
 * - boss music takes over during combat and the death cue stops it
 * - Ninefold Judgment thresholds, apparition, suspension, and hit cooldown work
 * - denied localStorage access does not break achievement loading
 * - no /api/track network calls
 * - no unexpected page/console errors
 * - responses carry the headers from dist/_headers (the build's copy of
 *   src/_headers) with Cloudflare Pages semantics, so the production CSP is
 *   enforced: any `securitypolicyviolation` fails the run
 * - no served path gets Cache-Control from more than one _headers rule
 *
 * Usage:
 *   npm run build && npm run playtest
 *
 * Browser:
 *   Playwright's own Chromium (the full build in new headless mode, via
 *   channel 'chromium'), the same build CI uses. Install it once, and again
 *   after a Playwright upgrade: npm run playtest:install
 */
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');
const { resolveHeaders } = require('./pages-headers.js');
const {
    DIST,
    loadDistHeaderRules,
    listServedPaths,
    describeCacheControlConflict,
    startStaticServer,
} = require('./serve.js');

const PORT = Number(process.env.PLAYTEST_PORT || 4173);
const HOST = '127.0.0.1';
const BASE = `http://${HOST}:${PORT}`;
const OUT_DIR = path.join(__dirname, '..', 'playtest-output');

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
    console.log(`OK  ${message}`);
}

async function pressKey(page, key, times = 1) {
    for (let i = 0; i < times; i++) {
        await page.keyboard.press(key);
        await page.waitForTimeout(40);
    }
}

/**
 * Read live game state.
 * Note: source uses top-level `let`/`const`/`function`, which are global lexical
 * bindings in classic scripts — NOT always available as window.* properties.
 */
async function readGameProbe(page) {
    return page.evaluate(() => {
        const hasGameState = typeof gameState !== 'undefined' && gameState;
        const hasPlayerState = typeof playerState !== 'undefined' && playerState;
        const hasPlayer = typeof player !== 'undefined' && player;
        const g = hasGameState ? gameState : {};
        const p = hasPlayerState ? playerState : {};
        const pl = hasPlayer ? player : {};
        return {
            ready: !!(hasGameState && hasPlayerState),
            showIntroScreen: !!g.showIntroScreen,
            gameStarted: !!g.gameStarted,
            gameOver: !!g.gameOver,
            isPaused: !!g.isPaused,
            isMuted: !!g.isMuted,
            score: g.score,
            playTime: g.playTime,
            smallBomb: g.collectedCounts ? g.collectedCounts.small_bomb : null,
            lives: p.lives,
            playerX: pl.x,
            playerY: pl.y,
            hasLastFrame: typeof lastGameplayFrame !== 'undefined' && !!lastGameplayFrame,
            objectCount: typeof objects !== 'undefined' && Array.isArray(objects) ? objects.length : null,
        };
    });
}

async function waitForGameReady(page, timeoutMs = 15000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            const probe = await readGameProbe(page);
            if (probe.ready) {
                return probe;
            }
        } catch {
            // Bundle may still be loading; keep polling.
        }
        await page.waitForTimeout(100);
    }
    throw new Error('Timed out waiting for gameState to become available');
}

async function waitForGameplay(page, timeoutMs = 12000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const probe = await readGameProbe(page);
        if (!probe.showIntroScreen && probe.gameStarted && !probe.gameOver) {
            return probe;
        }
        if (probe.showIntroScreen) {
            await page.keyboard.press('Enter');
            await page.mouse.click(640, 400);
        }
        await page.waitForTimeout(100);
    }
    throw new Error('Timed out waiting for active gameplay');
}

/**
 * The Phaser + TypeScript rewrite at /next/ (docs/phaser-migration/plan.md):
 * served with the same headers, reaches its title screen, the menu responds to
 * the keyboard, the self-hosted fonts load, and nothing errors or violates the
 * CSP. Uses its own page so its errors are reported separately.
 */
async function checkNextBuild(browser) {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    const errors = [];
    const cspViolations = [];
    page.on('console', (msg) => {
        if (msg.type() === 'error') {
            errors.push(`console: ${msg.text()}`);
        }
    });
    page.on('pageerror', (err) => errors.push(`page: ${err && err.message ? err.message : err}`));
    page.on('response', (response) => {
        if (response.status() >= 400) {
            errors.push(`HTTP ${response.status()}: ${response.url()}`);
        }
    });
    await page.exposeFunction('__playtestReportNextCspViolation', (violation) => cspViolations.push(violation));
    await page.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (event) => {
            window.__playtestReportNextCspViolation(`${event.effectiveDirective || event.violatedDirective} ${event.blockedURI}`);
        });
    });

    try {
        const response = await page.goto(BASE + '/next/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        assert(Boolean(response && response.headers()['content-security-policy']), '/next/ is served with the _headers Content-Security-Policy');
        await page.waitForFunction(() => window.__mimicFeeder && window.__mimicFeeder.ready.includes('title'), null, { timeout: 20000 });
        assert(true, '/next/ reaches the title screen');
        const missingFonts = await page.evaluate(() => [
            '700 20px "Grenze Gotisch"', '400 20px Barlow', '700 20px Barlow',
        ].filter((face) => !document.fonts.check(face)));
        assert(missingFonts.length === 0, `/next/ loads its self-hosted fonts${missingFonts.length ? ` (missing: ${missingFonts.join(', ')})` : ''}`);
        await page.waitForTimeout(600);
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(OUT_DIR, 'next-title.png') });
        assert(true, '/next/ menu accepts keyboard navigation');

        if (cspViolations.length) {
            console.error('/next/ CSP violations:', cspViolations);
        }
        assert(cspViolations.length === 0, '/next/ has no Content-Security-Policy violations');
        if (errors.length) {
            console.error('/next/ errors:', errors);
        }
        assert(errors.length === 0, '/next/ has no page errors, console errors or failed requests');
    } finally {
        await page.close().catch(() => {});
    }
}

async function main() {
    const headerRules = loadDistHeaderRules();
    fs.mkdirSync(OUT_DIR, { recursive: true });

    const servedPaths = listServedPaths();
    const cacheControlConflicts = servedPaths
        .map((urlPath) => describeCacheControlConflict(urlPath, resolveHeaders(headerRules, urlPath, BASE)))
        .filter(Boolean);
    if (cacheControlConflicts.length) {
        console.error('Paths with more than one Cache-Control rule:\n  ' + cacheControlConflicts.join('\n  '));
    }
    assert(
        cacheControlConflicts.length === 0,
        `Every served path (${servedPaths.length}) gets Cache-Control from at most one _headers rule`
    );

    // Launch first so a missing browser fails before the server is listening.
    const browser = await chromium.launch({
        channel: 'chromium',
        args: ['--autoplay-policy=user-gesture-required'],
    });
    console.log(`Using browser: Playwright Chromium ${browser.version()}`);
    // Exact production headers here (no Cache-Control override).
    const server = await startStaticServer({ headerRules, host: HOST, port: PORT, cacheControlConflicts });
    console.log(`Serving ${DIST} at ${BASE} with ${headerRules.length} _headers rules`);
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    const consoleErrors = [];
    const audioPolicyMessages = [];
    const pageErrors = [];
    const trackRequests = [];
    const cspViolations = [];

    page.on('console', (msg) => {
        const messageText = msg.text();
        if (/AudioContext was not allowed to start|user gesture/i.test(messageText)) {
            audioPolicyMessages.push(messageText);
        }
        if (msg.type() === 'error') {
            consoleErrors.push(messageText);
        }
    });
    page.on('pageerror', (err) => {
        pageErrors.push(String(err && err.message ? err.message : err));
    });
    page.on('request', (req) => {
        if (req.url().includes('/api/track')) {
            trackRequests.push(req.url());
        }
    });

    try {
        // Report CSP violations to Node. The binding and init script are
        // injected by the browser driver, so the page's own CSP does not block them.
        await page.exposeFunction('__playtestReportCspViolation', (violation) => {
            cspViolations.push(violation);
        });
        await page.addInitScript(() => {
            document.addEventListener('securitypolicyviolation', (event) => {
                window.__playtestReportCspViolation({
                    directive: event.effectiveDirective || event.violatedDirective,
                    blockedURI: event.blockedURI,
                    source: event.sourceFile ? `${event.sourceFile}:${event.lineNumber}` : '',
                    sample: event.sample || '',
                });
            });
        });
        await page.addInitScript(() => {
            localStorage.setItem('mimicFeederLastUsedName', 'Returning Playtester');
        });
        // CDN p5 + local assets: domcontentloaded is enough; then wait for canvas/game.
        const documentResponse = await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        const documentHeaders = documentResponse ? documentResponse.headers() : {};
        assert(
            Boolean(documentHeaders['content-security-policy']),
            'Document is served with the _headers Content-Security-Policy'
        );
        await page.waitForSelector('canvas', { timeout: 20000 });
        assert(true, 'Page loaded with a canvas element');

        await waitForGameReady(page);
        assert(true, 'Game globals are available');

        const returningAudioBeforeGesture = await page.evaluate(() => ({
            showIntroScreen: gameState.showIntroScreen,
            gameStarted: gameState.gameStarted,
            audioStarted,
            musicPlaying: backgroundMusic1.isPlaying() || backgroundMusic2.isPlaying(),
        }));
        assert(
            !returningAudioBeforeGesture.showIntroScreen && returningAudioBeforeGesture.gameStarted,
            'Returning player auto-skips the intro'
        );
        assert(
            !returningAudioBeforeGesture.audioStarted &&
            !returningAudioBeforeGesture.musicPlaying,
            'Returning-player audio remains idle before the first user gesture'
        );
        await page.waitForTimeout(300);
        assert(audioPolicyMessages.length === 0, 'No pre-interaction AudioContext retry warnings');

        await page.click('canvas');
        await page.waitForFunction(() =>
            audioStarted && getAudioContext().state === 'running', null, {timeout: 5000}
        );
        const returningAudioAfterGesture = await page.evaluate(() => ({
            audioStarted,
            contextState: getAudioContext().state,
        }));
        assert(
            returningAudioAfterGesture.audioStarted && returningAudioAfterGesture.contextState === 'running',
            'First user gesture starts the returning player audio context'
        );

        // Late-run backgrounds, music and the apparition load after setup(); wait for them.
        await page.waitForFunction(() =>
            deferredAssetsRequested && deferredAssetsPending === 0, null, {timeout: 30000}
        );
        assert(true, 'Deferred late-run assets finished loading in the background');

        const dungeonBackgroundResult = await page.evaluate(() => ({
            imageCount: dungeonBackgroundImages.length,
            loaded: dungeonBackgroundImages.every((backgroundImage) =>
                backgroundImage && backgroundImage.width > 0 && backgroundImage.height > 0
            ),
            indices: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 50].map(getDungeonBackgroundIndex),
        }));
        assert(dungeonBackgroundResult.imageCount === 10, 'Ten dungeon backgrounds are available');
        assert(dungeonBackgroundResult.loaded, 'All dungeon backgrounds loaded successfully');
        assert(
            dungeonBackgroundResult.indices.join(',') === '0,1,2,3,4,5,6,7,8,9,9',
            `Dungeon backgrounds advance every floor and hold on 10+ (got ${dungeonBackgroundResult.indices.join(',')})`
        );

        const catProgressionResult = await page.evaluate(() => {
            const catEntry = spawnTable.find((entry) => entry.type === OBJ_CAT);
            if (!catEntry || typeof catEntry.condition !== 'function') {
                return {ok: false};
            }
            const stateForFloor = (dungeonFloor) => ({
                game: {dungeonFloor, dungeonZone: 1},
                player: {},
            });
            return {
                ok: true,
                floor1: catEntry.condition(stateForFloor(1)),
                floor2: catEntry.condition(stateForFloor(2)),
                laterFloor: catEntry.condition(stateForFloor(10)),
            };
        });
        assert(catProgressionResult.ok, 'Cat spawn progression condition is available');
        assert(catProgressionResult.floor1 === false, 'Cats do not spawn on Floor 1');
        assert(
            catProgressionResult.floor2 === true && catProgressionResult.laterFloor === true,
            'Cats spawn from Floor 2 onward'
        );

        const catHurtSoundResult = await page.evaluate(() => ({
            mapped: soundMap.cat_hurt === catHurtSound,
            loaded: !!catHurtSound && catHurtSound.isLoaded(),
        }));
        assert(catHurtSoundResult.mapped, 'Cat distress sound is registered');
        assert(catHurtSoundResult.loaded, 'Cat distress sound loaded successfully');

        const dungeonVoiceResult = await page.evaluate(() => ({
            mapped: soundMap.dungeon_warning === dungeonWarningSound &&
                soundMap.dungeon_judgment === dungeonJudgmentSound &&
                soundMap.dungeon_relents === dungeonRelentsSound,
            loaded: [dungeonWarningSound, dungeonJudgmentSound, dungeonRelentsSound].every(
                (sound) => sound && sound.isLoaded()
            ),
        }));
        assert(dungeonVoiceResult.mapped, 'Fixed dungeon voice clips are registered');
        assert(dungeonVoiceResult.loaded, 'Fixed dungeon voice clips loaded successfully');

        const judgmentContractResult = await page.evaluate(() => {
            const savedMuted = gameState.isMuted;
            const savedLives = playerState.lives;
            const savedGameOverFlag = gameState.shouldTriggerGameOver;
            gameState.isMuted = true;

            resetNinefoldJudgment();
            gameState.shadowBoltCatsDestroyed = 4;
            gameState.catKillWarningIssued = false;
            gameState.ninefoldJudgmentTriggered = false;
            recordShadowBoltCatKill();
            const warningAtFive = gameState.shadowBoltCatsDestroyed === 5 &&
                gameState.catKillWarningIssued && !gameState.ninefoldJudgmentTriggered;

            resetNinefoldJudgment();
            gameState.shadowBoltCatsDestroyed = 9;
            gameState.catKillWarningIssued = true;
            recordShadowBoltCatKill();
            const pendingAtTen = gameState.shadowBoltCatsDestroyed === 10 &&
                gameState.ninefoldJudgmentTriggered && ninefoldJudgmentState.phase === 'pending';

            ninefoldJudgmentState.phase = 'attack';
            ninefoldJudgmentState.damageCooldown = 0;
            playerState.lives = 3;
            const firstHitApplied = damagePlayerDuringNinefoldJudgment();
            const secondHitApplied = damagePlayerDuringNinefoldJudgment();
            const livesAfterOverlappingHits = playerState.lives;

            playerState.lives = savedLives;
            gameState.shouldTriggerGameOver = savedGameOverFlag;
            gameState.isMuted = savedMuted;
            gameState.shadowBoltCatsDestroyed = 0;
            gameState.catKillWarningIssued = false;
            gameState.ninefoldJudgmentTriggered = false;
            clearCenterNotifications();
            resetNinefoldJudgment();

            return {
                imageLoaded: !!ninefoldJudgmentImage && ninefoldJudgmentImage.width > 0 &&
                    ninefoldJudgmentImage.height > 0,
                warningAtFive,
                pendingAtTen,
                waveCount: NINEFOLD_WAVE_COUNT,
                firstHitApplied,
                secondHitApplied,
                livesAfterOverlappingHits,
            };
        });
        assert(judgmentContractResult.imageLoaded, 'Ninefold Judgment apparition loaded successfully');
        assert(judgmentContractResult.warningAtFive, 'Fifth deliberate cat kill issues the warning only');
        assert(judgmentContractResult.pendingAtTen, 'Tenth deliberate cat kill queues the judgment');
        assert(judgmentContractResult.waveCount === 9, 'Ninefold Judgment contains exactly nine waves');
        assert(
            judgmentContractResult.firstHitApplied && !judgmentContractResult.secondHitApplied &&
            judgmentContractResult.livesAfterOverlappingHits === 2,
            'Overlapping judgment hits cost only one life during the damage cooldown'
        );

        // Deterministic start: force intro so returning-player localStorage cannot auto-skip.
        await page.evaluate(() => {
            try {
                localStorage.removeItem('mimicAchievements');
            } catch { /* ignore */ }
            gameState.showIntroScreen = true;
            gameState.gameStarted = false;
            gameState.gameOver = false;
            gameState.isPaused = false;
            gameState.isMuted = false;
        });
        await page.waitForTimeout(100);

        // Focus canvas so keyboard events reach p5.
        await page.click('canvas');
        await pressKey(page, 'Enter');
        await page.mouse.click(640, 400);

        const gameplay = await waitForGameplay(page);
        assert(!gameplay.showIntroScreen && gameplay.gameStarted, 'Intro dismissed; gameplay started');

        await page.screenshot({ path: path.join(OUT_DIR, '01-gameplay.png') });

        // Exercise the real draw path without waiting through the entire encounter.
        const judgmentStart = await page.evaluate(() => {
            const objectCountBefore = objects.length;
            // A notification already showing when the encounter starts must be held, not lost.
            clearCenterNotifications();
            queueGameLevelNotification('Held before judgment');
            // A five-kill warning still queued when the judgment begins is superseded.
            enqueueCenterNotification({ title: CAT_KILL_WARNING_TITLE, subtitle: 'stale', duration: 240 });
            gameState.isMuted = true;
            gameState.shadowBoltCatsDestroyed = 9;
            gameState.catKillWarningIssued = true;
            gameState.ninefoldJudgmentTriggered = false;
            recordShadowBoltCatKill();
            return {objectCountBefore};
        });
        await page.waitForTimeout(250);
        const judgmentStarted = await page.evaluate(() => ({
            phase: ninefoldJudgmentState.phase,
            objectCount: objects.length,
            suspendedCount: ninefoldJudgmentState.suspendedObjects.length,
        }));
        assert(judgmentStarted.phase === 'summoning', 'Queued judgment enters its summoning phase');
        assert(judgmentStarted.objectCount === 0, 'Ordinary objects leave active simulation during judgment');
        assert(
            judgmentStarted.suspendedCount === judgmentStart.objectCountBefore,
            'Every ordinary object is retained in suspended judgment state'
        );

        // Notifications are held during the encounter: neither discarded nor advanced.
        const heldNotifications = await page.evaluate(async () => {
            queueAchievementNotification('Raised during judgment', 25);
            const timerBefore = activeCenterNotification ? activeCenterNotification.timer : null;
            await new Promise((resolve) => setTimeout(resolve, 300));
            return {
                activeTitle: activeCenterNotification ? activeCenterNotification.title : null,
                timerFrozen: !!activeCenterNotification && activeCenterNotification.timer === timerBefore,
                queuedDuring: hasPendingCenterNotificationTitle('Achievement Unlocked!'),
                staleWarningDropped: !hasPendingCenterNotificationTitle(CAT_KILL_WARNING_TITLE),
            };
        });
        assert(heldNotifications.staleWarningDropped, 'A still-queued five-kill warning is dropped once the judgment begins');
        assert(
            heldNotifications.activeTitle === 'Held before judgment' && heldNotifications.timerFrozen,
            'A notification showing when the judgment starts is held, not discarded'
        );
        assert(heldNotifications.queuedDuring, 'Notifications raised during the judgment stay queued');
        await page.screenshot({ path: path.join(OUT_DIR, '02-ninefold-summoning.png') });

        await page.evaluate(() => {
            ninefoldJudgmentState.phase = 'attack';
            ninefoldJudgmentState.phaseTimer = 0;
            ninefoldJudgmentState.wavesReleased = 0;
            ninefoldJudgmentState.corridorCenter = player.x + player.w / 2;
            ninefoldJudgmentState.waveTimer = NINEFOLD_FIRST_WAVE_DELAY_FRAMES;
        });
        await page.waitForTimeout(120);
        await page.screenshot({ path: path.join(OUT_DIR, '03-ninefold-ready.png') });

        const judgmentWave = await page.evaluate(() => {
            ninefoldJudgmentState.waveTimer = 0;
            spawnNinefoldWave();
            const leftFireballs = judgmentFireballs.filter((fireball) =>
                fireball.x < ninefoldJudgmentState.corridorCenter
            );
            const rightFireballs = judgmentFireballs.filter((fireball) =>
                fireball.x > ninefoldJudgmentState.corridorCenter
            );
            const innerLeft = leftFireballs.reduce((closest, fireball) =>
                !closest || fireball.x > closest.x ? fireball : closest, null
            );
            const innerRight = rightFireballs.reduce((closest, fireball) =>
                !closest || fireball.x < closest.x ? fireball : closest, null
            );
            const actualCorridorWidth = innerRight.x - innerRight.w / 2 -
                (innerLeft.x + innerLeft.w / 2);
            const initialYPositions = judgmentFireballs.map((fireball) => fireball.y);
            return {
                fireballCount: judgmentFireballs.length,
                playerWidth: player.w,
                actualCorridorWidth,
                verticalSpread: Math.max(...initialYPositions) - Math.min(...initialYPositions),
                delayedCount: judgmentFireballs.filter((fireball) => fireball.spawnDelay > 0).length,
            };
        });
        assert(
            judgmentWave.fireballCount >= 24,
            `A judgment wave forms dense meteor rain (got ${judgmentWave.fireballCount} fireballs)`
        );
        assert(
            judgmentWave.actualCorridorWidth > judgmentWave.playerWidth &&
            judgmentWave.actualCorridorWidth - judgmentWave.playerWidth <= 15,
            `Judgment opening gives the mimic only narrow clearance ` +
            `(mimic=${judgmentWave.playerWidth}, opening=${judgmentWave.actualCorridorWidth})`
        );
        assert(
            judgmentWave.verticalSpread >= 100 && judgmentWave.delayedCount > 0,
            `Judgment meteors have staggered heights and delays ` +
            `(spread=${judgmentWave.verticalSpread}, delayed=${judgmentWave.delayedCount})`
        );
        await page.waitForTimeout(350);
        await page.screenshot({ path: path.join(OUT_DIR, '04-ninefold-wave.png') });

        await page.evaluate(() => {
            completeNinefoldJudgment();
            gameState.shadowBoltCatsDestroyed = 0;
            gameState.catKillWarningIssued = false;
            gameState.ninefoldJudgmentTriggered = false;
            gameState.isMuted = false;
            wasGameAudioSilenced = null;
            syncGameAudioState();
        });
        const judgmentRestored = await readGameProbe(page);
        assert(
            judgmentRestored.objectCount === judgmentStart.objectCountBefore,
            'Suspended ordinary objects return after judgment survival'
        );
        const resumedNotifications = await page.evaluate(async () => {
            const timerBefore = activeCenterNotification ? activeCenterNotification.timer : null;
            await new Promise((resolve) => setTimeout(resolve, 300));
            const resumed = !!activeCenterNotification && activeCenterNotification.timer < timerBefore;
            clearCenterNotifications(); // keep later checks independent of these test banners
            return { resumed };
        });
        assert(resumedNotifications.resumed, 'Held notifications resume once the judgment ends');

        await pressKey(page, 'ArrowRight', 8);
        await page.waitForTimeout(250);
        const beforePause = await readGameProbe(page);
        const xBeforePause = beforePause.playerX;

        await pressKey(page, 'p');
        await page.waitForTimeout(200);
        const paused = await readGameProbe(page);
        assert(paused.isPaused === true, 'Pressing P pauses the game');
        assert(paused.hasLastFrame === true, 'Pause captured lastGameplayFrame snapshot');
        // Measure playTime only after pause is confirmed (frames can still tick between the
        // pre-pause probe and the P key taking effect).
        const playTimeAtPause = paused.playTime;

        await page.screenshot({ path: path.join(OUT_DIR, '02-paused.png') });

        // Gameplay keys should not change position / playTime while frozen.
        await pressKey(page, 'ArrowLeft', 10);
        await pressKey(page, 'ArrowUp', 3);
        await pressKey(page, 'Space', 2);
        await pressKey(page, 'z', 2);
        await pressKey(page, 'x', 2);
        await page.waitForTimeout(350);

        const stillPaused = await readGameProbe(page);
        assert(stillPaused.isPaused === true, 'Still paused after gameplay key spam');
        assert(
            Number.isFinite(stillPaused.playerX) &&
            Math.abs(stillPaused.playerX - xBeforePause) < 0.5,
            `Player X unchanged while paused (before=${xBeforePause}, after=${stillPaused.playerX})`
        );
        assert(
            Number.isFinite(stillPaused.playTime) &&
            Math.abs(stillPaused.playTime - playTimeAtPause) < 0.001,
            `Play time does not advance while paused (atPause=${playTimeAtPause}, after=${stillPaused.playTime})`
        );

        await pressKey(page, 'm');
        await page.waitForTimeout(80);
        const mutedProbe = await readGameProbe(page);
        assert(mutedProbe.isMuted === true, 'Mute (M) works while paused');

        // H1: resize while paused must not resume simulation (player X / playTime stay frozen).
        const preResize = await readGameProbe(page);
        await page.setViewportSize({ width: 1100, height: 720 });
        await page.waitForTimeout(400);
        await pressKey(page, 'ArrowLeft', 8);
        await pressKey(page, 'ArrowRight', 8);
        await page.waitForTimeout(200);
        const postResize = await readGameProbe(page);
        assert(postResize.isPaused === true, 'Still paused after viewport resize');
        assert(
            postResize.hasLastFrame === true,
            'Pause freeze snapshot retained across resize'
        );
        assert(
            Number.isFinite(postResize.playerX) &&
            Math.abs(postResize.playerX - preResize.playerX) < 0.5,
            `Player X unchanged after resize while paused (before=${preResize.playerX}, after=${postResize.playerX})`
        );
        assert(
            Number.isFinite(postResize.playTime) &&
            Math.abs(postResize.playTime - preResize.playTime) < 0.001,
            `Play time unchanged after resize while paused (before=${preResize.playTime}, after=${postResize.playTime})`
        );

        await pressKey(page, 'p');
        await page.waitForTimeout(200);
        const resumed = await readGameProbe(page);
        assert(resumed.isPaused === false, 'Pressing P again resumes');

        await page.screenshot({ path: path.join(OUT_DIR, '03-resumed.png') });

        // Bomb double-count contract: destroyedByBolt path increments once via handleBombCollection.
        const bombCountResult = await page.evaluate(() => {
            if (typeof handleBombCollection !== 'function' || typeof gameState === 'undefined') {
                return { ok: false, reason: 'handleBombCollection or gameState missing' };
            }
            const before = gameState.collectedCounts.small_bomb || 0;
            const fakeBomb = {
                type: typeof OBJ_SMALL_BOMB !== 'undefined' ? OBJ_SMALL_BOMB : 'small_bomb',
                x: 0,
                y: 0,
                w: 20,
                h: 20,
                destroyedByBolt: true,
            };
            handleBombCollection(fakeBomb);
            const after = gameState.collectedCounts.small_bomb || 0;
            return { ok: true, before, after, delta: after - before };
        });
        assert(bombCountResult.ok, `Bomb count probe available (${bombCountResult.reason || 'ok'})`);
        assert(
            bombCountResult.delta === 1,
            `Bolt-style bomb collection increments small_bomb by 1 (got delta=${bombCountResult.delta})`
        );

        const staffEligibility = await page.evaluate(() => {
            const staffEntry = spawnTable.find((entry) => entry.type === OBJ_WIZARD_STAFF);
            if (!staffEntry || typeof staffEntry.condition !== 'function') {
                return { ok: false, reason: 'wizard staff spawn condition missing' };
            }

            const savedObjects = objects;
            const isEligible = (floor, zone, hasWizardStaff = false, staffOnScreen = false) => {
                objects = staffOnScreen ? [{ type: OBJ_WIZARD_STAFF }] : [];
                return staffEntry.condition({
                    game: { dungeonFloor: floor, dungeonZone: zone },
                    player: { hasWizardStaff },
                });
            };

            try {
                return {
                    ok: true,
                    beforeUnlock: isEligible(1, 5),
                    atUnlock: isEligible(2, 1),
                    afterUnlock: isEligible(2, 4),
                    laterFloor: isEligible(3, 1),
                    afterCollection: isEligible(3, 1, true),
                    whileOnScreen: isEligible(3, 1, false, true),
                };
            } finally {
                objects = savedObjects;
            }
        });
        assert(staffEligibility.ok, `Wizard staff spawn condition is available (${staffEligibility.reason || 'ok'})`);
        assert(staffEligibility.beforeUnlock === false, 'Wizard staff stays locked before Floor 2 Zone 1');
        assert(staffEligibility.atUnlock === true, 'Wizard staff becomes eligible at Floor 2 Zone 1');
        assert(staffEligibility.afterUnlock === true && staffEligibility.laterFloor === true, 'Wizard staff remains eligible on later zones and floors');
        assert(staffEligibility.afterCollection === false, 'Wizard staff stops spawning after collection');
        assert(staffEligibility.whileOnScreen === false, 'Wizard staff does not duplicate while one is on screen');

        // Pacing: first offer is immediate; after misses, re-offers are occasional (seeded, deterministic).
        const staffPacing = await page.evaluate(() => {
            const saved = {
                objects, floor: gameState.dungeonFloor, zone: gameState.dungeonZone,
                offers: gameState.wizardStaffOffers, timer: gameState.objectSpawnTimer,
                hasStaff: playerState.hasWizardStaff, recent: recentSpawnXPositions,
                potionLevel: gameState.lastHealthPotionLevel,
            };
            const spawnTick = () => {
                objects = []; // the previous drop was missed / gone
                gameState.objectSpawnTimer = Math.round(gameState.objectSpawnRate);
                spawnObjects();
                return objects.some((obj) => obj.type === OBJ_WIZARD_STAFF);
            };
            try {
                randomSeed(20261109);
                gameState.dungeonFloor = 2;
                gameState.dungeonZone = 1;
                gameState.wizardStaffOffers = 0;
                playerState.hasWizardStaff = false;
                const firstTickIsStaff = spawnTick();
                let reoffers = 0;
                const ticks = 300;
                for (let i = 0; i < ticks; i++) {
                    if (spawnTick()) reoffers += 1;
                }
                return { firstTickIsStaff, reofferRate: reoffers / ticks };
            } finally {
                objects = saved.objects;
                gameState.dungeonFloor = saved.floor;
                gameState.dungeonZone = saved.zone;
                gameState.wizardStaffOffers = saved.offers;
                gameState.objectSpawnTimer = saved.timer;
                playerState.hasWizardStaff = saved.hasStaff;
                recentSpawnXPositions = saved.recent;
                gameState.lastHealthPotionLevel = saved.potionLevel;
                randomSeed(Date.now()); // do not leave the rest of the run deterministic
            }
        });
        assert(staffPacing.firstTickIsStaff, 'First wizard staff is offered on the first spawn after unlock');
        assert(
            staffPacing.reofferRate > 0.1 && staffPacing.reofferRate < 0.3,
            `Missed wizard staff is re-offered occasionally, not every spawn (rate ${staffPacing.reofferRate.toFixed(2)})`
        );

        const bossStaffGuarantee = await page.evaluate(() => {
            objects = [];
            bossFireballs = [];
            gameState.dungeonFloor = 2;
            gameState.dungeonZone = 4;
            gameState.objectsEaten = OBJECTS_PER_GAME_LEVEL;
            playerState.hasWizardStaff = false;

            checkForGameLevelUp();

            return {
                hasWizardStaff: playerState.hasWizardStaff,
                dungeonZone: gameState.dungeonZone,
                bossCount: objects.filter((obj) => obj.type === OBJ_BOSS).length,
            };
        });
        assert(bossStaffGuarantee.dungeonZone === 5, 'Boss transition advances to Zone 5');
        assert(bossStaffGuarantee.hasWizardStaff === true, 'Boss transition grants a missing wizard staff');
        assert(bossStaffGuarantee.bossCount === 1, 'Boss transition creates exactly one boss');

        const bossAudioAssets = await page.evaluate(() => ({
            musicMapped: soundMap.boss_music === bossMusic,
            deathMapped: soundMap.boss_death === bossDeathSound,
            musicLoaded: !!bossMusic && bossMusic.isLoaded(),
            deathLoaded: !!bossDeathSound && bossDeathSound.isLoaded(),
        }));
        assert(bossAudioAssets.musicMapped && bossAudioAssets.deathMapped, 'Boss audio is registered');
        assert(bossAudioAssets.musicLoaded && bossAudioAssets.deathLoaded, 'Boss audio loaded successfully');

        await page.evaluate(() => {
            gameState.isMuted = false;
            gameState.isPaused = false;
            syncGameAudioState();
            updateBackgroundMusic();
        });
        await page.waitForTimeout(150);
        const bossMusicResult = await page.evaluate(() => ({
            bossPlaying: bossMusic.isPlaying(),
            normalPlaying: backgroundMusic1.isPlaying() || backgroundMusic2.isPlaying(),
        }));
        assert(bossMusicResult.bossPlaying, 'Boss music plays during the boss encounter');
        assert(!bossMusicResult.normalPlaying, 'Normal music stops during the boss encounter');

        await page.evaluate(() => {
            const boss = objects.find((obj) => obj.type === OBJ_BOSS);
            boss.isDying = true;
            handleBossDefeatedAudio();
        });
        await page.waitForTimeout(100);
        const bossDeathAudioResult = await page.evaluate(() => ({
            bossPlaying: bossMusic.isPlaying(),
            deathPlaying: bossDeathSound.isPlaying(),
            normalPlaying: backgroundMusic1.isPlaying() || backgroundMusic2.isPlaying(),
        }));
        assert(!bossDeathAudioResult.bossPlaying, 'Boss music stops when the boss is defeated');
        assert(bossDeathAudioResult.deathPlaying, 'Boss death cue plays when the boss is defeated');
        assert(!bossDeathAudioResult.normalPlaying, 'Normal music waits during the boss death cue');
        await page.evaluate(() => stopAllSounds(false, false));

        const deniedStorageResult = await page.evaluate(() => {
            const originalGetItem = Storage.prototype.getItem;
            const originalRemoveItem = Storage.prototype.removeItem;
            let thrownMessage = null;

            Storage.prototype.getItem = () => {
                throw new Error('Storage access denied for playtest');
            };
            Storage.prototype.removeItem = () => {
                throw new Error('Storage cleanup denied for playtest');
            };

            gameState.achievements = { stale: { unlocked: true } };
            try {
                loadAchievements();
            } catch (error) {
                thrownMessage = String(error && error.message ? error.message : error);
            } finally {
                Storage.prototype.getItem = originalGetItem;
                Storage.prototype.removeItem = originalRemoveItem;
            }

            return {
                thrownMessage,
                achievementCount: Object.keys(gameState.achievements).length,
            };
        });
        assert(deniedStorageResult.thrownMessage === null, 'Denied localStorage access does not escape achievement loading');
        assert(deniedStorageResult.achievementCount === 0, 'Denied localStorage access falls back to empty achievements');

        await page.waitForTimeout(300);
        assert(trackRequests.length === 0, 'No /api/track network requests');
        if (cspViolations.length) {
            console.error('CSP violations:', cspViolations);
        }
        assert(cspViolations.length === 0, 'No Content-Security-Policy violations');
        if (cacheControlConflicts.length) {
            console.error('Served paths with more than one Cache-Control rule:', cacheControlConflicts);
        }
        assert(cacheControlConflicts.length === 0, 'No served response had more than one Cache-Control rule');
        assert(audioPolicyMessages.length === 0, 'No AudioContext autoplay-policy warnings');

        const hardConsoleErrors = consoleErrors.filter((text) => {
            const t = String(text).toLowerCase();
            if (t.includes('play() failed') || t.includes('audiocontext') || t.includes('autoplay')) {
                return false;
            }
            if (t.includes('the play() request was interrupted')) {
                return false;
            }
            // Headless Chromium sometimes logs font or media noise; keep signal high.
            if (t.includes('net::err_')) {
                return true;
            }
            return true;
        });

        if (pageErrors.length) {
            console.error('Page errors:', pageErrors);
        }
        if (hardConsoleErrors.length) {
            console.error('Console errors:', hardConsoleErrors);
        }

        assert(pageErrors.length === 0, 'No page errors');
        assert(hardConsoleErrors.length === 0, 'No unexpected console errors');

        await checkNextBuild(browser);

        console.log(`\nPlaytest passed.`);
        console.log(`Screenshots: ${pathToFileURL(OUT_DIR).href}`);
    } catch (error) {
        // A blocked script usually surfaces later as a timeout; show the cause.
        if (cspViolations.length) {
            console.error('CSP violations before failure:', cspViolations);
        }
        throw error;
    } finally {
        await browser.close().catch(() => {});
        await new Promise((resolve) => server.close(resolve));
    }
}

main().catch((error) => {
    console.error('\nPlaytest FAILED:', error && error.message ? error.message : error);
    process.exit(1);
});
