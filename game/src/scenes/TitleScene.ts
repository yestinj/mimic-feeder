import * as Phaser from 'phaser';
import { TEXTURES, backgroundKey } from '../assets';
import { DESIGN_HEIGHT, DESIGN_WIDTH, GROUND_Y } from '../config';
import { playSound } from '../audio';
import { Ambience, FLOOR_1_TORCHES } from '../game/ambience';
import { warmUpRenderers } from '../game/warmUp';
import { profile } from '../profile';
import { formatScore } from '../rules/format';
import { STRINGS } from '../strings';
import { markReady } from '../testHook';
import { COLOURS, MOTION, SPACE, TEXT_COLOURS, TYPE } from '../theme';
import { Button } from '../ui/Button';
import { Menu } from '../ui/Menu';
import { addPulsingTag } from '../ui/NewTag';
import { addPanel } from '../ui/kit';
import { openScreen } from '../ui/screens';
import { addText } from '../ui/text';

/** How often the mimic's lid creaks open on the title (ms between looks). */
const LID_EVERY_MS = { min: 6000, max: 11000 } as const;
/** Draw order: the backdrop, then the torchlight and dust, then everything else. */
const DEPTH = { backdrop: -3, air: -2 } as const;

/**
 * Title screen. Play starts a run; How to Play, Achievements, High Scores,
 * Settings and Credits open over it. It has some life: torchlight and dust,
 * and the mimic breathing, its lid creaking open now and then.
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
        const background = this.add.image(DESIGN_WIDTH / 2, DESIGN_HEIGHT, backgroundKey(0)).setOrigin(0.5, 1).setDepth(DEPTH.backdrop);
        background.setScale(Math.max(DESIGN_WIDTH / background.width, DESIGN_HEIGHT / background.height));
        // Darken and vignette the backdrop only, so the UI on top stays bright.
        background.enableFilters();
        background.filters?.internal.addVignette(0.5, 0.5, 0.8, 0.6);
        this.add.rectangle(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, COLOURS.ink, 0.35).setOrigin(0).setDepth(DEPTH.backdrop);
        // Torchlight, and dust drifting through it.
        new Ambience(this, DEPTH.air, FLOOR_1_TORCHES);
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
        // A slow breath, and now and then the lid creaks open for a look round.
        this.tweens.add({ targets: chest, scaleY: 0.77, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
        const creak = (): void => {
            chest.setTexture(TEXTURES.chestAjar);
            playSound(this, 'titleCreak');
            this.time.delayedCall(Phaser.Math.Between(700, 1200), () => {
                chest.setTexture(TEXTURES.chestClosed);
                this.time.delayedCall(Phaser.Math.Between(LID_EVERY_MS.min, LID_EVERY_MS.max), creak);
            });
        };
        this.time.delayedCall(Phaser.Math.Between(2500, 4500), creak);
    }

    private addMenu(): void {
        const items: { label: string; action: () => void }[] = [
            { label: STRINGS.menu.play, action: () => this.play() },
            { label: STRINGS.menu.howToPlay, action: () => openScreen(this, 'howToPlay', { from: 'title' }) },
            { label: STRINGS.menu.achievements, action: () => openScreen(this, 'achievements', { from: 'title' }) },
            { label: STRINGS.menu.highScores, action: () => openScreen(this, 'highScores', { from: 'title' }) },
            { label: STRINGS.menu.settings, action: () => openScreen(this, 'settings', { from: 'title' }) },
            { label: STRINGS.menu.credits, action: () => openScreen(this, 'credits', { from: 'title' }) },
        ];
        const top = 390;
        const step = 84;
        addPanel(this, DESIGN_WIDTH / 2, top + ((items.length - 1) * step) / 2, 540, items.length * step + SPACE.xl);
        const buttons = items.map((item, i) => new Button(this, DESIGN_WIDTH / 2, top + i * step, item.label, { onSelect: item.action }));
        new Menu(this, buttons);
        // Until a first run has been played, a nudge towards How to Play. Checked again on waking:
        // erasing the save in Settings (opened over the title) makes it a first run again.
        let nudge: Phaser.GameObjects.Container | null = null;
        const showNudge = (): void => {
            const wanted = profile().totals.runs === 0;
            if (wanted && !nudge) {
                nudge = addPulsingTag(this, DESIGN_WIDTH / 2 + 350, top + step, STRINGS.newHere);
            } else if (!wanted && nudge) {
                nudge.destroy();
                nudge = null;
            }
        };
        showNudge();
        this.events.on(Phaser.Scenes.Events.WAKE, showNudge);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.WAKE, showNudge));
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
