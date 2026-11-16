import * as Phaser from 'phaser';
import { createAnimations, loadCoreAssets } from '../assets';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../config';
import { STRINGS } from '../strings';
import { markReady } from '../testHook';
import { COLOURS, SPACE, TEXT_COLOURS, TYPE } from '../theme';
import { Button } from '../ui/Button';
import { Menu } from '../ui/Menu';
import { addPanel } from '../ui/kit';
import { addText } from '../ui/text';

/**
 * The loading screen: a themed progress bar while Floor 1's assets load.
 * Files that fail are tried once more. If an image is still missing after
 * that the game can't run (it measures its sprites), so the screen says so
 * and offers to reload; a missing sound only means playing without it.
 */
export class PreloadScene extends Phaser.Scene {
    /** Files that failed in the pass under way. */
    private failed: Phaser.Loader.File[] = [];

    constructor() {
        super('preload');
    }

    preload(): void {
        this.failed = [];
        this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => this.failed.push(file));

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
        this.finish(false);
    }

    /** The loader has finished a pass: try what failed once more, then start the game or say it couldn't load. */
    private finish(retried: boolean): void {
        const missing = this.failed;
        this.failed = [];
        if (missing.length > 0 && !retried) {
            // Queuing everything again only adds what isn't loaded yet: the loader skips the rest.
            this.load.once(Phaser.Loader.Events.COMPLETE, () => this.finish(true));
            loadCoreAssets(this.load);
            this.load.start();
            return;
        }
        if (missing.some((file) => file.type === 'image')) {
            this.showLoadFailed();
            return;
        }
        for (const file of missing) {
            console.warn(`Could not load ${file.key}; playing without it.`);
        }
        createAnimations(this.anims);
        // Later floors load in the background from here on.
        this.scene.launch('system');
        this.scene.start('title');
    }

    /** In place of the progress bar: what went wrong, and a button that reloads the page (what did arrive is cached). */
    private showLoadFailed(): void {
        this.children.removeAll(true);
        const cx = DESIGN_WIDTH / 2;
        const cy = DESIGN_HEIGHT / 2;
        const text = STRINGS.loadFailed;
        addPanel(this, cx, cy, 820, 360);
        addText(this, cx, cy - 104, text.title, TYPE.heading, { role: 'display', bold: true, colour: TEXT_COLOURS.gold }).setOrigin(0.5);
        addText(this, cx, cy - 26, text.detail, TYPE.body, { colour: TEXT_COLOURS.primary, align: 'center', wrapWidth: 820 - 2 * SPACE.xl }).setOrigin(0.5);
        const reload = new Button(this, cx, cy + 92, text.reload, { width: 320, onSelect: () => window.location.reload() });
        new Menu(this, [reload]);
        markReady('loadFailed');
    }
}
