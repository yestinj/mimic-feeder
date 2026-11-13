import * as Phaser from 'phaser';
import { TEXTURES, backgroundKey } from '../assets';
import { DESIGN_HEIGHT, DESIGN_WIDTH, GROUND_Y } from '../config';
import { playSound } from '../audio';
import { Ambience } from '../game/ambience';
import { warmUpRenderers } from '../game/warmUp';
import { prefersReducedMotion } from '../motion';
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

/** When the mimic first lifts its lid on the title, and how long between looks after that (ms). */
const LID_FIRST_MS = { min: 1500, max: 3000 } as const;
const LID_EVERY_MS = { min: 6000, max: 11000 } as const;
/** How often a look is only a peek, the lid never opening all the way. */
const LID_PEEK_ONLY = 0.3;
/** How long the lid rests ajar on the way back down (ms). */
const LID_SETTLE_MS = 250;
/** The How to Play nudge stops after this many runs, even if it was never opened. */
const NUDGE_RUNS = 3;
/** Draw order: the backdrop, then the torchlight and dust, then everything else. */
const DEPTH = { backdrop: -3, air: -2 } as const;

/**
 * Title screen. Play starts a run; How to Play, Achievements, High Scores,
 * Settings and Credits open over it. It has some life: torchlight and dust,
 * and the mimic breathing, now and then lifting its lid for a look round.
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
        // Floor 1's air: its torches' light, and dust drifting through it.
        new Ambience(this, DEPTH.air).setFloor(1, 0);
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
        // A slow breath (on scaleY, so the hop below moves y and angle instead).
        this.tweens.add({ targets: chest, scaleY: 0.77, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
        // Now and then the lid lifts for a peek; most times it then flips open with a hop and a wiggle,
        // has a look round, and settles back down.
        const close = (): void => {
            chest.setTexture(TEXTURES.chestAjar);
            this.time.delayedCall(LID_SETTLE_MS, () => {
                chest.setTexture(TEXTURES.chestClosed);
                playSound(this, 'lidShut');
                this.time.delayedCall(Phaser.Math.Between(LID_EVERY_MS.min, LID_EVERY_MS.max), look);
            });
        };
        const look = (): void => {
            chest.setTexture(TEXTURES.chestAjar);
            playSound(this, 'lidLift');
            if (Math.random() < LID_PEEK_ONLY) {
                this.time.delayedCall(Phaser.Math.Between(700, 1100), close);
                return;
            }
            this.time.delayedCall(Phaser.Math.Between(300, 450), () => {
                chest.setTexture(TEXTURES.chestOpen);
                playSound(this, 'lidOpen');
                if (!prefersReducedMotion()) {
                    this.tweens.add({ targets: chest, y: GROUND_Y - 14, duration: 140, yoyo: true, ease: 'Quad.Out' });
                    this.tweens.add({ targets: chest, angle: { from: -3, to: 3 }, duration: 90, yoyo: true, repeat: 1, onComplete: () => chest.setAngle(0) });
                }
                this.time.delayedCall(Phaser.Math.Between(700, 1000), close);
            });
        };
        this.time.delayedCall(Phaser.Math.Between(LID_FIRST_MS.min, LID_FIRST_MS.max), look);
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
        // A nudge towards How to Play, until it's been opened (or a few runs have been played without it).
        // Checked again on waking: How to Play opens over the title, and Settings can erase the save.
        let nudge: Phaser.GameObjects.Container | null = null;
        const showNudge = (): void => {
            const save = profile();
            const wanted = !save.howToPlayOpened && save.totals.runs < NUDGE_RUNS;
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
