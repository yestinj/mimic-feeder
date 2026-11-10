import * as Phaser from 'phaser';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../config';
import { COLOURS, MOTION, TEXT_COLOURS, TYPE } from '../theme';
import { Button } from './Button';
import { Menu } from './Menu';
import { addPanel } from './kit';
import { addText } from './text';

export interface ConfirmOptions {
    readonly message: string;
    readonly cancelLabel: string;
    readonly confirmLabel: string;
    readonly onConfirm: () => void;
    readonly onCancel: () => void;
}

const WIDTH = 760;
const HEIGHT = 300;

/**
 * A modal question with Cancel (focused, the safe default) and a confirm
 * button. It blocks clicks to everything under it; the scene keeps handling
 * Esc and calls cancel().
 */
export class ConfirmDialog {
    private readonly container: Phaser.GameObjects.Container;
    private readonly menu: Menu;
    private closed = false;

    constructor(scene: Phaser.Scene, private readonly options: ConfirmOptions) {
        const blocker = scene.add.rectangle(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, COLOURS.ink, 0.55).setOrigin(0).setInteractive();
        const cx = DESIGN_WIDTH / 2;
        const cy = DESIGN_HEIGHT / 2;
        // A solid backing: the panel art is slightly see-through, which a modal shouldn't be.
        const backing = scene.add.graphics().fillStyle(COLOURS.stone, 1).fillRoundedRect(cx - WIDTH / 2 + 3, cy - HEIGHT / 2 + 3, WIDTH - 6, HEIGHT - 6, 14);
        const panel = addPanel(scene, cx, cy, WIDTH, HEIGHT);
        const message = addText(scene, cx, cy - 56, options.message, TYPE.heading, { role: 'display', bold: true, colour: TEXT_COLOURS.gold }).setOrigin(0.5);
        const cancel = new Button(scene, cx - 170, cy + 64, options.cancelLabel, { width: 300, onSelect: () => this.cancel() });
        const confirm = new Button(scene, cx + 170, cy + 64, options.confirmLabel, { width: 300, onSelect: () => this.confirm() });
        this.menu = new Menu(scene, [cancel, confirm], { horizontal: true });
        this.container = scene.add.container(0, 0, [blocker, backing, panel, message, cancel, confirm]).setDepth(100).setAlpha(0);
        scene.tweens.add({ targets: this.container, alpha: 1, duration: MOTION.fast });
    }

    cancel(): void {
        if (this.close()) {
            this.options.onCancel();
        }
    }

    private confirm(): void {
        if (this.close()) {
            this.options.onConfirm();
        }
    }

    private close(): boolean {
        if (this.closed) {
            return false;
        }
        this.closed = true;
        this.menu.destroy();
        this.container.destroy();
        return true;
    }
}
