// Dungeon floors: names and backgrounds. Floors 1–10 each have their own
// background; Floor 10's (the Abyss) stays for every floor after it.

export interface FloorInfo {
    /** Display name, e.g. "Ageing Lower Halls". */
    readonly name: string;
    /** Background file under /assets/backgrounds/. */
    readonly background: string;
}

export const FLOORS: readonly FloorInfo[] = [
    { name: 'Upper Dungeon', background: 'upper-dungeon.webp' },
    { name: 'Ageing Lower Halls', background: 'ageing-lower-halls.webp' },
    { name: 'Lower Undercroft', background: 'lower-undercroft.webp' },
    { name: 'Buried Crypts', background: 'buried-crypts.webp' },
    { name: 'Ancient Catacombs', background: 'ancient-catacombs.webp' },
    { name: 'Root-Choked Necropolis', background: 'root-choked-necropolis.webp' },
    { name: 'Underworld Depths', background: 'underworld-depths.webp' },
    { name: 'Infernal Ruins', background: 'infernal-ruins.webp' },
    { name: 'Void Threshold', background: 'void-threshold.webp' },
    { name: 'Abyss', background: 'abyss.webp' },
];

/** Index into FLOORS for a floor number (1-based). Invalid input counts as Floor 1. */
export function floorIndex(floor: number): number {
    const normalised = Number.isFinite(floor) ? Math.max(1, Math.floor(floor)) : 1;
    return Math.min(normalised, FLOORS.length) - 1;
}

export function floorInfo(floor: number): FloorInfo {
    // floorIndex always returns a valid index, and FLOORS is non-empty.
    return FLOORS[floorIndex(floor)] as FloorInfo;
}

/** Banner title for a floor, e.g. "Floor 2: Ageing Lower Halls". */
export function floorTitle(floor: number): string {
    const normalised = Number.isFinite(floor) ? Math.max(1, Math.floor(floor)) : 1;
    return `Floor ${normalised}: ${floorInfo(normalised).name}`;
}
