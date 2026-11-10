// Menu screens opened over another one (Settings and High Scores, from the
// title, the pause menu or the results). The screen underneath sleeps, so it
// keeps its state (focus, an animation half done) and wakes up as it was.
import * as Phaser from 'phaser';
import { backgroundKey, floorBackground } from '../assets';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../config';
import { COLOURS, MOTION } from '../theme';

export type ScreenKey = 'settings' | 'highScores';
export type ReturnTo = 'title' | 'pause' | 'results';

export interface ScreenData {
    /** The scene to wake when this one closes. */
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

/** Closes a screen opened with openScreen and wakes the one it came from. */
export function closeScreen(scene: Phaser.Scene, data: ScreenData): void {
    scene.cameras.main.fadeOut(MOTION.fast, 0, 0, 0);
    scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        scene.scene.wake(data.from);
        scene.scene.stop();
    });
}

/**
 * What goes behind a screen: over the pause menu, a dark veil on the frozen
 * game; otherwise a floor's background, blurred and darkened.
 */
export function addScreenBackdrop(scene: Phaser.Scene, data: ScreenData): void {
    if (data.from === 'pause') {
        scene.add.rectangle(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, COLOURS.ink, 0.8).setOrigin(0);
        return;
    }
    const key = data.floor ? floorBackground(scene.textures, data.floor) : backgroundKey(0);
    const background = scene.add.image(DESIGN_WIDTH / 2, DESIGN_HEIGHT, key).setOrigin(0.5, 1);
    background.setScale(Math.max(DESIGN_WIDTH / background.width, DESIGN_HEIGHT / background.height));
    background.enableFilters();
    background.filters?.internal.addBlur(1, 2, 2, 1.5);
    scene.add.rectangle(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, COLOURS.ink, 0.7).setOrigin(0);
}
