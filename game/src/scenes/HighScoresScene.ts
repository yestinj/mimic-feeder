import * as Phaser from 'phaser';
import { TEXTURES } from '../assets';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../config';
import { profile } from '../profile';
import type { Tier } from '../rules/achievements';
import { formatDate, formatPlayTime, formatScore } from '../rules/format';
import type { HighScore } from '../rules/save';
import { STRINGS } from '../strings';
import { markReady } from '../testHook';
import { COLOURS, MOTION, SPACE, TEXT_COLOURS, TYPE } from '../theme';
import { Button } from '../ui/Button';
import { TIER_COLOURS, TIER_TEXT_COLOURS } from '../ui/Medal';
import { Menu } from '../ui/Menu';
import { UI, addPanel } from '../ui/kit';
import { onKeyDown } from '../ui/keys';
import { closeScreen, startScreen, type ScreenData } from '../ui/screens';
import { addText } from '../ui/text';

/** The podium: first in the middle and highest, second on the left, third on the right. */
const PODIUM: readonly { readonly place: number; readonly tier: Tier; readonly x: number; readonly top: number; readonly width: number; readonly height: number }[] = [
    { place: 2, tier: 'silver', x: DESIGN_WIDTH / 2 - 560, top: 236, width: 500, height: 256 },
    { place: 1, tier: 'gold', x: DESIGN_WIDTH / 2, top: 196, width: 560, height: 296 },
    { place: 3, tier: 'bronze', x: DESIGN_WIDTH / 2 + 560, top: 236, width: 500, height: 256 },
];
const MEDAL_TEXTURES: Record<Tier, string> = { gold: UI.medalGold, silver: UI.medalSilver, bronze: UI.medalBronze };

const TABLE_WIDTH = 1620;
const TABLE_TOP = 514;
const TABLE_HEIGHT = 420;
const ROW_HEIGHT = 46;
const TABLE_LEFT = DESIGN_WIDTH / 2 - TABLE_WIDTH / 2 + SPACE.xl;
const TABLE_INNER = TABLE_WIDTH - 2 * SPACE.xl;
const HEADER_Y = TABLE_TOP + 40;
const FIRST_ROW_Y = HEADER_Y + 52;

/** Where each table column sits (x from the table's left) and how it aligns. */
const COLUMNS = {
    rank: { x: 24, origin: 0.5 },
    name: { x: 90, origin: 0 },
    score: { x: 720, origin: 1 },
    place: { x: 880, origin: 0.5 },
    level: { x: 1040, origin: 0.5 },
    time: { x: 1200, origin: 0.5 },
    date: { x: TABLE_INNER - 8, origin: 1 },
} as const;

/**
 * The top 10 (plan §3.5): the first three on a podium with their medals,
 * the rest in a table below; name, score, floor and zone, level, time and
 * date for each, and the latest entry highlighted.
 */
export class HighScoresScene extends Phaser.Scene {
    private screen!: ScreenData;
    private leaving = false;

    constructor() {
        super('highScores');
    }

    create(data: ScreenData): void {
        this.screen = data;
        this.leaving = false;
        startScreen(this, data);
        addText(this, DESIGN_WIDTH / 2, 80, STRINGS.highScores.title, TYPE.title, { role: 'display', bold: true, colour: TEXT_COLOURS.gold }).setOrigin(0.5);

        const scores = profile().highScores;
        const latest = data.highlight ?? scores.reduce((newest, entry) => (entry.date > newest ? entry.date : newest), '');
        PODIUM.forEach((spot, i) => this.addPodiumCard(spot, scores[spot.place - 1] ?? null, latest, i));
        if (scores.length === 0) {
            addText(this, DESIGN_WIDTH / 2, TABLE_TOP + 120, STRINGS.highScores.empty, TYPE.body, { colour: TEXT_COLOURS.muted }).setOrigin(0.5);
            this.add.image(DESIGN_WIDTH / 2, TABLE_TOP + 300, TEXTURES.chestClosed).setScale(0.45).setAlpha(0.8);
        } else if (scores.length > 3) {
            this.addTable(scores.slice(3), latest);
        }

        const back = new Button(this, DESIGN_WIDTH / 2, 990, STRINGS.highScores.back, { width: 360, onSelect: () => this.close() });
        new Menu(this, [back]);
        addText(this, DESIGN_WIDTH / 2, DESIGN_HEIGHT - 28, STRINGS.highScores.hint, TYPE.tiny, { colour: TEXT_COLOURS.muted }).setOrigin(0.5);
        onKeyDown(this, ['ESC', 'BACKSPACE'], () => this.close());

        this.cameras.main.fadeIn(MOTION.fast, 0, 0, 0);
        markReady('highScores');
    }

