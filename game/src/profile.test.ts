import { describe, expect, it } from 'vitest';
import { DELETE_P5_SAVES, eraseProfile, loadProfile, onProfileChange, profile, updateProfile, type SaveStorage } from './profile';
import { OLD_KEYS, SAVE_KEY, defaultSave } from './rules/save';

class FakeStorage implements SaveStorage {
    readonly items = new Map<string, string>();
    failWrites = false;

    getItem(key: string): string | null {
        return this.items.get(key) ?? null;
    }

    setItem(key: string, value: string): void {
        if (this.failWrites) {
            throw new Error('QuotaExceededError');
        }
        this.items.set(key, value);
    }

    removeItem(key: string): void {
        this.items.delete(key);
    }
}

const withOldKeys = (): FakeStorage => {
    const storage = new FakeStorage();
    OLD_KEYS.forEach((key) => storage.setItem(key, '[]'));
    return storage;
};

describe('profile', () => {
    it('keeps the p5 game’s saves while both games share the site', () => {
        expect(DELETE_P5_SAVES).toBe(false);
        const storage = withOldKeys();
        loadProfile(storage);
        expect(OLD_KEYS.every((key) => storage.items.has(key))).toBe(true);
    });

    it('deletes the p5 game’s saves once switched on', () => {
        const storage = withOldKeys();
        loadProfile(storage, true);
        expect(OLD_KEYS.some((key) => storage.items.has(key))).toBe(false);
    });

    it('starts fresh, saves changes and reads them back', () => {
        const storage = new FakeStorage();
        expect(loadProfile(storage)).toEqual(defaultSave(false));
        let heard = 0;
        const stop = onProfileChange(() => heard++);
        updateProfile((save) => ({ ...save, name: 'Chomper' }));
        stop();
        updateProfile((save) => save);
        expect(heard).toBe(1);
        expect(JSON.parse(storage.getItem(SAVE_KEY) ?? '{}')).toMatchObject({ name: 'Chomper' });
        expect(loadProfile(storage).name).toBe('Chomper');
    });

    it('carries on without storage, or when writes fail', () => {
        loadProfile(null);
        expect(updateProfile((save) => ({ ...save, name: 'Nowhere' })).name).toBe('Nowhere');
        const storage = new FakeStorage();
        loadProfile(storage);
        storage.failWrites = true;
        expect(updateProfile((save) => ({ ...save, name: 'Full' })).name).toBe('Full');
        expect(profile().name).toBe('Full');
    });

    it('erases everything', () => {
        const storage = new FakeStorage();
        loadProfile(storage);
        updateProfile((save) => ({ ...save, name: 'Chomper', discoveries: ['goblin'] }));
        expect(eraseProfile()).toEqual(defaultSave(false));
        expect(loadProfile(storage)).toEqual(defaultSave(false));
    });
});
