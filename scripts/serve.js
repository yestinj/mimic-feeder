#!/usr/bin/env node
/**
 * Local static server for dist/ that applies dist/_headers (the build's copy of
 * public/_headers) the way Cloudflare does, so local runs get the production
 * Content-Security-Policy and other headers. See scripts/headers.js.
 *
 * Like production, the game is served under the base path from wrangler.jsonc
 * (/games/mimic-feeder/), so a root-relative path in the game fails here too.
 * The address without the trailing slash redirects to it; anything outside the
 * base path is a 404.
 *
 * Used two ways:
 * - `npm start`: manual testing on http://127.0.0.1:8080/games/mimic-feeder/ (PORT overrides).
 *   Every _headers rule applies except Cache-Control, which is replaced with
 *   `no-store` so a rebuild shows up on a normal refresh.
 * - scripts/playtest.js: imports startStaticServer() and keeps the exact
 *   production headers, including Cache-Control.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const ts = require('typescript');
const { loadHeadersFile, resolveHeaders, toResponseHeaders } = require('./headers.js');

const DIST = path.join(__dirname, '..', 'dist');
const HEADERS_FILE = path.join(DIST, '_headers');

/** The path the game is served under, with both slashes: assets.base_path in wrangler.jsonc. */
function readBasePath() {
    const file = path.join(__dirname, '..', 'wrangler.jsonc');
    // TypeScript's tsconfig parser reads JSONC (comments, trailing commas).
    const { config, error } = ts.parseConfigFileTextToJson(file, fs.readFileSync(file, 'utf8'));
    if (error) {
        throw new Error(`wrangler.jsonc: ${ts.flattenDiagnosticMessageText(error.messageText, '\n')}`);
    }
    const basePath = (config.assets && config.assets.base_path) || '/';
    return `/${basePath.replace(/^\/+|\/+$/g, '')}/`.replace('//', '/');
}

const BASE_PATH = readBasePath();

function contentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return ({
        '.html': 'text/html; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.webp': 'image/webp',
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

/**
 * Fails with a hint when dist/ has not been built (or the build did not copy
 * public/_headers). Returns the parsed _headers rules.
 */
function loadDistHeaderRules() {
    if (!fs.existsSync(path.join(DIST, 'index.html'))) {
        throw new Error('dist/index.html missing. Run `npm run build` first.');
    }
    if (!fs.existsSync(HEADERS_FILE)) {
        throw new Error('dist/_headers missing. The build copies public/_headers; run `npm run build`.');
    }
    return loadHeadersFile(HEADERS_FILE);
}

function listDistFiles(dirPath, files = []) {
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            listDistFiles(fullPath, files);
        } else if (entry.isFile()) {
            files.push(fullPath);
        }
    }
    return files;
}

/**
 * Every URL path Cloudflare would serve from dist/, under BASE_PATH: each file,
 * minus `_headers` (Cloudflare reads it, never serves it), plus the directory
 * path (BASE_PATH, ...) of every index.html.
 */
function listServedPaths() {
    const filePaths = listDistFiles(DIST)
        .filter((filePath) => filePath !== HEADERS_FILE)
        .map((filePath) => BASE_PATH + path.relative(DIST, filePath).split(path.sep).join('/'));
    const directoryPaths = filePaths
        .filter((urlPath) => urlPath.endsWith('/index.html'))
        .map((urlPath) => urlPath.slice(0, -'index.html'.length));
    return [...directoryPaths, ...filePaths].sort();
}

/**
 * Returns a `path <- rule + rule => "value"` description when resolved headers
 * got Cache-Control from more than one _headers rule (Cloudflare would join them).
 */
function describeCacheControlConflict(urlPath, resolved) {
    const cacheControl = resolved.headers.get('cache-control');
    if (!cacheControl || cacheControl.values.length <= 1) {
        return null;
    }
    return `${urlPath} <- ${cacheControl.rules.join(' + ')} => "${cacheControl.values.join(', ')}"`;
}

