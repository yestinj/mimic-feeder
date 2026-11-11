// The player's save, held in memory and written to localStorage on every
// change. Storage can be blocked (private windows, strict settings) or hold
// junk; either way the game carries on with defaults and just doesn't save.
import { unlockEarned } from './rules/achievements';
import { OLD_KEYS, SAVE_KEY, defaultSave, isNewerSave, parseSave, type SaveData } from './rules/save';

/**
 * The p5 game's keys are deleted on first load (plan §3.8), but not yet:
 * /next/ shares its origin, and so its localStorage, with the live p5 game,
 * whose scores and achievements those keys are. M5 turns this on when the
 * rewrite replaces it.
 */
export const DELETE_P5_SAVES = false;

/** The parts of the Storage API the profile uses, so tests can pass a fake. */
export interface SaveStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

/** The system's own reduced-motion setting, used for first-time defaults. */
export function systemPrefersReducedMotion(): boolean {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function browserStorage(): SaveStorage | null {
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

let storage: SaveStorage | null = null;
let current: SaveData = defaultSave(false);
const listeners = new Set<(save: SaveData) => void>();

/**
 * Another tab changed the save: take its version, so this tab's next write
 * doesn't undo it (a high score set there, an erase).
 */
function onStorage(event: StorageEvent): void {
    if (event.storageArea !== storage || (event.key !== SAVE_KEY && event.key !== null)) {
        return;
    }
    const systemReducedMotion = systemPrefersReducedMotion();
    current = parseSave(event.newValue, systemReducedMotion) ?? defaultSave(systemReducedMotion);
    listeners.forEach((listener) => listener(current));
}

/** Loads the save (or starts a fresh one). Call once at boot; tests pass their own storage. */
export function loadProfile(from: SaveStorage | null = browserStorage(), deleteOldKeys = DELETE_P5_SAVES): SaveData {
    storage = from;
    if (typeof window !== 'undefined') {
        window.removeEventListener('storage', onStorage);
        window.addEventListener('storage', onStorage);
    }
    const systemReducedMotion = systemPrefersReducedMotion();
    let raw: string | null = null;
    try {
        raw = storage?.getItem(SAVE_KEY) ?? null;
        if (deleteOldKeys) {
            OLD_KEYS.forEach((key) => storage?.removeItem(key));
        }
    } catch (error) {
        console.warn('Could not read the save; starting fresh.', error);
    }
    if (isNewerSave(raw)) {
        // Played with a newer version of the game: play on, but leave that save alone.
        console.warn('The save is from a newer version; progress in this one won\u2019t be saved.');
        storage = null;
    }
    const loaded = parseSave(raw, systemReducedMotion) ?? defaultSave(systemReducedMotion);
    // Anything already earned but not unlocked (played before achievements existed) unlocks now, quietly.
    current = unlockEarned(loaded, new Date().toISOString());
    if (current !== loaded) {
        write();
    }
    return current;
}

export function profile(): SaveData {
    return current;
}

/** Changes the save, writes it, and tells anyone listening (settings screens, audio). */
export function updateProfile(change: (save: SaveData) => SaveData): SaveData {
    current = change(current);
    write();
    listeners.forEach((listener) => listener(current));
    return current;
}

function write(): void {
    try {
        storage?.setItem(SAVE_KEY, JSON.stringify(current));
    } catch (error) {
        console.warn('Could not write the save.', error);
    }
}

/** Erases everything: a fresh save with the system's defaults. */
export function eraseProfile(): SaveData {
    return updateProfile(() => defaultSave(systemPrefersReducedMotion()));
}

/** Calls `listener` after every change; returns a function that stops it. */
export function onProfileChange(listener: (save: SaveData) => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}
