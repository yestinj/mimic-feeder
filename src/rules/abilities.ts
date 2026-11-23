// The mimic's abilities (inventory §6): what unlocks them, their cooldowns,
// the dash's double tap and the tentacles' targets.

export type Ability = 'dash' | 'shadowBolt' | 'tentacles' | 'magnetism';

/** In the order they appear on the ability bar. */
export const ABILITIES: readonly Ability[] = ['dash', 'shadowBolt', 'tentacles', 'magnetism'];

/** Cooldowns in ms. */
export const COOLDOWNS: Readonly<Record<Ability, number>> = {
    dash: 1000,
    shadowBolt: 250,
    tentacles: 3000,
    magnetism: 10000,
};

/** Tentacles unlock at this mimic level, grabbing 2 creatures and 1 more per later level. */
export const TENTACLES_FROM_LEVEL = 5;
const TENTACLES_FIRST_REACH = 2;

/** How many creatures the tentacles grab at a mimic level (0 before they unlock). */
export function tentacleReach(level: number): number {
    return level < TENTACLES_FROM_LEVEL ? 0 : TENTACLES_FIRST_REACH + (level - TENTACLES_FROM_LEVEL);
}

/** Time left on each ability's cooldown. Ticked only while the run is being played. */
export class Cooldowns {
    private readonly remaining = new Map<Ability, number>();

    ready(ability: Ability): boolean {
        return (this.remaining.get(ability) ?? 0) <= 0;
    }

    start(ability: Ability): void {
        this.remaining.set(ability, COOLDOWNS[ability]);
    }

    tick(ms: number): void {
        for (const [ability, left] of this.remaining) {
            this.remaining.set(ability, Math.max(0, left - ms));
        }
    }

    /** How much of the cooldown is left, from 1 (just used) to 0 (ready). */
    fraction(ability: Ability): number {
        return (this.remaining.get(ability) ?? 0) / COOLDOWNS[ability];
    }
}

/** Second press of the same direction within this time dashes. */
export const DOUBLE_TAP_MS = 250;

/**
 * Spots double taps of ← or → (presses only, not key repeat), each direction
 * on its own as in the p5 game. Only feed it presses while the dash is ready.
 */
export class DoubleTap {
    private readonly last = new Map<-1 | 1, number>();

    /** Records a press; true if it completes a double tap in that direction. */
    press(direction: -1 | 1, time: number): boolean {
        const previous = this.last.get(direction);
        this.last.set(direction, time);
        return previous !== undefined && time > previous && time - previous <= DOUBLE_TAP_MS;
    }
}

export interface Target {
    readonly x: number;
    readonly y: number;
}

/** The `reach` targets nearest to (x, y), nearest first. */
export function nearestTargets<T extends Target>(x: number, y: number, targets: readonly T[], reach: number): T[] {
    return [...targets]
        .sort((a, b) => (a.x - x) ** 2 + (a.y - y) ** 2 - ((b.x - x) ** 2 + (b.y - y) ** 2))
        .slice(0, Math.max(0, reach));
}
