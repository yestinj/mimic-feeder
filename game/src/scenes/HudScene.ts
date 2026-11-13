import * as Phaser from 'phaser';
import { isMuted } from '../audio';
import { onProfileChange } from '../profile';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../config';
import { floorTitle } from '../rules/floors';
import { formatScore } from '../rules/format';
import { GROWTH, type Run, type RunEvent } from '../rules/run';
import { STRINGS } from '../strings';
import { PRACTICE_FLOOR, markReady } from '../testHook';
import { COLOURS, MOTION, SPACE, TEXT_COLOURS, TYPE } from '../theme';
import type { Ability } from '../rules/abilities';
import type { Achievement } from '../rules/achievements';
import { overlaps } from '../rules/contact';
import { AbilityBar } from '../ui/AbilityBar';
import { BossBar } from '../ui/BossBar';
import { JudgmentPanel } from '../ui/JudgmentPanel';
import type { JudgmentView } from '../game/Judgment';
import { Hearts } from '../ui/Hearts';
import { Notifications } from '../ui/Notifications';
import { ProgressBar } from '../ui/ProgressBar';
import { UI } from '../ui/kit';
import { addText } from '../ui/text';
import { RUN_EVENTS, type BossHealth, type GameScene } from './GameScene';

/** A gain in score this big gets the bigger bump (a crown or more). */
const BIG_GAIN = 50;

/** A growth factor as the percentage it adds: 1.05 → 5. */
function percentGain(factor: number): number {
    return Math.round((factor - 1) * 100);
}

const MARGIN = 48;
const XP_BAR_WIDTH = 300;
/** HUD blocks fade to this while the boss flies behind them. */
const COVERED_ALPHA = 0.3;

/** A group of HUD pieces that fades together while the boss is behind any of them. */
interface HudBlock {
    readonly parts: (Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.AlphaSingle & { getBounds(): Phaser.Geom.Rectangle })[];
    faded: boolean;
}

/**
 * The heads-up display over the playfield: score, floor and zone (top left),
 * hearts, level and XP (top right), the mute icon, and notifications. It only
 * redraws when the game scene reports a change.
 */
export class HudScene extends Phaser.Scene {
    private playfield!: GameScene;
    private run!: Run;
    private abilityBar!: AbilityBar;
    private bossBar!: BossBar;
    private judgmentPanel!: JudgmentPanel;
    private blocks: HudBlock[] = [];
    private scoreText!: Phaser.GameObjects.Text;
    private floorText!: Phaser.GameObjects.Text;
    private hearts!: Hearts;
    private xpBar!: ProgressBar;
    private badge!: Phaser.GameObjects.Container;
    private levelText!: Phaser.GameObjects.Text;
    private muteIcon!: Phaser.GameObjects.Image;
    private edgeGlow!: Phaser.GameObjects.Image;
    private notifications!: Notifications;
    private shownScore = 0;
    private shownLevel = 1;
    private scoreTween: Phaser.Tweens.Tween | null = null;
    /** The score's bump, kept apart: the score text is also faded with its block while the boss flies behind it. */
    private scoreBump: Phaser.Tweens.Tween | null = null;

    constructor() {
        super('hud');
    }

