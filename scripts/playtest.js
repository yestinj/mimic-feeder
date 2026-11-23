#!/usr/bin/env node
/**
 * Playwright playtest for Mimic Feeder (Playwright's Chromium), against dist/
 * served with dist/_headers applied the way Cloudflare Pages applies them.
 *
 * Checks:
 * - every served path gets Cache-Control from at most one _headers rule, and
 *   the old /next/ preview address redirects to /
 * - a full run (checkGame): title, play, pause, abilities, cats, dragons, the
 *   boss, the Ninefold Judgment, game over, results, high scores, settings and
 *   the save, with the production CSP enforced (any `securitypolicyviolation`
 *   fails) and no page or console errors
 * - the notices shown without WebGL or JavaScript (checkNotices)
 * - files that fail to load (checkLoading), and music that loads late (checkLateMusic)
 * - the keyboard note on phones and tablets (checkKeyboardNote)
 *
 * The game is ES modules: checks read its state through its test hook
 * (window.__mimicFeeder, src/testHook.ts); ?test adds debug shortcuts.
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

/**
 * The game, served with the production headers and its fonts: a full run
 * works. The title menu starts a game, audio unlocks on the first key press,
 * the mimic moves, pause freezes everything and blocks gameplay keys, M mutes,
 * Restart asks first, the run ends in game over and the results, and Play
 * Again starts afresh. The save works: scores reach the high scores under the
 * name given, settings survive a reload, and erasing clears everything.
 * Nothing errors, violates the CSP or trips the autoplay policy. Reads state
 * through the game's test hook (window.__mimicFeeder).
 */