    /** A place on the podium: its medal with the place on it, then the name, score and run; "Unclaimed" while it's empty. */
    private addPodiumCard(spot: (typeof PODIUM)[number], entry: HighScore | null, latest: string, order: number): void {
        const { x, top, width, height, tier, place } = spot;
        const first = place === 1;
        const parts: Phaser.GameObjects.GameObject[] = [addPanel(this, 0, height / 2, width, height)];
        const isLatest = entry !== null && entry.date === latest;
        if (entry) {
            parts.push(this.add.graphics()
                .lineStyle(isLatest ? 4 : 3, isLatest ? COLOURS.goldBright : TIER_COLOURS[tier], 1)
                .strokeRoundedRect(-width / 2 + 1.5, 1.5, width - 3, height - 3, 14));
        } else {
            parts.push(this.add.graphics().fillStyle(COLOURS.ink, 0.45).fillRoundedRect(-width / 2, 0, width, height, 14));
        }

        // The medal, with the place on its face, overlapping the top of the card.
        const medalSize = first ? 104 : 88;
        const medal = this.add.image(0, 0, entry ? MEDAL_TEXTURES[tier] : UI.medalLocked).setDisplaySize(medalSize, medalSize);
        const number = addText(this, 0, 0, String(place), Math.round(medalSize * 0.42), {
            role: 'display',
            bold: true,
            colour: entry ? TIER_TEXT_COLOURS[tier] : TEXT_COLOURS.dim,
        }).setOrigin(0.5);
        parts.push(medal, number);

        if (entry) {
            const nameY = medalSize / 2 + (first ? 44 : 36);
            parts.push(addText(this, 0, nameY, entry.name, first ? TYPE.heading : TYPE.button, { role: 'display', bold: true, colour: isLatest ? TEXT_COLOURS.gold : TEXT_COLOURS.primary }).setOrigin(0.5));
            parts.push(addText(this, 0, nameY + (first ? 72 : 60), formatScore(entry.score), first ? TYPE.title : TYPE.heading, { bold: true, colour: TEXT_COLOURS.gold }).setOrigin(0.5));
            const details = STRINGS.highScores.details(entry.floor, entry.zone, entry.level, formatPlayTime(entry.playTimeMs));
            parts.push(addText(this, 0, height - 54, details, TYPE.tiny, { colour: TEXT_COLOURS.muted }).setOrigin(0.5));
            parts.push(addText(this, 0, height - 28, formatDate(entry.date), TYPE.tiny, { colour: TEXT_COLOURS.dim }).setOrigin(0.5));
            if (isLatest) {
                parts.push(...this.latestTag(width / 2 - 70, 30));
            }
        } else {
            parts.push(addText(this, 0, height / 2 + 20, STRINGS.highScores.unclaimed, TYPE.body, { colour: TEXT_COLOURS.dim }).setOrigin(0.5));
        }

        const card = this.add.container(x, top, parts).setAlpha(0);
        this.tweens.add({ targets: card, alpha: 1, duration: MOTION.normal, delay: order * 60 });
    }

    /** A small "Latest" pill. */
    private latestTag(x: number, y: number): Phaser.GameObjects.GameObject[] {
        const label = addText(this, x, y, STRINGS.highScores.latest, TYPE.tiny, { bold: true, colour: TEXT_COLOURS.shadow, shadow: false }).setOrigin(0.5);
        const width = label.width + 22;
        const pill = this.add.graphics().fillStyle(COLOURS.goldBright, 1).fillRoundedRect(x - width / 2, y - 13, width, 26, 13);
        return [pill, label];
    }

    /** Places 4 to 10, as a table. */
    private addTable(entries: readonly HighScore[], latest: string): void {
        addPanel(this, DESIGN_WIDTH / 2, TABLE_TOP + TABLE_HEIGHT / 2, TABLE_WIDTH, TABLE_HEIGHT);
        const s = STRINGS.highScores;
        const headings: [keyof typeof COLUMNS, string][] = [
            ['name', s.name],
            ['score', s.score],
            ['place', s.floorZone],
            ['level', s.level],
            ['time', s.time],
            ['date', s.date],
        ];
        for (const [column, label] of headings) {
            const { x, origin } = COLUMNS[column];
            addText(this, TABLE_LEFT + x, HEADER_Y, label.toUpperCase(), TYPE.tiny, { bold: true, colour: TEXT_COLOURS.muted, letterSpacing: 3 }).setOrigin(origin, 0.5);
        }
        this.add.rectangle(TABLE_LEFT, HEADER_Y + 26, TABLE_INNER, 2, COLOURS.goldDim, 0.6).setOrigin(0, 0.5);
        entries.forEach((entry, i) => this.addRow(entry, i + 4, FIRST_ROW_Y + i * ROW_HEIGHT, entry.date === latest));
    }

    private addRow(entry: HighScore, place: number, y: number, isLatest: boolean): void {
        if (isLatest) {
            this.add.graphics()
                .fillStyle(COLOURS.gold, 0.14)
                .fillRoundedRect(TABLE_LEFT - 12, y - ROW_HEIGHT / 2 + 3, TABLE_INNER + 24, ROW_HEIGHT - 6, 10)
                .lineStyle(2, COLOURS.gold, 0.8)
                .strokeRoundedRect(TABLE_LEFT - 12, y - ROW_HEIGHT / 2 + 3, TABLE_INNER + 24, ROW_HEIGHT - 6, 10);
        } else if (place % 2 === 1) {
            // Every other row a shade lighter, to keep the eye on its line.
            this.add.rectangle(TABLE_LEFT - 12, y, TABLE_INNER + 24, ROW_HEIGHT - 6, COLOURS.stoneLight, 0.35).setOrigin(0, 0.5);
        }
        const colour = isLatest ? TEXT_COLOURS.gold : TEXT_COLOURS.primary;
        const cells: [keyof typeof COLUMNS, string, boolean, string][] = [
            ['rank', String(place), true, TEXT_COLOURS.muted],
            ['name', entry.name, true, colour],
            ['score', formatScore(entry.score), true, colour],
            ['place', STRINGS.highScores.place(entry.floor, entry.zone), false, colour],
            ['level', String(entry.level), false, colour],
            ['time', formatPlayTime(entry.playTimeMs), false, colour],
            ['date', formatDate(entry.date), false, colour],
        ];
        for (const [column, value, bold, cellColour] of cells) {
            const { x, origin } = COLUMNS[column];
            addText(this, TABLE_LEFT + x, y, value, TYPE.body, { bold, colour: cellColour }).setOrigin(origin, 0.5);
        }
    }

    private close(): void {
        if (this.leaving) {
            return;
        }
        this.leaving = true;
        closeScreen(this, this.screen);
    }
}
