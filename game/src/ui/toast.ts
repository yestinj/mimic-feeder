import type * as Phaser from 'phaser';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../config';
import { MOTION, SPACE, TEXT_COLOURS, TYPE } from '../theme';
import { addPanel } from './kit';
import { addText } from './text';

const toasts = new WeakMap<Phaser.Scene, Phaser.GameObjects.Container>();

/** A short note near the bottom of a menu screen, replacing any note already showing. */
export function showToast(scene: Phaser.Scene, message: string): void {
    toasts.get(scene)?.destroy();
    const text = addText(scene, 0, 0, message, TYPE.small, { colour: TEXT_COLOURS.primary }).setOrigin(0.5);
    const panel = addPanel(scene, 0, 0, text.width + SPACE.xl * 1.5, 72);
    const toast = scene.add.container(DESIGN_WIDTH / 2, DESIGN_HEIGHT - 150, [panel, text]).setAlpha(0).setDepth(50);
    toasts.set(scene, toast);
    scene.tweens.add({ targets: toast, alpha: 1, y: toast.y - 12, duration: MOTION.normal, ease: MOTION.ease });
    scene.tweens.add({
        targets: toast,
        alpha: 0,
        delay: 1800,
        duration: MOTION.slow,
        onComplete: () => {
            toast.destroy();
            if (toasts.get(scene) === toast) {
                toasts.delete(scene);
            }
        },
    });
}
