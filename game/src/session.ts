// What the player has already been shown. The save system (M3) will keep
// this between visits; until then it lasts until the page reloads.
import type { Ability } from './rules/abilities';

const introduced = new Set<Ability>();

/** True once an ability's new-ability card has been shown. */
export function wasIntroduced(ability: Ability): boolean {
    return introduced.has(ability);
}

/** Records that an ability's card has been shown. */
export function markIntroduced(ability: Ability): void {
    introduced.add(ability);
}
