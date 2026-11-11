import * as Phaser from 'phaser';
import { DESIGN_WIDTH } from '../config';
import { floorTitle } from '../rules/floors';
import { formatPlayTime, formatScore } from '../rules/format';
import type { RunSummary } from '../rules/run';
import { STRINGS } from '../strings';
import type { DeathCause } from '../rules/run';
import { profile, updateProfile } from '../profile';
import { DEFAULT_NAME, NAME_CHARACTER, NAME_MAX_LENGTH, nameMimic } from '../rules/save';
import { markReady, setResultsView } from '../testHook';
import { COLOURS, MOTION, SPACE, TEXT_COLOURS, TYPE } from '../theme';
import { Button } from '../ui/Button';
import { Menu } from '../ui/Menu';
import { onKeyDown } from '../ui/keys';
import { addPanel } from '../ui/kit';
import { TextField } from '../ui/TextField';
import { addFloorBackdrop, openScreen } from '../ui/screens';
import { addText } from '../ui/text';

const PANEL_WIDTH = 1000;
const PANEL_HEIGHT = 420;
const PANEL_Y = 540;
const ACTIONS_Y = 850;
const NAME_FIELD_WIDTH = 360;

/** What the game hands the results: the run, and what the save made of it. */
export interface ResultsData extends RunSummary {
    /** Its place on the high scores, or null. */
    readonly rank: number | null;
    /** It beat the best score so far. */
    readonly newBest: boolean;
    /** When the run ended (ISO); it identifies the run's high-score entry. */
    readonly date: string;
}

/**
 * The game-over results: where the run ended, the score and a few numbers,
 * its place on the high scores, then play again, the high scores or the menu.
 * The first time a score makes the board, it asks for the mimic's name. The
 * full results story (tally, growth, highlights) comes in a later milestone.
 */
export class ResultsScene extends Phaser.Scene {
    private leaving = false;
    private results!: ResultsData;
    private cause: string | null = null;
    private nameField: TextField | null = null;
    private namePrompt: Phaser.GameObjects.GameObject[] = [];

    constructor() {
        super('results');
    }

    create(results: ResultsData): void {
        this.leaving = false;
        this.results = results;
        this.nameField = null;
        this.namePrompt = [];
        addFloorBackdrop(this, results.floor, 0.55);

        const cx = DESIGN_WIDTH / 2;
        const title = addText(this, cx, 170, STRINGS.gameOver.title, TYPE.hero, { role: 'display', bold: true, colour: '#ffffff', letterSpacing: 2 }).setOrigin(0.5);
        title.setTint(COLOURS.goldBright, COLOURS.goldBright, COLOURS.gold, COLOURS.gold);
        this.cause = describeCause(results.causeOfDeath);
        if (this.cause) {
            addText(this, cx, 262, this.cause, TYPE.body, { colour: TEXT_COLOURS.primary }).setOrigin(0.5);
        }
        addText(this, cx, this.cause ? 304 : 270, STRINGS.gameOver.endedOn(floorTitle(results.floor)), TYPE.small, { colour: TEXT_COLOURS.muted }).setOrigin(0.5);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => setResultsView(null));
        this.addScorePanel(results);

        onKeyDown(this, ['ENTER'], () => {
            if (this.nameField) {
                this.saveName(this.nameField.finish());
            }
        });
        onKeyDown(this, ['ESC'], () => {
            if (this.nameField) {
                this.skipName();
            } else {
                this.leave('title');
            }
        });
        // "Name your mimic" is asked once, the first time a score makes the board.
        if (results.rank !== null && !profile().named) {
            this.askName();
        } else {
            this.addActions();
            if (results.rank !== null) {
                this.addSavedNote(profile().name, false);
            }
        }
        this.report();

