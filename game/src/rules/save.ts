// The save: one versioned object in localStorage (plan §3.8). It holds the
// name and settings, the top 10 scores, personal bests, achievements,
// discoveries, the abilities already introduced, and lifetime totals. Every
// field is checked on load, so an old, partial or corrupt save never breaks
// the game: anything unusable falls back to its default.
import { ABILITIES, type Ability } from './abilities';
import { EDIBLE_KINDS, POWER_UP_KINDS, SHINY_KINDS, type EdibleKind, type PowerUpKind, type ShinyKind } from './objects';

export const SAVE_KEY = 'mimicFeeder.save';
export const SAVE_VERSION = 1;
/** The p5 game's keys, deleted on first load (starting fresh was agreed, plan §3.8). */
export const OLD_KEYS = ['mimicFeederHighScores', 'mimicFeederLastUsedName', 'mimicAchievements'] as const;

export const HIGH_SCORE_COUNT = 10;
export const NAME_MAX_LENGTH = 12;
export const DEFAULT_NAME = 'Mimic';
/** What a name can be typed with: letters (any language, with their accents and vowel signs), digits and spaces. */
export const NAME_CHARACTER = /^[\p{L}\p{M}\p{N} ]$/u;

export interface Settings {
    /** 0–1, on top of each track's own level. */
    readonly musicVolume: number;
    /** 0–1, for sound effects (and, from M4, UI sounds). */
    readonly effectsVolume: number;
    readonly muted: boolean;
    readonly screenShake: boolean;
    readonly reducedMotion: boolean;
}

export interface HighScore {
    readonly name: string;
    readonly score: number;
    readonly floor: number;
    readonly zone: number;
    readonly level: number;
    readonly playTimeMs: number;
    /** When the run ended, as an ISO date-time. */
    readonly date: string;
}

/** Counts across every run (the grind achievements are measured on these). */
export interface Totals {
    readonly runs: number;
    readonly playTimeMs: number;
    readonly eaten: Readonly<Record<EdibleKind, number>>;
    readonly collected: Readonly<Record<ShinyKind | PowerUpKind, number>>;
    readonly catsRescued: number;
    readonly catsKilled: number;
    readonly catsShot: number;
    readonly hazardsDetonated: number;
    /** Objects destroyed: side hits and Shadow Bolt kills. */
    readonly destroyed: number;
    readonly bossesDefeated: number;
    readonly judgmentsSurvived: number;
    readonly uses: Readonly<Record<Ability, number>>;
    /** The secret achievements' feats: the Ninefold Judgment brought on, a boss beaten without losing a heart, a bomb pulled into the mouth with Magnetism, a new floor reached on the last heart. */
    readonly judgmentsCalled: number;
    readonly flawlessBosses: number;
    readonly hotSnacks: number;
    readonly lastHeartFloors: number;
}

/** Bests from single runs. */
export interface Bests {
    readonly score: number;
    readonly floor: number;
    readonly level: number;
    readonly playTimeMs: number;
}

export interface SaveData {
    readonly version: typeof SAVE_VERSION;
    readonly name: string;
    /** True once the player has chosen a name: "Name your mimic" is only asked once. */
    readonly named: boolean;
    readonly settings: Settings;
    /** Best first, at most HIGH_SCORE_COUNT. */
    readonly highScores: readonly HighScore[];
    readonly bests: Bests;
    readonly totals: Totals;
    /** Achievement ids and when each was unlocked (ISO date-time). */
    readonly achievements: Readonly<Record<string, string>>;
    /** Unlocked achievements already seen on the achievements screen (the rest are marked "New" there). */
    readonly achievementsSeen: readonly string[];
    /** Object kinds the player has met (How to Play shows the rest as "???"). */
    readonly discoveries: readonly string[];
    /** Discoveries already seen on How to Play's Creatures & Items tab (the rest are marked "New" there). */
    readonly discoveriesSeen: readonly string[];
    /** Abilities whose new-ability card has been shown. */
    readonly introduced: readonly Ability[];
}

/** Settings start from the system: reduced motion on, and screen shake off, when it asks for less motion. */
export function defaultSettings(systemPrefersReducedMotion: boolean): Settings {
    return { musicVolume: 1, effectsVolume: 1, muted: false, screenShake: !systemPrefersReducedMotion, reducedMotion: systemPrefersReducedMotion };
}

function zeroCounts<K extends string>(keys: readonly K[]): Record<K, number> {
    return Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
}

export function emptyTotals(): Totals {
    return {
        runs: 0,
        playTimeMs: 0,
        eaten: zeroCounts(EDIBLE_KINDS),
        collected: zeroCounts([...SHINY_KINDS, ...POWER_UP_KINDS]),
        catsRescued: 0,
        catsKilled: 0,
        catsShot: 0,
        hazardsDetonated: 0,
        destroyed: 0,
        bossesDefeated: 0,
        judgmentsSurvived: 0,
        uses: zeroCounts(ABILITIES),
        judgmentsCalled: 0,
        flawlessBosses: 0,
        hotSnacks: 0,
        lastHeartFloors: 0,
    };
}

