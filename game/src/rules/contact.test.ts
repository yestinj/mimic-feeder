import { describe, expect, it } from 'vitest';
import { expand, isBite, overlaps, resolveContact } from './contact';
import { formatPlayTime, formatScore } from './format';

const mimic = { x: 100, y: 200, width: 100, height: 80 };

describe('contact', () => {
    it('eats food falling into the top 30% of the chest', () => {
        const food = { x: 120, y: 180, width: 30, height: 30 };
        expect(isBite(food, mimic, true)).toBe(true);
        expect(resolveContact('creature', food, mimic, true)).toBe('eat');
    });

    it('bumps food that meets the side below the mouth', () => {
        // The mouth ends 24 px down (30% of 80); this food's top is lower.
        const food = { x: 80, y: 230, width: 30, height: 30 };
        expect(overlaps(food, mimic)).toBe(true);
        expect(resolveContact('creature', food, mimic, true)).toBe('bump');
    });

    it('only eats falling food', () => {
        const food = { x: 120, y: 180, width: 30, height: 30 };
        expect(resolveContact('creature', food, mimic, false)).toBe('bump');
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