    create(): void {
        const game = this.scene.get('game') as GameScene;
        this.playfield = game;
        this.run = game.currentRun;
        this.shownScore = 0;
        this.shownLevel = this.run.level;
        this.scoreTween = null;

        this.addTopShade();
        this.addLowHealthGlow();
        this.blocks = [];
        this.addScore();
        this.addVitals();
        this.notifications = new Notifications(this);
        this.abilityBar = new AbilityBar(this, MARGIN, DESIGN_HEIGHT - 84);
        this.abilityBar.sync(game.abilityStates(), false);
        this.bossBar = new BossBar(this, DESIGN_WIDTH / 2, 24);
        this.judgmentPanel = new JudgmentPanel(this);

        const onEvent = (event: RunEvent): void => this.onRunEvent(event);
        const onChanged = (): void => this.refresh(true);
        const onOver = (): void => this.showGameOver();
        const onAbilityNotice = (ability: Ability): void => this.notifications.abilityToast(ability);
        const onJudgment = (view: JudgmentView | null): void => {
            // Other notices wait while the judgment runs; the five-cat warning it superseded is dropped.
            this.notifications.setHeld(view !== null);
            if (view) {
                this.notifications.discard('catWarning');
            }
            this.judgmentPanel.show(view);
        };
        const onBoss = (health: BossHealth | null): void => {
            this.bossBar.set(health);
            this.notifications.makeRoomForBossBar(health !== null);
        };
        game.events.on(RUN_EVENTS.event, onEvent);
        game.events.on(RUN_EVENTS.changed, onChanged);
        game.events.on(RUN_EVENTS.over, onOver);
        game.events.on(RUN_EVENTS.abilityNotice, onAbilityNotice);
        game.events.on(RUN_EVENTS.boss, onBoss);
        game.events.on(RUN_EVENTS.judgment, onJudgment);
        const onAchievement = (achievement: Achievement): void => this.notifications.achievementToast(achievement);
        game.events.on(RUN_EVENTS.achievement, onAchievement);
        const onNewBest = (best: number): void => this.notifications.toast(STRINGS.notices.newBest, STRINGS.notices.newBestDetail(formatScore(best)));
        game.events.on(RUN_EVENTS.newBest, onNewBest);
        // Muting (M, or Settings over the pause menu) is saved; the icon follows the save.
        const stopFollowingMute = onProfileChange((save) => this.muteIcon.setVisible(save.settings.muted));
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            game.events.off(RUN_EVENTS.event, onEvent);
            game.events.off(RUN_EVENTS.changed, onChanged);
            game.events.off(RUN_EVENTS.over, onOver);
            game.events.off(RUN_EVENTS.abilityNotice, onAbilityNotice);
            game.events.off(RUN_EVENTS.boss, onBoss);
            game.events.off(RUN_EVENTS.judgment, onJudgment);
            game.events.off(RUN_EVENTS.achievement, onAchievement);
            game.events.off(RUN_EVENTS.newBest, onNewBest);
            stopFollowingMute();
        });

        this.refresh(false);
        this.notifications.banner(floorTitle(this.run.floor));
        markReady('hud');
    }

    /** True while a banner (a new floor, a boss) is showing or queued. */
    get bannersBusy(): boolean {
        return this.notifications?.bannersBusy ?? false;
    }

    override update(): void {
        // Cooldowns change every frame; everything else waits for the game's events.
        this.abilityBar.sync(this.playfield.abilityStates(), true);
        this.abilityBar.setFaded(overlaps(this.playfield.mimicBounds(), this.abilityBar.bounds()));
        this.fadeBlocksUnderBoss();
    }

    /** The score and the hearts fade while the boss flies behind them, so it never vanishes. */
    private fadeBlocksUnderBoss(): void {
        const boss = this.playfield.bossBounds();
        for (const block of this.blocks) {
            const covered = boss !== null && block.parts.some((part) => overlaps(boss, part.getBounds()));
            if (covered !== block.faded) {
                block.faded = covered;
                this.tweens.add({ targets: block.parts, alpha: covered ? COVERED_ALPHA : 1, duration: MOTION.normal });
            }
        }
    }

    /** Darkens the top of the screen a little so the HUD reads on any background. */
    private addTopShade(): void {
        const shade = this.add.graphics();
        shade.fillGradientStyle(COLOURS.ink, COLOURS.ink, COLOURS.ink, COLOURS.ink, 0.6, 0.6, 0, 0);
        shade.fillRect(0, 0, DESIGN_WIDTH, 240);
    }

    private addLowHealthGlow(): void {
        this.edgeGlow = this.add.image(0, 0, UI.edgeGlow).setOrigin(0).setDisplaySize(DESIGN_WIDTH, DESIGN_HEIGHT).setAlpha(0);
        this.tweens.add({ targets: this.edgeGlow, alpha: { from: 0.25, to: 0.5 }, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.InOut', paused: true });
    }

    private addScore(): void {
        const label = addText(this, MARGIN, 34, 'SCORE', TYPE.tiny, { colour: TEXT_COLOURS.muted, letterSpacing: 4, bold: true });
        this.scoreText = addText(this, MARGIN, 56, '0', TYPE.title, { colour: TEXT_COLOURS.gold, bold: true });
        this.floorText = addText(this, MARGIN, 136, '', TYPE.small, { colour: TEXT_COLOURS.primary });
        if (PRACTICE_FLOOR !== null) {
            addText(this, MARGIN, 166, STRINGS.practice.hud, TYPE.small, { colour: TEXT_COLOURS.muted });
        }
        this.muteIcon = this.add.image(MARGIN + 22, 196, UI.soundOff).setVisible(isMuted());
        this.blocks.push({ parts: [label, this.scoreText, this.floorText, this.muteIcon], faded: false });
    }

    private addVitals(): void {
        const right = DESIGN_WIDTH - MARGIN;
        this.hearts = new Hearts(this, right - 26, 66);

        const badgeX = right - 44;
        const badgeY = 162;
        // Numbers use the text font (Barlow), whose digits sit centred in their box.
        this.levelText = addText(this, 0, 0, '1', TYPE.heading, { bold: true, colour: TEXT_COLOURS.gold, shadow: false }).setOrigin(0.5);
        this.badge = this.add.container(badgeX, badgeY, [this.add.image(0, 0, UI.badge), this.levelText]);
        this.xpBar = new ProgressBar(this, badgeX - 44 - SPACE.s - XP_BAR_WIDTH / 2, badgeY, XP_BAR_WIDTH, COLOURS.xp);
        const label = addText(this, badgeX - 44 - SPACE.s - XP_BAR_WIDTH, badgeY - 44, 'LEVEL', TYPE.tiny, { colour: TEXT_COLOURS.muted, letterSpacing: 4, bold: true });
        this.blocks.push({ parts: [this.hearts, this.badge, this.xpBar, label], faded: false });
    }

    /** Brings every number up to date with the run. */
    private refresh(animate: boolean): void {
        const run = this.run;
        this.floorText.setText(STRINGS.hud.floorZone(run.floor, run.zone));
        this.hearts.set(run.lives, run.maxLives, animate);
        this.updateLowHealth();

        const levelledUp = run.level > this.shownLevel;
        this.shownLevel = run.level;
        this.levelText.setText(String(run.level));
        this.xpBar.setProgress(run.xp / run.xpToNext, animate, levelledUp);
        if (animate && levelledUp) {
            this.tweens.add({ targets: this.badge, scale: { from: 1.3, to: 1 }, duration: MOTION.slow, ease: 'Back.Out' });
        }

        this.countScoreTo(run.score, animate);
    }

    private countScoreTo(score: number, animate: boolean): void {
        if (score === this.shownScore) {
            return;
        }
        this.scoreTween?.stop();
        if (!animate) {
            this.shownScore = score;
            this.scoreText.setText(formatScore(score));
            return;
        }
        this.scoreTween = this.tweens.addCounter({
            from: this.shownScore,
            to: score,
            duration: 420,
            ease: 'Cubic.Out',
            onUpdate: (tween) => {
                this.shownScore = Math.round(tween.getValue() ?? score);
                this.scoreText.setText(formatScore(this.shownScore));
            },
        });
        // A bump with every gain: a bigger one, flashing white, for treasure and other big hauls.
        const big = score - this.shownScore >= BIG_GAIN;
        this.scoreBump?.stop();
        this.scoreBump = this.tweens.add({ targets: this.scoreText, scale: { from: big ? 1.2 : 1.08, to: 1 }, duration: big ? MOTION.slow : MOTION.normal, ease: 'Back.Out' });
        if (big) {
            this.scoreText.setTint(0xffffff);
            this.time.delayedCall(MOTION.normal, () => this.scoreText.clearTint());
        }
    }

    private updateLowHealth(): void {
        const low = this.run.lives === 1;
        const pulse = this.tweens.getTweensOf(this.edgeGlow)[0];
        if (low && pulse?.paused) {
            pulse.resume();
        } else if (!low && pulse && !pulse.paused) {
            pulse.pause();
            this.edgeGlow.setAlpha(0);
        }
    }

    private onRunEvent(event: RunEvent): void {
        switch (event.type) {
            case 'zone':
                if (event.boss) {
                    this.notifications.bossCard(STRINGS.boss.name, STRINGS.notices.bossFight);
                } else if (event.newFloor) {
                    this.notifications.banner(floorTitle(event.floor));
                } else {
                    this.notifications.toast(STRINGS.notices.zone(event.zone));
                }
                break;
            case 'bossDefeated':
                this.notifications.banner(STRINGS.notices.bossDefeated);
                break;
            case 'catWarning':
                this.notifications.judgmentWarning(STRINGS.judgment.warningTitle, STRINGS.judgment.warningDetail);
                break;
            case 'levelUp':
                this.notifications.toast(STRINGS.notices.levelUp(event.level), STRINGS.notices.levelUpDetail(percentGain(GROWTH.speed), percentGain(GROWTH.size)), 'levelUp');
                break;
            case 'extraLife':
                this.notifications.toast(STRINGS.notices.extraLife, STRINGS.notices.extraLifeDetail);
                break;
            case 'tentaclesGrow':
                this.notifications.toast(STRINGS.notices.tentaclesGrow, STRINGS.notices.tentaclesGrowDetail(event.reach), 'tentacles');
                break;
            default:
                break;
        }
    }

    private showGameOver(): void {
        this.notifications.clear();
        const title = addText(this, DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2 - 40, STRINGS.gameOver.title, TYPE.hero, {
            role: 'display',
            bold: true,
            colour: '#ffffff',
            letterSpacing: 2,
        }).setOrigin(0.5).setAlpha(0).setScale(1.15);
        title.setTint(COLOURS.goldBright, COLOURS.goldBright, COLOURS.gold, COLOURS.gold);
        this.tweens.add({ targets: title, alpha: 1, scale: 1, duration: 700, ease: 'Cubic.Out' });
    }
}