async function checkGame(browser) {
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
    await page.exposeFunction('__playtestReportCspViolation', (violation) => cspViolations.push(violation));
    await page.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (event) => {
            window.__playtestReportCspViolation(`${event.effectiveDirective || event.violatedDirective} ${event.blockedURI}`);
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
        throw new Error(`Timed out waiting for the game state; last snapshot: ${JSON.stringify(last)}`);
    };
    /**
     * Two presses of Enter in the same instant (a second one landing before the first has done anything),
     * sent as page events so no frame can fall between them.
     */
    const pressEnterTwice = () => page.evaluate(() => {
        for (let i = 0; i < 2; i++) {
            for (const type of ['keydown', 'keyup']) {
                window.dispatchEvent(new KeyboardEvent(type, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
            }
        }
    });
    /** How many times a scene has opened. */
    const timesOpened = (scene) => page.evaluate((key) => window.__mimicFeeder.ready.filter((ready) => ready === key).length, scene);
    /**
     * Clicks a point (in the game's 1920×1080 design pixels) over and over until `scene` has opened,
     * and for a little longer: whatever a double click's timing, one of these lands there. A button's
     * action only takes effect a frame or two after it runs, and a second click in that gap used to get through.
     */
    const clickUntilOpen = async (x, y, scene) => {
        const box = await page.evaluate(() => {
            const rect = document.querySelector('canvas').getBoundingClientRect();
            return { left: rect.left, top: rect.top, scale: rect.width / 1920 };
        });
        const opensBefore = await timesOpened(scene);
        const giveUp = Date.now() + 30000;
        let until = null;
        for (let clicks = 0; Date.now() < (until ?? giveUp); clicks++) {
            await page.mouse.click(box.left + x * box.scale, box.top + y * box.scale);
            if (until === null && clicks % 10 === 9 && await timesOpened(scene) > opensBefore) {
                until = Date.now() + 300;
            }
        }
    };
    const holdKey = async (key, ms) => {
        await page.keyboard.down(key);
        await page.waitForTimeout(ms);
        await page.keyboard.up(key);
    };

    try {
        // ?test adds the game's debug shortcuts (window.__mimicFeeder.debug), used for the abilities below.
        const response = await page.goto(BASE + '/?test', { waitUntil: 'domcontentloaded', timeout: 30000 });
        const headers = response ? response.headers() : {};
        assert(Boolean(headers['content-security-policy']), 'The game is served at / with the _headers Content-Security-Policy');
        assert(!/noindex/i.test(headers['x-robots-tag'] || ''), 'and is not marked noindex');
        await page.waitForFunction(() => window.__mimicFeeder && window.__mimicFeeder.ready.includes('title'), null, { timeout: 20000 });
        assert(true, 'reaches the title screen');
        const missingFonts = await page.evaluate(() => [
            '700 20px "Grenze Gotisch"', '400 20px Barlow', '700 20px Barlow',
        ].filter((face) => !document.fonts.check(face)));
        assert(missingFonts.length === 0, `loads its self-hosted fonts${missingFonts.length ? ` (missing: ${missingFonts.join(', ')})` : ''}`);
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(OUT_DIR, 'title.png') });

        // The kit's cursor shows on the menus and hides during play (a bad cursor value would leave it hidden everywhere).
        const cursor = () => page.evaluate(() => document.querySelector('canvas').style.cursor);
        assert((await cursor()).includes('url('), 'the title shows the menu cursor');

        // Play is focused on the title menu.
        await page.keyboard.press('Enter');
        await waitForSnapshot((s) => s.running.includes('game') && s.running.includes('hud') && s.game && s.game.playTimeMs > 0);
        const start = await snapshot();
        assert(start.game.lives === 3 && start.game.score === 0 && start.game.floor === 1 && start.game.zone === 1,
            'Play starts a run on Floor 1 Zone 1 with three lives');
        await waitForSnapshot((s) => s.audio === 'running', 5000);
        assert(true, 'audio is running after the first key press');
        assert(await cursor() === 'none', 'the cursor hides during play');

        // Held until it has moved: at a few frames per second a short tap can start and end within one frame.
        await page.keyboard.down('ArrowLeft');
        await waitForSnapshot((s) => s.game.mimicX < start.game.mimicX - 50);
        await page.keyboard.up('ArrowLeft');
        assert(true, 'the mimic moves with the arrow keys');

        await page.keyboard.press('KeyP');
        await waitForSnapshot((s) => s.running.includes('pause') && s.paused.includes('game') && s.paused.includes('hud'));
        const paused = await snapshot();
        await holdKey('ArrowRight', 400);
        await page.keyboard.press('ArrowUp');
        await page.waitForTimeout(400);
        const stillPaused = await snapshot();
        assert(stillPaused.game.playTimeMs === paused.game.playTimeMs && stillPaused.game.objects === paused.game.objects,
            'pause freezes play time and spawning');
        assert(stillPaused.game.mimicX === paused.game.mimicX, 'gameplay keys do nothing while paused');
        assert((await cursor()).includes('url('), 'the cursor comes back on the pause menu');
        await page.screenshot({ path: path.join(OUT_DIR, 'pause.png') });

        await page.keyboard.press('KeyM');
        await waitForSnapshot((s) => s.muted === true, 2000);
        await page.keyboard.press('KeyM');
        await waitForSnapshot((s) => s.muted === false, 2000);
        assert(true, 'M mutes and unmutes, also while paused');

        // Settings (fourth item) opens over the pause menu, and Esc goes back to it. The ↑ pressed
        // above moved the focus from Resume round to Quit (the last item), so Settings is four down.
        for (let i = 0; i < 4; i++) {
            await page.keyboard.press('ArrowDown');
        }
        await page.keyboard.press('Enter');
        const settings = await waitForSnapshot((s) => s.running.includes('settings') && !s.running.includes('pause') && s.paused.includes('game'));
        // The resume countdown is off by default; switch it on (the tenth row) for the checks below.
        assert(settings.save.settings.resumeCountdown === false, 'the resume countdown is off by default');
        for (let i = 0; i < 9; i++) {
            await page.keyboard.press('ArrowDown');
        }
        await page.keyboard.press('Enter');
        await waitForSnapshot((s) => s.save.settings.resumeCountdown === true, 5000);
        await page.keyboard.press('Escape');
        await waitForSnapshot((s) => s.running.includes('pause') && !s.running.includes('settings'));
        assert((await snapshot()).paused.includes('game'), 'Settings opens from the pause menu, switches the countdown on, and Esc returns to it');

        // With it on, leaving the pause menu counts down 3-2-1 over the still-paused run;
        // P during the count goes back to the pause menu.
        await page.keyboard.press('Escape');
        await waitForSnapshot((s) => s.running.includes('countdown') && s.paused.includes('game') && !s.running.includes('pause'));
        await page.keyboard.press('KeyP');
        await waitForSnapshot((s) => s.running.includes('pause') && !s.running.includes('countdown') && s.paused.includes('game'));
        assert(true, 'leaving the pause menu counts down first, and P during it goes back to the menu');
        await page.keyboard.press('Escape');
        await waitForSnapshot((s) => s.running.includes('game') && !s.running.includes('pause') && !s.running.includes('countdown') && s.game.playTimeMs > paused.game.playTimeMs);
        assert(true, 'Esc resumes the run after the countdown');

        // Switching tab mid-run loses focus and hides the page in the same moment; it opens the pause menu
        // once, and nothing of it (the blur) stays after resuming.
        const switchTabAndBack = async () => {
            await page.evaluate(() => {
                Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
                window.dispatchEvent(new Event('blur'));
                document.dispatchEvent(new Event('visibilitychange'));
            });
            await page.evaluate(() => {
                Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
                document.dispatchEvent(new Event('visibilitychange'));
                window.dispatchEvent(new Event('focus'));
            });
        };
        await switchTabAndBack();
        await waitForSnapshot((s) => s.running.includes('pause') && s.paused.includes('game'));
        assert((await snapshot()).game.cameraFilters === 1, 'switching tab mid-run pauses the game (blurred once)');
        await page.keyboard.press('Escape');
        await waitForSnapshot((s) => s.running.includes('game') && !s.running.includes('pause') && !s.running.includes('countdown'));
        assert((await snapshot()).game.cameraFilters === 0, 'resuming after switching tab leaves no blur behind');

        // A stronger screen shake takes over from a weaker one that's running (a hit straight after a dash),
        // and a weaker one leaves a stronger one to finish. All in one go, so no frame passes in between.
        const shakes = await page.evaluate(() => {
            const hook = window.__mimicFeeder;
            hook.debug.shake(2);
            hook.debug.shake(7);
            const stronger = hook.snapshot().game.shake;
            hook.debug.shake(3);
            return { stronger, weaker: hook.snapshot().game.shake };
        });
        assert(shakes.stronger === 7, `a strong screen shake takes over from a weaker one (shaking at ${shakes.stronger})`);
        assert(shakes.weaker === 7, `and a weaker one doesn't cut a strong one short (shaking at ${shakes.weaker})`);

        // Losing the WebGL context (a GPU reset) blanks the screen: the run pauses until it's back.
        const webglContext = (lose) => page.evaluate((loseIt) => {
            if (loseIt) {
                const canvas = document.querySelector('canvas');
                const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
                window.__loseContext = gl.getExtension('WEBGL_lose_context');
                window.__loseContext.loseContext();
            } else {
                window.__loseContext.restoreContext();
            }
        }, lose);
        await webglContext(true);
        const contextLost = await waitForSnapshot((s) => s.running.includes('pause') && s.paused.includes('game'));
        await page.waitForTimeout(1000);
        assert((await snapshot()).game.playTimeMs === contextLost.game.playTimeMs, 'losing the WebGL context pauses the run');
        await webglContext(false);
        await page.waitForTimeout(500);
        // Lost again during the resume countdown: back to the pause menu, not on into play.
        await page.keyboard.press('Escape');
        await waitForSnapshot((s) => s.running.includes('countdown'));
        await webglContext(true);
        await waitForSnapshot((s) => s.running.includes('pause') && !s.running.includes('countdown'));
        await page.waitForTimeout(3500);
        assert((await snapshot()).game.playTimeMs === contextLost.game.playTimeMs, 'and losing it during the resume countdown goes back to the pause menu');
        await webglContext(false);
        await page.waitForTimeout(500);
        await page.keyboard.press('Escape');
        const contextBack = await waitForSnapshot((s) => s.running.includes('game') && !s.running.includes('pause') && !s.running.includes('countdown')
            && s.game.playTimeMs > contextLost.game.playTimeMs);
        assert(contextBack.game.cameraFilters === 0, 'and play resumes from the pause menu once the context is back');

        // Abilities, unlocked through the debug shortcuts, with the normal spawns off so only the test's objects fall.
        const debug = (name, ...args) => page.evaluate(([fn, list]) => window.__mimicFeeder.debug[fn](...list), [name, args]);
        await debug('setSpawning', false);
        // The first unlock of each ability pauses the game on a card that only its own key (or Enter) closes.
        await debug('grant', 'shadowBolt');
        await waitForSnapshot((s) => s.card && s.card.ability === 'shadowBolt' && s.paused.includes('game'));
        assert(true, 'the first Shadow Bolt unlock pauses the game on a card');
        await waitForSnapshot((s) => s.card && s.card.ready);
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(300);
        assert((await snapshot()).card !== null, 'movement keys do not close the card');
        await page.keyboard.press('Space');
        await waitForSnapshot((s) => !s.card && s.running.includes('game'));
        assert(true, "the ability's own key closes the card and play resumes");
        await waitForSnapshot((s) => s.save.achievements.includes('staff_initiate') && s.save.newAchievements.includes('staff_initiate'));
        assert(true, 'finding the Staff unlocks the Staff Initiate achievement, saves it and marks it new');

        // K opens the achievements straight over the run (which marks what's new as seen), and Esc goes back to it.
        await page.keyboard.press('KeyK');
        await waitForSnapshot((s) => s.running.includes('achievements') && !s.running.includes('pause') && s.paused.includes('game'));
        assert((await snapshot()).save.newAchievements.length === 0, 'opening the achievements marks new ones as seen');
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(OUT_DIR, 'achievements.png') });
        await page.keyboard.press('Escape');
        await waitForSnapshot((s) => s.running.includes('game') && s.running.includes('hud') && !s.running.includes('achievements'));
        assert((await snapshot()).running.every((key) => key !== 'pause'), 'K opens the achievements over the run, and Esc goes straight back to it');
        await page.keyboard.press('KeyK');
        await waitForSnapshot((s) => s.running.includes('achievements'));
        await page.keyboard.press('KeyK');
        await waitForSnapshot((s) => s.running.includes('game') && !s.running.includes('achievements'));
        assert(true, 'K closes the achievements too');
        // H opens How to Play straight over the run, on Creatures & Items since this run has met new things,
        // which marks them seen (they stay tagged "New" for this visit); H closes it again.
        // A crown, dropped away from the mimic (missing one costs nothing), is the thing just met.
        const crownX = (await snapshot()).game.mimicX > 960 ? 300 : 1620;
        await debug('spawn', 'crown', crownX);
        const met = (await waitForSnapshot((s) => s.save.newDiscoveries.includes('crown'))).save.newDiscoveries;
        assert(true, 'meeting something marks it new for How to Play');
        await page.keyboard.press('KeyH');
        const opened = await waitForSnapshot((s) => s.running.includes('howToPlay') && s.paused.includes('game') && s.howToPlay && s.howToPlay.tab === 'bestiary');
        assert(met.every((key) => opened.howToPlay.fresh.includes(key)) && opened.save.newDiscoveries.length === 0,
            'H opens How to Play over the run on what is new, and marks it seen');
        await page.keyboard.press('KeyH');
        await waitForSnapshot((s) => s.running.includes('game') && !s.running.includes('howToPlay') && s.howToPlay === null);
        assert(true, 'H goes back to play');
        // Opened from the pause menu (K there too), Esc goes back to the menu, then to the run.
        await page.keyboard.press('KeyP');
        await waitForSnapshot((s) => s.running.includes('pause'));
        await page.keyboard.press('KeyK');
        await waitForSnapshot((s) => s.running.includes('achievements') && !s.running.includes('pause'));
        await page.keyboard.press('Escape');
        await waitForSnapshot((s) => s.running.includes('pause') && !s.running.includes('achievements'));
        await page.keyboard.press('Escape');
        await waitForSnapshot((s) => s.running.includes('game') && !s.running.includes('pause'));
        assert(true, 'the achievements opened from the pause menu go back to it');
        for (const [ability, key] of [['tentacles', 'KeyZ'], ['magnetism', 'KeyX']]) {
            await debug('grant', ability);
            await waitForSnapshot((s) => s.card && s.card.ability === ability && s.card.ready);
            await page.keyboard.press(key);
            await waitForSnapshot((s) => !s.card && s.running.includes('game'));
        }
        let before = await waitForSnapshot((s) => s.game.abilities.length === 4);
        assert(true, 'the Staff, levelling up and the Magnet unlock Shadow Bolt, Tentacles and Magnetism');
        const awayX = before.game.mimicX > 960 ? 300 : 1620;

        await debug('spawn', 'bomb');
        await page.keyboard.press('Space');
        await waitForSnapshot((s) => s.game.hazardsDetonated > before.game.hazardsDetonated);
        assert((await snapshot()).game.lives === before.game.lives, 'a Shadow Bolt sets off a bomb without costing a life');

        before = await snapshot();
        await debug('spawn', 'goblin', awayX);
        await page.keyboard.press('KeyZ');
        await waitForSnapshot((s) => s.game.creaturesEaten > before.game.creaturesEaten);
        assert(true, 'Tentacles reel a creature into the mouth');

        before = await snapshot();
        await debug('spawn', 'crown', awayX);
        await page.keyboard.press('KeyX');
        await waitForSnapshot((s) => s.game.shiniesCollected > before.game.shiniesCollected);
        assert(true, 'Magnetism pulls treasure to the mimic');

        // Pausing (the countdown is on, so resuming counts down first) for longer than any of the
        // game's own waits: a cat's three seconds on the floor, a dragon's flight of up to two.
        const CAT_PAUSE_MS = 3500;
        const DRAGON_PAUSE_MS = 2500;
        const playing = (s) => s.running.includes('game') && !s.running.includes('pause') && !s.running.includes('countdown');
        /** Pauses with `open`, waits, resumes, and returns the game once play has moved on by at least a frame. */
        const pauseAWhile = async (open, ms) => {
            await open();
            const paused = await waitForSnapshot((s) => s.running.includes('pause') && s.paused.includes('game'));
            await page.waitForTimeout(ms);
            await page.keyboard.press('Escape');
            return waitForSnapshot((s) => playing(s) && s.game.playTimeMs > paused.game.playTimeMs);
        };

        // Cats land safely and are rescued after three seconds of play: time spent paused doesn't count.
        // (Each check allows for slow frames: it only expects the cat to be waiting still while less
        // than its three seconds of play have passed since it was seen on the floor.)
        before = await snapshot();
        await debug('spawn', 'cat', awayX);
        const landed = await waitForSnapshot((s) => s.game.waitingCats > 0, 60000);
        const catPlayMs = (s) => s.game.playTimeMs - landed.game.playTimeMs;
        const stillWaiting = (s) => s.game.catsRescued === before.game.catsRescued || catPlayMs(s) >= 2500;
        let resumed = await pauseAWhile(() => page.keyboard.press('KeyP'), CAT_PAUSE_MS);
        assert(stillWaiting(resumed), `a cat on the floor isn't rescued while the game is paused (${Math.round(catPlayMs(resumed))} ms of play since it landed)`);
        resumed = await pauseAWhile(switchTabAndBack, CAT_PAUSE_MS);
        assert(stillWaiting(resumed), `nor while the game is paused by switching tab (${Math.round(catPlayMs(resumed))} ms of play since it landed)`);
        const rescued = await waitForSnapshot((s) => s.game.catsRescued > before.game.catsRescued, 60000);
        // Well short of three seconds, in case a slow frame delayed seeing it land.
        assert(catPlayMs(rescued) >= 1500, `a cat is rescued after three seconds of play (${Math.round(catPlayMs(rescued))} ms since it was seen on the floor)`);
        assert(rescued.game.lives === before.game.lives, 'a cat lands safely and is rescued');

        // Dragons fly off when the mimic is beneath them, for at least a second of play.
        await debug('spawn', 'dragon');
        const fleeing = await waitForSnapshot((s) => s.game.flyingDragons > 0, 60000);
        assert(true, 'a dragon flies off when the mimic is beneath it');
        resumed = await pauseAWhile(() => page.keyboard.press('KeyP'), DRAGON_PAUSE_MS);
        const flightPlayMs = resumed.game.playTimeMs - fleeing.game.playTimeMs;
        assert(resumed.game.flyingDragons > 0 || flightPlayMs >= 1000, `a dragon's flight doesn't run out while the game is paused (${Math.round(flightPlayMs)} ms of play since it took off)`);

        // The lid stays ajar for a quarter second of play after a cast: pausing straight after doesn't use it up.
        // (Allowing for slow frames: it only expects the lid ajar while less than that has passed since the cast.)
        before = await waitForSnapshot((s) => playing(s) && s.game.flyingDragons === 0 && s.game.lid === 'closed');
        resumed = await pauseAWhile(async () => {
            await page.keyboard.press('Space');
            await page.keyboard.press('KeyP');
        }, 1000);
        const sinceCast = resumed.game.playTimeMs - before.game.playTimeMs;
        assert(resumed.game.boltsCast > before.game.boltsCast && (resumed.game.lid === 'ajar' || sinceCast >= 250),
            `the lid's moments are timed in play: still ajar after a pause straight after a cast (${resumed.game.lid}, ${Math.round(sinceCast)} ms of play since)`);

        // Zone 5 of an even floor is a boss fight; beating the boss moves on a floor.
        await debug('startBoss');
        const fight = await waitForSnapshot((s) => s.game.boss !== null);
        assert(fight.game.floor % 2 === 0 && fight.game.zone === 5 && fight.game.objects === 0,
            'Zone 5 of an even floor starts a boss fight on a cleared board');
        // A toast while the boss hovers at the top centre, in the toasts' spot: it fades so the boss stays in sight,
        // as the score and hearts do. (Points enough for a level-up, whose toast shows at once.)
        await debug('bonus', 2000);
        const underBoss = await waitForSnapshot((s) => s.notices.faded > 0, 10000);
        assert(underBoss.game.boss !== null, 'a toast fades while the boss is behind it');

        // The boss's banner is up. Under the pause menu it's hidden, so the menu's title and panels never
        // share the screen with it; the score, hearts and ability bar stay. Paused for longer than the
        // banner lasts, it's back afterwards with the time it had left.
        await waitForSnapshot((s) => s.notices.visible > 0);
        await page.keyboard.press('KeyP');
        const underMenu = await waitForSnapshot((s) => s.running.includes('pause') && s.paused.includes('hud'));
        assert(underMenu.notices.showing > 0 && underMenu.notices.visible === 0, 'the pause menu hides the banner that was showing');
        await page.waitForTimeout(3000);
        await page.keyboard.press('Escape');
        const counting = await waitForSnapshot((s) => s.running.includes('countdown'));
        assert(counting.notices.showing > 0 && counting.notices.visible === 0, 'and it stays hidden through the resume countdown');
        const backInPlay = await waitForSnapshot((s) => playing(s) && s.game.playTimeMs > underMenu.game.playTimeMs);
        assert(backInPlay.notices.showing > 0 && backInPlay.notices.visible === backInPlay.notices.showing, 'the banner is back once play resumes');

        await debug('damageBoss', fight.game.boss.max);
        await waitForSnapshot((s) => s.game.boss === null && s.game.floor === fight.game.floor + 1 && s.game.zone === 1, 60000);
        assert(true, 'beating the boss moves on to the next floor');
        await debug('setSpawning', true);

        // Pause menu: Restart (fifth item) asks first; Cancel is the default.
        await page.keyboard.press('Escape');
        await waitForSnapshot((s) => s.running.includes('pause'));
        for (let i = 0; i < 4; i++) {
            await page.keyboard.press('ArrowDown');
        }
        // Pressed twice, it still asks once: Esc closes the dialog, with none left behind.
        await pressEnterTwice();
        await waitForSnapshot((s) => s.dialog);
        await page.waitForTimeout(400);
        await page.keyboard.press('Escape');
        await waitForSnapshot((s) => !s.dialog, 5000);
        assert((await snapshot()).running.includes('pause'), 'pressing Enter twice on Restart opens one dialog, which Esc closes');
        await page.keyboard.press('Enter');
        await waitForSnapshot((s) => s.dialog);
        await page.keyboard.press('Enter');
        await waitForSnapshot((s) => !s.dialog);
        assert((await snapshot()).running.includes('pause'), 'Restart asks to confirm, and Cancel keeps the run');
        // A button ignores presses for a moment after it has acted (so a double click counts once);
        // the test cancelled faster than a person could, so give Restart that moment.
        await page.waitForTimeout(400);
        await page.keyboard.press('Enter');
        await waitForSnapshot((s) => s.dialog);
        await page.keyboard.press('ArrowRight');
        const beforeRestart = (await snapshot()).game.playTimeMs;
        await page.keyboard.press('Enter');
        await waitForSnapshot((s) => s.running.includes('game') && !s.running.includes('pause') && s.game && s.game.playTimeMs > 0);
        assert((await snapshot()).game.playTimeMs < beforeRestart, 'confirming Restart starts a new run');
        const afterRestart = await snapshot();
        assert(afterRestart.save.runs === 1 && afterRestart.save.scores.length === 0 && afterRestart.save.bestScore > 0,
            'a restarted run counts towards lifetime totals and bests, but not the high scores');
        // Enough points to make the board.
        await debug('bonus', 500);

        // Wait in a corner until enough food hits the floor to end the run.
        await page.keyboard.down('ArrowLeft');
        await waitForSnapshot((s) => s.running.includes('results'), 180000);
        await page.keyboard.up('ArrowLeft');
        assert(true, 'losing the last life ends the run and shows the results');

        // The first score on the board asks for the mimic's name, and saves it under that name.
        const naming = await waitForSnapshot((s) => s.results && s.results.naming);
        assert(naming.results.rank === 1, 'the first score makes the board and asks for a name');
        await page.waitForTimeout(800);
        await page.screenshot({ path: path.join(OUT_DIR, 'results.png') });
        await page.keyboard.type('Chomper!');
        await page.keyboard.press('Enter');
        const named = await waitForSnapshot((s) => s.results && !s.results.naming);
        assert(named.save.name === 'Chomper' && named.save.named && named.save.scores.length === 1 && named.save.scores[0].name === 'Chomper',
            'the name typed is saved, with the score');

        // R plays again straight away (Play Again, focused, does the same with Enter).
        await page.keyboard.press('KeyR');
        await waitForSnapshot((s) => s.running.includes('game') && s.game && s.game.lives === 3 && s.game.playTimeMs > 0);
        assert(true, 'R on the results starts a new run');

        // The Ninefold Judgment: ten cats shot bring it on. Standing still, its fire ends the run.
        await debug('setSpawning', false);
        await debug('grant', 'shadowBolt');
        await debug('shootCats', 10);
        const judged = await waitForSnapshot((s) => s.game && s.game.judgment !== null);
        assert(judged.game.objects === 0, 'ten cats shot bring the Ninefold Judgment, setting everything else aside');
        await page.keyboard.press('Space');
        await page.waitForTimeout(300);
        assert((await snapshot()).game.boltsCast === judged.game.boltsCast, 'Shadow Bolts are blocked during the Judgment');
        // The Judgment's own panel hides under the pause menu too, and is back in play.
        assert((await snapshot()).notices.judgmentSeen === true, 'the Judgment shows its panel');
        await page.keyboard.press('KeyP');
        const judgedUnderMenu = await waitForSnapshot((s) => s.running.includes('pause') && s.paused.includes('hud'));
        assert(judgedUnderMenu.notices.judgmentSeen === false, 'the pause menu hides the Judgment\'s panel');
        await page.keyboard.press('Escape');
        const judgedInPlay = await waitForSnapshot((s) => playing(s) && s.game.playTimeMs > judgedUnderMenu.game.playTimeMs);
        assert(judgedInPlay.notices.judgmentSeen === true, 'and it is back once play resumes');
        await waitForSnapshot((s) => s.results !== null, 120000);
        assert((await snapshot()).results.cause === 'Judged by the dungeon', 'dying to the Judgment shows as the cause of death');
        // Any key skips the story of the run to the end (it takes a few seconds otherwise).
        await page.waitForTimeout(500);
        await page.keyboard.press('Space');
        await waitForSnapshot((s) => s.results && s.results.staged, 1500);
        assert(!(await snapshot()).results.naming, 'any key skips the results to the end, and the name is only asked for once');
        await page.waitForTimeout(200);

        // High Scores (second button) opens over the results, and Esc goes back to them.
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('Enter');
        await waitForSnapshot((s) => s.running.includes('highScores') && !s.running.includes('results'));
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(OUT_DIR, 'high-scores.png') });
        await page.keyboard.press('Escape');
        await waitForSnapshot((s) => s.running.includes('results') && !s.running.includes('highScores'));
        assert(true, 'High Scores opens from the results and Esc returns to them');

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
        await page.screenshot({ path: path.join(OUT_DIR, 'settings.png') });
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__mimicFeeder && window.__mimicFeeder.ready.includes('title'), null, { timeout: 20000 });
        const reloaded = await snapshot();
        assert(reloaded.save.settings.musicVolume === 0.7 && reloaded.save.settings.screenShake === false
            && reloaded.save.name === 'Chomper' && reloaded.save.scores.length >= 1,
        'settings, the name and the high scores survive a reload');
        assert(reloaded.save.achievements.includes('staff_initiate'), 'achievements survive a reload');

        // How to Play (second on the title menu): what this run met is shown, and the abilities it unlocked.
        // From the title it opens on Basics: the goblin met since H was pressed stays new until Creatures & Items is shown.
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        const basics = await waitForSnapshot((s) => s.running.includes('howToPlay') && !s.running.includes('title') && s.howToPlay && s.howToPlay.tab === 'basics');
        assert(basics.save.newDiscoveries.includes('goblin'), 'How to Play opens on Basics from the title, leaving new things unseen');
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowRight');
        const shown = await waitForSnapshot((s) => s.howToPlay && s.howToPlay.tab === 'bestiary');
        const guide = shown.howToPlay;
        assert(!guide.hidden.includes('goblin') && !guide.hidden.includes('bomb') && guide.lockedAbilities.length === 0
            && guide.fresh.includes('goblin') && shown.save.newDiscoveries.length === 0,
            'Creatures & Items shows what has been met and unlocked, tags what is new, and marks it seen');
        await page.keyboard.press('Escape');
        await waitForSnapshot((s) => s.running.includes('title') && !s.running.includes('howToPlay'));

        // Achievements (third on the title menu, one below How to Play) open from the title too.
        // Enter pressed twice still opens them once: a second press used to open them again after they closed.
        await page.keyboard.press('ArrowDown');
        let opensBefore = await timesOpened('achievements');
        await pressEnterTwice();
        await waitForSnapshot((s) => s.running.includes('achievements') && !s.running.includes('title'));
        await page.keyboard.press('Escape');
        await waitForSnapshot((s) => s.running.includes('title') && !s.running.includes('achievements'));
        assert(true, 'Achievements opens from the title menu and Esc returns to it');
        // Time for a second opening, if one were waiting, to happen.
        await page.waitForTimeout(800);
        assert((await snapshot()).running.includes('title') && await timesOpened('achievements') === opensBefore + 1,
            'pressing Enter twice on a menu button opens its screen once');

        // Credits (last on the title menu, at 960, 810; nothing on the Credits screen is clickable there),
        // clicked again and again as it opens: once, too.
        opensBefore = await timesOpened('credits');
        await clickUntilOpen(960, 810, 'credits');
        await waitForSnapshot((s) => s.running.includes('credits') && !s.running.includes('title'));
        await page.keyboard.press('Escape');
        await waitForSnapshot((s) => s.running.includes('title') && !s.running.includes('credits'));
        assert(true, 'Credits opens from the title menu and Esc returns to it');
        await page.waitForTimeout(800);
        assert((await snapshot()).running.includes('title') && await timesOpened('credits') === opensBefore + 1,
            'clicking a menu button repeatedly opens its screen once');

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
            'Erase save data asks first, then clears everything');

        // A practice run (?test&floor=N, a testing aid) starts on that floor with a steady player's progress,
        // and leaves the save alone.
        await page.goto(BASE + '/?test&floor=7', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForFunction(() => window.__mimicFeeder && window.__mimicFeeder.ready.includes('title'), null, { timeout: 20000 });
        await page.waitForTimeout(400);
        await page.keyboard.press('Enter');
        const practice = await waitForSnapshot((s) => s.running.includes('game') && s.game && s.game.playTimeMs > 0);
        assert(practice.game.floor === 7 && practice.game.zone === 1 && practice.game.abilities.length === 4 && practice.game.level >= 5
            && practice.game.score > 0 && practice.game.lives === practice.game.maxLives && practice.game.maxLives > 3,
            '?floor=7 starts a practice run on Floor 7 with a steady player\'s level, abilities, hearts and score');
        await page.evaluate(() => window.__mimicFeeder.debug.die());
        // The game-over hold is 1.8 s of game time, and for its first 120 frames after loading Phaser steps
        // the game at most 1/60 s a frame: at CI's few frames a second, that's well over the usual 30 s.
        const practiceOver = await waitForSnapshot((s) => s.running.includes('results'), 180000);
        assert(practiceOver.save.runs === 0 && practiceOver.save.scores.length === 0 && practiceOver.save.achievements.length === 0
            && practiceOver.save.discoveries.length === 0 && practiceOver.results.rank === null,
            'a practice run leaves the save alone');

        if (cspViolations.length) {
            console.error('CSP violations:', cspViolations);
        }
        assert(cspViolations.length === 0, 'has no Content-Security-Policy violations');
        assert(audioPolicyMessages.length === 0, 'has no AudioContext autoplay-policy warnings');
        if (errors.length) {
            console.error('errors:', errors);
        }
        assert(errors.length === 0, 'has no page errors, console errors or failed requests');
    } finally {
        await page.close().catch(() => {});
    }
}

