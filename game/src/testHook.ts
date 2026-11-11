// A small, read-only hook for the Playwright playtest. The rewrite uses ES
// modules, so tests can't reach game state through bare globals as they did
// with the p5 version; scenes report milestones here, and the playtest can
// read a snapshot of the game.
import type * as Phaser from 'phaser';
import { isMuted } from './audio';
import { profile } from './profile';
import { unseenAchievements } from './rules/achievements';
import type { Settings } from './rules/save';

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
    readonly catsRescued: number;
    /** Dragons flying off right now. */
    readonly flyingDragons: number;
    readonly boss: { readonly health: number; readonly max: number; readonly phase: string } | null;
    /** The Ninefold Judgment, while it's on. */
    readonly judgment: { readonly phase: string; readonly gap: number | null } | null;
    readonly boltsCast: number;
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
    /** The new-ability card on screen, and whether it accepts its key yet. */
    readonly card: { readonly ability: string; readonly ready: boolean } | null;
    /** How to Play, while it's open: the tab shown, the creatures and items not met yet, and the abilities not unlocked yet. */
    readonly howToPlay: { readonly tab: string; readonly hidden: readonly string[]; readonly lockedAbilities: readonly string[] } | null;
    /** The results screen, while it's showing: the cause of death, the place on the board, and whether it's asking for a name. */
    readonly results: { readonly cause: string | null; readonly rank: number | null; readonly naming: boolean } | null;
    /** What the save holds. */
    readonly save: {
        readonly name: string;
        readonly named: boolean;
        readonly scores: readonly { readonly name: string; readonly score: number }[];
        readonly bestScore: number;
        readonly runs: number;
        readonly discoveries: readonly string[];
        /** Unlocked achievement ids. */
        readonly achievements: readonly string[];
        /** Unlocked ones not yet seen on the achievements screen ("New" there). */
        readonly newAchievements: readonly string[];
        readonly settings: Settings;
    };
}

/** Shortcuts for the playtest, present only with ?test in the URL. */
export interface DebugApi {
    /** Unlocks an ability the way the game does (Staff, Magnet, or levelling up to 5 for tentacles). */
    grant(ability: string): void;
    /** Drops an object at x (default: above the mimic). */
    spawn(kind: string, x?: number): void;
    /** Stops (and clears) or restarts the normal spawns, so a test controls what falls. */
    setSpawning(on: boolean): void;
    /** Jumps to the next boss fight (Zone 5 of the next even floor). */
    startBoss(): void;
    /** Applies Shadow Bolt hits to the boss without aiming. */
    damageBoss(hits: number): void;
    /** Counts cats as shot, as if by Shadow Bolts (the fifth warns, the tenth brings the judgment). */
    shootCats(count: number): void;
    /** Adds points (and XP), so a test run can make the high scores. */
    bonus(points: number): void;
}

export interface MimicFeederTestHook {
    /** Scene keys that have finished creating, in order. */
    readonly ready: string[];
    snapshot?: () => GameSnapshot;
    debug?: DebugApi;
}

const query = new URLSearchParams(window.location.search);
/** True when the page was opened with ?test: the debug shortcuts are available. */
export const TEST_MODE = query.has('test');
/** True with ?debug: physics bodies are outlined and frame times shown. */
export const DEBUG_MODE = query.has('debug');

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

let card: (() => GameSnapshot['card']) | null = null;
let howToPlay: GameSnapshot['howToPlay'] = null;

/** How to Play reports what it shows; null when it closes. */
export function setHowToPlayView(view: GameSnapshot['howToPlay']): void {
    howToPlay = view;
}
let results: GameSnapshot['results'] = null;

/** The results scene reports what it shows; null when it closes. */
export function setResultsView(view: GameSnapshot['results']): void {
    results = view;
}

/** The unlock scene reports its card here; null when none is showing. */
export function setCardView(view: (() => GameSnapshot['card']) | null): void {
    card = view;
}

/** The game scene registers how to describe the run; null when it shuts down. */
export function setGameView(view: (() => GameView) | null): void {
    gameView = view;
}

function saveView(): GameSnapshot['save'] {
    const save = profile();
    return {
        name: save.name,
        named: save.named,
        scores: save.highScores.map(({ name, score }) => ({ name, score })),
        bestScore: save.bests.score,
        runs: save.totals.runs,
        discoveries: save.discoveries,
        achievements: Object.keys(save.achievements),
        newAchievements: unseenAchievements(save),
        settings: save.settings,
    };
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
            card: card ? card() : null,
            howToPlay,
            results,
            save: saveView(),
        };
    };
}
