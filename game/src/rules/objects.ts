// Everything that falls into the dungeon, as data (inventory §4). Cats,
// dragons and the power-ups arrive in M2.

export type CreatureKind = 'goblin' | 'dwarf' | 'wraith' | 'human' | 'elf';
export type ShinyKind = 'crown' | 'diamond';
export type HazardKind = 'bomb' | 'fireball';
export type ObjectKind = CreatureKind | ShinyKind | HazardKind;

/**
 * - creature: eaten from above for points; bumped off the sides; costs a life
 *   if it hits the floor.
 * - shiny: collected on any contact; breaks harmlessly on the floor.
 * - hazard: costs a life on contact; explodes harmlessly on the floor.
 */
export type ObjectCategory = 'creature' | 'shiny' | 'hazard';

export interface ObjectDef {
    readonly kind: ObjectKind;
    readonly category: ObjectCategory;
    /** Score and XP when eaten or collected. */
    readonly points: number;
    /** Relative chance in the normal spawn roll. Hazards roll separately (spawner.ts). */
    readonly weight: number;
    /** Display scale relative to the source image, at the reference size. */
    readonly scale: number;
    /** Fall speed relative to the current drop speed. */
    readonly fallSpeed: number;
}

// The p5 spawn table's probabilities, kept as they were: only their ratios
// matter, and later additions (dragons at 0.05) rely on the same scale.
const P5 = 1.111;

export const OBJECTS: Readonly<Record<ObjectKind, ObjectDef>> = {
    goblin: { kind: 'goblin', category: 'creature', points: 1, weight: 0.25 * P5, scale: 1 / 6, fallSpeed: 1 },
    dwarf: { kind: 'dwarf', category: 'creature', points: 3, weight: 0.2 * P5, scale: 3, fallSpeed: 1 },
    wraith: { kind: 'wraith', category: 'creature', points: 7, weight: 0.1 * P5, scale: 1.4, fallSpeed: 1 },
    human: { kind: 'human', category: 'creature', points: 10, weight: 0.2 * P5, scale: 1.5, fallSpeed: 1 },
    elf: { kind: 'elf', category: 'creature', points: 20, weight: 0.1 * P5, scale: 1.5, fallSpeed: 1 },
    // Drawn 45 and 35 px wide (the source images are 126 and 186 px wide).
    crown: { kind: 'crown', category: 'shiny', points: 50, weight: 0.03 * P5, scale: 45 / 126, fallSpeed: 1 },
    diamond: { kind: 'diamond', category: 'shiny', points: 100, weight: 0.02 * P5, scale: 35 / 186, fallSpeed: 1 },
    bomb: { kind: 'bomb', category: 'hazard', points: 0, weight: 0, scale: 1 / 2.5, fallSpeed: 1 },
    fireball: { kind: 'fireball', category: 'hazard', points: 0, weight: 0, scale: 2.5, fallSpeed: 3 },
};

export const CREATURE_KINDS: readonly CreatureKind[] = ['goblin', 'dwarf', 'wraith', 'human', 'elf'];
export const SHINY_KINDS: readonly ShinyKind[] = ['crown', 'diamond'];
export const HAZARD_KINDS: readonly HazardKind[] = ['bomb', 'fireball'];

export function isCreature(kind: ObjectKind): kind is CreatureKind {
    return OBJECTS[kind].category === 'creature';
}

export function isShiny(kind: ObjectKind): kind is ShinyKind {
    return OBJECTS[kind].category === 'shiny';
}

export function isHazard(kind: ObjectKind): kind is HazardKind {
    return OBJECTS[kind].category === 'hazard';
}
