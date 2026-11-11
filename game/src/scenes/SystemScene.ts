import * as Phaser from 'phaser';
import { loadDeferredAssets } from '../assets';
import { toggleMute } from '../audio';
import { DESIGN_WIDTH } from '../config';
import { DEBUG_MODE } from '../testHook';
import { TEXT_COLOURS, TYPE } from '../theme';
import { isTyping, onKeyDown } from '../ui/keys';
import { addText } from '../ui/text';

/** With ?debug: frames slower than this are logged to the console. */
const LONG_FRAME_MS = 100;
/** The readout shows the slowest frame over this window. */
const WORST_WINDOW_MS = 5000;

/** Game-wide events, emitted on `game.events`. */
export const GAME_EVENTS = {
    /** A background-loaded file arrived (payload: its key). */
    deferredLoaded: 'deferred-loaded',
} as const;

/**
 * Runs for the whole session, behind every other scene: global keys (M to
 * mute and F for fullscreen, anywhere) and loading the later floors' assets
 * in the background. With ?debug it also shows frame times, to catch stutters.
 */
export class SystemScene extends Phaser.Scene {
    private frameText: Phaser.GameObjects.Text | null = null;
    private recentFrames: { at: number; ms: number }[] = [];
    private nextReadout = 0;

    constructor() {
        super('system');
    }

    override update(time: number): void {
        if (!this.frameText) {
            return;
        }
        // rawDelta is the real time since the last frame, before Phaser smooths it.
        const ms = this.game.loop.rawDelta;
        this.recentFrames.push({ at: time, ms });
        this.recentFrames = this.recentFrames.filter((frame) => time - frame.at <= WORST_WINDOW_MS);
        if (ms > LONG_FRAME_MS) {
            console.warn(`Long frame: ${Math.round(ms)} ms`);
        }
        if (time >= this.nextReadout) {
            this.nextReadout = time + 500;
            const worst = Math.max(...this.recentFrames.map((frame) => frame.ms));
            this.frameText.setText(`${Math.round(this.game.loop.actualFps)} fps  ·  slowest frame ${Math.round(worst)} ms (last 5 s)`);
        }
    }

    create(): void {
        if (DEBUG_MODE) {
            this.frameText = addText(this, DESIGN_WIDTH / 2, 6, '', TYPE.tiny, { colour: TEXT_COLOURS.primary }).setOrigin(0.5, 0);
        }
        // Not while a name is being typed: M and F are letters then.
        onKeyDown(this, ['M'], () => {
            if (!isTyping()) {
                toggleMute(this.game);
            }
        });
        onKeyDown(this, ['F'], () => {
            if (!isTyping()) {
                this.scale.toggleFullscreen();
            }
        });

        this.load.on(Phaser.Loader.Events.FILE_COMPLETE, (key: string) => {
            this.game.events.emit(GAME_EVENTS.deferredLoaded, key);
        });
        this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
            console.warn(`Background load failed: ${file.key}`);
        });
        loadDeferredAssets(this.load);
        this.load.start();
    }
}
