#!/usr/bin/env node
/**
 * Lightweight Playwright playtest for Mimic Feeder (system Brave).
 *
 * Checks:
 * - page loads with a canvas
 * - intro can be dismissed and gameplay starts
 * - pause freezes input side-effects (playTime, player position)
 * - mute still works while paused
 * - bolt-style bomb collection increments small_bomb by 1
 * - wizard staff remains available and is guaranteed before a boss
 * - denied localStorage access does not break achievement loading
 * - no /api/track network calls
 * - no unexpected page/console errors
 *
 * Usage:
 *   npm run build && npm run playtest
 *
 * Browser:
 *   Uses system Brave by default (no Playwright Chromium download).
 *   Override with PLAYTEST_BROWSER_PATH=/path/to/browser
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const PORT = Number(process.env.PLAYTEST_PORT || 4173);
const HOST = '127.0.0.1';
const BASE = `http://${HOST}:${PORT}`;
const DIST = path.join(__dirname, '..', 'dist');
const OUT_DIR = path.join(__dirname, '..', 'playtest-output');

const DEFAULT_BRAVE_PATH = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
const BROWSER_PATH = process.env.PLAYTEST_BROWSER_PATH || DEFAULT_BRAVE_PATH;

function contentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return ({
        '.html': 'text/html; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.ico': 'image/x-icon',
        '.mp3': 'audio/mpeg',
        '.json': 'application/json',
        '.svg': 'image/svg+xml',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
    })[ext] || 'application/octet-stream';
}

function startStaticServer() {
    if (!fs.existsSync(path.join(DIST, 'index.html'))) {
        throw new Error('dist/index.html missing. Run `npm run build` first.');
    }

    const server = http.createServer((req, res) => {
        const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        const safePath = urlPath === '/' ? '/index.html' : urlPath;
        const filePath = path.normalize(path.join(DIST, safePath));
        if (!filePath.startsWith(DIST)) {
            res.writeHead(403);
            res.end('Forbidden');
            return;
        }
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end('Not found');
                return;
            }
            res.writeHead(200, { 'Content-Type': contentType(filePath) });
            res.end(data);
        });
    });

    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(PORT, HOST, () => resolve(server));
    });
}

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
        } catch (error) {
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

async function main() {
    if (!fs.existsSync(BROWSER_PATH)) {
        throw new Error(
            `Browser not found at: ${BROWSER_PATH}\n` +
            'Install Brave or set PLAYTEST_BROWSER_PATH to a Chromium-based browser binary.'
        );
    }

    let chromium;
    try {
        ({ chromium } = require('playwright'));
    } catch (error) {
        console.error('Playwright is not installed. Run: npm install');
        process.exit(1);
    }

    fs.mkdirSync(OUT_DIR, { recursive: true });

    console.log(`Using browser: ${BROWSER_PATH}`);
    console.log(`Serving ${DIST} at ${BASE}`);

    const server = await startStaticServer();
    const browser = await chromium.launch({
        executablePath: BROWSER_PATH,
        headless: true,
    });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    const consoleErrors = [];
    const pageErrors = [];
    const trackRequests = [];

    page.on('console', (msg) => {
        if (msg.type() === 'error') {
            consoleErrors.push(msg.text());
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
        // CDN p5 + local assets: domcontentloaded is enough; then wait for canvas/game.
        await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForSelector('canvas', { timeout: 20000 });
        assert(true, 'Page loaded with a canvas element');

        await waitForGameReady(page);
        assert(true, 'Game globals are available');

        // Deterministic start: force intro so returning-player localStorage cannot auto-skip.
        await page.evaluate(() => {
            try {
                localStorage.removeItem('mimicAchievements');
            } catch (e) { /* ignore */ }
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

        const hardConsoleErrors = consoleErrors.filter((text) => {
            const t = String(text).toLowerCase();
            if (t.includes('play() failed') || t.includes('audiocontext') || t.includes('autoplay')) {
                return false;
            }
            if (t.includes('the play() request was interrupted')) {
                return false;
            }
            // Brave/headless sometimes logs font or media noise; keep signal high.
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

        console.log(`\nPlaytest passed.`);
        console.log(`Screenshots: ${pathToFileURL(OUT_DIR).href}`);
    } finally {
        await browser.close().catch(() => {});
        await new Promise((resolve) => server.close(resolve));
    }
}

main().catch((error) => {
    console.error('\nPlaytest FAILED:', error && error.message ? error.message : error);
    process.exit(1);
});
