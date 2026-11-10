/**
 * Launches Playwright's own Chromium build, the one pinned to the installed
 * Playwright version. Local runs and CI use this same browser, so a local pass
 * means the same engine passed.
 *
 * `channel: 'chromium'` runs the full Chromium build in its new headless mode
 * (closer to a real browser than the separate headless shell), which is why the
 * install step uses `--no-shell`.
 *
 * One-time setup, and again after a Playwright upgrade: npm run playtest:install
 */
const INSTALL_HINT =
    'Playwright\'s Chromium is not installed for this Playwright version.\n' +
    'Run: npm run playtest:install';

/**
 * @param {import('playwright').LaunchOptions} [options]
 * @returns {Promise<import('playwright').Browser>}
 */
async function launchChromium(options = {}) {
    let chromium;
    try {
        ({ chromium } = require('playwright'));
    } catch {
        throw new Error('Playwright is not installed. Run: npm install');
    }

    try {
        return await chromium.launch({ channel: 'chromium', headless: true, ...options });
    } catch (error) {
        if (/Executable doesn't exist/i.test(String(error && error.message))) {
            throw new Error(INSTALL_HINT, { cause: error });
        }
        throw error;
    }
}

module.exports = { launchChromium };
