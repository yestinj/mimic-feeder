// The boss fight on even floors (inventory §5, "Boss"). Lengths are in
// reference pixels and times in ms; the scene converts lengths.
import type { Rng } from './spawner';
import { ZONES_PER_FLOOR } from './progression';

export const BOSS = {
    /** Drawn 150 px square; the hitbox is the top 90% and middle 80% of that. */
    size: 150,
    hitboxWidth: 0.8,
    hitboxHeight: 0.9,
    /** Its centre's height from the top. */
    y: 100,
    /** Side-to-side speed before the floor multiplier (3 px per frame). */
    speed: 180,
    /** Hovers this long before it starts moving and firing. */
    idleMs: 1000,
    /** Its death animation; then the next floor begins. */
    dyingMs: 2000,
    /** Fireballs: 60 px, falling at 10 px per frame before the floor multiplier. */
    fireballSize: 60,
    fireballSpeed: 600,
    /** Score and XP for beating it. */
    points: 250,
} as const;

/** Bosses appear in Zone 5 of every even floor (2, 4, 6…), in place of a normal zone. */
export function isBossZone(floor: number, zone: number): boolean {
    return zone === ZONES_PER_FLOOR && floor % 2 === 0;
}

/** Hits to beat it: 10 on Floor 2, and 2 more for each boss before (12 on Floor 4…). */
export function bossHealth(floor: number): number {
    return 10 + 2 * (Math.floor(floor / 2) - 1);
}

/** Speed and fire rate multiplier: 1× on Floor 2, 2× on Floor 4, 4× from Floor 6 (capped). */
export function bossSpeedMultiplier(floor: number): number {
    return Math.min(4, 2 ** Math.floor((floor - 2) / 2));
}

/** Time to its next fireball: 3 s × a random 0.15–1.2, divided by the floor multiplier. */
export function fireballCooldown(floor: number, rng: Rng): number {
    const frames = Math.round((180 * (0.15 + rng() * 1.05)) / bossSpeedMultiplier(floor));
    return (frames * 1000) / 60;
}
