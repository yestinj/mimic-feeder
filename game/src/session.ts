// What the player has already been shown. The save system (M3) will keep
// this between visits; until then it lasts until the page reloads.
import type { Ability } from './rules/abilities';

const introduced = new Set<Ability>();

/** True the first time an ability is introduced, which it then remembers. */
export function firstIntroduction(ability: Ability): boolean {
    if (introduced.has(ability)) {
        return false;
    }
    introduced.add(ability);
    return true;
}
