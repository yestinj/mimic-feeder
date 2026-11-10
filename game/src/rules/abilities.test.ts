import { describe, expect, it } from 'vitest';
import { COOLDOWNS, Cooldowns, DOUBLE_TAP_MS, DoubleTap, nearestTargets, tentacleReach } from './abilities';
import { BOLTED_BOMB_POINTS, Run } from './run';

describe('abilities', () => {
    it('gives every ability its own cooldown', () => {
        const cooldowns = new Cooldowns();
        expect(cooldowns.ready('dash')).toBe(true);
        cooldowns.start('dash');
        expect(cooldowns.ready('dash')).toBe(false);
        expect(cooldowns.ready('shadowBolt')).toBe(true);
        cooldowns.tick(COOLDOWNS.dash / 4);
        expect(cooldowns.fraction('dash')).toBeCloseTo(0.75);
        cooldowns.tick(COOLDOWNS.dash);
        expect(cooldowns.ready('dash')).toBe(true);
        expect(cooldowns.fraction('dash')).toBe(0);
    });

    it('dashes on a second press of the same direction within a quarter second', () => {
        const taps = new DoubleTap();
        expect(taps.press(-1, 1000)).toBe(false);
        expect(taps.press(-1, 1000 + DOUBLE_TAP_MS)).toBe(true);
        expect(taps.press(1, 2000)).toBe(false);
        expect(taps.press(1, 2000 + DOUBLE_TAP_MS + 1)).toBe(false);
        // Directions are tracked separately: ← → ← quickly still dashes left.
        taps.press(-1, 3000);
        taps.press(1, 3050);
        expect(taps.press(-1, 3100)).toBe(true);
    });

    it('unlocks tentacles at level 5 grabbing two, plus one per later level', () => {
        expect([4, 5, 6, 9].map(tentacleReach)).toEqual([0, 2, 3, 6]);
    });

    it('picks the nearest targets first', () => {
        const targets = [{ x: 100, y: 0 }, { x: 10, y: 0 }, { x: 50, y: 0 }];
        expect(nearestTargets(0, 0, targets, 2)).toEqual([{ x: 10, y: 0 }, { x: 50, y: 0 }]);
        expect(nearestTargets(0, 0, targets, 0)).toEqual([]);
    });
});

describe('run: power-ups and abilities', () => {
    it('unlocks Shadow Bolt with the Staff and Magnetism with the Magnet', () => {
        const run = new Run();
        expect(run.hasAbility('dash')).toBe(true);
        expect(run.hasAbility('shadowBolt')).toBe(false);
        expect(run.collectPowerUp('staff')).toEqual([{ type: 'unlock', ability: 'shadowBolt' }]);
        expect(run.collectPowerUp('magnet')).toEqual([{ type: 'unlock', ability: 'magnetism' }]);
        expect(run.hasAbility('shadowBolt') && run.hasAbility('magnetism')).toBe(true);
    });

    it('fills a heart with a potion, up to the maximum', () => {
        const run = new Run();
        expect(run.collectPowerUp('potion')).toEqual([]);
        run.lives = 2;
        expect(run.collectPowerUp('potion')).toEqual([{ type: 'lifeGained' }]);
        expect(run.lives).toBe(3);
    });

    it('unlocks tentacles on reaching level 5, and grows them after', () => {
        const run = new Run();
        run.level = 4;
        run.xpToNext = 100;
        expect(run.collect('diamond')).toContainEqual({ type: 'unlock', ability: 'tentacles' });
        expect(run.hasAbility('tentacles')).toBe(true);
        run.xp = run.xpToNext - 1;
        expect(run.eat('goblin')).toContainEqual({ type: 'tentaclesGrow', reach: 3 });
    });

    it('scores a bolted bomb and counts it as a detonation without costing a life', () => {
        const run = new Run();
        expect(run.shootHazard('bomb')).toEqual([{ type: 'points', points: BOLTED_BOMB_POINTS }]);
        expect([run.lives, run.score, run.hazardsDetonated, run.shotDown]).toEqual([3, BOLTED_BOMB_POINTS, 1, 1]);
    });
});
