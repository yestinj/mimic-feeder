// How to Play (plan §3.4): what the Creatures & Items tab shows, and in what
// order, and which abilities the player already knows. Everything here is
// hidden until the player has met it (the save's discoveries) or unlocked it.
import type { Ability } from './abilities';
import { BOSS } from './boss';
import { OBJECTS, type ObjectKind } from './objects';

export type GuideCategory = 'creature' | 'treasure' | 'hazard' | 'powerUp' | 'boss';

/** An object kind, or the boss. These are also the keys the save's discoveries use. */
export type GuideKey = ObjectKind | 'boss';

export interface GuideEntry {
    readonly key: GuideKey;
    readonly category: GuideCategory;
    /** Score for eating or collecting it (or beating it); null where there's none to show. */
    readonly points: number | null;
}

const entry = (key: ObjectKind, category: GuideCategory): GuideEntry => {
    const points = OBJECTS[key].points;
    return { key, category, points: points > 0 ? points : null };
};

/** The Creatures & Items tab, in order: creatures, treasure, hazards, power-ups, then the boss. */
export const GUIDE_ENTRIES: readonly GuideEntry[] = [
    entry('goblin', 'creature'),
    entry('dwarf', 'creature'),
    entry('wraith', 'creature'),
    entry('human', 'creature'),
    entry('elf', 'creature'),
    entry('dragon', 'creature'),
    entry('cat', 'creature'),
    entry('crown', 'treasure'),
    entry('diamond', 'treasure'),
    entry('bomb', 'hazard'),
    entry('fireball', 'hazard'),
    entry('potion', 'powerUp'),
    entry('staff', 'powerUp'),
    entry('magnet', 'powerUp'),
    { key: 'boss', category: 'boss', points: BOSS.points },
];

/** True once it's been met (it's in the save's discoveries). */
export function isDiscovered(key: GuideKey, discoveries: readonly string[]): boolean {
    return discoveries.includes(key);
}

/** True once the player has unlocked it in any run (its new-ability card was shown). The dash is known from the start. */
export function isKnownAbility(ability: Ability, introduced: readonly Ability[]): boolean {
    return ability === 'dash' || introduced.includes(ability);
}
