import * as Phaser from 'phaser';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../config';
import { STRINGS } from '../strings';
import { COLOURS, MOTION, SPACE, TEXT_COLOURS, TYPE } from '../theme';
import { Button } from '../ui/Button';
import { addPanel } from '../ui/kit';
import { Menu } from '../ui/Menu';
import { addText } from '../ui/text';
import { markReady } from '../testHook';
import { TEXTURES } from './PreloadScene';

const GROUND_Y = DESIGN_HEIGHT - 20;

/**
 * Title screen (M0 placeholder). The menu is navigable but its screens arrive in
 * later milestones; selecting an item shows a "coming soon" note.
 */
export class TitleScene extends Phaser.Scene {
    private toast: Phaser.GameObjects.Container | null = null;

    constructor() {
        super('title');
    }

    create(): void {
        this.cameras.main.fadeIn(MOTION.slow, 0, 0, 0);
        this.addBackdrop();
        this.addTitle();
        this.addMimic();
        this.addMenu();
        this.addFooter();
        markReady('title');
    }

    /** Floor 1's 4:3 background, cropped to fill 16:9 and anchored to the floor. */
    private addBackdrop(): void {
        const background = this.add.image(DESIGN_WIDTH / 2, DESIGN_HEIGHT, TEXTURES.titleBackground).setOrigin(0.5, 1);
        background.setScale(Math.max(DESIGN_WIDTH / background.width, DESIGN_HEIGHT / background.height));
        // Darken and vignette the backdrop only, so the UI on top stays bright.
        background.enableFilters();
        background.filters?.internal.addVignette(0.5, 0.5, 0.8, 0.6);
        this.add.rectangle(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, COLOURS.ink, 0.35).setOrigin(0);
    }

    private addTitle(): void {
        const title = addText(this, DESIGN_WIDTH / 2, 170, STRINGS.gameTitle, TYPE.hero, {
            role: 'display',
            bold: true,
            colour: '#ffffff',
            letterSpacing: 4,
        }).setOrigin(0.5);
        title.setTint(COLOURS.goldBright, COLOURS.goldBright, COLOURS.gold, COLOURS.gold);
        addText(this, DESIGN_WIDTH / 2, 262, STRINGS.tagline, TYPE.body, { colour: TEXT_COLOURS.muted }).setOrigin(0.5);
    }

    private addMimic(): void {
        this.add.ellipse(1520, GROUND_Y - 4, 190, 26, COLOURS.ink, 0.5);
        const chest = this.add.image(1520, GROUND_Y, TEXTURES.chestClosed).setOrigin(0.5, 1).setScale(0.75);
        // Placeholder idle: a slow breath. The full title-screen life comes in M4.
        this.tweens.add({ targets: chest, scaleY: 0.77, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }

    private addMenu(): void {
        const items = [
            STRINGS.menu.play,
            STRINGS.menu.howToPlay,
            STRINGS.menu.achievements,
            STRINGS.menu.highScores,
            STRINGS.menu.settings,
            STRINGS.menu.credits,
        ];
        const top = 390;
        const step = 84;
        addPanel(this, DESIGN_WIDTH / 2, top + ((items.length - 1) * step) / 2, 540, items.length * step + SPACE.xl);
        const buttons = items.map((label, i) => new Button(this, DESIGN_WIDTH / 2, top + i * step, label, {
            onSelect: () => this.showToast(`${label}: coming in a later milestone`),
        }));
        new Menu(this, buttons);
    }

    private addFooter(): void {
        addText(this, DESIGN_WIDTH / 2, DESIGN_HEIGHT - 56, STRINGS.keyHints, TYPE.small, { colour: TEXT_COLOURS.muted }).setOrigin(0.5);
        addText(this, SPACE.l, SPACE.l, STRINGS.previewNotice, TYPE.small, { colour: TEXT_COLOURS.muted });
    }

    private showToast(message: string): void {
        this.toast?.destroy();
        const text = addText(this, 0, 0, message, TYPE.small, { colour: TEXT_COLOURS.primary }).setOrigin(0.5);
        const panel = addPanel(this, 0, 0, text.width + SPACE.xl * 1.5, 72);
        const toast = this.add.container(DESIGN_WIDTH / 2, DESIGN_HEIGHT - 150, [panel, text]).setAlpha(0).setDepth(10);
        this.toast = toast;
        this.tweens.add({ targets: toast, alpha: 1, y: toast.y - 12, duration: MOTION.normal, ease: MOTION.ease });
        this.tweens.add({
            targets: toast,
            alpha: 0,
            delay: 1800,
            duration: MOTION.slow,
            onComplete: () => {
                toast.destroy();
                if (this.toast === toast) {
                    this.toast = null;
                }
            },
        });
    }
}
