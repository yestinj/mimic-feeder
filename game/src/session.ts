// What the player has already been shown, kept in the save.
import { profile, updateProfile } from './profile';
import type { Ability } from './rules/abilities';

/** True once an ability's new-ability card has been shown. */
export function wasIntroduced(ability: Ability): boolean {
    return profile().introduced.includes(ability);
}

/** Records that an ability's card has been shown. */
export function markIntroduced(ability: Ability): void {
    if (!wasIntroduced(ability)) {
        updateProfile((save) => ({ ...save, introduced: [...save.introduced, ability] }));
    }
}

/** True once an object kind has been met (How to Play shows the rest as "???"). */
export function wasDiscovered(kind: string): boolean {
    return profile().discoveries.includes(kind);
}

/** Records that an object kind has been met; true if it's the first time. */
export function markDiscovered(kind: string): boolean {
    if (wasDiscovered(kind)) {
        return false;
    }
    updateProfile((save) => ({ ...save, discoveries: [...save.discoveries, kind] }));
    return true;
}