/**
 * The notices the game shows in place of the game when it can't run: without
 * WebGL (in a browser of its own, started with WebGL off) and without
 * JavaScript. Each is a styled message, not a blank page.
 */
async function checkNotices(browser) {
    const readNotice = (page) => page.evaluate(() => {
        const notice = document.querySelector('.notice');
        if (!notice) {
            return null;
        }
        const box = notice.getBoundingClientRect();
        return {
            heading: notice.querySelector('h1')?.textContent ?? '',
            text: notice.querySelector('p')?.textContent ?? '',
            // Styled: it fills the page, and its heading is in the theme's gold.
            fillsPage: box.width >= window.innerWidth && box.height >= window.innerHeight,
            headingColour: getComputedStyle(notice.querySelector('h1')).color,
            canvases: document.querySelectorAll('canvas').length,
        };
    });
    const GOLD = 'rgb(255, 217, 138)';

    const noWebgl = await chromium.launch({ channel: 'chromium', args: ['--disable-gpu', '--disable-webgl', '--disable-3d-apis'] });
    try {
        const page = await noWebgl.newPage({ viewport: { width: 1280, height: 720 } });
        const errors = [];
        page.on('pageerror', (err) => errors.push(String(err && err.message ? err.message : err)));
        await page.goto(BASE + '/', { waitUntil: 'load', timeout: 30000 });
        await page.waitForSelector('.notice', { timeout: 10000 });
        const notice = await readNotice(page);
        assert(/WebGL/.test(notice.heading) && notice.text.length > 0, `without WebGL says so ("${notice.heading}")`);
        assert(notice.fillsPage && notice.headingColour === GOLD && notice.canvases === 0, 'the WebGL notice is styled and stands in place of the game');
        assert(errors.length === 0, `without WebGL throws no page error${errors.length ? ` (${errors.join('; ')})` : ''}`);
        await page.screenshot({ path: path.join(OUT_DIR, 'no-webgl.png') });
    } finally {
        await noWebgl.close().catch(() => {});
    }

    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 720 } });
    try {
        const page = await context.newPage();
        await page.goto(BASE + '/', { waitUntil: 'load', timeout: 30000 });
        // The page's own scripts don't run; the test's still can.
        await page.waitForSelector('.notice', { timeout: 10000 });
        const notice = await readNotice(page);
        assert(/JavaScript/.test(notice.heading) && notice.text.length > 0, `without JavaScript says so ("${notice.heading}")`);
        assert(notice.fillsPage && notice.headingColour === GOLD && notice.canvases === 0, 'the JavaScript notice is styled like the WebGL one');
        await page.screenshot({ path: path.join(OUT_DIR, 'no-javascript.png') });
    } finally {
        await context.close().catch(() => {});
    }
}

