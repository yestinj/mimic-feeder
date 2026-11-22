import { describe, expect, it } from 'vitest';
import { ABILITIES, TENTACLES_FROM_LEVEL } from './abilities';
import { PRACTICE_MAX_FLOOR, practiceFloor, typicalProgress } from './practice';
import { Run, START_LIVES } from './run';

describe('practice runs', () => {
    it('take a whole floor from 2 to the deepest allowed, and nothing else', () => {
        expect(practiceFloor('7')).toBe(7);
        expect(practiceFloor(' 2 ')).toBe(2);
        expect(practiceFloor(String(PRACTICE_MAX_FLOOR))).toBe(PRACTICE_MAX_FLOOR);
        for (const value of [null, '', '1', '0', '-3', '2.5', '7a', 'ten', String(PRACTICE_MAX_FLOOR + 1)]) {
            expect(practiceFloor(value)).toBeNull();
        }
    });

    it('count a steady player\'s progress, growing floor by floor', () => {
        expect(typicalProgress(1)).toEqual({ points: 0, humans: 0 });
        for (const floor of [3, 5, 7, 9]) {
            const before = typicalProgress(floor - 1);
            const progress = typicalProgress(floor);
            expect(progress.points).toBeGreaterThan(before.points);
            expect(progress.humans).toBeGreaterThanOrEqual(before.humans);
        }
    });

    it('start on the floor, levelled and equipped as a steady player would be', () => {
        const run = new Run();
        run.startOn(7);
        expect([run.floor, run.zone]).toEqual([7, 1]);
        expect(run.score).toBe(typicalProgress(7).points);
        expect(run.level).toBeGreaterThanOrEqual(TENTACLES_FROM_LEVEL);
        expect(ABILITIES.every((ability) => run.hasAbility(ability))).toBe(true);
        expect(run.maxLives).toBeGreaterThan(START_LIVES);
        expect(run.lives).toBe(run.maxLives);
        expect(run.creaturesEaten).toBe(0);
    });

    it('find the Staff and Magnet only once their floors have passed', () => {
        const early = new Run();
        early.startOn(3);
        expect([early.hasAbility('shadowBolt'), early.hasAbility('magnetism')]).toEqual([true, false]);
        const first = new Run();
        first.startOn(2);
        expect(first.hasAbility('shadowBolt')).toBe(false);
    });
});
