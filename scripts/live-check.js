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
 * - the page, the bundle and the assets get their Cache-Control from
 *   public/_headers (nothing errors if a rule's path stops matching)
 * - the address without its trailing slash redirects to it, and an unknown
 *   address gets a 404
 *
 * The run is never saved: the browser profile is thrown away afterwards, and
 * the game has no backend.
 *
 * Usage:
 *   npm run check:live                      # https://yest.dev/games/mimic-feeder/
 *   LIVE_URL=https://<preview>-mimic-feeder.<subdomain>.workers.dev/games/mimic-feeder/ npm run check:live
 *
 * CI runs it after each deploy of main (.github/workflows/deploy-check.yml).
 * A screenshot is saved to playtest-output/live-check.png.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

// Always with its trailing slash: the game's paths are relative to it.
const LIVE_URL = (process.env.LIVE_URL || 'https://yest.dev/games/mimic-feeder/').replace(/\/?$/, '/');
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
    /** Cache-Control of the first bundle/ and assets/ responses (unset until seen). */
    const cacheControl = {};

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
        const kind = ['bundle', 'assets'].find((dir) => response.url().startsWith(new URL(`${dir}/`, LIVE_URL).href));
        if (kind && !(kind in cacheControl)) {
            cacheControl[kind] = response.headers()['cache-control'] || '';
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
        // Previews (*.workers.dev) are noindex on purpose; the production address must not be.
        if (!new URL(LIVE_URL).hostname.endsWith('.workers.dev')) {
            check(!/noindex/i.test(headers['x-robots-tag'] || ''), 'Document is not marked noindex', headers['x-robots-tag']);
        }
        check(/max-age=3600\b/.test(headers['cache-control'] || ''), 'Document is cached for an hour (_headers)', headers['cache-control']);

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
        check(/\bimmutable\b/.test(cacheControl.bundle || ''), 'The bundle is cached as immutable (_headers)', cacheControl.bundle);
        check(/max-age=86400\b/.test(cacheControl.assets || ''), 'Assets revalidate within a day (_headers)', cacheControl.assets);
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

    // Without the trailing slash, the game's relative paths would point one
    // folder up: Cloudflare redirects to the address with it.
    const noSlash = LIVE_URL.replace(/\/$/, '');
    try {
        const redirect = await page.request.get(noSlash, { maxRedirects: 0 });
        const location = redirect.headers().location || '';
        check([301, 302, 307, 308].includes(redirect.status()) && new URL(location, noSlash).href === LIVE_URL,
            'The address without its trailing slash redirects to it', `status ${redirect.status()}, location ${location || 'none'}`);
    } catch (error) {
        check(false, 'The address without its trailing slash redirects to it', error.message.split('\n')[0]);
    }
    // The game is one page: anything else is a plain 404 (not_found_handling in wrangler.jsonc).
    try {
        const missing = await page.request.get(new URL('no-such-page', LIVE_URL).href, { maxRedirects: 0 });
        check(missing.status() === 404, 'An unknown address gets a 404', `status ${missing.status()}`);
    } catch (error) {
        check(false, 'An unknown address gets a 404', error.message.split('\n')[0]);
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
