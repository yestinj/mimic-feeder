#!/usr/bin/env node
/**
 * Read-only smoke check of the deployed site (production by default).
 *
 * Loads the live page in Playwright's Chromium as a returning player and checks:
 * - the document returns 200 with a Content-Security-Policy header
 * - p5 loads and the game reaches active play, with the play timer advancing
 * - no CSP violations, page errors, unexpected console errors, failed
 *   requests or HTTP error responses
 *
 * Nothing is written anywhere: the game has no backend, and the browser
 * profile is thrown away afterwards.
 *
 * Usage:
 *   npm run check:live                      # https://mimicfeeder.yest.dev/
 *   LIVE_URL=https://<preview>.pages.dev/ npm run check:live
 *
 * CI runs it after each deploy of main (.github/workflows/deploy-check.yml).
 * A screenshot is saved to playtest-output/live-check.png.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const LIVE_URL = process.env.LIVE_URL || 'https://mimicfeeder.yest.dev/';
const OUT_DIR = path.join(__dirname, '..', 'playtest-output');
const SCREENSHOT = path.join(OUT_DIR, 'live-check.png');

const failures = [];

function check(condition, message, detail) {
    if (condition) {
        console.log(`OK  ${message}`);
        return;
    }
    console.error(`FAIL ${message}${detail ? `\n     ${detail}` : ''}`);
    failures.push(message);
}

/** Audio autoplay noise before a user gesture is expected in headless runs. */
function isExpectedConsoleError(text) {
    const t = text.toLowerCase();
    return t.includes('play() failed') || t.includes('audiocontext') || t.includes('autoplay')
        || t.includes('the play() request was interrupted');
}

async function main() {
    console.log(`Live check: ${LIVE_URL}`);
    fs.mkdirSync(OUT_DIR, { recursive: true });

    const browser = await chromium.launch({ channel: 'chromium' });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    const cspViolations = [];
    const pageErrors = [];
    const consoleErrors = [];
    const failedRequests = [];
    const errorResponses = [];

    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => {
        if (message.type() === 'error' && !isExpectedConsoleError(message.text())) {
            consoleErrors.push(message.text());
        }
    });
    page.on('requestfailed', (request) => {
        const failure = request.failure();
        failedRequests.push(`${request.url()} (${failure ? failure.errorText : 'failed'})`);
    });
    page.on('response', (response) => {
        if (response.status() >= 400) {
            errorResponses.push(`${response.status()} ${response.url()}`);
        }
    });

    try {
        await page.exposeFunction('__liveCheckReportCspViolation', (violation) => cspViolations.push(violation));
        await page.addInitScript(() => {
            document.addEventListener('securitypolicyviolation', (event) => {
                window.__liveCheckReportCspViolation(`${event.effectiveDirective} blocked ${event.blockedURI}`);
            });
            // Returning player: skips the intro and name entry.
            localStorage.setItem('mimicFeederLastUsedName', 'Live Check');
        });

        const response = await page.goto(LIVE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
        check(response && response.status() === 200, 'Document returns 200', response && `status ${response.status()}`);
        check(Boolean(response && response.headers()['content-security-policy']), 'Document has a Content-Security-Policy header');

        await page.waitForSelector('canvas', { timeout: 30000 });
        await page.waitForFunction(() => typeof gameState !== 'undefined' && gameState.gameStarted, null, { timeout: 30000 });
        const p5Version = await page.evaluate(() => (typeof p5 !== 'undefined' ? p5.VERSION : null));
        check(Boolean(p5Version), `p5 loaded (${p5Version})`);

        // First gesture starts audio and play; then confirm the loop is running.
        await page.click('canvas');
        const before = await page.evaluate(() => gameState.playTime);
        await page.waitForTimeout(3000);
        const state = await page.evaluate(() => ({
            started: gameState.gameStarted,
            over: gameState.gameOver,
            playTime: gameState.playTime,
        }));
        check(state.started && !state.over, 'Game is in active play');
        check(state.playTime > before, 'Play timer advances', `playTime ${before} -> ${state.playTime}`);

        check(cspViolations.length === 0, 'No CSP violations', cspViolations.join('; '));
        check(pageErrors.length === 0, 'No page errors', pageErrors.join('; '));
        check(consoleErrors.length === 0, 'No unexpected console errors', consoleErrors.join('; '));
        check(failedRequests.length === 0, 'No failed requests', failedRequests.join('; '));
        check(errorResponses.length === 0, 'No HTTP error responses', errorResponses.join('; '));
    } catch (error) {
        failures.push(error.message.split('\n')[0]);
        console.error(`FAIL ${error.message.split('\n')[0]}`);
        if (cspViolations.length) {
            console.error(`     CSP violations: ${cspViolations.join('; ')}`);
        }
        if (failedRequests.length) {
            console.error(`     Failed requests: ${failedRequests.join('; ')}`);
        }
    } finally {
        await page.screenshot({ path: SCREENSHOT }).catch(() => {});
        await browser.close();
    }

    if (failures.length) {
        console.error(`\nLive check FAILED (${failures.length}). Screenshot: ${path.relative(process.cwd(), SCREENSHOT)}`);
        process.exit(1);
    }
    console.log('\nLive check passed.');
}

main().catch((error) => {
    console.error('Live check crashed:', error && error.message ? error.message : error);
    process.exit(1);
});
