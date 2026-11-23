import { describe, expect, it } from 'vitest';
import { STRINGS } from '../strings';
import { ABILITIES } from './abilities';
import { GUIDE_ENTRIES, discoveredCount, isDiscovered, isKnownAbility, markDiscoveriesSeen, unseenDiscoveries } from './guide';
import { defaultSave } from './save';
import { OBJECTS } from './objects';

describe('How to Play', () => {
    it('has a card for every object and the boss, each with its text', () => {
        expect(GUIDE_ENTRIES.map(({ key }) => key).sort()).toEqual([...Object.keys(OBJECTS), 'boss'].sort());
        for (const { key } of GUIDE_ENTRIES) {
            expect(STRINGS.howToPlay.entries[key]?.name, key).toBeTruthy();
            expect(STRINGS.howToPlay.entries[key]?.text, key).toBeTruthy();
        }
        expect(GUIDE_ENTRIES.find(({ key }) => key === 'goblin')?.points).toBe(1);
        expect(GUIDE_ENTRIES.find(({ key }) => key === 'cat')?.points).toBeNull();
    });

    it('never mentions the Ninefold Judgment', () => {
        const text = JSON.stringify(STRINGS.howToPlay).toLowerCase();
        expect(text).not.toMatch(/judg|ninefold/);
    });

    it('counts what has been met, and marks it "new" until Creatures & Items has been looked at', () => {
        const save = { ...defaultSave(false), discoveries: ['goblin', 'boss', 'judgment', 'dragon'] };
        expect(discoveredCount(save.discoveries)).toBe(3);
        // In tab order, and only what the tab shows (not the Judgment).
        expect(unseenDiscoveries(save)).toEqual(['goblin', 'dragon', 'boss']);
        const seen = markDiscoveriesSeen(save);
        expect(seen.discoveriesSeen).not.toContain('judgment');
        expect(unseenDiscoveries(seen)).toEqual([]);
        expect(unseenDiscoveries({ ...seen, discoveries: [...seen.discoveries, 'cat'] })).toEqual(['cat']);
    });

    it('hides what has not been met or unlocked yet', () => {
        expect(isDiscovered('goblin', ['goblin', 'boss'])).toBe(true);
        expect(isDiscovered('dragon', ['goblin'])).toBe(false);
        expect(isDiscovered('boss', ['boss'])).toBe(true);
        expect(isKnownAbility('dash', [])).toBe(true);
        expect(isKnownAbility('tentacles', [])).toBe(false);
        expect(isKnownAbility('tentacles', ['tentacles'])).toBe(true);
        for (const ability of ABILITIES) {
            expect(STRINGS.howToPlay.abilities[ability].text, ability).toBeTruthy();
            const hint: string = STRINGS.howToPlay.abilities[ability].hint;
            expect(ability === 'dash' || hint.length > 0, ability).toBe(true);
        }
    });
});
