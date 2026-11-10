import * as Phaser from 'phaser';
import { SLICE, UI } from './kit';

const HEIGHT = 28;
const INSET = 5;

/** A framed bar that fills left to right, tinted per use (XP now; boss health later). */
export class ProgressBar extends Phaser.GameObjects.Container {
    private readonly fill: Phaser.GameObjects.Image;
    private readonly fillFrameWidth: number;
    private shown = 0;
    private tween: Phaser.Tweens.Tween | null = null;

    constructor(scene: Phaser.Scene, x: number, y: number, width: number, colour: number) {
        super(scene, x, y);
        const frame = scene.add.nineslice(0, 0, UI.barFrame, undefined, width, HEIGHT, SLICE.barFrame, SLICE.barFrame);
        this.fill = scene.add.image(-width / 2 + INSET, 0, UI.barFill).setOrigin(0, 0.5).setTint(colour);
        this.fill.setDisplaySize(width - INSET * 2, HEIGHT - INSET * 2);
        this.fillFrameWidth = this.fill.frame.width;
        this.add([frame, this.fill]);
        scene.add.existing(this);
        this.draw(0);
    }

    /** Sets the fill (0–1). Animated, it eases there; a wrap past full sweeps to the end first. */
    setProgress(value: number, animate: boolean, wrapped = false): void {
        const target = Phaser.Math.Clamp(value, 0, 1);
        this.tween?.stop();
        if (!animate) {
            this.draw(target);
            return;
        }
        const sweep = (from: number, to: number, onComplete?: () => void): Phaser.Tweens.Tween => this.scene.tweens.addCounter({
            from,
            to,
            duration: 350,
            ease: 'Cubic.Out',
            onUpdate: (tween) => this.draw(tween.getValue() ?? to),
            ...(onComplete ? { onComplete } : {}),
        });
        this.tween = wrapped
            ? sweep(this.shown, 1, () => {
                this.tween = sweep(0, target);
            })
            : sweep(this.shown, target);
    }

    private draw(value: number): void {
        this.shown = value;
        this.fill.setVisible(value > 0);
        this.fill.setCrop(0, 0, this.fillFrameWidth * value, this.fill.frame.height);
    }
}