export function defaultSave(systemPrefersReducedMotion: boolean): SaveData {
    return {
        version: SAVE_VERSION,
        name: DEFAULT_NAME,
        named: false,
        settings: defaultSettings(systemPrefersReducedMotion),
        highScores: [],
        bests: { score: 0, floor: 0, level: 0, playTimeMs: 0 },
        totals: emptyTotals(),
        achievements: {},
        achievementsSeen: [],
        discoveries: [],
        discoveriesSeen: [],
        introduced: [],
    };
}

/**
 * Letters (with their marks), digits and spaces only, trimmed and at most
 * NAME_MAX_LENGTH characters (counted as the text field counts them, so a
 * character outside the basic plane is never cut in half); empty becomes the
 * default.
 */
export function cleanName(name: string): string {
    const kept = name.replace(/[^\p{L}\p{M}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim();
    const cleaned = [...kept].slice(0, NAME_MAX_LENGTH).join('').trim();
    // A name of marks alone has nothing to show.
    return /[\p{L}\p{N}]/u.test(cleaned) ? cleaned : DEFAULT_NAME;
}

/** True if `raw` is a save from a newer version of the game, which this one must not overwrite. */
export function isNewerSave(raw: string | null): boolean {
    if (!raw) {
        return false;
    }
    try {
        const data: unknown = JSON.parse(raw);
        return isObject(data) && typeof data.version === 'number' && data.version > SAVE_VERSION;
    } catch {
        return false;
    }
}

type Unknown = Record<string, unknown>;

function isObject(value: unknown): value is Unknown {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function number(value: unknown, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
    return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function boolean(value: unknown, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback;
}

function counts<K extends string>(value: unknown, keys: readonly K[]): Record<K, number> {
    const source = isObject(value) ? value : {};
    return Object.fromEntries(keys.map((key) => [key, Math.floor(number(source[key], 0))])) as Record<K, number>;
}

function readSettings(value: unknown, defaults: Settings): Settings {
    const source = isObject(value) ? value : {};
    return {
        musicVolume: number(source.musicVolume, defaults.musicVolume, 0, 1),
        effectsVolume: number(source.effectsVolume, defaults.effectsVolume, 0, 1),
        muted: boolean(source.muted, defaults.muted),
        screenShake: boolean(source.screenShake, defaults.screenShake),
        reducedMotion: boolean(source.reducedMotion, defaults.reducedMotion),
    };
}

function readHighScores(value: unknown): HighScore[] {
    if (!Array.isArray(value)) {
        return [];
    }
    const scores: HighScore[] = [];
    for (const entry of value) {
        if (!isObject(entry) || typeof entry.date !== 'string' || typeof entry.name !== 'string') {
            continue;
        }
        scores.push({
            name: cleanName(entry.name),
            score: Math.floor(number(entry.score, 0)),
            floor: Math.floor(number(entry.floor, 1, 1)),
            zone: Math.floor(number(entry.zone, 1, 1)),
            level: Math.floor(number(entry.level, 1, 1)),
            playTimeMs: number(entry.playTimeMs, 0),
            date: entry.date,
        });
    }
    return sortScores(scores).slice(0, HIGH_SCORE_COUNT);
}

function readTotals(value: unknown): Totals {
    const source = isObject(value) ? value : {};
    const whole = (key: string): number => Math.floor(number(source[key], 0));
    return {
        runs: whole('runs'),
        playTimeMs: number(source.playTimeMs, 0),
        eaten: counts(source.eaten, EDIBLE_KINDS),
        collected: counts(source.collected, [...SHINY_KINDS, ...POWER_UP_KINDS]),
        catsRescued: whole('catsRescued'),
        catsKilled: whole('catsKilled'),
        catsShot: whole('catsShot'),
        hazardsDetonated: whole('hazardsDetonated'),
        destroyed: whole('destroyed'),
        bossesDefeated: whole('bossesDefeated'),
        judgmentsSurvived: whole('judgmentsSurvived'),
        uses: counts(source.uses, ABILITIES),
        judgmentsCalled: whole('judgmentsCalled'),
        flawlessBosses: whole('flawlessBosses'),
        hotSnacks: whole('hotSnacks'),
        lastHeartFloors: whole('lastHeartFloors'),
    };
}

function readStrings(value: unknown): string[] {
    return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === 'string'))] : [];
}

/**
 * Reads a stored save. Returns null if there's nothing usable (missing,
 * unreadable or from an unknown version); otherwise every field is checked and
 * anything missing or invalid takes its default.
 */
export function parseSave(raw: string | null, systemPrefersReducedMotion: boolean): SaveData | null {
    if (!raw) {
        return null;
    }
    let data: unknown;
    try {
        data = JSON.parse(raw);
    } catch {
        return null;
    }
    if (!isObject(data) || data.version !== SAVE_VERSION) {
        return null;
    }
    const defaults = defaultSave(systemPrefersReducedMotion);
    const bests = isObject(data.bests) ? data.bests : {};
    const achievements = isObject(data.achievements) ? data.achievements : {};
    return {
        version: SAVE_VERSION,
        name: typeof data.name === 'string' ? cleanName(data.name) : defaults.name,
        named: data.named === true,
        settings: readSettings(data.settings, defaults.settings),
        highScores: readHighScores(data.highScores),
        bests: {
            score: Math.floor(number(bests.score, 0)),
            floor: Math.floor(number(bests.floor, 0)),
            level: Math.floor(number(bests.level, 0)),
            playTimeMs: number(bests.playTimeMs, 0),
        },
        totals: readTotals(data.totals),
        achievements: Object.fromEntries(Object.entries(achievements).filter((entry): entry is [string, string] => typeof entry[1] === 'string')),
        achievementsSeen: readStrings(data.achievementsSeen),
        discoveries: readStrings(data.discoveries),
        discoveriesSeen: readStrings(data.discoveriesSeen),
        introduced: readStrings(data.introduced).filter((item): item is Ability => (ABILITIES as readonly string[]).includes(item)),
    };
}

/**
 * Names the mimic (from Settings, or "Name your mimic" after a first score).
 * `scoreDate` renames that run's board entry too, which was saved under the
 * old name.
 */
export function nameMimic(save: SaveData, name: string, scoreDate?: string): SaveData {
    const cleaned = cleanName(name);
    const highScores = scoreDate === undefined ? save.highScores : save.highScores.map((entry) => (entry.date === scoreDate ? { ...entry, name: cleaned } : entry));
    return { ...save, name: cleaned, named: true, highScores };
}

/** Highest score first; equal scores keep the earlier run first. */
function sortScores(scores: HighScore[]): HighScore[] {
    return [...scores].sort((a, b) => b.score - a.score || a.date.localeCompare(b.date));
}

/** Where a score would place on the board (1-based), or null if it wouldn't make the top 10. */
export function scoreRank(scores: readonly HighScore[], score: number): number | null {
    if (score <= 0) {
        return null;
    }
    const rank = scores.filter((entry) => entry.score >= score).length + 1;
    return rank <= HIGH_SCORE_COUNT ? rank : null;
}

export function addTotals(a: Totals, b: Totals): Totals {
    const sum = <K extends string>(x: Readonly<Record<K, number>>, y: Readonly<Record<K, number>>): Record<K, number> =>
        Object.fromEntries(Object.keys(x).map((key) => [key, x[key as K] + (y[key as K] ?? 0)])) as Record<K, number>;
    return {
        runs: a.runs + b.runs,
        playTimeMs: a.playTimeMs + b.playTimeMs,
        eaten: sum(a.eaten, b.eaten),
        collected: sum(a.collected, b.collected),
        catsRescued: a.catsRescued + b.catsRescued,
        catsKilled: a.catsKilled + b.catsKilled,
        catsShot: a.catsShot + b.catsShot,
        hazardsDetonated: a.hazardsDetonated + b.hazardsDetonated,
        destroyed: a.destroyed + b.destroyed,
        bossesDefeated: a.bossesDefeated + b.bossesDefeated,
        judgmentsSurvived: a.judgmentsSurvived + b.judgmentsSurvived,
        uses: sum(a.uses, b.uses),
        judgmentsCalled: a.judgmentsCalled + b.judgmentsCalled,
        flawlessBosses: a.flawlessBosses + b.flawlessBosses,
        hotSnacks: a.hotSnacks + b.hotSnacks,
        lastHeartFloors: a.lastHeartFloors + b.lastHeartFloors,
    };
}

/** The bests, counting a run (in progress or finished). */
export function bestsWith(bests: Bests, run: RunRecord): Bests {
    return {
        score: Math.max(bests.score, run.score),
        floor: Math.max(bests.floor, run.floor),
        level: Math.max(bests.level, run.level),
        playTimeMs: Math.max(bests.playTimeMs, run.playTimeMs),
    };
}

/** What a finished run adds to the save. */
export interface RunRecord {
    readonly score: number;
    readonly floor: number;
    readonly zone: number;
    readonly level: number;
    readonly playTimeMs: number;
    /** The run's own counts (runs: 1). */
    readonly totals: Totals;
}

/**
 * Adds a run to the save: its totals always, its bests, and (for a run that
 * ended in game over, not one abandoned) its place on the board. Returns the
 * new save and the score's rank (null if it didn't place).
 */
export function recordRun(save: SaveData, run: RunRecord, endedInGameOver: boolean, date: string): { save: SaveData; rank: number | null } {
    const bests = bestsWith(save.bests, run);
    const rank = endedInGameOver ? scoreRank(save.highScores, run.score) : null;
    const highScores = rank === null
        ? save.highScores
        : sortScores([...save.highScores, { name: save.name, score: run.score, floor: run.floor, zone: run.zone, level: run.level, playTimeMs: run.playTimeMs, date }]).slice(0, HIGH_SCORE_COUNT);
    return { save: { ...save, bests, highScores, totals: addTotals(save.totals, run.totals) }, rank };
}