/**
 * Files that fail to load: one that fails once is fetched again, an
 * image that never arrives gets a message with a Reload button (not a black
 * screen), and missing sounds only mean playing without them.
 */
async function checkLoading(browser) {
    const openPage = async (route) => {
        const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
        const errors = [];
        page.on('pageerror', (err) => errors.push(String(err && err.message ? err.message : err)));
        await route(page);
        await page.goto(BASE + '/?test', { waitUntil: 'domcontentloaded', timeout: 30000 });
        return { page, errors };
    };
    const reached = (page, scene, timeout = 30000) => page.waitForFunction((key) => window.__mimicFeeder && window.__mimicFeeder.ready.includes(key), scene, { timeout });
    const readyScenes = (page) => page.evaluate(() => window.__mimicFeeder.ready);

    // A sprite that fails once and then arrives: the title, as usual.
    let requests = 0;
    let { page, errors } = await openPage((p) => p.route('**/assets/goblin.png', (route) => (++requests === 1 ? route.abort() : route.continue())));
    try {
        await reached(page, 'title');
        assert(requests === 2 && errors.length === 0, `fetches a sprite again when it fails to load (${requests} requests)`);
    } finally {
        await page.close().catch(() => {});
    }

    // A sprite that never arrives: a message, and Reload starts again once it's back.
    ({ page, errors } = await openPage((p) => p.route('**/assets/chest_closed.png', (route) => route.abort())));
    try {
        await reached(page, 'loadFailed');
        assert(!(await readyScenes(page)).includes('title') && errors.length === 0, 'says it couldn’t load when a sprite never arrives, and throws no page error');
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(OUT_DIR, 'load-failed.png') });
        await page.unroute('**/assets/chest_closed.png');
        await page.keyboard.press('Enter');
        // The page reloads, so the hook starts over: the title can only be this second load's.
        await page.waitForFunction(() => window.__mimicFeeder && window.__mimicFeeder.ready.includes('title') && !window.__mimicFeeder.ready.includes('loadFailed'), null, { timeout: 30000 });
        assert(true, 'Reload loads the game once the file is back');
    } finally {
        await page.close().catch(() => {});
    }

    // No sound files at all: the game starts and plays, silently.
    ({ page, errors } = await openPage((p) => p.route('**/*.mp3', (route) => route.abort())));
    try {
        await reached(page, 'title');
        await page.waitForTimeout(400);
        await page.keyboard.press('Enter');
        await reached(page, 'hud');
        await page.evaluate(() => {
            window.__mimicFeeder.debug.setSpawning(false);
            window.__mimicFeeder.debug.spawn('goblin');
        });
        await page.waitForFunction(() => window.__mimicFeeder.snapshot().game.creaturesEaten === 1, null, { timeout: 60000 });
        await page.waitForTimeout(300);
        const snapshot = await page.evaluate(() => window.__mimicFeeder.snapshot());
        assert(snapshot.game.objects === 0 && snapshot.game.creaturesEaten === 1 && errors.length === 0,
            `plays on without its sounds when they fail to load${errors.length ? ` (${errors.join('; ')})` : ''}`);
    } finally {
        await page.close().catch(() => {});
    }
}

