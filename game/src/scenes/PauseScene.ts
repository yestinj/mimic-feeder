import * as Phaser from 'phaser';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../config';
import { floorInfo } from '../rules/floors';
import { formatPlayTime } from '../rules/format';
import { dropSpeedPercent, spawnRatePercent } from '../rules/progression';
import type { Run } from '../rules/run';
import { STRINGS } from '../strings';
import { markReady } from '../testHook';
import { COLOURS, MOTION, SPACE, TEXT_COLOURS, TYPE } from '../theme';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Menu } from '../ui/Menu';
import { addPanel } from '../ui/kit';
import { onKeyDown } from '../ui/keys';
import { addText } from '../ui/text';
import { showToast } from '../ui/toast';
import type { GameScene } from './GameScene';

const PANEL_HEIGHT = 600;
const MENU_X = DESIGN_WIDTH / 2 - 290;
const RUN_X = DESIGN_WIDTH / 2 + 290;
const PANEL_Y = DESIGN_HEIGHT / 2 + 30;

/**
 * The pause menu over the frozen, blurred playfield: resume, restart or quit,
 * with a summary of the run so far. The game and HUD scenes are paused
 * underneath, so nothing moves or counts down.
 */
export class PauseScene extends Phaser.Scene {
    private menu!: Menu;
    private dialog: ConfirmDialog | null = null;
    private leaving = false;

    constructor() {
        super('pause');
    }

    create(): void {
        this.dialog = null;
        this.leaving = false;
        const run = (this.scene.get('game') as GameScene).currentRun;

        this.add.rectangle(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, COLOURS.ink, 0.45).setOrigin(0);
        addText(this, DESIGN_WIDTH / 2, 150, STRINGS.pause.title, TYPE.title, { role: 'display', bold: true, colour: TEXT_COLOURS.gold }).setOrigin(0.5);
        this.addMenu();
        this.addRunPanel(run);
        addText(this, DESIGN_WIDTH / 2, DESIGN_HEIGHT - 70, STRINGS.pause.hint, TYPE.small, { colour: TEXT_COLOURS.muted }).setOrigin(0.5);

        const back = (): void => {
            if (this.dialog) {
                this.dialog.cancel();
            } else {
                this.resumeGame();
            }
        };
        onKeyDown(this, ['ESC', 'P'], back);

        this.cameras.main.fadeIn(MOTION.fast, 0, 0, 0);
        markReady('pause');
    }

    private addMenu(): void {
        const items: { label: string; action: () => void }[] = [
            { label: STRINGS.pause.resume, action: () => this.resumeGame() },
            { label: STRINGS.menu.howToPlay, action: () => showToast(this, STRINGS.comingLater(STRINGS.menu.howToPlay)) },
            { label: STRINGS.menu.achievements, action: () => showToast(this, STRINGS.comingLater(STRINGS.menu.achievements)) },
            { label: STRINGS.menu.settings, action: () => showToast(this, STRINGS.comingLater(STRINGS.menu.settings)) },
            { label: STRINGS.pause.restart, action: () => this.confirmAbandon(STRINGS.confirm.restart, () => this.restart()) },
            { label: STRINGS.pause.quit, action: () => this.confirmAbandon(STRINGS.confirm.quit, () => this.quit()) },
        ];
        const step = 84;
        const top = PANEL_Y - ((items.length - 1) * step) / 2;
        addPanel(this, MENU_X, PANEL_Y, 520, PANEL_HEIGHT);
        const buttons = items.map((item, i) => new Button(this, MENU_X, top + i * step, item.label, { onSelect: item.action }));
        this.menu = new Menu(this, buttons);
    }

    /** "This run": where you are and how the mimic and the dungeon have grown. */
    private addRunPanel(run: Run): void {
        addPanel(this, RUN_X, PANEL_Y, 520, PANEL_HEIGHT);
        const top = PANEL_Y - PANEL_HEIGHT / 2 + SPACE.l;
        addText(this, RUN_X, top, STRINGS.pause.thisRun, TYPE.heading, { role: 'display', bold: true, colour: TEXT_COLOURS.gold }).setOrigin(0.5, 0);
        addText(this, RUN_X, top + 66, floorInfo(run.floor).name, TYPE.body, { colour: TEXT_COLOURS.muted }).setOrigin(0.5, 0);

        const percent = (factor: number): string => STRINGS.pause.percent(Math.round(factor * 100));
        const rows: [string, string][] = [
            [STRINGS.pause.floor, String(run.floor)],
            [STRINGS.pause.zone, String(run.zone)],
            [STRINGS.pause.time, formatPlayTime(run.playTimeMs)],
            [STRINGS.pause.level, String(run.level)],
            [STRINGS.pause.speed, percent(run.growth.speed)],
            [STRINGS.pause.size, percent(run.growth.size)],
            [STRINGS.pause.dropSpeed, STRINGS.pause.percent(dropSpeedPercent(run.gameLevel))],
            [STRINGS.pause.spawnRate, STRINGS.pause.percent(spawnRatePercent(run.gameLevel))],
        ];
        const left = RUN_X - 520 / 2 + SPACE.xl;
        const right = RUN_X + 520 / 2 - SPACE.xl;
        rows.forEach(([label, value], i) => {
            const y = top + 132 + i * 48;
            addText(this, left, y, label, TYPE.body, { colour: TEXT_COLOURS.muted });
            addText(this, right, y, value, TYPE.body, { bold: true }).setOrigin(1, 0);
        });
    }

    private confirmAbandon(confirmLabel: string, onConfirm: () => void): void {
        this.menu.setEnabled(false);
        this.dialog = new ConfirmDialog(this, {
            message: STRINGS.confirm.abandon,
            cancelLabel: STRINGS.confirm.cancel,
            confirmLabel,
            onConfirm,
            onCancel: () => {
                this.dialog = null;
                this.menu.setEnabled(true);
            },
        });
    }

    private resumeGame(): void {
        if (this.leaving) {
            return;
        }
        this.leaving = true;
        this.scene.resume('game');
        this.scene.resume('hud');
        this.scene.stop();
    }

    private restart(): void {
        this.leaving = true;
        this.sound.stopAll();
        this.scene.stop('hud');
        this.scene.start('game');
    }

    private quit(): void {
        this.leaving = true;
        this.sound.stopAll();
        this.scene.stop('hud');
        this.scene.stop('game');
        this.scene.start('title');
    }
}
