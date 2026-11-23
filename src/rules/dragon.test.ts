import { describe, expect, it } from 'vitest';
import { DRAGON, flight, shouldFlee } from './dragon';
import type { Rect } from './contact';

const { minHeight, range } = DRAGON;

/** A dragon 100 wide and 80 tall with its top at `y` (its centre is 40 lower). */
function dragonAt(x: number, y: number): { rect: Rect; centreY: number } {
    return { rect: { x, y, width: 100, height: 80 }, centreY: y + 40 };
}

/** A mimic 120 wide whose top is `gap` below the dragon's bottom (dragon at y 200, so its bottom is 280). */
function mimicBelow(x: number, gap: number): Rect {
    return { x, y: 280 + gap, width: 120, height: 100 };
}

function flees(dragon: { rect: Rect; centreY: number }, mimic: Rect): boolean {
    return shouldFlee(dragon.rect, dragon.centreY, mimic, minHeight, range);
}

describe('dragons', () => {
    const dragon = dragonAt(100, 200);

    it('flee when the mimic is side by side and its top is within range below', () => {
        expect(flees(dragon, mimicBelow(150, 70))).toBe(true);
        expect(flees(dragon, mimicBelow(150, range))).toBe(true);
        expect(flees(dragon, mimicBelow(150, range + 1))).toBe(false);
    });

    it('need the mimic side by side, overlapping by at least a little', () => {
        // The dragon spans 100–200; the mimic is 120 wide.
        expect(flees(dragon, mimicBelow(199, 50))).toBe(true);
        expect(flees(dragon, mimicBelow(200, 50))).toBe(false);
        expect(flees(dragon, mimicBelow(-19, 50))).toBe(true);
        expect(flees(dragon, mimicBelow(-20, 50))).toBe(false);
    });

    it('stay put while still near the top of the screen', () => {
        const high = dragonAt(100, minHeight - 40);
        const mimic = { ...mimicBelow(150, 0), y: high.rect.y + high.rect.height + 50 };
        expect(flees(high, mimic)).toBe(false);
        const lower = dragonAt(100, minHeight - 39);
        expect(flees(lower, { ...mimic, y: lower.rect.y + lower.rect.height + 50 })).toBe(true);
    });

    it('also flee from a mimic level with them or above, as in the p5 game', () => {
        expect(flees(dragon, mimicBelow(150, -60))).toBe(true);
        expect(flees(dragon, { x: 150, y: 0, width: 120, height: 100 })).toBe(true);
    });

    it('fly off up-left at the lowest roll, for the shortest time', () => {
        const { vx, vy, ms } = flight(300, () => 0);
        expect(Math.hypot(vx, vy)).toBeCloseTo(300);
        expect(Math.atan2(vy, vx) * (180 / Math.PI)).toBeCloseTo(-160);
        expect(ms).toBe(1000);
    });

    it('fly off up-right at the highest roll, for the longest time', () => {
        const { vx, vy, ms } = flight(300, () => 0.999999);
        expect(Math.atan2(vy, vx) * (180 / Math.PI)).toBeCloseTo(-20, 3);
        expect(ms).toBeCloseTo(2000, 2);
    });

    it('fly straight up at the middle roll', () => {
        const { vx, vy, ms } = flight(300, () => 0.5);
        expect(vx).toBeCloseTo(0);
        expect(vy).toBeCloseTo(-300);
        expect(ms).toBe(1500);
    });

    it('always fly upwards, at the speed given', () => {
        for (let roll = 0; roll < 1; roll += 0.05) {
            const { vx, vy, ms } = flight(240, () => roll);
            expect(vy).toBeLessThan(0);
            expect(Math.hypot(vx, vy)).toBeCloseTo(240);
            expect(ms).toBeGreaterThanOrEqual(1000);
            expect(ms).toBeLessThan(2000);
        }
    });
});
