import * as Phaser from 'phaser';
import { TEXTURES } from '../assets';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../config';
import { prefersReducedMotion } from '../motion';
import { profile, updateProfile } from '../profile';
import { ACHIEVEMENTS, TIER_POINTS } from '../rules/achievements';
import { floorTitle } from '../rules/floors';
import { formatPlayTime, formatScore } from '../rules/format';
import type { GuideKey } from '../rules/guide';
import { CREATURE_KINDS } from '../rules/objects';
import type { DeathCause, RunSummary } from '../rules/run';
import { DEFAULT_NAME, NAME_CHARACTER, NAME_MAX_LENGTH, nameMimic, type BestKind, type Totals } from '../rules/save';
import { STRINGS } from '../strings';
import { markReady, setResultsView } from '../testHook';
import { COLOURS, MOTION, SPACE, TEXT_COLOURS, TYPE } from '../theme';
import { Button } from '../ui/Button';
import { addEntrySprite, fitTo } from '../ui/EntrySprite';
import { addMedal } from '../ui/Medal';
import { Menu } from '../ui/Menu';
import { TextField } from '../ui/TextField';
import { UI, addPanel } from '../ui/kit';
import { onKeyDown } from '../ui/keys';
import { addFloorBackdrop, openScreen } from '../ui/screens';
import { addText } from '../ui/text';

/** What the game hands the results: the run, and what the save made of it. */
export interface ResultsData extends RunSummary {
    /** Its place on the high scores, or null. */
    readonly rank: number | null;
    /** It beat the best score so far. */
    readonly newBest: boolean;
    /** The best score before this run (0 if there wasn't one). */
    readonly bestBefore: number;
    /** When the run ended (ISO); it identifies the run's high-score entry. */
    readonly date: string;
    /** The run's own counts, for the tally. */
    readonly totals: Totals;
    /** How much the mimic grew: its size at the end, where it started at 1. */
    readonly size: number;
    /** Highlights: the bests it beat (none on a first run), achievements unlocked, and creatures, items and the boss met for the first time. */
    readonly bestsBeaten: readonly BestKind[];
    readonly achievements: readonly string[];
    readonly discoveries: readonly GuideKey[];
}

const GAP = 30;
const TALLY_WIDTH = 920;
const SCORE_WIDTH = 820;
const PANELS_LEFT = DESIGN_WIDTH / 2 - (TALLY_WIDTH + GAP + SCORE_WIDTH) / 2;
const PANEL_TOP = 220;
const PANEL_HEIGHT = 440;
const HIGHLIGHTS_TOP = PANEL_TOP + PANEL_HEIGHT + 20;
const HIGHLIGHTS_HEIGHT = 190;
const HIGHLIGHTS_WIDTH = TALLY_WIDTH + GAP + SCORE_WIDTH;
const ACTIONS_Y = 940;
const NAME_FIELD_WIDTH = 360;
const CHIP_SIZE = 64;
const CHIP_STEP = 124;
/** The mimic's size on the results, at the start of the run, and the most it's drawn at. */
const CHEST_START = 56;
const CHEST_MAX = 150;
/** The pace of the staged reveal. */
const STEP_MS = 120;
const COUNT_MS = 450;
/** Highlights shown before the rest are summed up as "+N more". */
const MAX_HIGHLIGHTS = 8;

const BEST_ICONS: Record<BestKind, string> = { score: UI.iconScore, floor: UI.iconFloor, level: UI.iconLevel, playTimeMs: UI.iconTime };

/** Anything the reveal can fade and pop: text, images, containers. */
interface Revealable {
    scale: number;
    setAlpha(alpha: number): this;
    setScale(scale: number): this;
}

/** One step of the staged reveal: `play` animates it, `show` jumps to its end (when skipped). */
interface Reveal {
    readonly at: number;
    readonly play: () => void;
    readonly show: () => void;
}

