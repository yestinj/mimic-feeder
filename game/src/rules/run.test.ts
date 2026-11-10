import { describe, expect, it } from 'vitest';
import { FIRST_LEVEL_XP, HUMANS_PER_EXTRA_LIFE, Run, START_LIVES } from './run';
import { CREATURES_PER_ZONE } from './progression';

describe('Run', () => {
    it('starts on Floor 1 Zone 1 with three lives', () => {
        const run = new Run();
        expect([run.floor, run.zone, run.gameLevel]).toEqual([1, 1, 1]);
        expect([run.lives, run.maxLives]).toEqual([START_LIVES, START_LIVES]);
        expect([run.level, run.xp, run.xpToNext]).toEqual([1, 0, FIRST_LEVEL_XP]);
    });

    it('scores points and XP for eating, and counts the creature', () => {
        const run = new Run();
        expect(run.eat('elf')).toEqual([{ type: 'points', points: 20 }]);
        expect([run.score, run.xp, run.eaten.elf, run.creaturesEaten]).toEqual([20, 20, 1, 1]);
    });

    it('levels up at 100 XP, doubles the next requirement and carries XP over', () => {
        const run = new Run();
        for (let i = 0; i < 4; i++) {
            run.eat('elf');
        }
        const events = run.collect('crown');
        expect(events).toEqual([
            { type: 'points', points: 50 },
            { type: 'levelUp', level: 2 },
        ]);
        expect([run.level, run.xp, run.xpToNext]).toEqual([2, 30, 200]);
    });

    it('can level up more than once from one big gain', () => {
        const run = new Run();
        run.xp = 90;
        run.collect('diamond');
        run.collect('diamond');
        run.collect('diamond');
        // 390 XP: 100 for level 2, 200 for level 3, 90 left towards 400.
        expect([run.level, run.xp, run.xpToNext]).toEqual([3, 90, 400]);
    });

    it('grows the mimic 5% in speed and size and 3% in jump per level', () => {
        const run = new Run();
        run.level = 3;
        expect(run.growth.speed).toBeCloseTo(1.1025);
        expect(run.growth.size).toBeCloseTo(1.1025);
        expect(run.growth.jump).toBeCloseTo(1.0609);
    });

    it('clears a zone after ten creatures; shinies do not count', () => {
        const run = new Run();
        for (let i = 0; i < CREATURES_PER_ZONE - 1; i++) {
            run.eat('goblin');
        }
        run.collect('crown');
        expect(run.zone).toBe(1);
        expect(run.eat('goblin')).toContainEqual({ type: 'zone', floor: 1, zone: 2, newFloor: false });
        expect([run.zone, run.eatenInZone, run.gameLevel]).toEqual([2, 0, 2]);
    });

    it('moves to the next floor after Zone 5', () => {
        const run = new Run();
        run.zone = 5;
        run.eatenInZone = CREATURES_PER_ZONE - 1;
        expect(run.eat('goblin')).toContainEqual({ type: 'zone', floor: 2, zone: 1, newFloor: true });
        expect(run.gameLevel).toBe(6);
    });

    it('adds and fills a heart for every 50 humans', () => {
        const run = new Run();
        run.lives = 2;
        for (let i = 1; i < HUMANS_PER_EXTRA_LIFE; i++) {
            expect(run.eat('human')).not.toContainEqual({ type: 'extraLife' });
        }
        expect(run.eat('human')).toContainEqual({ type: 'extraLife' });
        expect([run.lives, run.maxLives]).toEqual([3, 4]);
    });

    it('loses a life when a creature hits the floor or a hazard is touched, and ends at zero', () => {
        const run = new Run();
        expect(run.miss()).toEqual([{ type: 'lifeLost' }]);
        expect(run.detonate('bomb')).toEqual([{ type: 'lifeLost' }]);
        expect(run.detonate('fireball')).toEqual([{ type: 'lifeLost' }, { type: 'gameOver' }]);
        expect(run.isOver).toBe(true);
        expect([run.missed, run.hazardsDetonated, run.detonated.fireball]).toEqual([1, 2, 1]);
        // Nothing more happens once the run is over.
        expect(run.miss()).toEqual([]);
        expect(run.lives).toBe(0);
    });

    it('bumping costs nothing', () => {
        const run = new Run();
        expect(run.bump()).toEqual([]);
        expect([run.lives, run.score, run.bumped]).toEqual([3, 0, 1]);
    });

    it('counts play time only while the run is going', () => {
        const run = new Run();
        run.tick(1500);
        run.lives = 0;
        run.tick(1000);
        expect(run.playTimeMs).toBe(1500);
    });
});
