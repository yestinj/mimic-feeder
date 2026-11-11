import * as Phaser from 'phaser';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../config';
import { profile } from '../profile';
import { ACHIEVEMENTS, TIER_POINTS, progress, showsProgress, unlockedCount, type Achievement, type Tier } from '../rules/achievements';
import { formatDate, formatPlayTime, formatScore } from '../rules/format';
import { addTotals, bestsWith } from '../rules/save';
import { STRINGS } from '../strings';
import { markReady } from '../testHook';
import { COLOURS, MOTION, TEXT_COLOURS, TYPE } from '../theme';
import { Button } from '../ui/Button';
import { Menu } from '../ui/Menu';
import { onKeyDown } from '../ui/keys';
import { closeScreen, startScreen, type ScreenData } from '../ui/screens';
import { addText } from '../ui/text';
import type { GameScene } from './GameScene';

type Tab = Tier | 'secret';
const TABS: readonly Tab[] = ['bronze', 'silver', 'gold', 'secret'];

/** Frame and medal colours by tier. */
export const TIER_COLOURS: Record<Tier, number> = { bronze: 0xc07a43, silver: 0xc9ced3, gold: COLOURS.gold };

const TAB_Y = 236;
const TAB_WIDTH = 300;
const COLUMNS = 3;
const CARD_WIDTH = 580;
const CARD_HEIGHT = 150;
const CARD_GAP_X = 30;
const CARD_GAP_Y = 14;
const CARDS_TOP = 296;
const MEDAL_RADIUS = 42;
const BAR_WIDTH = 150;

/** The achievements on a tab: the secret ones have their own, whatever their tier. */
function onTab(tab: Tab): Achievement[] {
    return ACHIEVEMENTS.filter((achievement) => (tab === 'secret' ? achievement.secret : !achievement.secret && achievement.tier === tab));
}

/**
 * The achievements: a grid of badge cards, a tab per tier and one for the
 * secrets, with overall progress in the header. Unlocked cards show their
 * date; locked ones are dimmed and, where they count something, show how far
 * along they are. Secrets show as "???" until earned.
 */
export class AchievementsScene extends Phaser.Scene {
    private screen!: ScreenData;
    private leaving = false;
    private tab: Tab = 'bronze';
    private tabLabels: Phaser.GameObjects.Text[] = [];
    private tabUnderline!: Phaser.GameObjects.Rectangle;
    private cards: Phaser.GameObjects.Container[] = [];

    constructor() {
        super('achievements');
    }

