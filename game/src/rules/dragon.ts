// Dragons fly off when the mimic gets close (inventory §4, "Dragon behaviour").
import type { Rect } from './contact';
import type { Rng } from './spawner';

export const DRAGON = {
    /** It only takes fright once its centre is this far down the screen (reference px). */
    minHeight: 100,
    /** …and the mimic's top is within this distance below it, side by side (reference px). */
    range: 100,
    /** It flies at twice the drop speed… */
    flightSpeed: 2,
    /** …for 1–2 s… */
    flightMs: [1000, 2000],
    /** …diagonally upwards, at an angle from -160° to -20° (0° is right, -90° is straight up). */
    angle: [-160, -20],
} as const;

/**
 * True when a falling dragon should fly off: it's far enough down the screen,
 * side by side with the mimic, and the mimic's top is within range below it.
 * `minHeight` and `range` are in the same units as the rects.
 */
export function shouldFlee(dragon: Rect, dragonCentreY: number, mimic: Rect, minHeight: number, range: number): boolean {
    const sideBySide = dragon.x + dragon.width > mimic.x && dragon.x < mimic.x + mimic.width;
    const gap = mimic.y - (dragon.y + dragon.height);
    return dragonCentreY > minHeight && sideBySide && gap <= range;
}

/** A random flight: its velocity at `speed`, and how long it lasts (ms). */
export function flight(speed: number, rng: Rng): { vx: number; vy: number; ms: number } {
    const [minAngle, maxAngle] = DRAGON.angle;
    const angle = ((minAngle + rng() * (maxAngle - minAngle)) * Math.PI) / 180;
    const [minMs, maxMs] = DRAGON.flightMs;
    return { vx: speed * Math.cos(angle), vy: speed * Math.sin(angle), ms: minMs + rng() * (maxMs - minMs) };
}
