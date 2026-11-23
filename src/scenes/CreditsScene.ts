import * as Phaser from 'phaser';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../config';
import { STRINGS } from '../strings';
import { markReady } from '../testHook';
import { COLOURS, MOTION, SPACE, TEXT_COLOURS, TYPE } from '../theme';
import { Button } from '../ui/Button';
import { Menu } from '../ui/Menu';
import { addPanel } from '../ui/kit';
import { onKeyDown } from '../ui/keys';
import { closeScreen, startScreen, type ScreenData } from '../ui/screens';
import { addText } from '../ui/text';

const PANEL_WIDTH = 1100;
const PANEL_HEIGHT = 700;
const PANEL_Y = 530;

/** Credits (plan §3.4): the alpha testers, what it's made with, the version, and (in the corner) who made it. */
export class CreditsScene extends Phaser.Scene {
    private screen!: ScreenData;
    private leaving = false;

    constructor() {
        super('credits');
    }

    create(data: ScreenData): void {
        this.screen = data;
        this.leaving = false;
        startScreen(this, data);
        const text = STRINGS.credits;

        addText(this, DESIGN_WIDTH / 2, 80, text.title, TYPE.title, { role: 'display', bold: true, colour: TEXT_COLOURS.gold }).setOrigin(0.5);
        addPanel(this, DESIGN_WIDTH / 2, PANEL_Y, PANEL_WIDTH, PANEL_HEIGHT);
        const top = PANEL_Y - PANEL_HEIGHT / 2;
        const centre = DESIGN_WIDTH / 2;
        addText(this, centre, top + 95, STRINGS.gameTitle, TYPE.banner, { role: 'display', bold: true, colour: TEXT_COLOURS.gold }).setOrigin(0.5);
        this.add.rectangle(centre, top + 170, 520, 2, COLOURS.goldDim, 0.6);

        addText(this, centre, top + 230, text.thanksTitle, TYPE.heading, { role: 'display', bold: true, colour: TEXT_COLOURS.gold }).setOrigin(0.5);
        addText(this, centre, top + 287, text.thanks.join('   ·   '), TYPE.body, { bold: true }).setOrigin(0.5);
        addText(this, centre, top + 325, text.thanksNote, TYPE.small, { colour: TEXT_COLOURS.muted }).setOrigin(0.5);

        addText(this, centre, top + 405, text.builtTitle, TYPE.heading, { role: 'display', bold: true, colour: TEXT_COLOURS.gold }).setOrigin(0.5);
        text.built.forEach((line, i) => addText(this, centre, top + 460 + i * 34, line, TYPE.small, { colour: TEXT_COLOURS.primary }).setOrigin(0.5));

        addText(this, centre, top + PANEL_HEIGHT - 55, text.version(__GAME_VERSION__), TYPE.small, { bold: true, colour: TEXT_COLOURS.muted }).setOrigin(0.5);
        // Who made it: small, out of the way.
        addText(this, DESIGN_WIDTH - SPACE.l, DESIGN_HEIGHT - 28, text.author, TYPE.tiny, { colour: TEXT_COLOURS.dim }).setOrigin(1, 0.5);

        const back = new Button(this, DESIGN_WIDTH / 2, 990, text.back, { width: 360, quiet: true, onSelect: () => this.close() });
        new Menu(this, [back]);
        addText(this, DESIGN_WIDTH / 2, DESIGN_HEIGHT - 28, text.hint, TYPE.tiny, { colour: TEXT_COLOURS.muted }).setOrigin(0.5);
        onKeyDown(this, ['ESC', 'BACKSPACE'], () => this.close());

        this.cameras.main.fadeIn(MOTION.fast, 0, 0, 0);
        markReady('credits');
    }

    private close(): void {
        if (this.leaving) {
            return;
        }
        this.leaving = true;
        closeScreen(this, this.screen);
    }
}
