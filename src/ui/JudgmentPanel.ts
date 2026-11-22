import * as Phaser from 'phaser';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../config';
import type { JudgmentView } from '../game/Judgment';
import { STRINGS } from '../strings';
import { MOTION, TYPE } from '../theme';
import { addPanel } from './kit';
import { addText } from './text';

/** The judgment's own colours: crimson, pale rose, a sickly gold. */
const COLOURS = {
    title: '#ffa6b2',
    line: '#f0e2ec',
    run: '#ffd77e',
    header: '#ffafbe',
    relentTitle: '#e1cfe7',
    relentLine: '#c9b9cf',
} as const;

/**
 * The Ninefold Judgment's panels, in its violet and crimson: what the dungeon
 * says as it summons, the wave count during the attack, and its last words.
 * No instructions and no full stops, by design.
 */
export class JudgmentPanel {
    private shown: Phaser.GameObjects.Container | null = null;
    private shownPhase: JudgmentView['phase'] | null = null;
    private header: Phaser.GameObjects.Text | null = null;

    /** Holds every panel, the one fading out included, so they hide together. */
    private readonly layer: Phaser.GameObjects.Container;

    constructor(private readonly scene: Phaser.Scene) {
        this.layer = scene.add.container(0, 0).setDepth(20);
    }

    /** Hides the panels while an overlay is open over the run (as the HUD's other notices are). */
    setCovered(covered: boolean): void {
        this.layer.setVisible(!covered);
    }

    /** Whether the panel on screen can be seen; null when there is none (for the playtest). */
    get seen(): boolean | null {
        return this.shown ? this.layer.visible : null;
    }

    show(view: JudgmentView | null): void {
        if (!view) {
            this.replace(null);
            this.shownPhase = null;
            return;
        }
        if (view.phase === this.shownPhase) {
            this.header?.setText(STRINGS.judgment.header(view.wave, view.waves));
            return;
        }
        this.shownPhase = view.phase;
        this.replace(this.build(view));
    }

    private build(view: JudgmentView): Phaser.GameObjects.Container {
        const scene = this.scene;
        const text = STRINGS.judgment;
        switch (view.phase) {
            case 'summoning': {
                const y = DESIGN_HEIGHT * 0.63 + 130;
                return scene.add.container(DESIGN_WIDTH / 2, y, [
                    addPanel(scene, 0, 0, 1000, 260, 'judgment'),
                    addText(scene, 0, -72, text.summonTitle, TYPE.title, { role: 'display', bold: true, colour: COLOURS.title }).setOrigin(0.5),
                    addText(scene, 0, 0, text.summonLine, TYPE.body, { colour: COLOURS.line }).setOrigin(0.5),
                    addText(scene, 0, 62, text.summonRun, TYPE.heading, { role: 'display', bold: true, colour: COLOURS.run }).setOrigin(0.5),
                ]);
            }
            case 'attack': {
                this.header = addText(scene, 0, -2, text.header(view.wave, view.waves), TYPE.heading, { role: 'display', bold: true, colour: COLOURS.header }).setOrigin(0.5);
                return scene.add.container(DESIGN_WIDTH / 2, 70, [addPanel(scene, 0, 0, 820, 96, 'judgment'), this.header]);
            }
            case 'ending': {
                const y = DESIGN_HEIGHT * 0.68 + 80;
                return scene.add.container(DESIGN_WIDTH / 2, y, [
                    addPanel(scene, 0, 0, 900, 160, 'judgment'),
                    addText(scene, 0, -24, text.endTitle, TYPE.title, { role: 'display', bold: true, colour: COLOURS.relentTitle }).setOrigin(0.5),
                    addText(scene, 0, 40, text.endLine, TYPE.body, { colour: COLOURS.relentLine }).setOrigin(0.5),
                ]);
            }
        }
    }

    /** Fades the current panel out and the next one in. */
    private replace(next: Phaser.GameObjects.Container | null): void {
        const old = this.shown;
        if (old) {
            this.scene.tweens.add({ targets: old, alpha: 0, duration: MOTION.slow, onComplete: () => old.destroy() });
        }
        if (!next) {
            this.header = null;
        }
        this.shown = next;
        if (next) {
            this.layer.add(next.setAlpha(0));
            this.scene.tweens.add({ targets: next, alpha: 1, duration: MOTION.slow });
        }
    }
}