/**
 * The results tell the story of the run (plan §3.5): what cost the last life
 * and where, then, in stages, what the mimic devoured and met along the way,
 * the score and its place on the board, how much the mimic grew, and the
 * run's highlights (bests beaten, achievements unlocked, first meetings).
 * Any key or click skips to the end. Then: play again, the high scores or
 * the menu. The first time a score makes the board, it asks for the mimic's
 * name.
 */
export class ResultsScene extends Phaser.Scene {
    private leaving = false;
    private results!: ResultsData;
    private cause: string | null = null;
    private nameField: TextField | null = null;
    private namePrompt: Phaser.GameObjects.GameObject[] = [];
    private reveals: Reveal[] = [];
    private staged = false;
    private skipHint: Phaser.GameObjects.Text | null = null;

    constructor() {
        super('results');
    }

    create(results: ResultsData): void {
        this.leaving = false;
        this.results = results;
        this.nameField = null;
        this.namePrompt = [];
        this.reveals = [];
        this.staged = false;
        addFloorBackdrop(this, results.floor, 0.6);

        const cx = DESIGN_WIDTH / 2;
        const title = addText(this, cx, 78, STRINGS.gameOver.title, TYPE.banner, { role: 'display', bold: true, colour: '#ffffff', letterSpacing: 2 }).setOrigin(0.5);
        title.setTint(COLOURS.goldBright, COLOURS.goldBright, COLOURS.gold, COLOURS.gold);
        this.cause = describeCause(results.causeOfDeath);
        if (this.cause && results.causeOfDeath) {
            // What got you, beside the words: the creature let go, the bomb, the fireball, the boss, or the dungeon's eye.
            const line = addText(this, cx, 148, this.cause, TYPE.body, { colour: TEXT_COLOURS.primary }).setOrigin(0.5);
            const iconSize = 44;
            const shift = (iconSize + SPACE.s) / 2;
            line.setX(cx + shift);
            this.causeIcon(results.causeOfDeath, cx + shift - line.width / 2 - SPACE.s - iconSize / 2, 148, iconSize);
        }
        addText(this, cx, this.cause ? 186 : 156, STRINGS.gameOver.endedOn(floorTitle(results.floor)), TYPE.small, { colour: TEXT_COLOURS.muted }).setOrigin(0.5);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => setResultsView(null));

        this.addTally(results);
        this.addScore(results);
        this.addHighlights(results);
        this.stage();

