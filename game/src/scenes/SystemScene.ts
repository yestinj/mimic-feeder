import * as Phaser from 'phaser';
import { loadDeferredAssets } from '../assets';
import { toggleMute } from '../audio';
import { onKeyDown } from '../ui/keys';

/** Game-wide events, emitted on `game.events`. */
export const GAME_EVENTS = {
    /** Sound was muted or unmuted (payload: muted). */
    muteChanged: 'mute-changed',
    /** A background-loaded file arrived (payload: its key). */
    deferredLoaded: 'deferred-loaded',
} as const;

/**
 * Runs for the whole session, behind every other scene: global keys (M to
 * mute, anywhere) and loading the later floors' assets in the background.
 */
export class SystemScene extends Phaser.Scene {
    constructor() {
        super('system');
    }

    create(): void {
        onKeyDown(this, ['M'], () => {
            this.game.events.emit(GAME_EVENTS.muteChanged, toggleMute(this.game));
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
