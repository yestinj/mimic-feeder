// Visual theme: dark-dungeon fantasy. Every colour, type size, spacing value
// and animation timing used by the UI comes from here, so screens stay
// consistent. Sizes are in design pixels at 1920×1080.

export const COLOURS = {
    /** Deepest background, behind panels and the letterbox. */
    ink: 0x0b0806,
    /** Panel body (dark stone). */
    stone: 0x1a1411,
    stoneLight: 0x2b211b,
    /** Dark metal edges. */
    iron: 0x3b322b,
    /** Gold trim, focus highlights and accents. */
    gold: 0xe0b55a,
    goldBright: 0xffd98a,
    goldDim: 0x8f6d35,
    /** Status colours. */
    health: 0xd8473a,
    xp: 0x7fd99a,
    ember: 0xff8a3d,
    /** Dust kicked up on landing. */
    dust: 0xb8a487,
    /** The Ninefold Judgment's palette. */
    judgment: 0x9a5bd6,
} as const;

/** CSS colour strings for Phaser text. */
export const TEXT_COLOURS = {
    primary: '#f3e6c8',
    muted: '#c2ad89',
    dim: '#8a7a62',
    gold: '#ffd98a',
    danger: '#ff8f80',
    shadow: '#0b0806',
} as const;

export const FONTS = {
    /** Titles and headings. */
    display: 'Grenze Gotisch',
    /** Everything else, including numbers. */
    body: 'Barlow',
} as const;

/** Type scale in design pixels. */
export const TYPE = {
    hero: 120,
    /** Floor and boss banners. */
    banner: 84,
    title: 64,
    heading: 44,
    button: 34,
    body: 28,
    small: 22,
    tiny: 18,
} as const;

/** Spacing steps (multiples of 8). */
export const SPACE = {
    xs: 8,
    s: 16,
    m: 24,
    l: 40,
    xl: 64,
} as const;

/** Animation timings in milliseconds and the default easing. */
export const MOTION = {
    fast: 120,
    normal: 220,
    slow: 420,
    fade: 300,
    ease: 'Cubic.Out',
} as const;
