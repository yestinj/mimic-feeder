import * as Phaser from 'phaser';
import { TEXTURES, backgroundKey } from '../assets';
import { DESIGN_HEIGHT, DESIGN_WIDTH, GROUND_Y } from '../config';
import { warmUpRenderers } from '../game/warmUp';
import { profile } from '../profile';
import { formatScore } from '../rules/format';
import { STRINGS } from '../strings';
import { markReady } from '../testHook';
import { COLOURS, MOTION, SPACE, TEXT_COLOURS, TYPE } from '../theme';
import { Button } from '../ui/Button';
import { Menu } from '../ui/Menu';
import { addPanel } from '../ui/kit';
import { openScreen } from '../ui/screens';
import { addText } from '../ui/text';
import { showToast } from '../ui/toast';

/**
 * Title screen. Play starts a run, and Settings and High Scores open over
 * it; the other screens arrive in later milestones, and selecting them shows
 * a "coming later" note for now.
 */
export class TitleScene extends Phaser.Scene {
    private leaving = false;
    private profileText!: Phaser.GameObjects.Text;

    constructor() {
        super('title');
    }

    create(): void {
        this.leaving = false;
        this.cameras.main.fadeIn(MOTION.slow, 0, 0, 0);
        this.addBackdrop();
        this.addTitle();
        this.addMimic();
        this.addMenu();
        this.addFooter();
        this.addProfileLine();
        warmUpRenderers(this);
        markReady('title');
    }

    /** Floor 1's 4:3 background, cropped to fill 16:9 and anchored to the floor. */
    private addBackdrop(): void {
        const background = this.add.image(DESIGN_WIDTH / 2, DESIGN_HEIGHT, backgroundKey(0)).setOrigin(0.5, 1);
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
        const soon = (label: string) => () => showToast(this, STRINGS.comingLater(label));
        const items: { label: string; action: () => void }[] = [
            { label: STRINGS.menu.play, action: () => this.play() },
            { label: STRINGS.menu.howToPlay, action: soon(STRINGS.menu.howToPlay) },
            { label: STRINGS.menu.achievements, action: soon(STRINGS.menu.achievements) },
            { label: STRINGS.menu.highScores, action: () => openScreen(this, 'highScores', { from: 'title' }) },
            { label: STRINGS.menu.settings, action: () => openScreen(this, 'settings', { from: 'title' }) },
            { label: STRINGS.menu.credits, action: soon(STRINGS.menu.credits) },
        ];
        const top = 390;
        const step = 84;
        addPanel(this, DESIGN_WIDTH / 2, top + ((items.length - 1) * step) / 2, 540, items.length * step + SPACE.xl);
        const buttons = items.map((item, i) => new Button(this, DESIGN_WIDTH / 2, top + i * step, item.label, { onSelect: item.action }));
        new Menu(this, buttons);
    }

    /** The mimic's name and best score, once there's something to show. Settings can change both. */
    private addProfileLine(): void {
        this.profileText = addText(this, DESIGN_WIDTH - SPACE.l, SPACE.l, '', TYPE.small, { bold: true, colour: TEXT_COLOURS.gold }).setOrigin(1, 0);
        const refresh = (): void => {
            const save = profile();
            const best = save.bests.score > 0 ? formatScore(save.bests.score) : null;
            this.profileText.setText(save.named || best !== null ? STRINGS.profileLine(save.name, best) : '');
        };
        refresh();
        // The scene's event emitter outlives the scene, so the listener goes when it shuts down.
        this.events.on(Phaser.Scenes.Events.WAKE, refresh);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.WAKE, refresh));
    }

    private addFooter(): void {
        addText(this, DESIGN_WIDTH / 2, DESIGN_HEIGHT - 56, STRINGS.keyHints, TYPE.small, { colour: TEXT_COLOURS.muted }).setOrigin(0.5);
        addText(this, SPACE.l, SPACE.l, STRINGS.previewNotice, TYPE.small, { colour: TEXT_COLOURS.muted });
    }

    private play(): void {
        if (this.leaving) {
            return;
        }
        this.leaving = true;
        this.cameras.main.fadeOut(MOTION.normal, 0, 0, 0);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('game'));
    }
}
