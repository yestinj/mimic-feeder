// A small, read-only hook for the Playwright playtest. The rewrite uses ES
// modules, so tests can't reach game state through bare globals as they did
// with the p5 version; scenes report milestones here, and the playtest can
// read a snapshot of the game.
import type * as Phaser from 'phaser';
import { isMuted } from './audio';

/** What the game scene reports about the run in progress. */
export interface GameView {
    readonly score: number;
    readonly floor: number;
    readonly zone: number;
    readonly lives: number;
    readonly maxLives: number;
    readonly level: number;
    readonly playTimeMs: number;
    readonly mimicX: number;
    readonly objects: number;
    /** Abilities unlocked so far. */
    readonly abilities: readonly string[];
    readonly creaturesEaten: number;
    readonly shiniesCollected: number;
    readonly hazardsDetonated: number;
    /** Falling creatures' centres, lowest first (lets a test chase food). */
    readonly food: readonly { readonly x: number; readonly y: number }[];
}

export interface GameSnapshot {
    /** Scenes that are running (updating). */
    readonly running: readonly string[];
    /** Scenes that are paused. */
    readonly paused: readonly string[];
    /** The run, while a game scene exists (running or paused). */
    readonly game: GameView | null;
    /** The Web Audio context's state ("suspended" until the first key press or click). */
    readonly audio: string;
    readonly muted: boolean;
    /** A confirm dialog is open. */
    readonly dialog: boolean;
}

/** Shortcuts for the playtest, present only with ?test in the URL. */
export interface DebugApi {
    /** Unlocks an ability the way the game does (Staff, Magnet, or levelling up to 5 for tentacles). */
    grant(ability: string): void;
    /** Drops an object at x (default: above the mimic). */
    spawn(kind: string, x?: number): void;
    /** Stops (and clears) or restarts the normal spawns, so a test controls what falls. */
    setSpawning(on: boolean): void;
}

export interface MimicFeederTestHook {
    /** Scene keys that have finished creating, in order. */
    readonly ready: string[];
    snapshot?: () => GameSnapshot;
    debug?: DebugApi;
}

/** True when the page was opened with ?test: the debug shortcuts are available. */
export const TEST_MODE = new URLSearchParams(window.location.search).has('test');

declare global {
    interface Window {
        __mimicFeeder?: MimicFeederTestHook;
    }
}

function hook(): MimicFeederTestHook {
    window.__mimicFeeder ??= { ready: [] };
    return window.__mimicFeeder;
}

export function markReady(sceneKey: string): void {
    hook().ready.push(sceneKey);
}

let gameView: (() => GameView) | null = null;

/** The game scene provides the debug shortcuts while it exists (test mode only). */
export function setDebugApi(api: DebugApi | null): void {
    if (!TEST_MODE) {
        return;
    }
    if (api) {
        hook().debug = api;
    } else {
        delete hook().debug;
    }
}
let dialogOpen = false;

export function setDialogOpen(open: boolean): void {
    dialogOpen = open;
}

/** The game scene registers how to describe the run; null when it shuts down. */
export function setGameView(view: (() => GameView) | null): void {
    gameView = view;
}

export function installTestHook(game: Phaser.Game): void {
    hook().snapshot = () => {
        const scenes = game.scene.getScenes(false);
        const context = (game.sound as Partial<Phaser.Sound.WebAudioSoundManager>).context;
        return {
            running: scenes.filter((scene) => scene.sys.isActive()).map((scene) => scene.sys.settings.key),
            paused: scenes.filter((scene) => scene.sys.isPaused()).map((scene) => scene.sys.settings.key),
            game: gameView ? gameView() : null,
            audio: context ? context.state : 'none',
            muted: isMuted(),
            dialog: dialogOpen,
        };
    };
}
