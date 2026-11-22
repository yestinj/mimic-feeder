/**
 * ESLint flat config for Mimic Feeder. Run through `npm run lint` (scripts/lint.js).
 *
 * - The game (src/, TypeScript): typescript-eslint's recommended rules.
 * - The Node tooling (build.js, eslint.config.js, scripts/): ESLint's recommended rules.
 * Unused eslint-disable comments are errors in both.
 */
const js = require('@eslint/js');
const globals = require('globals');
const tseslint = require('typescript-eslint');

module.exports = [
    {
        ignores: [
            'dist/**',
            'playtest-output/**',
            'archive/**',
        ],
    },
    {
        linterOptions: {
            reportUnusedDisableDirectives: 'error',
        },
    },
    {
        files: ['build.js', 'eslint.config.js', 'scripts/**/*.js'],
        ...js.configs.recommended,
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'commonjs',
            globals: {
                ...globals.node,
            },
        },
    },
    {
        // These scripts run page.evaluate() callbacks inside the game page,
        // where browser APIs (window, document, KeyboardEvent, ...) are bare
        // names. Those callbacks run in the browser, not in Node.
        files: ['scripts/playtest.js', 'scripts/live-check.js'],
        rules: {
            'no-undef': 'off',
        },
    },
    ...tseslint.configs.recommended.map((config) => ({ ...config, files: ['src/**/*.ts', 'vite.config.mts'] })),
    {
        files: ['src/**/*.ts'],
        languageOptions: {
            globals: {
                ...globals.browser,
            },
        },
    },
    {
        files: ['vite.config.mts'],
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
    },
];
