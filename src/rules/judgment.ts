// The Ninefold Judgment (inventory §6): the dungeon's answer to shooting cats.
// Five cats shot in a run bring a warning; ten bring nine waves of falling
// fire, each a wall with one gap the mimic's width. Lengths are in design
// pixels (the scene passes them in) unless marked as reference pixels; times
// are in ms.
import type { Rng } from './spawner';

export const JUDGMENT = {
    /** Cats shot in a run before the warning, and before the judgment. */
    warningAt: 5,
    judgmentAt: 10,
    /** One wave for each of a cat's nine lives. */
    waves: 9,
    /** The apparition gathers before the first wave. */
    summonMs: 5500,
    firstWaveDelayMs: 600,
    /** The pause between one wave clearing and the next. */
    waveIntervalMs: 600,
    /** The apparition fades after the last wave. */
    endMs: 3500,
    /** After a hit, overlapping fireballs can't cost another life for this long. */
    damageCooldownMs: 750,
    /** Fall speed of the first wave and the increase per wave (reference px/s: 11.5 and 0.7 per frame). */
    speed: 690,
    speedStep: 42,
    /** Fireball size (reference px): a sixteenth of the p5 canvas width, between 50 and 68. */
    fireballSize: 64,
    /**
     * The gap is the mimic's width plus this (reference px). It's spare room
     * for lining up while running, so the scene scales it with the run speed
     * (RUN_SCALE): about 2.3 frames of running, as in the p5 game.
     */
    gapPadding: 14,
    /** The gap stays at least this far from the screen edges (reference px). */
    edgeMargin: 6,
    /** Fireballs in a wave are staggered upwards by up to this much (reference px)… */
    spread: 150,
    /** …and every other column has a later one, this far above (reference px). */
    trailingSpread: [90, 240],
} as const;

/** Fall speed of a wave (0-based), reference px/s. */
export function waveSpeed(wave: number): number {
    return JUDGMENT.speed + wave * JUDGMENT.speedStep;
}

export interface CorridorField {
    /** Width of the playfield. */
    readonly width: number;
    /** Width of the gap. */
    readonly gap: number;
    /** How close the gap may come to an edge. */
    readonly margin: number;
}

function clampCentre(centre: number, field: CorridorField): number {
    const half = field.gap / 2 + field.margin;
    return Math.max(half, Math.min(field.width - half, centre));
}

/**
 * Where the next wave's gap goes. The first one is a short way to either side
 * of the mimic; later ones move far enough to need a reaction, but no further
 * than the mimic can run while the wall falls (`reach`: its run speed over
 * 35 of the p5 game's frames).
 */
export function nextGapCentre(current: number | null, mimicCentre: number, reach: number, field: CorridorField, rng: Rng): number {
    const direction = rng() < 0.5 ? -1 : 1;
    const between = (min: number, max: number): number => min + rng() * (max - min);
    if (current === null) {
        const minShift = field.gap * 0.65;
        const maxShift = Math.max(minShift, field.width * 0.18);
        return clampCentre(mimicCentre + direction * between(minShift, maxShift), field);
    }
    const minShift = Math.max(field.gap * 0.85, field.width * 0.11);
    const maxShift = Math.max(minShift, Math.min(field.width * 0.21, reach));
    const candidate = clampCentre(current + direction * between(minShift, maxShift), field);
    // If an edge swallowed most of the move, go the other way instead.
    if (Math.abs(candidate - current) < minShift * 0.55) {
        return clampCentre(current - direction * between(minShift, maxShift), field);
    }
    return candidate;
}

export interface WaveFireball {
    readonly x: number;
    /** How far above the top it starts. */
    readonly above: number;
    /** It waits this long before falling (ms). */
    readonly delayMs: number;
}

export interface WaveShape {
    readonly fieldWidth: number;
    readonly gapCentre: number;
    readonly gap: number;
    readonly size: number;
    /** Vertical stagger of the main fireballs, and the range for the later ones (design px). */
    readonly spread: number;
    readonly trailing: readonly [number, number];
}

/**
 * One wave: a dense wall of fireballs across the whole width except the gap.
 * The two nearest the gap sit right against its edges; every other column
 * gets a later fireball, nudged away from the gap so it never narrows it.
 */
export function waveFireballs(wave: number, shape: WaveShape, rng: Rng): WaveFireball[] {
    const fireballs: WaveFireball[] = [];
    const spacing = shape.size * 0.82;
    const [trailingMin, trailingMax] = shape.trailing;
    const trailingRange = trailingMax - trailingMin;
    const between = (min: number, max: number): number => min + rng() * (max - min);
    let column = 0;
    const add = (x: number, trailing: boolean): void => {
        const band = (column % 5) / 4;
        const above = trailing
            ? trailingMin + band * trailingRange * 0.75 + between(0, trailingRange * 0.25)
            : band * shape.spread * 0.7 + between(0, shape.spread * 0.3);
        // The p5 game counted these delays in frames: 0–8 for the main fireballs, 4–16 for the later ones.
        const delayMs = trailing ? between(4, 16) * (1000 / 60) : between(0, 8) * (1000 / 60);
        fireballs.push({ x, above, delayMs });
    };
    const addColumn = (x: number, side: -1 | 1): void => {
        add(x, false);
        if ((column + wave) % 2 === 0) {
            add(x + side * between(spacing * 0.08, spacing * 0.2), true);
        }
        column += 1;
    };
    const half = shape.size / 2;
    for (let x = shape.gapCentre - shape.gap / 2 - half; x + half >= 0; x -= spacing) {
        addColumn(x, -1);
    }
    for (let x = shape.gapCentre + shape.gap / 2 + half; x - half <= shape.fieldWidth; x += spacing) {
        addColumn(x, 1);
    }
    return fireballs;
}
