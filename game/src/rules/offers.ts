// When power-ups fall (inventory §4 and plan §3.9). They take the place of
// the normal spawn: the Wizard Staff first, then a health potion, then the
// Magnet, the first that's due.
import type { ObjectKind, PowerUpKind } from './objects';
import type { Rng } from './spawner';

/** The Staff unlocks on Floor 2, the Magnet on Floor 3. */
export const STAFF_FROM_FLOOR = 2;
export const MAGNET_FROM_FLOOR = 3;
/** A potion is due every five levels (first at Floor 1 Zone 5). */
export const POTION_EVERY_LEVELS = 5;
/** After a missed Staff or Magnet, the chance per spawn of offering it again. */
export const REOFFER_CHANCE = 0.2;

export interface OfferState {
    readonly floor: number;
    readonly gameLevel: number;
    readonly hasStaff: boolean;
    readonly hasMagnet: boolean;
    /** Staffs and magnets offered so far this run (the first offer is immediate). */
    readonly staffOffers: number;
    readonly magnetOffers: number;
    /** The level the last potion fell at (0 before the first). */
    readonly lastPotionLevel: number;
}

/**
 * The power-up to drop on this spawn, if any. A power-up already on screen is
 * never offered twice, and the Staff and Magnet stop once collected.
 */
export function pickPowerUp(state: OfferState, onScreen: ReadonlySet<ObjectKind>, rng: Rng): PowerUpKind | null {
    const offerAgain = (offers: number): boolean => offers === 0 || rng() < REOFFER_CHANCE;
    if (!state.hasStaff && state.floor >= STAFF_FROM_FLOOR && !onScreen.has('staff') && offerAgain(state.staffOffers)) {
        return 'staff';
    }
    if (state.gameLevel >= state.lastPotionLevel + POTION_EVERY_LEVELS && !onScreen.has('potion')) {
        return 'potion';
    }
    if (!state.hasMagnet && state.floor >= MAGNET_FROM_FLOOR && !onScreen.has('magnet') && offerAgain(state.magnetOffers)) {
        return 'magnet';
    }
    return null;
}
