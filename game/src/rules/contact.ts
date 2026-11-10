// What happens when something touches the mimic (inventory §3 "Eating" and §4
// "Collisions"). Rectangles are axis-aligned, with (x, y) at the top left.
import type { ObjectCategory } from './objects';

export interface Rect {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}

/** The mouth is the top 30% of the chest. */
export const MOUTH_DEPTH = 0.3;

export function overlaps(a: Rect, b: Rect): boolean {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function expand(rect: Rect, by: number): Rect {
    return { x: rect.x - by, y: rect.y - by, width: rect.width + by * 2, height: rect.height + by * 2 };
}

/**
 * True when falling food meets the mouth: it's over the chest and reaches into
 * its top 30%. Anything else touching the chest has hit its side.
 */
export function isBite(food: Rect, mimic: Rect, falling: boolean): boolean {
    const mouthBottom = mimic.y + mimic.height * MOUTH_DEPTH;
    const over = food.x + food.width > mimic.x && food.x < mimic.x + mimic.width;
    const inMouth = food.y + food.height > mimic.y && food.y < mouthBottom;
    return falling && over && inMouth;
}

/**
 * - eat: a creature went into the mouth.
 * - bump: a creature hit the side and is knocked away (no points, no penalty).
 * - collect: a shiny, on any contact.
 * - detonate: a hazard, on any contact.
 */
export type ContactResult = 'eat' | 'bump' | 'collect' | 'detonate';

export function resolveContact(category: ObjectCategory, object: Rect, mimic: Rect, falling: boolean): ContactResult {
    switch (category) {
        case 'hazard':
            return 'detonate';
        case 'shiny':
            return 'collect';
        case 'creature':
            return isBite(object, mimic, falling) ? 'eat' : 'bump';
    }
}
