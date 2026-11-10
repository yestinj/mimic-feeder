import { describe, expect, it } from 'vitest';
import { JUDGMENT, nextGapCentre, waveFireballs, waveSpeed } from './judgment';
import { Run } from './run';

const field = { width: 1920, gap: 180, margin: 8 };

describe('Ninefold Judgment', () => {
    it('warns at the fifth cat shot and judges at the tenth, once each per run', () => {
        const run = new Run();
        const events = Array.from({ length: 12 }, () => run.shootCat());
        expect(events.findIndex((list) => list.some((event) => event.type === 'catWarning'))).toBe(JUDGMENT.warningAt - 1);
        expect(events.findIndex((list) => list.some((event) => event.type === 'judgment'))).toBe(JUDGMENT.judgmentAt - 1);
        expect(events.flat().filter((event) => event.type === 'catWarning')).toHaveLength(1);
        expect(events.flat().filter((event) => event.type === 'judgment')).toHaveLength(1);
    });

    it('speeds each wave up', () => {
        expect(waveSpeed(0)).toBe(690);
        expect(waveSpeed(8)).toBe(690 + 8 * 42);
    });

    it('puts the first gap a short way to one side of the mimic', () => {
        const left = nextGapCentre(null, 960, 400, field, () => 0);
        const right = nextGapCentre(null, 960, 400, field, () => 0.99);
        expect(left).toBeLessThan(960 - field.gap * 0.6);
        expect(right).toBeGreaterThan(960 + field.gap * 0.6);
        expect(right - 960).toBeLessThanOrEqual(field.width * 0.18 + 1);
    });

    it('moves later gaps far enough to need a reaction, but within reach', () => {
        const values = [0, 0.5, 0.99];
        for (const value of values) {
            const moved = Math.abs(nextGapCentre(960, 0, 300, field, () => value) - 960);
            expect(moved).toBeGreaterThanOrEqual(field.width * 0.11 - 1e-9);
            expect(moved).toBeLessThanOrEqual(Math.max(field.width * 0.11, 300) + 1e-9);
        }
    });

    it('turns back when an edge would swallow the move', () => {
        // Near the left edge and heading left: it goes right instead.
        const centre = nextGapCentre(150, 0, 400, field, () => 0.1);
        expect(centre).toBeGreaterThan(150 + field.width * 0.11 - 1);
    });

    it('fills the width with fireballs except the gap', () => {
        const shape = { fieldWidth: 1920, gapCentre: 700, gap: 180, size: 90, spread: 210, trailing: [126, 337] as const };
        const wave = waveFireballs(3, shape, () => 0.5);
        const half = shape.size / 2;
        for (const fireball of wave) {
            // Nothing reaches into the gap.
            expect(Math.abs(fireball.x - shape.gapCentre)).toBeGreaterThanOrEqual(shape.gap / 2 + half - 1e-9);
            expect(fireball.above).toBeGreaterThanOrEqual(0);
        }
        const xs = wave.map((fireball) => fireball.x);
        expect(Math.min(...xs) - half).toBeLessThanOrEqual(0);
        expect(Math.max(...xs) + half).toBeGreaterThanOrEqual(shape.fieldWidth);
        // The two nearest the gap sit right against its edges.
        expect(xs).toContain(shape.gapCentre - shape.gap / 2 - half);
        expect(xs).toContain(shape.gapCentre + shape.gap / 2 + half);
    });
});

describe('cause of death', () => {
    it('remembers what cost the last life', () => {
        const run = new Run();
        run.miss('goblin');
        run.detonate('bomb');
        expect(run.summary().causeOfDeath).toBeNull();
        run.judge();
        expect(run.summary().causeOfDeath).toEqual({ type: 'judgment' });
    });

    it('names the creature that went to waste', () => {
        const run = new Run();
        run.lives = 1;
        run.sideHit('elf');
        expect(run.summary().causeOfDeath).toEqual({ type: 'wasted', creature: 'elf' });
    });

    it('tells a falling fireball from the boss', () => {
        const run = new Run();
        run.lives = 1;
        run.detonate('fireball');
        expect(run.summary().causeOfDeath).toEqual({ type: 'fireball' });
        const boss = new Run();
        boss.lives = 1;
        boss.burn();
        expect(boss.summary().causeOfDeath).toEqual({ type: 'boss' });
    });
});