/**
 * Music that arrives late (a slow connection): on Floor 4, whose own
 * track and the boss's both load in the background, the floor's track turning
 * up during the boss fight doesn't take over, and the boss's starts as soon as
 * it arrives.
 */
async function checkLateMusic(browser) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('pageerror', (err) => errors.push(String(err && err.message ? err.message : err)));
    const releases = {};
    for (const file of ['background2.mp3', 'boss.mp3']) {
        const released = new Promise((resolve) => {
            releases[file] = resolve;
        });
        await page.route(`**/assets/music/${file}`, async (route) => {
            await released;
            await route.continue();
        });
    }
    const snapshot = () => page.evaluate(() => window.__mimicFeeder.snapshot());
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
        throw new Error(`Timed out waiting for the game; last snapshot: ${JSON.stringify(last && last.game)}`);
    };
    try {
        await page.goto(BASE + '/?test&floor=4', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForFunction(() => window.__mimicFeeder && window.__mimicFeeder.ready.includes('title'), null, { timeout: 30000 });
        await page.waitForTimeout(400);
        await page.keyboard.press('Enter');
        await page.waitForFunction(() => window.__mimicFeeder.ready.includes('hud'), null, { timeout: 30000 });
        await page.evaluate(() => {
            window.__mimicFeeder.debug.setSpawning(false);
            window.__mimicFeeder.debug.startBoss();
        });
        await waitForSnapshot((s) => s.game.boss !== null && s.game.floor === 4);

        // Floor 4's own track arrives mid-fight: it waits for the floor, and the boss's track is still wanted.
        const floorTrack = page.waitForResponse('**/assets/music/background2.mp3');
        releases['background2.mp3']();
        await floorTrack;
        await page.waitForTimeout(1500);
        const fighting = await snapshot();
        assert(fighting.game.boss !== null && fighting.game.music !== 'music2',
            `a floor track that loads late doesn't take over the boss fight (playing: ${fighting.game.music})`);

        releases['boss.mp3']();
        await waitForSnapshot((s) => s.game.music === 'boss', 15000);
        assert(errors.length === 0, `the boss music starts as soon as it loads${errors.length ? ` (${errors.join('; ')})` : ''}`);
    } finally {
        Object.values(releases).forEach((release) => release());
        await page.close().catch(() => {});
    }
}

