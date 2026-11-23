#!/usr/bin/env node
/**
 * Read-only smoke check of the deployed site (production by default).
 *
 * Loads the live page in Playwright's Chromium and checks:
 * - the document returns 200 with a Content-Security-Policy header, and
 *   (on the production domain) isn't marked noindex
 * - the game reaches its title screen, and Enter starts a run whose play time
 *   advances
 * - no CSP violations, page errors, unexpected console errors, failed
 *   requests or HTTP error responses
 * - the old /next/ preview address redirects to /
 *
 * The run is never saved: the browser profile is thrown away afterwards, and
 * the game has no backend.
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
const NEXT_URL = new URL('next/', LIVE_URL).href;

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
        });

        const response = await page.goto(LIVE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
        const headers = response ? response.headers() : {};
        check(response && response.status() === 200, 'Document returns 200', response && `status ${response.status()}`);
        check(Boolean(headers['content-security-policy']), 'Document has a Content-Security-Policy header');
        // Preview deployments (*.pages.dev) are noindex on purpose; the production domain must not be.
        if (!new URL(LIVE_URL).hostname.endsWith('.pages.dev')) {
            check(!/noindex/i.test(headers['x-robots-tag'] || ''), 'Document is not marked noindex', headers['x-robots-tag']);
        }

        // The game reports its scenes and state through its test hook (src/testHook.ts).
        await page.waitForFunction(() => window.__mimicFeeder && window.__mimicFeeder.ready.includes('title'), null, { timeout: 30000 });
        check(true, 'The game reaches its title screen');
        await page.waitForTimeout(500);

        // Play is focused on the title: Enter starts a run (and unlocks audio).
        await page.keyboard.press('Enter');
        await page.waitForFunction(() => {
            const snapshot = window.__mimicFeeder.snapshot();
            return snapshot.running.includes('game') && snapshot.game && snapshot.game.playTimeMs > 0;
        }, null, { timeout: 30000 });
        const before = await page.evaluate(() => window.__mimicFeeder.snapshot().game.playTimeMs);
        await page.waitForTimeout(3000);
        const after = await page.evaluate(() => window.__mimicFeeder.snapshot().game.playTimeMs);
        check(after > before, 'A run starts and its play time advances', `playTimeMs ${Math.round(before)} -> ${Math.round(after)}`);

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
    }

    // The old preview address, for anyone who still has the link.
    try {
        const redirect = await page.request.get(NEXT_URL, { maxRedirects: 0 });
        const location = redirect.headers().location || '';
        check([301, 308].includes(redirect.status()) && new URL(location, NEXT_URL).href === new URL('/', LIVE_URL).href,
            '/next/ redirects to /', `status ${redirect.status()}, location ${location || 'none'}`);
    } catch (error) {
        check(false, '/next/ redirects to /', error.message.split('\n')[0]);
    }

    await browser.close();

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
