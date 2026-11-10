import * as Phaser from 'phaser';
import { floorBackground } from '../assets';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../config';
import { floorTitle } from '../rules/floors';
import { formatPlayTime, formatScore } from '../rules/format';
import type { RunSummary } from '../rules/run';
import { STRINGS } from '../strings';
import { markReady } from '../testHook';
import { COLOURS, MOTION, SPACE, TEXT_COLOURS, TYPE } from '../theme';
import { Button } from '../ui/Button';
import { Menu } from '../ui/Menu';
import { onKeyDown } from '../ui/keys';
import { addPanel } from '../ui/kit';
import { addText } from '../ui/text';

const PANEL_WIDTH = 1000;
const PANEL_HEIGHT = 380;

/**
 * The basic game-over results: where the run ended, the score and a few
 * numbers, then play again or go back to the menu. The full results story
 * (tally, growth, highlights, high scores) comes in later milestones.
 */
export class ResultsScene extends Phaser.Scene {
    private leaving = false;

    constructor() {
        super('results');
    }

    create(summary: RunSummary): void {
        this.leaving = false;
        this.addBackdrop(summary.floor);

        const cx = DESIGN_WIDTH / 2;
        const title = addText(this, cx, 170, STRINGS.gameOver.title, TYPE.hero, { role: 'display', bold: true, colour: '#ffffff', letterSpacing: 2 }).setOrigin(0.5);
        title.setTint(COLOURS.goldBright, COLOURS.goldBright, COLOURS.gold, COLOURS.gold);
        addText(this, cx, 270, STRINGS.gameOver.endedOn(floorTitle(summary.floor)), TYPE.body, { colour: TEXT_COLOURS.muted }).setOrigin(0.5);

        const panelY = 530;
        addPanel(this, cx, panelY, PANEL_WIDTH, PANEL_HEIGHT);
        const top = panelY - PANEL_HEIGHT / 2;
        addText(this, cx, top + SPACE.l + 8, STRINGS.gameOver.score.toUpperCase(), TYPE.tiny, { colour: TEXT_COLOURS.muted, letterSpacing: 4, bold: true }).setOrigin(0.5);
        const score = addText(this, cx, top + 150, formatScore(summary.score), TYPE.hero, { bold: true, colour: TEXT_COLOURS.gold }).setOrigin(0.5);
        this.tweens.add({ targets: score, scale: { from: 0.8, to: 1 }, alpha: { from: 0, to: 1 }, duration: MOTION.slow, ease: 'Back.Out' });

        const stats: [string, string][] = [
            [STRINGS.gameOver.level, String(summary.level)],
            [STRINGS.gameOver.time, formatPlayTime(summary.playTimeMs)],
            [STRINGS.gameOver.eaten, String(summary.creaturesEaten)],
            [STRINGS.gameOver.shinies, String(summary.shiniesCollected)],
        ];
        const columnWidth = (PANEL_WIDTH - SPACE.xl * 2) / stats.length;
        stats.forEach(([label, value], i) => {
            const x = cx - PANEL_WIDTH / 2 + SPACE.xl + columnWidth * (i + 0.5);
            addText(this, x, top + 262, value, TYPE.heading, { bold: true }).setOrigin(0.5);
            addText(this, x, top + 312, label, TYPE.small, { colour: TEXT_COLOURS.muted }).setOrigin(0.5);
        });

        const buttonsY = panelY + PANEL_HEIGHT / 2 + 110;
        const playAgain = new Button(this, cx - 230, buttonsY, STRINGS.gameOver.playAgain, { width: 400, onSelect: () => this.leave('game') });
        const menu = new Button(this, cx + 230, buttonsY, STRINGS.gameOver.menu, { width: 400, onSelect: () => this.leave('title') });
        new Menu(this, [playAgain, menu], { horizontal: true });
        onKeyDown(this, ['ESC'], () => this.leave('title'));

        this.cameras.main.fadeIn(MOTION.slow, 0, 0, 0);
        markReady('results');
    }

    /** The floor where the run ended, blurred and darkened. */
    private addBackdrop(floor: number): void {
        const background = this.add.image(DESIGN_WIDTH / 2, DESIGN_HEIGHT, floorBackground(this.textures, floor)).setOrigin(0.5, 1);
        background.setScale(Math.max(DESIGN_WIDTH / background.width, DESIGN_HEIGHT / background.height));
        background.enableFilters();
        background.filters?.internal.addBlur(1, 2, 2, 1.5);
        this.add.rectangle(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, COLOURS.ink, 0.55).setOrigin(0);
    }

    private leave(scene: 'game' | 'title'): void {
        if (this.leaving) {
            return;
        }
        this.leaving = true;
        this.sound.stopAll();
        this.cameras.main.fadeOut(MOTION.normal, 0, 0, 0);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(scene));
    }
}
