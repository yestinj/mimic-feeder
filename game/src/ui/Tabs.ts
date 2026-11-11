import * as Phaser from 'phaser';
import { playSound } from '../audio';
import { DESIGN_WIDTH } from '../config';
import { COLOURS, MOTION, TEXT_COLOURS, TYPE } from '../theme';
import { onKeyDown } from './keys';
import { addText } from './text';

/** Anything that can be dimmed: an image, a container. */
export interface TabIcon {
    setAlpha(alpha: number): unknown;
}

export interface TabSpec {
    readonly label: string;
    /** A small picture before the label (a medal, a sprite), dimmed while its tab isn't shown. */
    readonly icon?: (scene: Phaser.Scene, x: number, y: number) => TabIcon;
    /** Something new on the tab: a dot by its label until it's shown. */
    readonly dot?: boolean;
}

const ICON_SIZE = 40;
const ICON_GAP = 12;

/**
 * A row of tabs, centred at `y`, with an underline that slides to the one
 * shown. ← → (or A D) and clicks change tab; `onShow` is called with the
 * new tab's index (and once for the first tab, from `show`).
 */
export class Tabs {
    private readonly labels: Phaser.GameObjects.Text[] = [];
    private readonly icons: (TabIcon | null)[] = [];
    private readonly dots: (Phaser.GameObjects.Arc | null)[] = [];
    private readonly underline: Phaser.GameObjects.Rectangle;
    private readonly left: number;
    private current = -1;

    constructor(
        private readonly scene: Phaser.Scene,
        y: number,
        private readonly tabWidth: number,
        specs: readonly TabSpec[],
        private readonly onShow: (index: number) => void,
    ) {
        this.left = DESIGN_WIDTH / 2 - (specs.length * tabWidth) / 2;
        specs.forEach((spec, i) => {
            const centre = this.centre(i);
            const label = addText(scene, 0, y, spec.label, TYPE.button, { role: 'display', bold: true }).setOrigin(0, 0.5);
            // The icon and label are centred together in the tab.
            const iconWidth = spec.icon ? ICON_SIZE + ICON_GAP : 0;
            const start = centre - (iconWidth + label.width) / 2;
            this.icons.push(spec.icon ? spec.icon(scene, start + ICON_SIZE / 2, y) : null);
            label.setX(start + iconWidth);
            this.labels.push(label);
            this.dots.push(spec.dot ? scene.add.circle(label.x + label.width + 12, y - 14, 7, COLOURS.goldBright).setStrokeStyle(2, COLOURS.ink, 0.9) : null);
            scene.add.zone(centre, y, tabWidth, 60)
                .setInteractive({ useHandCursor: true })
                .on(Phaser.Input.Events.POINTER_UP, () => this.show(i));
        });
        scene.add.rectangle(this.left, y + 34, specs.length * tabWidth, 2, COLOURS.goldDim, 0.5).setOrigin(0, 0.5);
        this.underline = scene.add.rectangle(this.centre(0), y + 34, tabWidth - 40, 4, COLOURS.gold).setOrigin(0.5);
        // One step per press: a held key would rebuild the page at the keyboard's repeat rate.
        onKeyDown(scene, ['LEFT', 'A'], () => this.step(-1));
        onKeyDown(scene, ['RIGHT', 'D'], () => this.step(1));
    }

    get index(): number {
        return this.current;
    }

    /** Shows tab `index`: the first call puts the underline straight there, later ones slide it. */
    show(index: number): void {
        const first = this.current === -1;
        this.current = index;
        this.labels.forEach((label, i) => label.setColor(i === index ? TEXT_COLOURS.gold : TEXT_COLOURS.muted));
        this.icons.forEach((icon, i) => icon?.setAlpha(i === index ? 1 : 0.55));
        this.dots[index]?.setVisible(false);
        if (first) {
            this.underline.setX(this.centre(index));
        } else {
            playSound(this.scene, 'uiTab');
            this.scene.tweens.add({ targets: this.underline, x: this.centre(index), duration: MOTION.fast, ease: MOTION.ease });
        }
        this.onShow(index);
    }

    private step(step: 1 | -1): void {
        const count = this.labels.length;
        this.show((this.current + step + count) % count);
    }

    private centre(index: number): number {
        return this.left + this.tabWidth * (index + 0.5);
    }
}
