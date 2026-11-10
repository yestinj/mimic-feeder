// Gameplay tuning carried over from the p5 game (src/js/constants.js). Lengths
// are in reference pixels (the p5 game's 1024×768 canvas) and times in
// seconds; scenes convert lengths with SIZE_SCALE and RUN_SCALE (config.ts).
// The p5 game counted in 60 fps frames: 6 px per frame is 360 px/s, and so on.

export const MIMIC = {
    /** The chest sprite's scale at the reference size. */
    scale: 0.4,
    /** Run speed, px/s (horizontal: converted with RUN_SCALE). */
    runSpeed: 360,
    /** Gravity, px/s². */
    gravity: 1800,
    /** Jump take-off speed, px/s. */
    jumpSpeed: 720,
    /** Jumps before landing (2 = double jump). */
    maxJumps: 2,
    /** Food closer than this opens the lid, px. */
    lidOpenDistance: 15,
    /** How long the lid stays open after reaching for food mid-jump, s. */
    jumpBiteOpenTime: 0.75,
} as const;

export const SPAWNING = {
    /** Objects appear this far above the top edge (their centre), px. */
    startY: -20,
    /** Each object's fall speed varies by up to this fraction either way. */
    speedVariation: 0.25,
    /** A new object avoids landing this close to the last few, px. */
    minGap: 50,
    /** How many recent positions it avoids. */
    recentPositions: 3,
    /** Attempts at finding a position clear of the recent ones. */
    placementAttempts: 5,
    /** Hazards never appear closer than this to the mimic's centre, px. */
    hazardClearance: 80,
} as const;
