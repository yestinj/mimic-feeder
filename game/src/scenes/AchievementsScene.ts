import * as Phaser from 'phaser';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../config';
import { prefersReducedMotion } from '../motion';
import { profile, updateProfile } from '../profile';
import {
    ACHIEVEMENTS,
    TIER_POINTS,
    markAchievementsSeen,
    pointsEarned,
    progress,
    showsProgress,
    unlockedCount,
    unseenAchievements,
    type Achievement,
    type Tier,
} from '../rules/achievements';
import { formatDate, formatPlayTime, formatScore } from '../rules/format';
import { addTotals, bestsWith } from '../rules/save';
import { STRINGS } from '../strings';
import { markReady } from '../testHook';
import { COLOURS, MOTION, TEXT_COLOURS, TYPE } from '../theme';
import { Button } from '../ui/Button';
import { addMedal, addTabMedal, TIER_COLOURS, TIER_TEXT_COLOURS } from '../ui/Medal';
import { Menu } from '../ui/Menu';
import { ProgressBar } from '../ui/ProgressBar';
import { addPanel } from '../ui/kit';
import { onKeyDown } from '../ui/keys';
import { closeScreen, startScreen, type ScreenData } from '../ui/screens';
import { addText } from '../ui/text';
import type { GameScene } from './GameScene';

type Tab = Tier | 'secret';
const TABS: readonly Tab[] = ['bronze', 'silver', 'gold', 'secret'];

const SUMMARY_Y = 146;
const SUMMARY_BAR_Y = 188;
const SUMMARY_BAR_WIDTH = 640;
const TAB_Y = 252;
const TAB_WIDTH = 300;
const TAB_MEDAL = 40;
const COLUMNS = 3;
const CARD_WIDTH = 580;
const CARD_HEIGHT = 144;
const CARD_GAP_X = 30;
const CARD_GAP_Y = 12;
const CARDS_TOP = 306;
const CARD_PADDING = 20;
const CARD_RADIUS = 14;
const MEDAL_SIZE = 104;
/** Room for a progress count ("6,200 / 20,000") at the end of a card's bar, so the bars line up. */
const COUNT_WIDTH = 140;
/** Where a card's text starts, from its left edge. */
const TEXT_INSET = CARD_PADDING + MEDAL_SIZE + 22;

/** The achievements on a tab: the secret ones have their own, whatever their tier. */
function onTab(tab: Tab): Achievement[] {
    return ACHIEVEMENTS.filter((achievement) => (tab === 'secret' ? achievement.secret : !achievement.secret && achievement.tier === tab));
}

/**
 * The achievements: a grid of medal cards, a tab per tier and one for the
 * secrets, with overall progress in the header. Earned medals are in their
 * tier's metal, with the date they were earned; locked ones are dark iron
 * and, where they count something, show how far along they are. Secrets
 * show as "???", with a hint, until earned. Anything unlocked since the
 * screen was last open is marked "New" (and its tab has a dot), and the
 * screen opens on the first tab with something new.
 */
export class AchievementsScene extends Phaser.Scene {
    private screen!: ScreenData;
    private leaving = false;
    private tab: Tab = 'bronze';
    private tabs: { label: Phaser.GameObjects.Text; medal: Phaser.GameObjects.Container; dot: Phaser.GameObjects.Arc | null }[] = [];
    private tabUnderline!: Phaser.GameObjects.Rectangle;
    private cards: Phaser.GameObjects.Container[] = [];
    /** Unlocked since the screen was last open: marked "New" for this visit. */
    private unseen = new Set<string>();
    private pulses: Phaser.Tweens.Tween[] = [];

    constructor() {
        super('achievements');
    }

