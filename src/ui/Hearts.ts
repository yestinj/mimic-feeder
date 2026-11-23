import * as Phaser from 'phaser';
import { prefersReducedMotion } from '../motion';
import { MOTION } from '../theme';
import { UI } from './kit';

const SPACING = 56;
const PER_ROW = 8;

/**
 * Lives as hearts, with empty sockets up to the maximum, right-aligned to x.
 * A lost heart shakes; a gained one pops; the last one pulses.
 */
export class Hearts extends Phaser.GameObjects.Container {
    private icons: Phaser.GameObjects.Image[] = [];
    private lives = 0;
    private maxLives = 0;
    private pulse: Phaser.Tweens.Tween | null = null;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y);
        scene.add.existing(this);
    }

    set(lives: number, maxLives: number, animate: boolean): void {
        if (maxLives !== this.maxLives) {
            this.build(maxLives);
        }
        const previous = this.lives;
        this.lives = lives;
        this.icons.forEach((icon, i) => icon.setTexture(i < lives ? UI.heartFull : UI.heartEmpty));

        if (animate && lives < previous) {
            const lost = this.icons[lives];
            if (lost) {
                this.shake(lost);
            }
        } else if (animate && lives > previous) {
            const gained = this.icons[lives - 1];
            if (gained) {
                this.scene.tweens.add({ targets: gained, scale: { from: 1.5, to: 1 }, duration: MOTION.slow, ease: 'Back.Out' });
            }
        }
        this.updatePulse();
    }

    private build(maxLives: number): void {
        this.removeAll(true);
        this.maxLives = maxLives;
        this.icons = [];
        for (let i = 0; i < maxLives; i++) {
            const row = Math.floor(i / PER_ROW);
            const column = i % PER_ROW;
            const inRow = Math.min(PER_ROW, maxLives - row * PER_ROW);
            const x = -(inRow - 1 - column) * SPACING;
            this.icons.push(this.scene.add.image(x, row * SPACING, UI.heartEmpty));
        }
        this.add(this.icons);
        this.pulse?.stop();
        this.pulse = null;
    }

    private shake(icon: Phaser.GameObjects.Image): void {
        const home = icon.x;
        this.scene.tweens.add({ targets: icon, scale: { from: 1.35, to: 1 }, duration: MOTION.slow, ease: 'Cubic.Out' });
        if (prefersReducedMotion()) {
            return;
        }
        this.scene.tweens.add({
            targets: icon,
            x: { from: home - 8, to: home + 8 },
            duration: 50,
            yoyo: true,
            repeat: 3,
            onComplete: () => icon.setX(home),
        });
    }

    /** The last heart pulses while it's the only one left. */
    private updatePulse(): void {
        const last = this.lives === 1 ? this.icons[0] : undefined;
        if (last && !this.pulse) {
            this.pulse = this.scene.tweens.add({ targets: last, scale: 1.18, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
        } else if (!last && this.pulse) {
            this.pulse.stop();
            this.pulse = null;
            this.icons.forEach((icon) => icon.setScale(1));
        }
    }
}
