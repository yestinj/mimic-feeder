import * as Phaser from 'phaser';
import { createAnimations, loadCoreAssets } from '../assets';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../config';
import { STRINGS } from '../strings';
import { COLOURS, TEXT_COLOURS, TYPE } from '../theme';
import { addPanel } from '../ui/kit';
import { addText } from '../ui/text';

/** The loading screen: a themed progress bar while Floor 1's assets load. */
export class PreloadScene extends Phaser.Scene {
    constructor() {
        super('preload');
    }

    preload(): void {
        const cx = DESIGN_WIDTH / 2;
        const cy = DESIGN_HEIGHT / 2;
        const barWidth = 520;
        const barHeight = 16;

        addPanel(this, cx, cy, barWidth + 96, 150);
        addText(this, cx, cy - 34, STRINGS.loading, TYPE.small, { role: 'display', colour: TEXT_COLOURS.gold }).setOrigin(0.5);
        const bar = this.add.graphics();
        const drawBar = (progress: number): void => {
            const left = cx - barWidth / 2;
            const top = cy + 12;
            bar.clear();
            bar.fillStyle(COLOURS.ink, 1).fillRoundedRect(left, top, barWidth, barHeight, barHeight / 2);
            bar.fillStyle(COLOURS.gold, 1).fillRoundedRect(left, top, Math.max(barHeight, barWidth * progress), barHeight, barHeight / 2);
        };
        drawBar(0);
        this.load.on(Phaser.Loader.Events.PROGRESS, drawBar);

        loadCoreAssets(this.load);
    }

    create(): void {
        createAnimations(this.anims);
        // Later floors load in the background from here on.
        this.scene.launch('system');
        this.scene.start('title');
    }
}
