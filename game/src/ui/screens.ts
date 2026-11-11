// Menu screens opened over another one (Settings, High Scores and
// Achievements, from the title, the pause menu or the results). The screen
// underneath sleeps, so it keeps its state (focus, an animation half done)
// and wakes up as it was. The achievements can also open straight over the
// run (K), which is paused underneath and resumes when they close.
import * as Phaser from 'phaser';
import { backgroundKey, floorBackground } from '../assets';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../config';
import { COLOURS, MOTION } from '../theme';

export type ScreenKey = 'settings' | 'highScores' | 'achievements';
export type ReturnTo = 'title' | 'pause' | 'results' | 'game';

export interface ScreenData {
    /** The scene to go back to when this one closes: woken, or for the game, resumed. */
    readonly from: ReturnTo;
    /** The floor to show behind the screen (from the results); none means Floor 1. */
    readonly floor?: number;
    /** A high score to highlight (its date), from the results. */
    readonly highlight?: string;
}

/** Puts `scene` to sleep and opens a screen over it. */
export function openScreen(scene: Phaser.Scene, key: ScreenKey, data: ScreenData): void {
    scene.scene.launch(key, data);
    scene.scene.sleep();
}

/**
 * Sets up a screen as it opens: input back on (closeScreen switched it off,
 * and a scene keeps that between runs) and the backdrop.
 */
export function startScreen(scene: Phaser.Scene, data: ScreenData): void {
    scene.input.enabled = true;
    addScreenBackdrop(scene, data);
}

/** Closes a screen opened with openScreen and wakes the one it came from. */
export function closeScreen(scene: Phaser.Scene, data: ScreenData): void {
    // Nothing more is clicked while it fades out (see startScreen).
    scene.input.enabled = false;
    scene.cameras.main.fadeOut(MOTION.fast, 0, 0, 0);
    scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        if (data.from === 'game') {
            scene.scene.resume('game');
            scene.scene.resume('hud');
        } else {
            scene.scene.wake(data.from);
        }
        scene.scene.stop();
    });
}

/** A floor's background (Floor 1 if none is given), cropped to fill the screen, blurred and darkened by `dim`. */
export function addFloorBackdrop(scene: Phaser.Scene, floor: number | undefined, dim: number): void {
    const key = floor ? floorBackground(scene.textures, floor) : backgroundKey(0);
    const background = scene.add.image(DESIGN_WIDTH / 2, DESIGN_HEIGHT, key).setOrigin(0.5, 1);
    background.setScale(Math.max(DESIGN_WIDTH / background.width, DESIGN_HEIGHT / background.height));
    background.enableFilters();
    background.filters?.internal.addBlur(1, 2, 2, 1.5);
    scene.add.rectangle(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, COLOURS.ink, dim).setOrigin(0);
}

/**
 * What goes behind a screen: over the pause menu or the run, a dark veil on
 * the frozen game; otherwise a floor's background, blurred and darkened.
 */
function addScreenBackdrop(scene: Phaser.Scene, data: ScreenData): void {
    if (data.from === 'pause' || data.from === 'game') {
        scene.add.rectangle(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, COLOURS.ink, 0.8).setOrigin(0);
    } else {
        addFloorBackdrop(scene, data.floor, 0.7);
    }
}