    create(data: ScreenData): void {
        this.screen = data;
        this.leaving = false;
        this.tab = 'bronze';
        this.cards = [];
        startScreen(this, data);

        const unlocked = profile().achievements;
        addText(this, DESIGN_WIDTH / 2, 95, STRINGS.achievements.title, TYPE.title, { role: 'display', bold: true, colour: TEXT_COLOURS.gold }).setOrigin(0.5);
        addText(this, DESIGN_WIDTH / 2, 160, STRINGS.achievements.header(unlockedCount(unlocked), ACHIEVEMENTS.length), TYPE.body, { bold: true }).setOrigin(0.5);
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

    /** The tab row: each tier's name and how many of it are unlocked. */
    private addTabs(unlocked: Readonly<Record<string, string>>): void {
        const left = DESIGN_WIDTH / 2 - (TABS.length * TAB_WIDTH) / 2;
        this.tabLabels = TABS.map((tab, i) => {
            const list = onTab(tab);
            const done = list.filter(({ id }) => id in unlocked).length;
            const label = addText(this, left + TAB_WIDTH * (i + 0.5), TAB_Y, `${STRINGS.achievements.tabs[tab]}  ${done}/${list.length}`, TYPE.button, { role: 'display', bold: true })
                .setOrigin(0.5)
                .setInteractive({ useHandCursor: true });
            label.on(Phaser.Input.Events.POINTER_UP, () => this.showTab(tab));
            return label;
        });
        this.add.rectangle(left, TAB_Y + 30, TABS.length * TAB_WIDTH, 2, COLOURS.goldDim, 0.5).setOrigin(0, 0.5);
        this.tabUnderline = this.add.rectangle(0, TAB_Y + 30, TAB_WIDTH - 40, 4, COLOURS.gold).setOrigin(0.5);
    }

    private stepTab(step: 1 | -1): void {
        const index = TABS.indexOf(this.tab);
        this.showTab(TABS[(index + step + TABS.length) % TABS.length] ?? 'bronze');
    }

    private showTab(tab: Tab): void {
        this.tab = tab;
        const index = TABS.indexOf(tab);
        this.tabLabels.forEach((label, i) => label.setColor(i === index ? TEXT_COLOURS.gold : TEXT_COLOURS.muted));
        const active = this.tabLabels[index];
        if (active) {
            this.tweens.add({ targets: this.tabUnderline, x: active.x, duration: MOTION.fast, ease: MOTION.ease });
        }
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
        const left = -CARD_WIDTH / 2;
        const textX = left + 2 * MEDAL_RADIUS + 44;

        const frame = this.add.graphics()
            .fillStyle(COLOURS.stone, 0.96)
            .fillRoundedRect(left, -CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT, 14)
            .lineStyle(3, unlocked ? tierColour : COLOURS.iron, 1)
            .strokeRoundedRect(left, -CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT, 14);
        const medalX = left + 22 + MEDAL_RADIUS;
        const medal = this.add.circle(medalX, 0, MEDAL_RADIUS, unlocked ? tierColour : COLOURS.stoneLight).setStrokeStyle(3, unlocked ? COLOURS.ink : tierColour, unlocked ? 0.6 : 0.8);
        const medalText = addText(this, medalX, 0, hidden ? '?' : text.points(TIER_POINTS[achievement.tier]), TYPE.small, {
            bold: true,
            colour: unlocked ? '#1a1411' : TEXT_COLOURS.muted,
            shadow: !unlocked,
        }).setOrigin(0.5);

        const name = addText(this, textX, -46, hidden ? text.secretName : (text.list[achievement.id]?.name ?? achievement.id), TYPE.body, {
            bold: true,
            colour: unlocked ? TEXT_COLOURS.gold : TEXT_COLOURS.primary,
        }).setOrigin(0, 0.5);
        const description = addText(this, textX, -26, hidden ? text.secretDescription : (text.list[achievement.id]?.description ?? ''), TYPE.small, {
            colour: TEXT_COLOURS.muted,
            wrapWidth: CARD_WIDTH / 2 - textX - 20,
        });
        const parts: Phaser.GameObjects.GameObject[] = [frame, medal, medalText, name, description];

        const footY = 46;
        if (unlocked) {
            parts.push(addText(this, textX, footY, text.unlockedOn(formatDate(unlockedOn)), TYPE.tiny, { bold: true, colour: TEXT_COLOURS.gold }).setOrigin(0, 0.5));
        } else if (showsProgress(achievement)) {
            const format = achievement.stat === 'longestRun' ? formatPlayTime : formatScore;
            parts.push(addText(this, textX, footY, text.progress(text.stats[achievement.stat], format(value), format(achievement.goal)), TYPE.tiny, { colour: TEXT_COLOURS.primary }).setOrigin(0, 0.5));
            const barX = CARD_WIDTH / 2 - 24 - BAR_WIDTH;
            parts.push(this.add.rectangle(barX, footY, BAR_WIDTH, 10, COLOURS.iron).setOrigin(0, 0.5));
            if (value > 0) {
                parts.push(this.add.rectangle(barX, footY, BAR_WIDTH * (value / achievement.goal), 10, tierColour).setOrigin(0, 0.5));
            }
        } else {
            parts.push(addText(this, textX, footY, text.locked, TYPE.tiny, { colour: TEXT_COLOURS.dim }).setOrigin(0, 0.5));
        }

        const card = this.add.container(x, y, parts);
        if (!unlocked) {
            // Locked cards are dimmed, but stay readable.
            [medal, medalText, name, description].forEach((part) => part.setAlpha(0.7));
        }
        return card;
    }

    private close(): void {
        if (this.leaving) {
            return;
        }
        this.leaving = true;
        closeScreen(this, this.screen);
    }
}
