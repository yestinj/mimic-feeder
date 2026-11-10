// Floors, zones and difficulty (inventory §5).

export const ZONES_PER_FLOOR = 5;
/** Creatures eaten to clear a zone. */
export const CREATURES_PER_ZONE = 10;

/** Hazards start falling from this level (Floor 1, Zone 3). */
export const HAZARDS_FROM_LEVEL = 3;
/** Fireballs join the bombs from this floor. */
export const FIREBALLS_FROM_FLOOR = 4;

/** Base fall speed in reference px/s (the p5 game's 60 px/s at its 2× starting scale). */
export const BASE_DROP_SPEED = 120;
/** Spawn interval at level 1, in 60 fps frames (2.75 s), and its floor. */
const BASE_SPAWN_FRAMES = 165;
const MIN_SPAWN_FRAMES = 10;
const DIFFICULTY_PER_LEVEL = 0.05;

/** The run's level number: Floor 1 Zone 1 is level 1, Floor 2 Zone 1 is level 6. */
export function gameLevel(floor: number, zone: number): number {
    return (floor - 1) * ZONES_PER_FLOOR + zone;
}

/** Difficulty multiplier: +5% per level. */
export function difficulty(level: number): number {
    return 1 + (level - 1) * DIFFICULTY_PER_LEVEL;
}

/** Fall speed for a level, reference px/s, before each object's own variation. */
export function dropSpeed(level: number): number {
    return BASE_DROP_SPEED * difficulty(level);
}

function spawnFrames(level: number): number {
    return Math.max(MIN_SPAWN_FRAMES, Math.round(BASE_SPAWN_FRAMES / difficulty(level)));
}

/** Time between spawns for a level, ms. */
export function spawnInterval(level: number): number {
    return (spawnFrames(level) * 1000) / 60;
}

/** Drop speed relative to level 1, as a whole percentage (the pause screen shows it). */
export function dropSpeedPercent(level: number): number {
    return Math.round(difficulty(level) * 100);
}

/** Spawn rate relative to level 1, as a whole percentage. */
export function spawnRatePercent(level: number): number {
    return Math.round((BASE_SPAWN_FRAMES / spawnFrames(level)) * 100);
}

export type MusicTrack = 'music1' | 'music2';

/** Floors 1–2, 5–6, 9–10… play the first track; Floors 3–4, 7–8… the second. */
export function musicForFloor(floor: number): MusicTrack {
    return (floor - 1) % 4 < 2 ? 'music1' : 'music2';
}

/** The floor and zone after clearing a zone. */
export function nextZone(floor: number, zone: number): { floor: number; zone: number } {
    return zone >= ZONES_PER_FLOOR ? { floor: floor + 1, zone: 1 } : { floor, zone: zone + 1 };
}