    create(data: ScreenData): void {
        this.screen = data;
        this.leaving = false;
        this.cards = [];
        this.pulses = [];
        startScreen(this, data);

        const unlocked = profile().achievements;
        this.unseen = new Set(unseenAchievements(profile()));
        if (this.unseen.size > 0) {
            updateProfile(markAchievementsSeen);
        }
        this.tab = TABS.find((tab) => this.hasUnseen(tab)) ?? 'bronze';
        addText(this, DESIGN_WIDTH / 2, 80, STRINGS.achievements.title, TYPE.title, { role: 'display', bold: true, colour: TEXT_COLOURS.gold }).setOrigin(0.5);
        this.addSummary(unlocked);
        this.addTabs(unlocked);
        this.showTab(this.tab);

        const back = new Button(this, DESIGN_WIDTH / 2, 990, STRINGS.achievements.back, { width: 360, onSelect: () => this.close() });
        new Menu(this, [back]);
        addText(this, DESIGN_WIDTH / 2, DESIGN_HEIGHT - 28, STRINGS.achievements.hint, TYPE.tiny, { colour: TEXT_COLOURS.muted }).setOrigin(0.5);
        onKeyDown(this, ['LEFT', 'A'], () => this.stepTab(-1), { repeat: true });
        onKeyDown(this, ['RIGHT', 'D'], () => this.stepTab(1), { repeat: true });
        onKeyDown(this, ['ESC', 'BACKSPACE'], () => this.close());

        this.cameras.main.fadeIn(MOTION.fast, 0, 0, 0);
        markReady('achievements');
    }

    /** How many are unlocked, the score they've earned, and a bar for the whole set. */
    private addSummary(unlocked: Readonly<Record<string, string>>): void {
        const count = unlockedCount(unlocked);
        addText(this, DESIGN_WIDTH / 2, SUMMARY_Y, STRINGS.achievements.header(count, ACHIEVEMENTS.length, pointsEarned(unlocked)), TYPE.body, { bold: true })
            .setOrigin(0.5);
        new ProgressBar(this, DESIGN_WIDTH / 2, SUMMARY_BAR_Y, SUMMARY_BAR_WIDTH, COLOURS.gold).setProgress(count / ACHIEVEMENTS.length, false);
    }

    /** The tab row: each tier's medal, name and how many of it are unlocked. */
    private addTabs(unlocked: Readonly<Record<string, string>>): void {
        const left = DESIGN_WIDTH / 2 - (TABS.length * TAB_WIDTH) / 2;
        this.tabs = TABS.map((tab, i) => {
            const list = onTab(tab);
            const done = list.filter(({ id }) => id in unlocked).length;
            const centre = left + TAB_WIDTH * (i + 0.5);
            const label = addText(this, 0, TAB_Y, `${STRINGS.achievements.tabs[tab]}  ${done}/${list.length}`, TYPE.button, { role: 'display', bold: true })
                .setOrigin(0, 0.5);
            // The medal and label are centred together in the tab.
            const gap = 12;
            const start = centre - (TAB_MEDAL + gap + label.width) / 2;
            const medal = addTabMedal(this, start + TAB_MEDAL / 2, TAB_Y, tab, TAB_MEDAL);
            label.setX(start + TAB_MEDAL + gap);
            // Something new on this tab: a dot until it's looked at.
            const dot = this.hasUnseen(tab) ? this.add.circle(label.x + label.width + 12, TAB_Y - 14, 7, COLOURS.goldBright).setStrokeStyle(2, COLOURS.ink, 0.9) : null;
            this.add.zone(centre, TAB_Y, TAB_WIDTH, 60)
                .setInteractive({ useHandCursor: true })
                .on(Phaser.Input.Events.POINTER_UP, () => this.showTab(tab));
            return { label, medal, dot };
        });
        this.add.rectangle(left, TAB_Y + 34, TABS.length * TAB_WIDTH, 2, COLOURS.goldDim, 0.5).setOrigin(0, 0.5);
        const x = left + TAB_WIDTH * (TABS.indexOf(this.tab) + 0.5);
        this.tabUnderline = this.add.rectangle(x, TAB_Y + 34, TAB_WIDTH - 40, 4, COLOURS.gold).setOrigin(0.5);
    }