        this.cameras.main.fadeIn(MOTION.slow, 0, 0, 0);
        markReady('results');
    }

    private addScorePanel(results: ResultsData): void {
        const cx = DESIGN_WIDTH / 2;
        addPanel(this, cx, PANEL_Y, PANEL_WIDTH, PANEL_HEIGHT);
        const top = PANEL_Y - PANEL_HEIGHT / 2;
        addText(this, cx, top + SPACE.l + 8, STRINGS.gameOver.score.toUpperCase(), TYPE.tiny, { colour: TEXT_COLOURS.muted, letterSpacing: 4, bold: true }).setOrigin(0.5);
        const score = addText(this, cx, top + 150, formatScore(results.score), TYPE.hero, { bold: true, colour: TEXT_COLOURS.gold }).setOrigin(0.5);
        this.tweens.add({ targets: score, scale: { from: 0.8, to: 1 }, alpha: { from: 0, to: 1 }, duration: MOTION.slow, ease: 'Back.Out' });

        const ribbon = results.newBest ? STRINGS.gameOver.newBest : results.rank !== null ? STRINGS.gameOver.onBoard(results.rank) : null;
        if (ribbon) {
            const text = addText(this, cx, top + 232, ribbon, TYPE.body, { bold: true, colour: TEXT_COLOURS.gold }).setOrigin(0.5);
            this.tweens.add({ targets: text, alpha: { from: 0, to: 1 }, delay: MOTION.slow, duration: MOTION.slow });
        }

        const stats: [string, string][] = [
            [STRINGS.gameOver.level, String(results.level)],
            [STRINGS.gameOver.time, formatPlayTime(results.playTimeMs)],
            [STRINGS.gameOver.eaten, String(results.creaturesEaten)],
            [STRINGS.gameOver.shinies, String(results.shiniesCollected)],
        ];
        const columnWidth = (PANEL_WIDTH - SPACE.xl * 2) / stats.length;
        stats.forEach(([label, value], i) => {
            const x = cx - PANEL_WIDTH / 2 + SPACE.xl + columnWidth * (i + 0.5);
            addText(this, x, top + 304, value, TYPE.heading, { bold: true }).setOrigin(0.5);
            addText(this, x, top + 354, label, TYPE.small, { colour: TEXT_COLOURS.muted }).setOrigin(0.5);
        });
    }

    /** "Name your mimic": a name field where the buttons will be. */
    private askName(): void {
        const cx = DESIGN_WIDTH / 2;
        const label = addText(this, cx - 30, ACTIONS_Y, STRINGS.gameOver.namePrompt, TYPE.heading, { role: 'display', bold: true, colour: TEXT_COLOURS.gold }).setOrigin(1, 0.5);
        const field = new TextField(this, cx + 30 + NAME_FIELD_WIDTH / 2, ACTIONS_Y, '', {
            width: NAME_FIELD_WIDTH,
            maxLength: NAME_MAX_LENGTH,
            placeholder: DEFAULT_NAME,
            allowed: NAME_CHARACTER,
        });
        const hint = addText(this, cx, ACTIONS_Y + 70, STRINGS.gameOver.nameHint, TYPE.small, { colour: TEXT_COLOURS.muted }).setOrigin(0.5);
        field.startEditing();
        this.nameField = field;
        this.namePrompt = [label, field, hint];
    }

    private saveName(name: string): void {
        const save = updateProfile((current) => nameMimic(current, name, this.results.date));
        this.closeNamePrompt(save.name);
    }

    /** Esc: keeps the default name (Settings can change it later). */
    private skipName(): void {
        this.nameField?.cancel();
        const save = updateProfile((current) => ({ ...current, named: true }));
        this.closeNamePrompt(save.name);
    }

    private closeNamePrompt(name: string): void {
        this.namePrompt.forEach((object) => object.destroy());
        this.namePrompt = [];
        this.nameField = null;
        this.addActions();
        this.addSavedNote(name, true);
        this.report();
    }

    /** Play Again (focused), High Scores and Menu. */
    private addActions(): void {
        const cx = DESIGN_WIDTH / 2;
        const width = 380;
        const playAgain = new Button(this, cx - 420, ACTIONS_Y, STRINGS.gameOver.playAgain, { width, onSelect: () => this.leave('game') });
        const highScores = new Button(this, cx, ACTIONS_Y, STRINGS.gameOver.highScores, {
            width,
            onSelect: () => openScreen(this, 'highScores', { from: 'results', floor: this.results.floor, ...(this.results.rank !== null ? { highlight: this.results.date } : {}) }),
        });
        const menu = new Button(this, cx + 420, ACTIONS_Y, STRINGS.gameOver.menu, { width, onSelect: () => this.leave('title') });
        new Menu(this, [playAgain, highScores, menu], { horizontal: true });
    }

    /** Under the buttons: the name the score was saved under, and after naming, where to change it. */
    private addSavedNote(name: string, justNamed: boolean): void {
        const cx = DESIGN_WIDTH / 2;
        addText(this, cx, ACTIONS_Y + 72, STRINGS.gameOver.savedAs(name), TYPE.small, { colour: TEXT_COLOURS.muted }).setOrigin(0.5);
        if (justNamed) {
            addText(this, cx, ACTIONS_Y + 110, STRINGS.gameOver.renameHint, TYPE.small, { colour: TEXT_COLOURS.dim }).setOrigin(0.5);
        }
    }

    private report(): void {
        setResultsView({ cause: this.cause, rank: this.results.rank, naming: this.nameField !== null });
    }

    private leave(scene: 'game' | 'title'): void {
        if (this.leaving || this.nameField) {
            return;
        }
        this.leaving = true;
        this.sound.stopAll();
        this.cameras.main.fadeOut(MOTION.normal, 0, 0, 0);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(scene));
    }
}

/** What cost the last life, in words (draft lines, reviewed in M4). */
function describeCause(cause: DeathCause | null): string | null {
    if (!cause) {
        return null;
    }
    switch (cause.type) {
        case 'wasted':
            return STRINGS.causes.wasted(STRINGS.creatureNames[cause.creature]);
        case 'bomb':
            return STRINGS.causes.bomb;
        case 'fireball':
            return STRINGS.causes.fireball;
        case 'boss':
            return STRINGS.causes.boss;
        case 'judgment':
            return STRINGS.causes.judgment;
    }
}