        this.cameras.main.fadeIn(MOTION.slow, 0, 0, 0);
        this.report();
        markReady('results');
    }

    // The tally ----------------------------------------------------------------

    /** "The mimic devoured…" the creatures eaten, then what else happened along the way. */
    private addTally(results: ResultsData): void {
        const cx = PANELS_LEFT + TALLY_WIDTH / 2;
        const top = PANEL_TOP;
        addPanel(this, cx, top + PANEL_HEIGHT / 2, TALLY_WIDTH, PANEL_HEIGHT);
        const text = STRINGS.gameOver;

        this.fadeIn(addText(this, cx, top + 46, text.devoured, TYPE.heading, { role: 'display', bold: true, colour: TEXT_COLOURS.gold }).setOrigin(0.5), 250);
        const eaten = [...CREATURE_KINDS, 'cat' as const]
            .filter((kind) => results.totals.eaten[kind] > 0)
            .map((kind) => ({ key: kind as GuideKey, count: results.totals.eaten[kind], label: null }));
        const at = this.addChips(eaten, cx, top + 122, 450, text.nothingEaten);

        this.fadeIn(addText(this, cx, top + 252, text.alongTheWay, TYPE.button, { role: 'display', bold: true, colour: TEXT_COLOURS.gold }).setOrigin(0.5), at + 150);
        const labels = text.tallyLabels;
        const others = [
            { key: 'crown' as GuideKey, count: results.totals.collected.crown, label: labels.crown },
            { key: 'diamond' as GuideKey, count: results.totals.collected.diamond, label: labels.diamond },
            { key: 'bomb' as GuideKey, count: results.totals.hazardsDetonated, label: labels.detonated },
            { key: 'cat' as GuideKey, count: results.totals.catsRescued, label: labels.rescued },
            { key: 'boss' as GuideKey, count: results.totals.bossesDefeated, label: labels.defeated },
        ].filter(({ count }) => count > 0);
        this.addChips(others, cx, top + 326, at + 300, text.nothingElse);
    }

    /** A row of sprites with counts under them (and a label, if given), revealed one by one from `at`; returns when the row is done. */
    private addChips(chips: readonly { key: GuideKey; count: number; label: string | null }[], cx: number, y: number, at: number, empty: string): number {
        if (chips.length === 0) {
            this.fadeIn(addText(this, cx, y + 20, empty, TYPE.body, { colour: TEXT_COLOURS.muted }).setOrigin(0.5), at);
            return at + STEP_MS;
        }
        const left = cx - ((chips.length - 1) * CHIP_STEP) / 2;
        chips.forEach(({ key, count, label }, i) => {
            const x = left + i * CHIP_STEP;
            const sprite = addEntrySprite(this, x, y, key, CHIP_SIZE);
            const number = addText(this, x, y + 58, '0', TYPE.body, { bold: true }).setOrigin(0.5);
            const parts: Revealable[] = [sprite, number];
            if (label) {
                parts.push(addText(this, x, y + 88, label, TYPE.tiny, { colour: TEXT_COLOURS.muted }).setOrigin(0.5));
            }
            this.pop(parts, at + i * STEP_MS, () => this.countUp(number, count, formatScore), () => number.setText(formatScore(count)));
        });
        return at + chips.length * STEP_MS + COUNT_MS / 2;
    }

    // The score and growth -------------------------------------------------------

    /** The score counting up, its place on the board, and the mimic's growth. */
    private addScore(results: ResultsData): void {
        const cx = PANELS_LEFT + TALLY_WIDTH + GAP + SCORE_WIDTH / 2;
        const top = PANEL_TOP;
        addPanel(this, cx, top + PANEL_HEIGHT / 2, SCORE_WIDTH, PANEL_HEIGHT);
        const text = STRINGS.gameOver;
        const at = 1500;

        addText(this, cx, top + 44, text.score.toUpperCase(), TYPE.tiny, { colour: TEXT_COLOURS.muted, letterSpacing: 4, bold: true }).setOrigin(0.5);
        const score = addText(this, cx, top + 118, '0', TYPE.hero, { bold: true, colour: TEXT_COLOURS.gold }).setOrigin(0.5);
        this.reveal(at, () => this.countUp(score, results.score, formatScore, 900, () => this.bump(score)), () => score.setText(formatScore(results.score)).setScale(1));

        // "New best!", or its place on the board; and short of a new best, the best so far to measure it by.
        const placed = results.rank !== null ? text.onBoard(results.rank) : null;
        let lineY = top + 192;
        if (results.newBest || placed) {
            this.pop([addText(this, cx, lineY, results.newBest ? text.newBest : (placed ?? ''), TYPE.body, { bold: true, colour: TEXT_COLOURS.gold }).setOrigin(0.5)], at + 950);
            lineY += 34;
        }
        if (!results.newBest && results.bestBefore > 0) {
            this.pop([addText(this, cx, lineY, text.best(formatScore(results.bestBefore)), TYPE.small, { colour: TEXT_COLOURS.muted }).setOrigin(0.5)], at + 1000);
        }
        this.add.rectangle(cx, top + 250, SCORE_WIDTH - 2 * SPACE.xl, 2, COLOURS.goldDim, 0.5);

        // The mimic at the start of the run, and at the end.
        const baseline = top + 330;
        const start = this.chest(cx - 150, baseline, CHEST_START).setAlpha(0.6);
        const arrow = addText(this, cx - 50, baseline - CHEST_START / 2, '→', TYPE.heading, { colour: TEXT_COLOURS.muted }).setOrigin(0.5);
        const end = this.chest(cx + 80, baseline, CHEST_START);
        const endScale = end.scale * (Math.min(CHEST_MAX, CHEST_START * results.size) / CHEST_START);
        const grew = addText(this, cx, baseline + 34, text.grew(results.size.toFixed(1)), TYPE.small, { colour: TEXT_COLOURS.muted }).setOrigin(0.5);
        const levelTime = addText(this, cx, baseline + 66, text.levelAndTime(results.level, formatPlayTime(results.playTimeMs)), TYPE.body, { bold: true }).setOrigin(0.5);
        this.pop([arrow, end, grew, levelTime], at + 1100, () => {
            this.tweens.add({ targets: end, scale: endScale, duration: 600, delay: MOTION.normal, ease: 'Back.Out' });
        }, () => end.setScale(endScale));
        this.fadeIn(start, at + 1100, 0.6);
    }

    /** A picture of what cost the last heart. */
    private causeIcon(cause: DeathCause, x: number, y: number, size: number): void {
        switch (cause.type) {
            case 'wasted':
                addEntrySprite(this, x, y, cause.creature, size);
                return;
            case 'bomb':
            case 'fireball':
            case 'boss':
                addEntrySprite(this, x, y, cause.type, size);
                return;
            case 'judgment':
                fitTo(this.add.image(x, y, UI.iconEye), size);
                return;
        }
    }

    /** The closed chest, `height` tall, standing on `baseline`. */
    private chest(x: number, baseline: number, height: number): Phaser.GameObjects.Image {
        const chest = this.add.image(x, baseline, TEXTURES.chestClosed).setOrigin(0.5, 1);
        return chest.setScale(height / chest.height);
    }

    // Highlights -------------------------------------------------------------------

    /** Bests beaten, achievements unlocked and first meetings, as a flow of chips (the rest summed up as "+N more"). */
    private addHighlights(results: ResultsData): void {
        const cx = DESIGN_WIDTH / 2;
        const top = HIGHLIGHTS_TOP;
        addPanel(this, cx, top + HIGHLIGHTS_HEIGHT / 2, HIGHLIGHTS_WIDTH, HIGHLIGHTS_HEIGHT);
        const text = STRINGS.gameOver;
        const at = 3000;
        this.fadeIn(addText(this, cx, top + 34, text.highlights, TYPE.button, { role: 'display', bold: true, colour: TEXT_COLOURS.gold }).setOrigin(0.5), at);

        const chips: { icon: (x: number) => Phaser.GameObjects.GameObject; label: string }[] = [
            // The new best score already has its ribbon.
            ...results.bestsBeaten.filter((kind) => kind !== 'score').map((kind) => ({
                icon: (x: number) => fitTo(this.add.image(x, 0, BEST_ICONS[kind]), 36),
                label: text.bests[kind],
            })),
            ...results.achievements.flatMap((id) => {
                const achievement = ACHIEVEMENTS.find((entry) => entry.id === id);
                return achievement
                    ? [{ icon: (x: number) => addMedal(this, x, 0, achievement, 'unlocked', 40), label: text.achievement(STRINGS.achievements.list[id]?.name ?? id, TIER_POINTS[achievement.tier]) }]
                    : [];
            }),
            ...results.discoveries.map((key) => ({
                icon: (x: number) => addEntrySprite(this, x, 0, key, 36),
                label: text.discovered(STRINGS.howToPlay.entries[key]?.name ?? key),
            })),
        ];
        if (chips.length === 0) {
            this.fadeIn(addText(this, cx, top + 112, text.noHighlights, TYPE.body, { colour: TEXT_COLOURS.muted }).setOrigin(0.5), at + 150);
            return;
        }
        const shown = chips.length > MAX_HIGHLIGHTS ? chips.slice(0, MAX_HIGHLIGHTS - 1) : chips;
        const built = shown.map(({ icon, label }) => this.highlightChip(icon, label));
        if (shown.length < chips.length) {
            built.push(this.highlightChip(null, text.more(chips.length - shown.length)));
        }
        // Flow into rows as wide as the panel, each row centred.
        const maxWidth = HIGHLIGHTS_WIDTH - 2 * SPACE.l;
        const rows: Phaser.GameObjects.Container[][] = [];
        let rowWidth = 0;
        for (const chip of built) {
            const row = rows[rows.length - 1];
            if (row && rowWidth + SPACE.s + chip.width <= maxWidth) {
                row.push(chip);
                rowWidth += SPACE.s + chip.width;
            } else {
                rows.push([chip]);
                rowWidth = chip.width;
            }
        }
        rows.forEach((row, r) => {
            const width = row.reduce((sum, chip) => sum + chip.width, 0) + SPACE.s * (row.length - 1);
            let x = cx - width / 2;
            row.forEach((chip) => {
                chip.setPosition(x + chip.width / 2, top + 92 + r * 58);
                x += chip.width + SPACE.s;
            });
        });
        built.forEach((chip, i) => this.pop([chip], at + 150 + i * STEP_MS));
    }

    /** A highlight: an icon and a line on a dark pill. */
    private highlightChip(icon: ((x: number) => Phaser.GameObjects.GameObject) | null, label: string): Phaser.GameObjects.Container {
        const iconWidth = icon ? 44 + SPACE.xs : 0;
        const text = addText(this, 0, 0, label, TYPE.small, { bold: true }).setOrigin(0, 0.5);
        const width = SPACE.m * 2 + iconWidth + text.width;
        const left = -width / 2;
        const pill = this.add.graphics()
            .fillStyle(COLOURS.ink, 0.6)
            .fillRoundedRect(left, -24, width, 48, 24)
            .lineStyle(1.5, COLOURS.goldDim, 0.8)
            .strokeRoundedRect(left, -24, width, 48, 24);
        text.setX(left + SPACE.m + iconWidth);
        const parts: Phaser.GameObjects.GameObject[] = [pill];
        if (icon) {
            parts.push(icon(left + SPACE.m + 22));
        }
        parts.push(text);
        return this.add.container(0, 0, parts).setSize(width, 48);
    }

    // Staging --------------------------------------------------------------------

    /** Hidden until `at`, then faded in (to `alpha`). */
    private fadeIn(object: Revealable, at: number, alpha = 1): void {
        object.setAlpha(0);
        this.reveal(at, () => this.tweens.add({ targets: object, alpha, duration: MOTION.normal }), () => object.setAlpha(alpha));
    }

    /** Hidden until `at`, then popped in (just faded in with reduced motion), with anything else to `play`, or `show` when skipped. */
    private pop(objects: readonly Revealable[], at: number, play?: () => void, show?: () => void): void {
        const scales = objects.map((object) => object.scale);
        objects.forEach((object) => object.setAlpha(0));
        this.reveal(at, () => {
            objects.forEach((object, i) => {
                const scale = scales[i] ?? 1;
                if (!prefersReducedMotion()) {
                    object.setScale(scale * 0.7);
                }
                this.tweens.add({ targets: object, alpha: 1, scale, duration: MOTION.normal, ease: 'Back.Out' });
            });
            play?.();
        }, () => {
            objects.forEach((object, i) => object.setAlpha(1).setScale(scales[i] ?? 1));
            show?.();
        });
    }

    private reveal(at: number, play: () => void, show: () => void): void {
        this.reveals.push({ at, play, show });
    }

    /** Counts a text up from 0 to `to`. */
    private countUp(text: Phaser.GameObjects.Text, to: number, format: (value: number) => string, duration = COUNT_MS, done?: () => void): void {
        this.tweens.addCounter({
            from: 0,
            to,
            duration,
            ease: 'Cubic.Out',
            onUpdate: (tween) => text.setText(format(Math.round(tween.getValue() ?? to))),
            onComplete: () => {
                text.setText(format(to));
                done?.();
            },
        });
    }

    private bump(object: Phaser.GameObjects.Text): void {
        if (!prefersReducedMotion()) {
            this.tweens.add({ targets: object, scale: 1.12, duration: 120, yoyo: true, ease: 'Sine.Out' });
        }
    }

    /** Plays the reveals in turn; any key or click skips to the end. Then the buttons (or the name prompt). */
    private stage(): void {
        const end = Math.max(0, ...this.reveals.map(({ at }) => at)) + 600;
        for (const { at, play } of this.reveals) {
            this.time.delayedCall(at, play);
        }
        this.time.delayedCall(end, () => this.finishStaging(false));
        this.skipHint = addText(this, DESIGN_WIDTH / 2, DESIGN_HEIGHT - 34, STRINGS.gameOver.skipHint, TYPE.tiny, { colour: TEXT_COLOURS.dim }).setOrigin(0.5);

        // A key pressed before the results appeared (to skip the game-over moment) doesn't count.
        const since = performance.now();
        const onKey = (event: KeyboardEvent): void => {
            if (event.timeStamp >= since) {
                this.finishStaging(true);
            }
        };
        const onPointer = (): void => this.finishStaging(true);
        this.input.keyboard?.on('keydown', onKey);
        this.input.on(Phaser.Input.Events.POINTER_DOWN, onPointer);
        this.events.once('staged', () => {
            this.input.keyboard?.off('keydown', onKey);
            this.input.off(Phaser.Input.Events.POINTER_DOWN, onPointer);
        });
    }

    private finishStaging(skipped: boolean): void {
        if (this.staged) {
            return;
        }
        this.staged = true;
        this.events.emit('staged');
        if (skipped) {
            this.time.removeAllEvents();
            this.tweens.killAll();
            this.reveals.forEach(({ show }) => show());
        }
        this.skipHint?.destroy();
        this.skipHint = null;
        // Next frame, so the key that skipped doesn't also reach the buttons or the name field.
        this.time.delayedCall(1, () => this.showActions());
    }

    // After the story: buttons, or the name prompt -------------------------------------

    private showActions(): void {
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
        // R goes again straight away (not while a name is being typed: leave() waits for it).
        onKeyDown(this, ['R'], () => this.leave('game'));
        // "Name your mimic" is asked once, the first time a score makes the board.
        if (this.results.rank !== null && !profile().named) {
            this.askName();
        } else {
            this.addActions();
            if (this.results.rank !== null) {
                this.addSavedNote(profile().name, false);
            }
        }
        this.report();
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
        const hint = addText(this, cx, ACTIONS_Y + 64, STRINGS.gameOver.nameHint, TYPE.small, { colour: TEXT_COLOURS.muted }).setOrigin(0.5);
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
        addText(this, cx, DESIGN_HEIGHT - 34, STRINGS.gameOver.actionsHint, TYPE.tiny, { colour: TEXT_COLOURS.muted }).setOrigin(0.5);
    }

    /** Under the buttons: the name the score was saved under, and after naming, where to change it. */
    private addSavedNote(name: string, justNamed: boolean): void {
        const note = justNamed ? `${STRINGS.gameOver.savedAs(name)}   ·   ${STRINGS.gameOver.renameHint}` : STRINGS.gameOver.savedAs(name);
        addText(this, DESIGN_WIDTH / 2, ACTIONS_Y + 64, note, TYPE.small, { colour: TEXT_COLOURS.muted }).setOrigin(0.5);
    }

    private report(): void {
        setResultsView({ cause: this.cause, rank: this.results.rank, naming: this.nameField !== null, staged: this.staged });
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
