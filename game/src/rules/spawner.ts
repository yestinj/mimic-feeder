// What falls next, and where (inventory §4, "Spawning").
import { OBJECTS, type HazardKind, type ObjectDef, type ObjectKind } from './objects';
import { FIREBALLS_FROM_FLOOR, HAZARDS_FROM_LEVEL, gameLevel } from './progression';

/** A random source returning [0, 1), like Math.random. Injected so tests can control it. */
export type Rng = () => number;

/** Chance per spawn tick of a hazard joining the normal spawn, once hazards have started. */
export const HAZARD_CHANCE = 0.15;

/** Objects that can come up in the normal spawn roll on a floor: cats from Floor 2, dragons from Floor 3. */
export function spawnPool(floor: number): readonly ObjectDef[] {
    return Object.values(OBJECTS).filter((def) => def.weight > 0 && floor >= (def.fromFloor ?? 1));
}

/** Weighted pick: each item's chance is its weight over the total. */
export function pickWeighted<T extends { readonly weight: number }>(items: readonly T[], rng: Rng): T {
    const total = items.reduce((sum, item) => sum + item.weight, 0);
    let roll = rng() * total;
    for (const item of items) {
        roll -= item.weight;
        if (roll < 0) {
            return item;
        }
    }
    // Rounding can leave a sliver past the last item.
    const last = items[items.length - 1];
    if (!last) {
        throw new Error('pickWeighted needs at least one item');
    }
    return last;
}

/** The object for this spawn tick. */
export function pickObject(floor: number, rng: Rng): ObjectKind {
    return pickWeighted(spawnPool(floor), rng).kind;
}

/** A hazard to add on this spawn tick, if any: bombs from Floor 1 Zone 3, and fireballs half the time from Floor 4. */
export function rollHazard(floor: number, zone: number, rng: Rng): HazardKind | null {
    if (gameLevel(floor, zone) < HAZARDS_FROM_LEVEL || rng() >= HAZARD_CHANCE) {
        return null;
    }
    if (floor < FIREBALLS_FROM_FLOOR) {
        return 'bomb';
    }
    return rng() < 0.5 ? 'bomb' : 'fireball';
}

export interface Placement {
    /** Width of the playfield. */
    readonly fieldWidth: number;
    /** Half the object's width: it must fit entirely on screen. */
    readonly halfWidth: number;
    /** Recent spawn positions to keep clear of. */
    readonly recent: readonly number[];
    /** Minimum distance from each recent position. */
    readonly minGap: number;
    /** How many random positions to try before taking the last one. */
    readonly attempts: number;
}

/** A horizontal centre anywhere across the full width, clear of recent spawns when possible. */
export function pickSpawnX(placement: Placement, rng: Rng): number {
    const min = placement.halfWidth;
    const max = placement.fieldWidth - placement.halfWidth;
    let x = min;
    for (let attempt = 0; attempt < Math.max(1, placement.attempts); attempt++) {
        x = min + rng() * (max - min);
        if (placement.recent.every((recentX) => Math.abs(x - recentX) >= placement.minGap)) {
            break;
        }
    }
    return x;
}

/** Moves x at least `clearance` away from `avoidX` (staying on its side), within [min, max]. */
export function keepClearOf(x: number, avoidX: number, clearance: number, min: number, max: number): number {
    if (Math.abs(x - avoidX) >= clearance) {
        return x;
    }
    return x <= avoidX ? Math.max(min, avoidX - clearance) : Math.min(max, avoidX + clearance);
}

/** The last few spawn positions, oldest first. */
export class SpawnHistory {
    private readonly positions: number[] = [];

    constructor(private readonly size: number) {}

    get recent(): readonly number[] {
        return this.positions;
    }

    add(x: number): void {
        this.positions.push(x);
        if (this.positions.length > this.size) {
            this.positions.shift();
        }
    }
}
