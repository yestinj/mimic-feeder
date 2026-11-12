import * as Phaser from 'phaser';
import { playSound } from '../audio';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../config';
import { prefersReducedMotion } from '../motion';
import { STRINGS } from '../strings';
import { markReady } from '../testHook';
import { TEXT_COLOURS, TYPE } from '../theme';
import { onKeyDown } from '../ui/keys';
import { addText } from '../ui/text';
import type { GameScene } from './GameScene';

/** Each number stays up this long (ms). */
const STEP_MS = 520;

/**
 * The resume countdown (plan §3.1, a trial; switchable in Settings): 3, 2, 1
 * over the run, still paused but no longer blurred, so the player can see
 * where everything is before play carries on. P or Esc goes back to the pause
 * menu, and so does losing focus or the page being hidden.
 */
export class CountdownScene extends Phaser.Scene {
    private done = false;

    constructor() {
        super('countdown');
    }

    create(): void {
        this.done = false;
        const game = this.scene.get('game') as GameScene;
        const number = addText(this, DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2 - 40, '', TYPE.hero * 1.4, { role: 'display', bold: true, colour: TEXT_COLOURS.gold }).setOrigin(0.5);
        const hint = addText(this, DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2 + 90, STRINGS.countdown.hint, TYPE.small, { colour: TEXT_COLOURS.muted }).setOrigin(0.5);
        hint.setAlpha(0.85);

        const show = (count: number): void => {
            number.setText(String(count)).setAlpha(1).setScale(1);
            playSound(this, 'uiTick');
            if (!prefersReducedMotion()) {
                number.setScale(1.35);
                this.tweens.add({ targets: number, scale: 1, duration: STEP_MS * 0.6, ease: 'Back.Out' });
            }
            this.tweens.add({ targets: number, alpha: 0.25, delay: STEP_MS * 0.6, duration: STEP_MS * 0.4 });
        };
        [3, 2, 1].forEach((count, i) => this.time.delayedCall(i * STEP_MS, () => show(count)));
        this.time.delayedCall(3 * STEP_MS, () => this.finish(() => game.resumePlay()));

        const backToPause = (): void => this.finish(() => game.reopenPause());
        onKeyDown(this, ['P', 'ESC'], backToPause);
        // Losing focus, or the page being hidden, stops the count like it pauses play.
        this.game.events.on(Phaser.Core.Events.BLUR, backToPause);
        this.game.events.on(Phaser.Core.Events.HIDDEN, backToPause);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.game.events.off(Phaser.Core.Events.BLUR, backToPause);
            this.game.events.off(Phaser.Core.Events.HIDDEN, backToPause);
        });
        markReady('countdown');
    }

    private finish(then: () => void): void {
        if (this.done) {
            return;
        }
        this.done = true;
        this.scene.stop();
        then();
    }
}
