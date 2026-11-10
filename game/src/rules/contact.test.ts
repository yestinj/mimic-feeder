import { describe, expect, it } from 'vitest';
import { expand, isBite, overlaps, resolveContact } from './contact';
import { formatPlayTime, formatScore } from './format';

const mimic = { x: 100, y: 200, width: 100, height: 80 };

describe('contact', () => {
    // The mouth is the top 24 px of this 80 px chest: y 200 to 224.
    it('eats food coming in over the rim', () => {
        const food = { x: 120, y: 175, width: 30, height: 30 };
        expect(isBite(food, mimic, true)).toBe(true);
        expect(resolveContact('creature', food, mimic, true)).toBe('eat');
        // Just over the edge of the chest still counts.
        expect(isBite({ x: 75, y: 190, width: 30, height: 30 }, mimic, true)).toBe(true);
    });

    it('treats food meeting the chest below the rim as a side hit, even if it reaches the mouth band', () => {
        // Tall food: its top is in the mouth band, but its bottom is well below the rim.
        const tall = { x: 80, y: 205, width: 30, height: 60 };
        expect(overlaps(tall, mimic)).toBe(true);
        expect(resolveContact('creature', tall, mimic, true)).toBe('sideHit');
        const low = { x: 80, y: 240, width: 30, height: 30 };
        expect(resolveContact('creature', low, mimic, true)).toBe('sideHit');
    });

    it('only eats falling food', () => {
        const food = { x: 120, y: 175, width: 30, height: 30 };
        expect(resolveContact('creature', food, mimic, false)).toBe('sideHit');
    });

    it('collects shinies and sets off hazards on any contact', () => {
        const side = { x: 80, y: 250, width: 30, height: 30 };
        expect(resolveContact('shiny', side, mimic, true)).toBe('collect');
        expect(resolveContact('hazard', side, mimic, false)).toBe('detonate');
    });

    it('treats touching edges as not overlapping, and expands rects on every side', () => {
        expect(overlaps({ x: 200, y: 200, width: 10, height: 10 }, mimic)).toBe(false);
        expect(expand(mimic, 15)).toEqual({ x: 85, y: 185, width: 130, height: 110 });
    });
});

describe('format', () => {
    it('shows play time in seconds, then minutes and seconds', () => {
        expect(formatPlayTime(45_900)).toBe('45s');
        expect(formatPlayTime(252_000)).toBe('4m 12s');
    });

    it('groups thousands', () => {
        expect(formatScore(12480)).toBe('12,480');
    });
});
