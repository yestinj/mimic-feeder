import * as Phaser from 'phaser';
import { DESIGN_WIDTH } from '../config';
import { profile } from '../profile';
import { formatDate, formatPlayTime, formatScore } from '../rules/format';
import type { HighScore } from '../rules/save';
import { STRINGS } from '../strings';
import { markReady } from '../testHook';
import { COLOURS, MOTION, SPACE, TEXT_COLOURS, TYPE } from '../theme';
import { Button } from '../ui/Button';
import { Menu } from '../ui/Menu';
import { addPanel } from '../ui/kit';
import { onKeyDown } from '../ui/keys';
import { closeScreen, startScreen, type ScreenData } from '../ui/screens';
import { addText } from '../ui/text';

const PANEL_WIDTH = 1500;
const PANEL_HEIGHT = 740;
const PANEL_Y = 540;
const ROW_HEIGHT = 60;
const LEFT = DESIGN_WIDTH / 2 - PANEL_WIDTH / 2 + SPACE.xl;
const INNER_WIDTH = PANEL_WIDTH - 2 * SPACE.xl;
const HEADER_Y = PANEL_Y - PANEL_HEIGHT / 2 + 56;
const FIRST_ROW_Y = HEADER_Y + 70;

/** Medal colours for the top three. */
const MEDALS = [COLOURS.gold, 0xc9ced3, 0xc07a43] as const;

/** Where each column sits (x from the left of the rows) and how it aligns. */
const COLUMNS = {
    rank: { x: 32, origin: 0.5 },
    name: { x: 96, origin: 0 },
    score: { x: 700, origin: 1 },
    place: { x: 860, origin: 0.5 },
    level: { x: 1010, origin: 0.5 },
    time: { x: 1140, origin: 0.5 },
    date: { x: INNER_WIDTH - 16, origin: 1 },
} as const;

/**
 * The top 10: gold, silver and bronze for the first three; name, score,
 * floor and zone, level, time and date; the latest entry highlighted.
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
        addText(this, DESIGN_WIDTH / 2, 100, STRINGS.highScores.title, TYPE.title, { role: 'display', bold: true, colour: TEXT_COLOURS.gold }).setOrigin(0.5);
        addPanel(this, DESIGN_WIDTH / 2, PANEL_Y, PANEL_WIDTH, PANEL_HEIGHT);

        const scores = profile().highScores;
        if (scores.length === 0) {
            addText(this, DESIGN_WIDTH / 2, PANEL_Y, STRINGS.highScores.empty, TYPE.body, { colour: TEXT_COLOURS.muted }).setOrigin(0.5);
        } else {
            this.addHeader();
            const latest = data.highlight ?? scores.reduce((newest, entry) => (entry.date > newest ? entry.date : newest), '');
            scores.forEach((entry, i) => this.addRow(entry, i, entry.date === latest));
        }

        const back = new Button(this, DESIGN_WIDTH / 2, 990, STRINGS.highScores.back, { width: 360, onSelect: () => this.close() });
        new Menu(this, [back]);
        onKeyDown(this, ['ESC', 'BACKSPACE'], () => this.close());

        this.cameras.main.fadeIn(MOTION.fast, 0, 0, 0);
        markReady('highScores');
    }

    private addHeader(): void {
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
            addText(this, LEFT + x, HEADER_Y, label.toUpperCase(), TYPE.tiny, { bold: true, colour: TEXT_COLOURS.muted, letterSpacing: 3 }).setOrigin(origin, 0.5);
        }
        this.add.rectangle(LEFT, HEADER_Y + 30, INNER_WIDTH, 2, COLOURS.goldDim, 0.6).setOrigin(0, 0.5);
    }

    private addRow(entry: HighScore, index: number, latest: boolean): void {
        const y = FIRST_ROW_Y + index * ROW_HEIGHT;
        if (latest) {
            this.add.graphics()
                .fillStyle(COLOURS.gold, 0.14)
                .fillRoundedRect(LEFT - 12, y - ROW_HEIGHT / 2 + 4, INNER_WIDTH + 24, ROW_HEIGHT - 8, 12)
                .lineStyle(2, COLOURS.gold, 0.8)
                .strokeRoundedRect(LEFT - 12, y - ROW_HEIGHT / 2 + 4, INNER_WIDTH + 24, ROW_HEIGHT - 8, 12);
        }
        const medal = MEDALS[index];
        const rankX = LEFT + COLUMNS.rank.x;
        if (medal !== undefined) {
            this.add.circle(rankX, y, 22, medal).setStrokeStyle(3, COLOURS.ink, 0.6);
        }
        addText(this, rankX, y, String(index + 1), TYPE.body, { bold: true, colour: medal !== undefined ? '#1a1411' : TEXT_COLOURS.muted, shadow: medal === undefined }).setOrigin(0.5);

        const colour = latest ? TEXT_COLOURS.gold : TEXT_COLOURS.primary;
        const cells: [keyof typeof COLUMNS, string, boolean][] = [
            ['name', entry.name, true],
            ['score', formatScore(entry.score), true],
            ['place', STRINGS.highScores.place(entry.floor, entry.zone), false],
            ['level', String(entry.level), false],
            ['time', formatPlayTime(entry.playTimeMs), false],
            ['date', formatDate(entry.date), false],
        ];
        for (const [column, value, bold] of cells) {
            const { x, origin } = COLUMNS[column];
            addText(this, LEFT + x, y, value, TYPE.body, { bold, colour }).setOrigin(origin, 0.5);
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