/**
 * The keyboard note: on a phone (touch as the main input) it shows
 * over the game, which loads underneath; Continue closes it without the key
 * reaching the game, and it isn't shown again. A desktop never sees it.
 */
async function checkKeyboardNote(browser) {
    const titleReady = (page) => page.waitForFunction(() => window.__mimicFeeder && window.__mimicFeeder.ready.includes('title'), null, { timeout: 30000 });
    const readNote = (page) => page.evaluate(() => {
        const note = document.querySelector('.notice');
        return note ? { heading: note.querySelector('h1').textContent, focused: document.activeElement === note.querySelector('button') } : null;
    });
    const phone = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

    let context = await browser.newContext(phone);
    try {
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (err) => errors.push(String(err && err.message ? err.message : err)));
        await page.goto(BASE + '/?test', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForSelector('.notice button', { timeout: 10000 });
        await titleReady(page);
        const note = await readNote(page);
        assert(/keyboard/.test(note.heading) && note.focused, `on a phone, a note says the game is played with a keyboard ("${note.heading}")`);
        await page.screenshot({ path: path.join(OUT_DIR, 'keyboard-note.png') });
        // Enter presses Continue; on the title it would also start a run if it got through.
        await page.keyboard.press('Enter');
        await page.waitForTimeout(800);
        const ready = await page.evaluate(() => window.__mimicFeeder.ready);
        assert((await readNote(page)) === null && !ready.includes('game'), 'Continue closes it, and the key doesn\'t reach the game');
        await page.reload({ waitUntil: 'domcontentloaded' });
        await titleReady(page);
        await page.waitForTimeout(300);
        assert((await readNote(page)) === null && errors.length === 0, `and it isn't shown again${errors.length ? ` (${errors.join('; ')})` : ''}`);
    } finally {
        await context.close().catch(() => {});
    }

    context = await browser.newContext(phone);
    try {
        const page = await context.newPage();
        await page.goto(BASE + '/?test', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForSelector('.notice button', { timeout: 10000 });
        await page.tap('.notice button');
        await page.waitForTimeout(300);
        assert((await readNote(page)) === null, 'a tap on Continue closes it too');
    } finally {
        await context.close().catch(() => {});
    }

    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    try {
        await page.goto(BASE + '/?test', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await titleReady(page);
        await page.waitForTimeout(300);
        assert((await readNote(page)) === null, 'a desktop never sees the keyboard note');
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
    // The local server doesn't apply _redirects; check the rules Cloudflare Pages will.
    const redirects = fs.readFileSync(path.join(DIST, '_redirects'), 'utf8');
    assert(/^\/next\/\*\s+\/\s+301$/m.test(redirects) && /^\/next\s+\/\s+301$/m.test(redirects),
        'The old /next/ preview address redirects to / (_redirects)');

    // Launch first so a missing browser fails before the server is listening.
    const browser = await chromium.launch({
        channel: 'chromium',
        args: ['--autoplay-policy=user-gesture-required'],
    });
    console.log(`Using browser: Playwright Chromium ${browser.version()}`);
    // Exact production headers here (no Cache-Control override).
    const server = await startStaticServer({ headerRules, host: HOST, port: PORT, cacheControlConflicts });
    console.log(`Serving ${DIST} at ${BASE} with ${headerRules.length} _headers rules`);

    try {
        await checkGame(browser);
        await checkNotices(browser);
        await checkLoading(browser);
        await checkLateMusic(browser);
        await checkKeyboardNote(browser);

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
