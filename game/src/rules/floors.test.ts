import { describe, expect, it } from 'vitest';
import { FLOORS, floorIndex, floorInfo, floorTitle } from './floors';

describe('floors', () => {
    it('has a background for each of Floors 1–10', () => {
        expect(FLOORS).toHaveLength(10);
        expect(floorInfo(1).background).toBe('upper-dungeon.webp');
        expect(floorInfo(10).background).toBe('abyss.webp');
    });

    it('advances the background every floor through Floor 10', () => {
        expect([1, 2, 3, 9, 10].map(floorIndex)).toEqual([0, 1, 2, 8, 9]);
    });

    it('keeps the Abyss for every floor after 10', () => {
        expect(floorInfo(11).name).toBe('Abyss');
        expect(floorInfo(250).name).toBe('Abyss');
    });

    it('treats invalid floors as Floor 1', () => {
        expect(floorIndex(0)).toBe(0);
        expect(floorIndex(-3)).toBe(0);
        expect(floorIndex(Number.NaN)).toBe(0);
        expect(floorIndex(2.7)).toBe(1);
    });

    it('builds banner titles with the floor name', () => {
        expect(floorTitle(2)).toBe('Floor 2: Ageing Lower Halls');
        expect(floorTitle(12)).toBe('Floor 12: Abyss');
    });
});
