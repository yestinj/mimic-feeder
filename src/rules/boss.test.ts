import { describe, expect, it } from 'vitest';
import { BOSS, bossHealth, bossSpeedMultiplier, fireballCooldown, isBossZone } from './boss';
import { CAT_RESCUE_POINTS } from './cats';
import { flight, shouldFlee } from './dragon';
import { CREATURES_PER_ZONE } from './progression';
import { Run } from './run';

describe('boss', () => {
    it('fights in Zone 5 of even floors only', () => {
        expect(isBossZone(2, 5)).toBe(true);
        expect(isBossZone(4, 5)).toBe(true);
        expect(isBossZone(3, 5)).toBe(false);
        expect(isBossZone(2, 4)).toBe(false);
    });

    it('takes 10 hits on Floor 2 and 2 more per boss after', () => {
        expect([2, 4, 6].map(bossHealth)).toEqual([10, 12, 14]);
    });

    it('speeds up 1×, 2×, then 4× at most', () => {
        expect([2, 4, 6, 8, 12].map(bossSpeedMultiplier)).toEqual([1, 2, 4, 4, 4]);
    });

    it('fires every 0.45–3.6 s on Floor 2, faster later', () => {
        expect(fireballCooldown(2, () => 0)).toBeCloseTo(450);
        expect(fireballCooldown(2, () => 1)).toBeCloseTo(3600);
        expect(fireballCooldown(4, () => 1)).toBeCloseTo(1800);
    });

    it('starts when a run reaches Zone 5 of an even floor, and nothing clears it but beating the boss', () => {
        const run = new Run();
        run.floor = 2;
        run.zone = 4;
        run.eatenInZone = CREATURES_PER_ZONE - 1;
        expect(run.eat('goblin')).toContainEqual({ type: 'zone', floor: 2, zone: 5, newFloor: false, boss: true });
        expect(run.inBossFight).toBe(true);
        for (let i = 0; i < CREATURES_PER_ZONE * 2; i++) {
            expect(run.eat('goblin').some((event) => event.type === 'zone')).toBe(false);
        }
        expect(run.defeatBoss()).toContainEqual({ type: 'bossDefeated' });
        expect(run.score).toBe(CREATURES_PER_ZONE * 2 + 1 + BOSS.points);
        expect(run.finishBossFloor()).toEqual([{ type: 'zone', floor: 3, zone: 1, newFloor: true, boss: false }]);
        expect([run.inBossFight, run.bossesDefeated, run.gameLevel]).toEqual([false, 1, 11]);
    });
});

describe('cats', () => {
    it('count towards the zone when eaten, but score nothing', () => {
        const run = new Run();
        expect(run.eat('cat')).toEqual([]);
        expect([run.score, run.eatenInZone, run.eaten.cat, run.creaturesEaten]).toEqual([0, 1, 1, 1]);
    });

    it('score 100 when rescued; killing one costs no life', () => {
        const run = new Run();
        expect(run.rescueCat()).toContainEqual({ type: 'points', points: CAT_RESCUE_POINTS });
        run.killCat();
        run.shootCat();
        expect([run.catsRescued, run.catsKilled, run.catsShot, run.lives]).toEqual([1, 1, 1, 3]);
    });
});

describe('dragons', () => {
    const mimic = { x: 100, y: 500, width: 100, height: 80 };

    it('fly off when the mimic is beneath and close, once they are far enough down', () => {
        const close = { x: 120, y: 380, width: 60, height: 40 }; // bottom 420: 80 above the mimic
        expect(shouldFlee(close, 400, mimic, 100, 100)).toBe(true);
        expect(shouldFlee(close, 90, mimic, 100, 100)).toBe(false); // still near the top
        expect(shouldFlee({ ...close, y: 300 }, 320, mimic, 100, 100)).toBe(false); // 160 above
        expect(shouldFlee({ ...close, x: 260 }, 400, mimic, 100, 100)).toBe(false); // not side by side
    });

    it('fly diagonally upwards for 1–2 s at the given speed', () => {
        const slow = flight(100, () => 0);
        expect(slow.ms).toBe(1000);
        expect(slow.vy).toBeLessThan(0);
        expect(Math.hypot(slow.vx, slow.vy)).toBeCloseTo(100);
        const late = flight(100, () => 1);
        expect(late.ms).toBe(2000);
        expect(late.vx).toBeGreaterThan(0);
        expect(late.vy).toBeLessThan(0);
    });
});
