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
 * True when falling food comes in over the rim: it's over the chest and its
 * bottom edge is inside the mouth (the top 30%), as when it drops in from
 * above or the mimic jumps up into it. Food that meets the chest lower down
 * has hit its side.
 *
 * (The p5 game ate anything reaching into the mouth band, so running into
 * tall food from the side often counted as eating; plan §3.9.)
 */
export function isBite(food: Rect, mimic: Rect, falling: boolean): boolean {
    const mouthBottom = mimic.y + mimic.height * MOUTH_DEPTH;
    const foodBottom = food.y + food.height;
    const over = food.x + food.width > mimic.x && food.x < mimic.x + mimic.width;
    const overRim = foodBottom > mimic.y && foodBottom <= mouthBottom;
    return falling && over && overRim;
}

/**
 * - eat: a creature went into the mouth.
 * - sideHit: a creature hit the side of the chest and was destroyed (costs a life).
 * - collect: a shiny, on any contact.
 * - detonate: a hazard, on any contact.
 */
export type ContactResult = 'eat' | 'sideHit' | 'collect' | 'detonate';

export function resolveContact(category: ObjectCategory, object: Rect, mimic: Rect, falling: boolean): ContactResult {
    switch (category) {
        case 'hazard':
            return 'detonate';
        case 'shiny':
            return 'collect';
        case 'creature':
            return isBite(object, mimic, falling) ? 'eat' : 'sideHit';
    }
}
