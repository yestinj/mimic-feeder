/**
 * ESLint flat config for Mimic Feeder. Run through `npm run lint` (scripts/lint.js).
 *
 * The game is classic global scripts concatenated in build.js JS_FILE_ORDER, so
 * linting src/js files one at a time would report every cross-file name as
 * undefined. scripts/lint.js instead lints the same concatenation the build
 * ships, under the virtual path GAME_BUNDLE_PATH, and maps findings back to the
 * original file and line. Running plain `npx eslint .` covers only the Node
 * tooling (src/js is ignored here on purpose).
 */
const js = require('@eslint/js');
const globals = require('globals');
const p5GlobalsFile = require('./scripts/p5-globals.json');

/** Virtual file name scripts/lint.js passes to ESLint for the concatenated game. */
const GAME_BUNDLE_PATH = 'src/game-bundle.js';

/**
 * p5 lifecycle and event callbacks. The game defines these and p5 calls them,
 * so nothing in the bundle references them (no-unused-vars would report them).
 * They are also kept out of the p5 globals so defining them is not a redeclare.
 */
const P5_CALLBACKS = [
    'preload', 'setup', 'draw', 'windowResized',
    'keyPressed', 'keyReleased', 'keyTyped',
    'mousePressed', 'mouseReleased', 'mouseClicked', 'doubleClicked',
    'mouseMoved', 'mouseDragged', 'mouseWheel',
    'touchStarted', 'touchMoved', 'touchEnded',
    'deviceMoved', 'deviceTurned', 'deviceShaken',
];

/**
 * Names p5.js + p5.sound global mode put on window, generated from the CDN pins
 * in src/index.html by scripts/generate-p5-globals.js. All readonly: assigning
 * to one (e.g. `width = 10`) silently breaks p5, so no-global-assign reports it.
 */
const p5Globals = Object.fromEntries(
    p5GlobalsFile.globals
        .filter((name) => !P5_CALLBACKS.includes(name))
        .map((name) => [name, 'readonly'])
);

/**
 * Correctness rules for the game bundle: likely bugs, not style. Kept as an
 * explicit list (rather than all of js.configs.recommended) so new upstream
 * recommended rules do not churn game source.
 */
const gameCorrectnessRules = {
    'no-undef': 'error',
    // builtinGlobals: also report a top-level declaration that shadows a
    // browser or p5 global (e.g. `function random()` replacing p5's).
    'no-redeclare': ['error', { builtinGlobals: true }],
    'no-unused-vars': ['error', {
        vars: 'all',
        args: 'none',
        caughtErrors: 'none',
        varsIgnorePattern: `^(${P5_CALLBACKS.join('|')})$`,
    }],
    'no-global-assign': 'error',
    'no-const-assign': 'error',
    'no-func-assign': 'error',
    'no-class-assign': 'error',
    'no-dupe-keys': 'error',
    'no-dupe-args': 'error',
    'no-dupe-class-members': 'error',
    'no-dupe-else-if': 'error',
    'no-duplicate-case': 'error',
    'no-fallthrough': 'error',
    'no-unreachable': 'error',
    'no-self-assign': 'error',
    'no-self-compare': 'error',
    'no-cond-assign': 'error',
    'no-constant-binary-expression': 'error',
    'no-unsafe-negation': 'error',
    'no-unsafe-finally': 'error',
    'no-sparse-arrays': 'error',
    'no-loss-of-precision': 'error',
    'no-shadow-restricted-names': 'error',
    'no-use-before-define': ['error', { functions: false, classes: false, variables: false }],
    'use-isnan': 'error',
    'valid-typeof': 'error',
    'getter-return': 'error',
};

module.exports = [
    {
        ignores: [
            'dist/**',
            'docs/**',
            'playtest-output/**',
            'archive/**',
            // Linted as one concatenated bundle by scripts/lint.js (see header).
            'src/js/**',
        ],
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
        // scripts/playtest.js runs page.evaluate() callbacks inside the game
        // page, where game globals (gameState, player, ...) and browser APIs
        // are bare names. Those callbacks are not checked against the bundle.
        files: ['scripts/playtest.js', 'scripts/generate-p5-globals.js'],
        rules: {
            'no-undef': 'off',
        },
    },
    {
        files: [GAME_BUNDLE_PATH],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'script',
            globals: {
                ...globals.browser,
                ...p5Globals,
            },
        },
        linterOptions: {
            reportUnusedDisableDirectives: 'error',
        },
        rules: gameCorrectnessRules,
    },
];

module.exports.GAME_BUNDLE_PATH = GAME_BUNDLE_PATH;
