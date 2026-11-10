/**
 * Minimal Cloudflare Pages `_headers` emulation for the local playtest server.
 *
 * Semantics followed (https://developers.cloudflare.com/pages/configuration/headers/):
 * - A rule is an unindented URL pattern followed by indented `Name: value` lines.
 *   `#` starts a comment line; blank lines are ignored.
 * - Patterns are relative paths (`/assets/*`) or absolute URLs
 *   (`https://*.pages.dev/*`). `*` is a splat matching any characters (including
 *   `/`), `:name` is a placeholder matching one path segment. Query strings are
 *   ignored. A pattern must match the whole path (or URL).
 * - EVERY matching rule applies. Headers with the same name from several rules
 *   are joined with `, ` in file order.
 * - An indented `! Name` line detaches that header (drops it even when another
 *   matching rule sets it).
 */
const fs = require('fs');

function escapeRegex(text) {
    return text.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Compiles one `_headers` URL pattern to a whole-string RegExp.
 * @param {string} pattern
 * @returns {RegExp}
 */
function compilePattern(pattern) {
    const source = pattern
        .split(/(\*|:[A-Za-z]\w*)/)
        .map((part) => {
            if (part === '*') {
                return '.*';
            }
            if (/^:[A-Za-z]\w*$/.test(part)) {
                return '[^/]+';
            }
            return escapeRegex(part);
        })
        .join('');
    return new RegExp(`^${source}$`);
}

/**
 * Parses `_headers` text into rules.
 * @param {string} text
 * @returns {{pattern: string, regex: RegExp, absolute: boolean, headers: {name: string, value: string}[], detach: string[]}[]}
 */
function parseHeadersFile(text) {
    const rules = [];
    let current = null;
    const lines = text.split(/\r?\n/);
    lines.forEach((rawLine, index) => {
        const trimmed = rawLine.trim();
        if (trimmed === '' || trimmed.startsWith('#')) {
            return;
        }
        const indented = /^\s/.test(rawLine);
        if (!indented) {
            current = {
                pattern: trimmed,
                regex: compilePattern(trimmed),
                absolute: /^https?:\/\//.test(trimmed),
                headers: [],
                detach: [],
            };
            rules.push(current);
            return;
        }
        if (!current) {
            throw new Error(`_headers line ${index + 1}: header before any URL pattern`);
        }
        if (trimmed.startsWith('!')) {
            current.detach.push(trimmed.slice(1).trim().toLowerCase());
            return;
        }
        const colon = trimmed.indexOf(':');
        if (colon <= 0) {
            throw new Error(`_headers line ${index + 1}: expected "Name: value", got "${trimmed}"`);
        }
        current.headers.push({
            name: trimmed.slice(0, colon).trim(),
            value: trimmed.slice(colon + 1).trim(),
        });
    });
    return rules;
}

function loadHeadersFile(filePath) {
    return parseHeadersFile(fs.readFileSync(filePath, 'utf8'));
}

/**
 * Resolves the headers Cloudflare Pages would add to a response.
 * @param {ReturnType<typeof parseHeadersFile>} rules
 * @param {string} urlPath request path without query, e.g. `/assets/a.png`
 * @param {string} origin e.g. `http://127.0.0.1:4173`, for absolute-URL patterns
 * @returns {{headers: Map<string, {name: string, values: string[], rules: string[]}>, matchedRules: string[]}}
 */
function resolveHeaders(rules, urlPath, origin) {
    const headers = new Map();
    const detached = new Set();
    const matchedRules = [];
    const fullUrl = `${origin}${urlPath}`;

    for (const rule of rules) {
        if (!rule.regex.test(rule.absolute ? fullUrl : urlPath)) {
            continue;
        }
        matchedRules.push(rule.pattern);
        rule.detach.forEach((name) => detached.add(name));
        for (const { name, value } of rule.headers) {
            const key = name.toLowerCase();
            if (!headers.has(key)) {
                headers.set(key, { name, values: [], rules: [] });
            }
            const entry = headers.get(key);
            entry.values.push(value);
            entry.rules.push(rule.pattern);
        }
    }

    detached.forEach((key) => headers.delete(key));
    return { headers, matchedRules };
}

/**
 * Flattens resolved headers to a plain object (same-name values joined with ", ").
 * @param {Map<string, {name: string, values: string[]}>} headers
 * @returns {Record<string, string>}
 */
function toResponseHeaders(headers) {
    const result = {};
    for (const { name, values } of headers.values()) {
        result[name] = values.join(', ');
    }
    return result;
}

module.exports = {
    compilePattern,
    parseHeadersFile,
    loadHeadersFile,
    resolveHeaders,
    toResponseHeaders,
};
