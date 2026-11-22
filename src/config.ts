// Fixed design resolution. Phaser scales it to fit the window (16:9), with
// black bars for other aspect ratios.
export const DESIGN_WIDTH = 1920;
export const DESIGN_HEIGHT = 1080;

/** Shared art and audio, served by the site at /assets/. */
export const ASSET_BASE = '/assets/';

// The p5 game was tuned in pixels on a 1024×768 canvas. Its numbers are kept
// as they were and converted here (docs/phaser-migration/plan.md §1):
// - sizes, heights and vertical speeds scale with the screen height, so falls
//   and jumps take the same time as before;
// - horizontal movement scales with the wider screen, so crossing it takes the
//   same time as before.
export const REFERENCE_WIDTH = 1024;
export const REFERENCE_HEIGHT = 768;
/** Reference pixels to design pixels for sizes and vertical movement. */
export const SIZE_SCALE = DESIGN_HEIGHT / REFERENCE_HEIGHT;
/** Reference pixels to design pixels for horizontal movement. */
export const RUN_SCALE = DESIGN_WIDTH / REFERENCE_WIDTH;

/**
 * Where the mimic stands and falling objects land. The p5 floor was 14 px above
 * the bottom; the floor backgrounds are scaled to the full width (RUN_SCALE)
 * and anchored to the bottom, so the same strip of art stays under the mimic.
 */
export const GROUND_Y = DESIGN_HEIGHT - Math.round(14 * RUN_SCALE);
