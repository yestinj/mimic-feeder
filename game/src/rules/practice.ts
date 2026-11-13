// Practice runs, a testing aid: /next/?test&floor=7 starts every run on that
// floor, with what a steady player would have by then. They leave the save
// alone (no high scores, totals, achievements or discoveries).
import { BOSS, isBossZone } from './boss';
import { OBJECTS, isEdible, isShiny } from './objects';
import { CREATURES_PER_ZONE, ZONES_PER_FLOOR } from './progression';
import { spawnPool } from './spawner';

/** The deepest floor a practice run can start on. */
export const PRACTICE_MAX_FLOOR = 20;
/** The share of the shinies that fall a steady player catches. */
export const SHINIES_CAUGHT = 0.5;

/** The floor a practice run starts on, from the URL's `floor` value: a whole number from 2 to PRACTICE_MAX_FLOOR, otherwise none. */
export function practiceFloor(value: string | null): number | null {
    if (value === null || !/^\d+$/.test(value.trim())) {
        return null;
    }
    const floor = Number(value.trim());
    return floor >= 2 && floor <= PRACTICE_MAX_FLOOR ? floor : null;
}

/** What a steady player has gained by the start of a floor. */
export interface TypicalProgress {
    /** Score (and XP): the creatures eaten, the shinies caught, the bosses beaten. */
    readonly points: number;
    /** Humans eaten, for the extra hearts they bring. */
    readonly humans: number;
}

/**
 * A steady player's progress by the start of `floor`: every zone before it
 * cleared (its ten creatures, at their average worth in that floor's spawns),
 * about half the shinies that fell meanwhile, and every boss beaten.
 */
export function typicalProgress(floor: number): TypicalProgress {
    let points = 0;
    let humans = 0;
    for (let f = 1; f < floor; f++) {
        const pool = spawnPool(f);
        const weight = (keep: (def: (typeof pool)[number]) => boolean): number =>
            pool.filter(keep).reduce((sum, def) => sum + def.weight, 0);
        const worth = (keep: (def: (typeof pool)[number]) => boolean): number =>
            pool.filter(keep).reduce((sum, def) => sum + def.weight * def.points, 0);
        const edibleWeight = weight((def) => isEdible(def.kind));
        // Per zone: ten creatures eaten, and the shinies that fell alongside them (by their share of the spawns).
        const zonePoints = (CREATURES_PER_ZONE * (worth((def) => isEdible(def.kind)) + SHINIES_CAUGHT * worth((def) => isShiny(def.kind)))) / edibleWeight;
        const zoneHumans = (CREATURES_PER_ZONE * OBJECTS.human.weight) / edibleWeight;
        for (let zone = 1; zone <= ZONES_PER_FLOOR; zone++) {
            if (isBossZone(f, zone)) {
                points += BOSS.points;
            } else {
                points += zonePoints;
                humans += zoneHumans;
            }
        }
    }
    return { points: Math.round(points), humans: Math.floor(humans) };
}