/**
 * Starts the server.
 * @param {object} options
 * @param {ReturnType<typeof loadHeadersFile>} options.headerRules
 * @param {string} options.host
 * @param {number} options.port
 * @param {string} [options.cacheControlOverride] replaces any Cache-Control from _headers
 * @param {string[]} [options.cacheControlConflicts] collects multi-rule Cache-Control paths seen
 * @returns {Promise<http.Server>}
 */
function startStaticServer({ headerRules, host, port, cacheControlOverride, cacheControlConflicts = [] }) {
    const origin = `http://${host}:${port}`;
    const server = http.createServer((req, res) => {
        let urlPath;
        try {
            urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        } catch {
            res.writeHead(400);
            res.end('Bad request');
            return;
        }

        // Apply every matching _headers rule to every response, as Cloudflare does.
        const resolved = resolveHeaders(headerRules, urlPath, origin);
        const conflict = describeCacheControlConflict(urlPath, resolved);
        if (conflict && !cacheControlConflicts.includes(conflict)) {
            cacheControlConflicts.push(conflict);
        }
        const ruleHeaders = toResponseHeaders(resolved.headers);
        if (cacheControlOverride) {
            for (const name of Object.keys(ruleHeaders)) {
                if (name.toLowerCase() === 'cache-control') {
                    delete ruleHeaders[name];
                }
            }
            ruleHeaders['Cache-Control'] = cacheControlOverride;
        }

        // Like Cloudflare: the game's address without its trailing slash
        // redirects to it, and nothing outside the base path is served.
        if (`${urlPath}/` === BASE_PATH) {
            const queryStart = (req.url || '').indexOf('?');
            const query = queryStart === -1 ? '' : req.url.slice(queryStart);
            res.writeHead(307, { ...ruleHeaders, Location: BASE_PATH + query });
            res.end();
            return;
        }
        if (!urlPath.startsWith(BASE_PATH)) {
            res.writeHead(404, ruleHeaders);
            res.end('Not found');
            return;
        }
        // A directory path serves that directory's index.html.
        const relativePath = urlPath.slice(BASE_PATH.length);
        const safePath = relativePath === '' || relativePath.endsWith('/') ? `${relativePath}index.html` : relativePath;
        const filePath = path.normalize(path.join(DIST, safePath));
        if (!filePath.startsWith(DIST + path.sep)) {
            res.writeHead(403, ruleHeaders);
            res.end('Forbidden');
            return;
        }
        if (filePath === HEADERS_FILE) {
            res.writeHead(404, ruleHeaders);
            res.end('Not found');
            return;
        }
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404, ruleHeaders);
                res.end('Not found');
                return;
            }
            res.writeHead(200, { ...ruleHeaders, 'Content-Type': contentType(filePath) });
            res.end(data);
        });
    });

    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => resolve(server));
    });
}

/** Best-effort: open the URL in the default browser. */
function openInBrowser(url) {
    const command = ({ darwin: 'open', win32: 'explorer' })[process.platform] || 'xdg-open';
    try {
        const child = spawn(command, [url], { stdio: 'ignore', detached: true });
        child.on('error', () => {});
        child.unref();
    } catch {
        // Not fatal: the URL is printed anyway.
    }
}

async function main() {
    const host = '127.0.0.1';
    const port = Number(process.env.PORT || 8080);
    const headerRules = loadDistHeaderRules();
    await startStaticServer({ headerRules, host, port, cacheControlOverride: 'no-store' });

    const url = `http://${host}:${port}${BASE_PATH}`;
    console.log(`Serving dist/ at ${url}`);
    console.log(`Applying ${headerRules.length} _headers rules (CSP etc.); Cache-Control replaced with no-store for local testing.`);
    console.log('After a change, run `npm run build` again and refresh. Ctrl+C to stop.');
    openInBrowser(url);
}

module.exports = {
    BASE_PATH,
    DIST,
    HEADERS_FILE,
    loadDistHeaderRules,
    listServedPaths,
    describeCacheControlConflict,
    startStaticServer,
};

if (require.main === module) {
    main().catch((error) => {
        console.error(error && error.message ? error.message : error);
        process.exit(1);
    });
}
