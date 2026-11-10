// Tuning for the Phaser spike. Values follow the p5 game's constants, converted
// from "pixels per 60fps frame" to pixels per second.

export const WIDTH = 1024;
export const HEIGHT = 768;
export const GROUND_Y = HEIGHT - 14;

export const PLAYER = {
    scale: 0.4,
    speed: 360,          // 6 px/frame
    gravity: 1800,       // 0.5 px/frame²
    jump: -720,          // -12 px/frame
    maxJumps: 2,
    eatZone: 0.3,        // top 30% of the chest is the mouth
    nearby: 40,          // opens the lid when food is this close
    growth: 1.05         // speed and size per level
};

export const OBJECTS = {
    baseDrop: 120,       // 60 px/s × the game's 2.0 start scale
    spawnMs: 2750,       // 165 frames
    bombChance: 0.15,
    height: 62
};

export const CREATURES = [
    { key: 'human', xp: 10, weight: 0.45 },
    { key: 'goblin', xp: 1, weight: 0.3 },
    { key: 'elf', xp: 20, weight: 0.25 }
];

export const LIVES = 3;
export const XP_CAP = 100;
export const EATEN_PER_ZONE = 10;

export const THEME = {
    font: 'Georgia, "Times New Roman", serif',
    gold: '#ffdb7e',
    goldHex: 0xffdb7e,
    text: '#f6ead0',
    muted: '#c9b99b',
    panel: 0x120b08,
    panelAlpha: 0.78,
    border: 0xb0844f,
    xp: 0x7fd99a,
    danger: 0xe0533f
};