    private hasUnseen(tab: Tab): boolean {
        return onTab(tab).some(({ id }) => this.unseen.has(id));
    }

    private stepTab(step: 1 | -1): void {
        const index = TABS.indexOf(this.tab);
        this.showTab(TABS[(index + step + TABS.length) % TABS.length] ?? 'bronze');
    }

    private showTab(tab: Tab): void {
        this.tab = tab;
        const index = TABS.indexOf(tab);
        this.tabs.forEach(({ label, medal, dot }, i) => {
            label.setColor(i === index ? TEXT_COLOURS.gold : TEXT_COLOURS.muted);
            medal.setAlpha(i === index ? 1 : 0.55);
            if (i === index) {
                dot?.setVisible(false);
            }
        });
        const left = DESIGN_WIDTH / 2 - (TABS.length * TAB_WIDTH) / 2;
        this.tweens.add({ targets: this.tabUnderline, x: left + TAB_WIDTH * (index + 0.5), duration: MOTION.fast, ease: MOTION.ease });

        this.pulses.forEach((pulse) => pulse.remove());
        this.pulses = [];
        this.cards.forEach((card) => card.destroy());
        const save = profile();
        // Opened during a run, progress includes the run so far (it's saved when the run ends).
        const duringRun = this.screen.from === 'pause' || this.screen.from === 'game';
        const run = duringRun ? (this.scene.get('game') as GameScene).currentRun.record() : null;
        const totals = run ? addTotals(save.totals, run.totals) : save.totals;
        const bests = run ? bestsWith(save.bests, run) : save.bests;
        const gridLeft = DESIGN_WIDTH / 2 - (COLUMNS * CARD_WIDTH + (COLUMNS - 1) * CARD_GAP_X) / 2;
        this.cards = onTab(tab).map((achievement, i) => {
            const x = gridLeft + (i % COLUMNS) * (CARD_WIDTH + CARD_GAP_X) + CARD_WIDTH / 2;
            const y = CARDS_TOP + Math.floor(i / COLUMNS) * (CARD_HEIGHT + CARD_GAP_Y) + CARD_HEIGHT / 2;
            return this.addCard(x, y, achievement, save.achievements[achievement.id] ?? null, progress(achievement, totals, bests));
        });
    }

