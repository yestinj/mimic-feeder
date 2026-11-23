import { describe, expect, it } from 'vitest';
import {
    difficulty,
    dropSpeed,
    dropSpeedPercent,
    gameLevel,
    musicForFloor,
    nextZone,
    spawnInterval,
    spawnRatePercent,
} from './progression';

describe('progression', () => {
    it('numbers levels across floors of five zones', () => {
        expect(gameLevel(1, 1)).toBe(1);
        expect(gameLevel(1, 5)).toBe(5);
        expect(gameLevel(2, 1)).toBe(6);
        expect(gameLevel(4, 3)).toBe(18);
    });

    it('gets 5% harder per level', () => {
        expect(difficulty(1)).toBe(1);
        expect(difficulty(11)).toBeCloseTo(1.5);
        expect(dropSpeed(1)).toBe(120);
        expect(dropSpeed(21)).toBeCloseTo(240);
        expect(dropSpeedPercent(6)).toBe(125);
    });

    it('spawns every 2.75 s at first, faster later, never faster than 10 frames', () => {
        expect(spawnInterval(1)).toBeCloseTo(2750);
        // 165 / 1.5 = 110 frames.
        expect(spawnInterval(11)).toBeCloseTo((110 * 1000) / 60);
        expect(spawnRatePercent(11)).toBe(150);
        expect(spawnInterval(10_000)).toBeCloseTo((10 * 1000) / 60);
    });

    it('moves through zones, then floors', () => {
        expect(nextZone(1, 1)).toEqual({ floor: 1, zone: 2 });
        expect(nextZone(1, 5)).toEqual({ floor: 2, zone: 1 });
    });

    it('alternates music every two floors', () => {
        expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map(musicForFloor)).toEqual([
            'music1', 'music1', 'music2', 'music2', 'music1', 'music1', 'music2', 'music2', 'music1',
        ]);
    });
});
