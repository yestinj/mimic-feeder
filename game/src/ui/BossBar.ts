import * as Phaser from 'phaser';
import { STRINGS } from '../strings';
import { COLOURS, MOTION, TEXT_COLOURS, TYPE } from '../theme';
import { prefersReducedMotion } from '../motion';
import { SLICE, UI } from './kit';
import { addText } from './text';

const WIDTH = 600;
const HEIGHT = 24;
const INSET = 6;
const GAP = 4;
const BAR_Y = 32;

/**
 * The boss's name and health, top centre and compact, so it stays above the
 * boss: one segment per hit it can take.
 */
export class BossBar extends Phaser.GameObjects.Container {
    private readonly segments: Phaser.GameObjects.Graphics;
    private health = 0;
    private max = 0;
    private shown = false;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y);
        const name = addText(scene, 0, 0, STRINGS.boss.name, TYPE.body, { role: 'display', bold: true, colour: TEXT_COLOURS.gold }).setOrigin(0.5);
        const frame = scene.add.nineslice(0, BAR_Y, UI.barFrame, undefined, WIDTH, HEIGHT, SLICE.barFrame, SLICE.barFrame);
        this.segments = scene.add.graphics();
        this.add([name, frame, this.segments]);
        this.setAlpha(0).setVisible(false);
        scene.add.existing(this);
    }

    get visibleNow(): boolean {
        return this.shown;
    }

    /** Shows or updates the bar; null hides it. */
    set(state: { health: number; max: number } | null): void {
        if (!state) {
            this.hide();
            return;
        }
        const lost = this.shown && state.health < this.health ? this.health - 1 : null;
        this.health = state.health;
        this.max = state.max;
        this.draw();
        if (!this.shown) {
            this.shown = true;
            this.setVisible(true);
            this.scene.tweens.add({ targets: this, alpha: 1, y: { from: this.y - 20, to: this.y }, duration: MOTION.slow, ease: MOTION.ease });
        } else if (lost !== null) {
            this.flash(lost);
        }
    }

    private hide(): void {
        if (!this.shown) {
            return;
        }
        this.shown = false;
        this.scene.tweens.add({ targets: this, alpha: 0, duration: MOTION.slow, onComplete: () => this.setVisible(false) });
    }

    private segmentBounds(index: number): { x: number; width: number } {
        const inner = WIDTH - INSET * 2;
        const width = (inner - GAP * (this.max - 1)) / this.max;
        return { x: -WIDTH / 2 + INSET + index * (width + GAP), width };
    }

    private draw(): void {
        this.segments.clear();
        const top = BAR_Y - HEIGHT / 2 + INSET;
        const height = HEIGHT - INSET * 2;
        for (let i = 0; i < this.max; i++) {
            const { x, width } = this.segmentBounds(i);
            if (i < this.health) {
                this.segments.fillStyle(COLOURS.health, 1);
            } else {
                this.segments.fillStyle(COLOURS.ink, 0.6);
            }
            this.segments.fillRect(x, top, width, height);
        }
    }

    /** The segment just lost flashes white, and the bar jolts. */
    private flash(index: number): void {
        const { x, width } = this.segmentBounds(index);
        const spark = this.scene.add.rectangle(x + width / 2, BAR_Y, width, HEIGHT - INSET * 2, 0xffffff);
        this.add(spark);
        this.scene.tweens.add({ targets: spark, alpha: 0, scaleY: 1.8, duration: MOTION.slow, onComplete: () => spark.destroy() });
        if (!prefersReducedMotion()) {
            const home = this.x;
            this.scene.tweens.add({ targets: this, x: home + 6, duration: 40, yoyo: true, repeat: 2, onComplete: () => this.setX(home) });
        }
    }
}