    private addCard(x: number, y: number, achievement: Achievement, unlockedOn: string | null, value: number): Phaser.GameObjects.Container {
        const unlocked = unlockedOn !== null;
        const hidden = achievement.secret === true && !unlocked;
        const text = STRINGS.achievements;
        const tierColour = TIER_COLOURS[achievement.tier];
        const tierText = TIER_TEXT_COLOURS[achievement.tier];
        const left = -CARD_WIDTH / 2;
        const right = CARD_WIDTH / 2;
        const top = -CARD_HEIGHT / 2;
        const textX = left + TEXT_INSET;
        const parts: Phaser.GameObjects.GameObject[] = [addPanel(this, 0, 0, CARD_WIDTH, CARD_HEIGHT)];

        if (unlocked) {
            // Earned: framed in its tier's metal.
            parts.push(this.add.graphics().lineStyle(3, tierColour, 1).strokeRoundedRect(left + 1.5, top + 1.5, CARD_WIDTH - 3, CARD_HEIGHT - 3, CARD_RADIUS));
        } else {
            // Not yet: the card sinks back into the dark.
            parts.push(this.add.graphics().fillStyle(COLOURS.ink, 0.45).fillRoundedRect(left, top, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS));
        }
        parts.push(addMedal(this, left + CARD_PADDING + MEDAL_SIZE / 2, 0, achievement, unlocked ? 'unlocked' : hidden ? 'hidden' : 'locked', MEDAL_SIZE));

        // The score it's worth, in a tag at the top right.
        const nameY = top + 30;
        const points = addText(this, right - CARD_PADDING - 12, nameY, text.points(TIER_POINTS[achievement.tier]), TYPE.tiny, {
            bold: true,
            colour: unlocked ? tierText : TEXT_COLOURS.dim,
            shadow: false,
        }).setOrigin(1, 0.5);
        const tagWidth = points.width + 24;
        const tag = this.add.graphics()
            .fillStyle(COLOURS.ink, 0.7)
            .fillRoundedRect(right - CARD_PADDING - tagWidth, nameY - 14, tagWidth, 28, 14)
            .lineStyle(1.5, unlocked ? tierColour : COLOURS.iron, 1)
            .strokeRoundedRect(right - CARD_PADDING - tagWidth, nameY - 14, tagWidth, 28, 14);
        parts.push(tag, points);

        const name = addText(this, textX, nameY, hidden ? text.secretName : (text.list[achievement.id]?.name ?? achievement.id), TYPE.body, {
            bold: true,
            colour: unlocked ? tierText : TEXT_COLOURS.primary,
        }).setOrigin(0, 0.5);
        const entry = text.list[achievement.id];
        const description = addText(this, textX, nameY + 18, (hidden ? entry?.hint : entry?.description) ?? '', TYPE.small, {
            colour: TEXT_COLOURS.muted,
            wrapWidth: right - CARD_PADDING - textX,
        });
        if (!unlocked) {
            name.setAlpha(0.8);
        }
        parts.push(name, description);

        const footY = CARD_HEIGHT / 2 - 30;
        if (unlocked) {
            parts.push(addText(this, textX, footY, text.unlockedOn(formatDate(unlockedOn)), TYPE.tiny, { bold: true, colour: tierText }).setOrigin(0, 0.5));
        } else if (showsProgress(achievement)) {
            const format = achievement.stat === 'longestRun' ? formatPlayTime : formatScore;
            const count = addText(this, right - CARD_PADDING, footY, text.progress(format(value), format(achievement.goal)), TYPE.tiny, { bold: true })
                .setOrigin(1, 0.5);
            const barWidth = right - CARD_PADDING - COUNT_WIDTH - textX;
            const bar = new ProgressBar(this, textX + barWidth / 2, footY, barWidth, tierColour);
            bar.setProgress(value / achievement.goal, false);
            parts.push(bar, count);
        } else {
            parts.push(addText(this, textX, footY, text.locked, TYPE.tiny, { colour: TEXT_COLOURS.dim }).setOrigin(0, 0.5));
        }

        if (this.unseen.has(achievement.id)) {
            parts.push(this.addNewTag(left + CARD_PADDING + MEDAL_SIZE / 2, MEDAL_SIZE / 2 - 6));
        }
        return this.add.container(x, y, parts);
    }

    /** A "New" tag across the bottom of a medal, pulsing gently (unless motion is reduced). */
    private addNewTag(x: number, y: number): Phaser.GameObjects.Container {
        const label = addText(this, 0, 0, STRINGS.achievements.new, TYPE.tiny, { bold: true, colour: TEXT_COLOURS.shadow, shadow: false })
            .setOrigin(0.5);
        const width = label.width + 24;
        const pill = this.add.graphics()
            .fillStyle(COLOURS.goldBright, 1)
            .fillRoundedRect(-width / 2, -13, width, 26, 13)
            .lineStyle(2, COLOURS.ink, 0.9)
            .strokeRoundedRect(-width / 2, -13, width, 26, 13);
        const tag = this.add.container(x, y, [pill, label]);
        if (!prefersReducedMotion()) {
            this.pulses.push(this.tweens.add({ targets: tag, scale: 1.08, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.InOut' }));
        }
        return tag;
    }

    private close(): void {
        if (this.leaving) {
            return;
        }
        this.leaving = true;
        closeScreen(this, this.screen);
    }
}
