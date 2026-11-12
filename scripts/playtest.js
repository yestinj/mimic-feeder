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
 * served with the same headers and fonts, and a full run works: the title menu
 * starts a game, audio unlocks on the first key press, the mimic moves, pause
 * freezes everything and blocks gameplay keys, M mutes, Restart asks first,
 * the run ends in game over and the results, and Play Again starts afresh.
 * The save works: scores reach the high scores under the name given, settings
 * survive a reload, and erasing clears everything. Nothing errors, violates the CSP or trips the autoplay policy. Uses its own
 * page so its errors are reported separately; reads state through the game's
 * test hook (window.__mimicFeeder).
 */
async function checkNextBuild(browser) {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    const errors = [];
    const cspViolations = [];
    const audioPolicyMessages = [];
    page.on('console', (msg) => {
        if (msg.type() === 'error') {
            errors.push(`console: ${msg.text()}`);
        }
        if (/AudioContext was not allowed to start|user gesture/i.test(msg.text())) {
            audioPolicyMessages.push(msg.text());
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

    const snapshot = () => page.evaluate(() => window.__mimicFeeder.snapshot());
    /**
     * Polls the game's snapshot until `predicate` holds. CI renders WebGL in
     * software at a few frames per second, so checks wait for the game's state
     * rather than for fixed times.
     */
    const waitForSnapshot = async (predicate, timeout = 30000) => {
        const deadline = Date.now() + timeout;
        let last = null;
        while (Date.now() < deadline) {
            last = await snapshot();
            if (predicate(last)) {
                return last;
            }
            await page.waitForTimeout(50);
        }
        throw new Error(`Timed out waiting for the /next/ game state; last snapshot: ${JSON.stringify(last)}`);
    };
    const holdKey = async (key, ms) => {
        await page.keyboard.down(key);
        await page.waitForTimeout(ms);
        await page.keyboard.up(key);
    };

    try {
        // ?test adds the game's debug shortcuts (window.__mimicFeeder.debug), used for the abilities below.
        const response = await page.goto(BASE + '/next/?test', { waitUntil: 'domcontentloaded', timeout: 30000 });
        assert(Boolean(response && response.headers()['content-security-policy']), '/next/ is served with the _headers Content-Security-Policy');
        await page.waitForFunction(() => window.__mimicFeeder && window.__mimicFeeder.ready.includes('title'), null, { timeout: 20000 });
        assert(true, '/next/ reaches the title screen');
        const missingFonts = await page.evaluate(() => [
            '700 20px "Grenze Gotisch"', '400 20px Barlow', '700 20px Barlow',
        ].filter((face) => !document.fonts.check(face)));
        assert(missingFonts.length === 0, `/next/ loads its self-hosted fonts${missingFonts.length ? ` (missing: ${missingFonts.join(', ')})` : ''}`);
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(OUT_DIR, 'next-title.png') });

        // Play is focused on the title menu.
        await page.keyboard.press('Enter');
        await waitForSnapshot((s) => s.running.includes('game') && s.running.includes('hud') && s.game && s.game.playTimeMs > 0);
        const start = await snapshot();
        assert(start.game.lives === 3 && start.game.score === 0 && start.game.floor === 1 && start.game.zone === 1,
            '/next/ Play starts a run on Floor 1 Zone 1 with three lives');
        await waitForSnapshot((s) => s.audio === 'running', 5000);
        assert(true, '/next/ audio is running after the first key press');

        // Held until it has moved: at a few frames per second a short tap can start and end within one frame.
        await page.keyboard.down('ArrowLeft');
        await waitForSnapshot((s) => s.game.mimicX < start.game.mimicX - 50);
        await page.keyboard.up('ArrowLeft');
        assert(true, '/next/ the mimic moves with the arrow keys');

        await page.keyboard.press('KeyP');
        await waitForSnapshot((s) => s.running.includes('pause') && s.paused.includes('game') && s.paused.includes('hud'));
        const paused = await snapshot();
        await holdKey('ArrowRight', 400);
        await page.keyboard.press('ArrowUp');
        await page.waitForTimeout(400);
        const stillPaused = await snapshot();
        assert(stillPaused.game.playTimeMs === paused.game.playTimeMs && stillPaused.game.objects === paused.game.objects,
            '/next/ pause freezes play time and spawning');
        assert(stillPaused.game.mimicX === paused.game.mimicX, '/next/ gameplay keys do nothing while paused');
        await page.screenshot({ path: path.join(OUT_DIR, 'next-pause.png') });

        await page.keyboard.press('KeyM');
        await waitForSnapshot((s) => s.muted === true, 2000);
        await page.keyboard.press('KeyM');
        await waitForSnapshot((s) => s.muted === false, 2000);
        assert(true, '/next/ M mutes and unmutes, also while paused');

        // Settings (fourth item) opens over the pause menu, and Esc goes back to it. The ↑ pressed
        // above moved the focus from Resume round to Quit (the last item), so Settings is four down.
        for (let i = 0; i < 4; i++) {
            await page.keyboard.press('ArrowDown');
        }
        await page.keyboard.press('Enter');
        await waitForSnapshot((s) => s.running.includes('settings') && !s.running.includes('pause') && s.paused.includes('game'));
        await page.keyboard.press('Escape');
        await waitForSnapshot((s) => s.running.includes('pause') && !s.running.includes('settings'));
        assert((await snapshot()).paused.includes('game'), '/next/ Settings opens from the pause menu and Esc returns to it');

        // Leaving the pause menu counts down 3-2-1 over the still-paused run (on by default in Settings);
        // P during the count goes back to the pause menu.
        await page.keyboard.press('Escape');
        await waitForSnapshot((s) => s.running.includes('countdown') && s.paused.includes('game') && !s.running.includes('pause'));
        await page.keyboard.press('KeyP');
        await waitForSnapshot((s) => s.running.includes('pause') && !s.running.includes('countdown') && s.paused.includes('game'));
        assert(true, '/next/ leaving the pause menu counts down first, and P during it goes back to the menu');
        await page.keyboard.press('Escape');
        await waitForSnapshot((s) => s.running.includes('game') && !s.running.includes('pause') && !s.running.includes('countdown') && s.game.playTimeMs > paused.game.playTimeMs);
        assert(true, '/next/ Esc resumes the run after the countdown');

        // Losing focus mid-run (another tab or window) opens the pause menu.
        await page.evaluate(() => window.dispatchEvent(new Event('blur')));
        await waitForSnapshot((s) => s.running.includes('pause') && s.paused.includes('game'));
        assert(true, '/next/ losing focus mid-run pauses the game');
        await page.evaluate(() => window.dispatchEvent(new Event('focus')));
        await page.keyboard.press('Escape');
        await waitForSnapshot((s) => s.running.includes('game') && !s.running.includes('pause') && !s.running.includes('countdown'));

        // Abilities, unlocked through the debug shortcuts, with the normal spawns off so only the test's objects fall.
        const debug = (name, ...args) => page.evaluate(([fn, list]) => window.__mimicFeeder.debug[fn](...list), [name, args]);
        await debug('setSpawning', false);
        // The first unlock of each ability pauses the game on a card that only its own key (or Enter) closes.
        await debug('grant', 'shadowBolt');
        await waitForSnapshot((s) => s.card && s.card.ability === 'shadowBolt' && s.paused.includes('game'));
        assert(true, '/next/ the first Shadow Bolt unlock pauses the game on a card');
        await waitForSnapshot((s) => s.card && s.card.ready);
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(300);
        assert((await snapshot()).card !== null, '/next/ movement keys do not close the card');
        await page.keyboard.press('Space');
        await waitForSnapshot((s) => !s.card && s.running.includes('game'));
        assert(true, "/next/ the ability's own key closes the card and play resumes");
        await waitForSnapshot((s) => s.save.achievements.includes('staff_initiate') && s.save.newAchievements.includes('staff_initiate'));
        assert(true, '/next/ finding the Staff unlocks the Staff Initiate achievement, saves it and marks it new');

        // K opens the achievements straight over the run (which marks what's new as seen), and Esc goes back to it.
        await page.keyboard.press('KeyK');
        await waitForSnapshot((s) => s.running.includes('achievements') && !s.running.includes('pause') && s.paused.includes('game'));
        assert((await snapshot()).save.newAchievements.length === 0, '/next/ opening the achievements marks new ones as seen');
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(OUT_DIR, 'next-achievements.png') });
        await page.keyboard.press('Escape');
        await waitForSnapshot((s) => s.running.includes('game') && s.running.includes('hud') && !s.running.includes('achievements'));
        assert((await snapshot()).running.every((key) => key !== 'pause'), '/next/ K opens the achievements over the run, and Esc goes straight back to it');
        await page.keyboard.press('KeyK');
        await waitForSnapshot((s) => s.running.includes('achievements'));
        await page.keyboard.press('KeyK');
        await waitForSnapshot((s) => s.running.includes('game') && !s.running.includes('achievements'));
        assert(true, '/next/ K closes the achievements too');
        // H opens How to Play straight over the run, on Creatures & Items since this run has met new things,
        // which marks them seen (they stay tagged "New" for this visit); H closes it again.
        // A crown, dropped away from the mimic (missing one costs nothing), is the thing just met.
        const crownX = (await snapshot()).game.mimicX > 960 ? 300 : 1620;
        await debug('spawn', 'crown', crownX);
        const met = (await waitForSnapshot((s) => s.save.newDiscoveries.includes('crown'))).save.newDiscoveries;
        assert(true, '/next/ meeting something marks it new for How to Play');
        await page.keyboard.press('KeyH');
        const opened = await waitForSnapshot((s) => s.running.includes('howToPlay') && s.paused.includes('game') && s.howToPlay && s.howToPlay.tab === 'bestiary');
        assert(met.every((key) => opened.howToPlay.fresh.includes(key)) && opened.save.newDiscoveries.length === 0,
            '/next/ H opens How to Play over the run on what is new, and marks it seen');
        await page.keyboard.press('KeyH');
        await waitForSnapshot((s) => s.running.includes('game') && !s.running.includes('howToPlay') && s.howToPlay === null);
        assert(true, '/next/ H goes back to play');
        // Opened from the pause menu (K there too), Esc goes back to the menu, then to the run.
        await page.keyboard.press('KeyP');
        await waitForSnapshot((s) => s.running.includes('pause'));
        await page.keyboard.press('KeyK');
        await waitForSnapshot((s) => s.running.includes('achievements') && !s.running.includes('pause'));
        await page.keyboard.press('Escape');
        await waitForSnapshot((s) => s.running.includes('pause') && !s.running.includes('achievements'));
        await page.keyboard.press('Escape');
        await waitForSnapshot((s) => s.running.includes('game') && !s.running.includes('pause'));
        assert(true, '/next/ the achievements opened from the pause menu go back to it');
        for (const [ability, key] of [['tentacles', 'KeyZ'], ['magnetism', 'KeyX']]) {
            await debug('grant', ability);
            await waitForSnapshot((s) => s.card && s.card.ability === ability && s.card.ready);
            await page.keyboard.press(key);
            await waitForSnapshot((s) => !s.card && s.running.includes('game'));
        }
        let before = await waitForSnapshot((s) => s.game.abilities.length === 4);
        assert(true, '/next/ the Staff, levelling up and the Magnet unlock Shadow Bolt, Tentacles and Magnetism');
        const awayX = before.game.mimicX > 960 ? 300 : 1620;

        await debug('spawn', 'bomb');
        await page.keyboard.press('Space');
        await waitForSnapshot((s) => s.game.hazardsDetonated > before.game.hazardsDetonated);
        assert((await snapshot()).game.lives === before.game.lives, '/next/ a Shadow Bolt sets off a bomb without costing a life');

        before = await snapshot();
        await debug('spawn', 'goblin', awayX);
        await page.keyboard.press('KeyZ');
        await waitForSnapshot((s) => s.game.creaturesEaten > before.game.creaturesEaten);
        assert(true, '/next/ Tentacles reel a creature into the mouth');

        before = await snapshot();
        await debug('spawn', 'crown', awayX);
        await page.keyboard.press('KeyX');
        await waitForSnapshot((s) => s.game.shiniesCollected > before.game.shiniesCollected);
        assert(true, '/next/ Magnetism pulls treasure to the mimic');

        // Cats land safely and are rescued; dragons fly off when the mimic is beneath them.
        before = await snapshot();
        await debug('spawn', 'cat', awayX);
        await waitForSnapshot((s) => s.game.catsRescued > before.game.catsRescued, 60000);
        assert((await snapshot()).game.lives === before.game.lives, '/next/ a cat lands safely and is rescued');
        await debug('spawn', 'dragon');
        await waitForSnapshot((s) => s.game.flyingDragons > 0, 60000);
        assert(true, '/next/ a dragon flies off when the mimic is beneath it');

        // Zone 5 of an even floor is a boss fight; beating the boss moves on a floor.
        await debug('startBoss');
        const fight = await waitForSnapshot((s) => s.game.boss !== null);
        assert(fight.game.floor % 2 === 0 && fight.game.zone === 5 && fight.game.objects === 0,
            '/next/ Zone 5 of an even floor starts a boss fight on a cleared board');
        await debug('damageBoss', fight.game.boss.max);
        await waitForSnapshot((s) => s.game.boss === null && s.game.floor === fight.game.floor + 1 && s.game.zone === 1, 60000);
        assert(true, '/next/ beating the boss moves on to the next floor');
        await debug('setSpawning', true);

        // Pause menu: Restart (fifth item) asks first; Cancel is the default.
        await page.keyboard.press('Escape');
        await waitForSnapshot((s) => s.running.includes('pause'));
        for (let i = 0; i < 4; i++) {
            await page.keyboard.press('ArrowDown');
        }
        await page.keyboard.press('Enter');
        await waitForSnapshot((s) => s.dialog);
        await page.keyboard.press('Enter');
        await waitForSnapshot((s) => !s.dialog);
        assert((await snapshot()).running.includes('pause'), '/next/ Restart asks to confirm, and Cancel keeps the run');
        await page.keyboard.press('Enter');
        await waitForSnapshot((s) => s.dialog);
        await page.keyboard.press('ArrowRight');
        const beforeRestart = (await snapshot()).game.playTimeMs;
        await page.keyboard.press('Enter');
        await waitForSnapshot((s) => s.running.includes('game') && !s.running.includes('pause') && s.game && s.game.playTimeMs > 0);
        assert((await snapshot()).game.playTimeMs < beforeRestart, '/next/ confirming Restart starts a new run');
        const afterRestart = await snapshot();
        assert(afterRestart.save.runs === 1 && afterRestart.save.scores.length === 0 && afterRestart.save.bestScore > 0,
            '/next/ a restarted run counts towards lifetime totals and bests, but not the high scores');
        // Enough points to make the board.
        await debug('bonus', 500);

        // Wait in a corner until enough food hits the floor to end the run.
        await page.keyboard.down('ArrowLeft');
        await waitForSnapshot((s) => s.running.includes('results'), 180000);
        await page.keyboard.up('ArrowLeft');
        assert(true, '/next/ losing the last life ends the run and shows the results');

        // The first score on the board asks for the mimic's name, and saves it under that name.
        const naming = await waitForSnapshot((s) => s.results && s.results.naming);
        assert(naming.results.rank === 1, '/next/ the first score makes the board and asks for a name');
        await page.waitForTimeout(800);
        await page.screenshot({ path: path.join(OUT_DIR, 'next-results.png') });
        await page.keyboard.type('Chomper!');
        await page.keyboard.press('Enter');
        const named = await waitForSnapshot((s) => s.results && !s.results.naming);
        assert(named.save.name === 'Chomper' && named.save.named && named.save.scores.length === 1 && named.save.scores[0].name === 'Chomper',
            '/next/ the name typed is saved, with the score');

        // R plays again straight away (Play Again, focused, does the same with Enter).
        await page.keyboard.press('KeyR');
        await waitForSnapshot((s) => s.running.includes('game') && s.game && s.game.lives === 3 && s.game.playTimeMs > 0);
        assert(true, '/next/ R on the results starts a new run');

        // The Ninefold Judgment: ten cats shot bring it on. Standing still, its fire ends the run.
        await debug('setSpawning', false);
        await debug('grant', 'shadowBolt');
        await debug('shootCats', 10);
        const judged = await waitForSnapshot((s) => s.game && s.game.judgment !== null);
        assert(judged.game.objects === 0, '/next/ ten cats shot bring the Ninefold Judgment, setting everything else aside');
        await page.keyboard.press('Space');
        await page.waitForTimeout(300);
        assert((await snapshot()).game.boltsCast === judged.game.boltsCast, '/next/ Shadow Bolts are blocked during the Judgment');
        await waitForSnapshot((s) => s.results !== null, 120000);
        assert((await snapshot()).results.cause === 'Judged by the dungeon', '/next/ dying to the Judgment shows as the cause of death');
        // Any key skips the story of the run to the end (it takes a few seconds otherwise).
        await page.waitForTimeout(500);
        await page.keyboard.press('Space');
        await waitForSnapshot((s) => s.results && s.results.staged, 1500);
        assert(!(await snapshot()).results.naming, '/next/ any key skips the results to the end, and the name is only asked for once');
        await page.waitForTimeout(200);

        // High Scores (second button) opens over the results, and Esc goes back to them.
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('Enter');
        await waitForSnapshot((s) => s.running.includes('highScores') && !s.running.includes('results'));
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(OUT_DIR, 'next-high-scores.png') });
        await page.keyboard.press('Escape');
        await waitForSnapshot((s) => s.running.includes('results') && !s.running.includes('highScores'));
        assert(true, '/next/ High Scores opens from the results and Esc returns to them');

        // Settings (fifth on the title menu) save as they change and survive a reload.
        await page.keyboard.press('Escape');
        await waitForSnapshot((s) => s.running.includes('title') && !s.running.includes('results'));
        for (let i = 0; i < 4; i++) {
            await page.keyboard.press('ArrowDown');
        }
        await page.keyboard.press('Enter');
        await waitForSnapshot((s) => s.running.includes('settings'));
        for (let i = 0; i < 3; i++) {
            await page.keyboard.press('ArrowLeft');
        }
        // Down to Screen shake (the fifth row), then switch it off.
        for (let i = 0; i < 4; i++) {
            await page.keyboard.press('ArrowDown');
        }
        await page.keyboard.press('Enter');
        await waitForSnapshot((s) => s.save.settings.musicVolume === 0.7 && s.save.settings.screenShake === false);
        await page.screenshot({ path: path.join(OUT_DIR, 'next-settings.png') });
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__mimicFeeder && window.__mimicFeeder.ready.includes('title'), null, { timeout: 20000 });
        const reloaded = await snapshot();
        assert(reloaded.save.settings.musicVolume === 0.7 && reloaded.save.settings.screenShake === false
            && reloaded.save.name === 'Chomper' && reloaded.save.scores.length >= 1,
        '/next/ settings, the name and the high scores survive a reload');
        assert(reloaded.save.achievements.includes('staff_initiate'), '/next/ achievements survive a reload');

        // How to Play (second on the title menu): what this run met is shown, and the abilities it unlocked.
        // From the title it opens on Basics: the goblin met since H was pressed stays new until Creatures & Items is shown.
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        const basics = await waitForSnapshot((s) => s.running.includes('howToPlay') && !s.running.includes('title') && s.howToPlay && s.howToPlay.tab === 'basics');
        assert(basics.save.newDiscoveries.includes('goblin'), '/next/ How to Play opens on Basics from the title, leaving new things unseen');
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowRight');
        const shown = await waitForSnapshot((s) => s.howToPlay && s.howToPlay.tab === 'bestiary');
        const guide = shown.howToPlay;
        assert(!guide.hidden.includes('goblin') && !guide.hidden.includes('bomb') && guide.lockedAbilities.length === 0
            && guide.fresh.includes('goblin') && shown.save.newDiscoveries.length === 0,
            '/next/ Creatures & Items shows what has been met and unlocked, tags what is new, and marks it seen');
        await page.keyboard.press('Escape');
        await waitForSnapshot((s) => s.running.includes('title') && !s.running.includes('howToPlay'));

        // Achievements (third on the title menu, one below How to Play) open from the title too.
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        await waitForSnapshot((s) => s.running.includes('achievements') && !s.running.includes('title'));
        await page.keyboard.press('Escape');
        await waitForSnapshot((s) => s.running.includes('title') && !s.running.includes('achievements'));
        assert(true, '/next/ Achievements opens from the title menu and Esc returns to it');

        // Credits (last on the title menu, three below Achievements).
        for (let i = 0; i < 3; i++) {
            await page.keyboard.press('ArrowDown');
        }
        await page.keyboard.press('Enter');
        await waitForSnapshot((s) => s.running.includes('credits') && !s.running.includes('title'));
        await page.keyboard.press('Escape');
        await waitForSnapshot((s) => s.running.includes('title') && !s.running.includes('credits'));
        assert(true, '/next/ Credits opens from the title menu and Esc returns to it');

        // Erase save data (ninth row) asks first, then starts over. Settings is one above Credits.
        await page.keyboard.press('ArrowUp');
        await page.keyboard.press('Enter');
        await waitForSnapshot((s) => s.running.includes('settings'));
        for (let i = 0; i < 8; i++) {
            await page.keyboard.press('ArrowDown');
        }
        await page.keyboard.press('Enter');
        await waitForSnapshot((s) => s.dialog);
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('Enter');
        const erased = await waitForSnapshot((s) => !s.dialog && s.save.scores.length === 0);
        assert(erased.save.name === 'Mimic' && !erased.save.named && erased.save.runs === 0 && erased.save.settings.musicVolume === 1
            && erased.save.achievements.length === 0,
            '/next/ Erase save data asks first, then clears everything');

        if (cspViolations.length) {
            console.error('/next/ CSP violations:', cspViolations);
        }
        assert(cspViolations.length === 0, '/next/ has no Content-Security-Policy violations');
        assert(audioPolicyMessages.length === 0, '/next/ has no AudioContext autoplay-policy warnings');
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
