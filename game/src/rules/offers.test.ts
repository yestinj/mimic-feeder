import { describe, expect, it } from 'vitest';
import type { ObjectKind } from './objects';
import { REOFFER_CHANCE, pickPowerUp, type OfferState } from './offers';
import { Run } from './run';

const base: OfferState = {
    floor: 1,
    gameLevel: 1,
    hasStaff: false,
    hasMagnet: false,
    staffOffers: 0,
    magnetOffers: 0,
    lastPotionLevel: 0,
};
const nothing = new Set<ObjectKind>();
const always = (): number => 0;
const never = (): number => 0.99;

describe('power-up offers', () => {
    it('keeps the Staff locked before Floor 2, then offers it at once', () => {
        expect(pickPowerUp({ ...base, gameLevel: 4 }, nothing, always)).toBeNull();
        expect(pickPowerUp({ ...base, floor: 2, gameLevel: 6, lastPotionLevel: 5 }, nothing, never)).toBe('staff');
    });

    it('re-offers a missed Staff only occasionally, never twice on screen, and stops once collected', () => {
        const missed = { ...base, floor: 2, gameLevel: 7, lastPotionLevel: 5, staffOffers: 1 };
        expect(pickPowerUp(missed, nothing, () => REOFFER_CHANCE - 0.01)).toBe('staff');
        expect(pickPowerUp(missed, nothing, never)).toBeNull();
        expect(pickPowerUp({ ...base, floor: 2, gameLevel: 6, lastPotionLevel: 5 }, new Set<ObjectKind>(['staff']), always)).toBeNull();
        expect(pickPowerUp({ ...missed, hasStaff: true }, nothing, always)).toBeNull();
    });

    it('drops a potion every five levels, first at Floor 1 Zone 5', () => {
        expect(pickPowerUp({ ...base, gameLevel: 4 }, nothing, never)).toBeNull();
        expect(pickPowerUp({ ...base, gameLevel: 5 }, nothing, never)).toBe('potion');
        expect(pickPowerUp({ ...base, gameLevel: 9, lastPotionLevel: 5 }, nothing, never)).toBeNull();
        expect(pickPowerUp({ ...base, gameLevel: 5 }, new Set<ObjectKind>(['potion']), never)).toBeNull();
    });

    it('offers the Magnet like the Staff, from Floor 3 (plan §3.9)', () => {
        const floor3 = { ...base, floor: 3, gameLevel: 11, lastPotionLevel: 10, hasStaff: true };
        expect(pickPowerUp(floor3, nothing, never)).toBe('magnet');
        expect(pickPowerUp({ ...floor3, floor: 4, gameLevel: 17, lastPotionLevel: 15, magnetOffers: 2 }, nothing, () => 0.1)).toBe('magnet');
        expect(pickPowerUp({ ...floor3, magnetOffers: 1 }, nothing, never)).toBeNull();
        expect(pickPowerUp({ ...floor3, hasMagnet: true }, nothing, always)).toBeNull();
    });

    it('prefers the Staff, then the potion, then the Magnet', () => {
        expect(pickPowerUp({ ...base, floor: 3, gameLevel: 11 }, nothing, always)).toBe('staff');
        expect(pickPowerUp({ ...base, floor: 3, gameLevel: 11, hasStaff: true }, nothing, always)).toBe('potion');
    });

    it('records offers on the run', () => {
        const run = new Run();
        run.floor = 2;
        run.zone = 1;
        expect(run.offerPowerUp(nothing, never)).toBe('staff');
        expect(run.staffOffers).toBe(1);
        expect(run.offerPowerUp(nothing, never)).toBe('potion');
        expect(run.lastPotionLevel).toBe(6);
        expect(run.offerPowerUp(nothing, never)).toBeNull();
    });
});
