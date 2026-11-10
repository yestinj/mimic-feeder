import { describe, expect, it } from 'vitest';
import { OBJECTS } from './objects';
import { HAZARD_CHANCE, SPAWN_POOL, SpawnHistory, keepClearOf, pickObject, pickSpawnX, pickWeighted, rollHazard } from './spawner';

/** An Rng that returns the given values in turn. */
function sequence(...values: number[]): () => number {
    let i = 0;
    return () => {
        const value = values[i % values.length];
        i += 1;
        return value ?? 0;
    };
}

describe('spawner', () => {
    it('only rolls hazards separately, never in the normal pool', () => {
        expect(SPAWN_POOL.map((def) => def.kind)).not.toContain('bomb');
        expect(SPAWN_POOL.map((def) => def.kind)).not.toContain('fireball');
    });

    it('picks in proportion to weight', () => {
        const items = [{ weight: 1, id: 'a' }, { weight: 3, id: 'b' }];
        expect(pickWeighted(items, () => 0).id).toBe('a');
        expect(pickWeighted(items, () => 0.24).id).toBe('a');
        expect(pickWeighted(items, () => 0.26).id).toBe('b');
        expect(pickWeighted(items, () => 0.999999).id).toBe('b');
    });

    it('makes goblins the most common and diamonds the rarest pick', () => {
        const counts = new Map<string, number>();
        const steps = 10_000;
        for (let i = 0; i < steps; i++) {
            const kind = pickObject(() => (i + 0.5) / steps);
            counts.set(kind, (counts.get(kind) ?? 0) + 1);
        }
        const total = SPAWN_POOL.reduce((sum, def) => sum + def.weight, 0);
        expect((counts.get('goblin') ?? 0) / steps).toBeCloseTo(OBJECTS.goblin.weight / total, 2);
        expect((counts.get('diamond') ?? 0) / steps).toBeCloseTo(OBJECTS.diamond.weight / total, 2);
        expect(OBJECTS.goblin.weight / total).toBeCloseTo(0.278, 3);
    });

    it('starts hazards at Floor 1 Zone 3, on 15% of spawns', () => {
        expect(rollHazard(1, 2, () => 0)).toBeNull();
        expect(rollHazard(1, 3, sequence(0, 0))).toBe('bomb');
        expect(rollHazard(1, 3, () => HAZARD_CHANCE)).toBeNull();
    });

    it('adds fireballs half the time from Floor 4', () => {
        expect(rollHazard(3, 5, sequence(0, 0.9))).toBe('bomb');
        expect(rollHazard(4, 1, sequence(0, 0.4))).toBe('bomb');
        expect(rollHazard(4, 1, sequence(0, 0.6))).toBe('fireball');
    });

    it('places objects across the full width, fully on screen', () => {
        const placement = { fieldWidth: 1920, halfWidth: 40, recent: [], minGap: 70, attempts: 5 };
        expect(pickSpawnX(placement, () => 0)).toBe(40);
        expect(pickSpawnX(placement, () => 0.5)).toBe(960);
        expect(pickSpawnX(placement, () => 0.999999)).toBeCloseTo(1880);
    });

    it('avoids recent spawn positions when it can', () => {
        const placement = { fieldWidth: 1000, halfWidth: 0, recent: [500], minGap: 50, attempts: 5 };
        // First try lands at 510 (too close), the second at 700.
        expect(pickSpawnX(placement, sequence(0.51, 0.7))).toBe(700);
        // Every try too close: it settles for the last one.
        expect(pickSpawnX(placement, () => 0.52)).toBe(520);
    });

    it('keeps hazards clear of the mimic, on the side they were heading for', () => {
        expect(keepClearOf(300, 500, 100, 0, 1000)).toBe(300);
        expect(keepClearOf(450, 500, 100, 0, 1000)).toBe(400);
        expect(keepClearOf(520, 500, 100, 0, 1000)).toBe(600);
        expect(keepClearOf(30, 60, 100, 20, 1000)).toBe(20);
    });

    it('remembers only the last few positions', () => {
        const history = new SpawnHistory(3);
        [1, 2, 3, 4].forEach((x) => history.add(x));
        expect(history.recent).toEqual([2, 3, 4]);
    });
});
