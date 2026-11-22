import * as Phaser from 'phaser';
import { FONTS } from '../theme';
import { preloadUiKit } from '../ui/kit';

/** Fonts must be ready before any text is created, or Phaser renders the fallback. */
const FONT_FACES = [
    `700 64px "${FONTS.display}"`,
    `400 28px "${FONTS.body}"`,
    `700 28px "${FONTS.body}"`,
];
const FONT_TIMEOUT_MS = 4000;

/** Loads the tiny UI kit and the fonts, then hands over to the loading screen. */
export class BootScene extends Phaser.Scene {
    constructor() {
        super('boot');
    }

    preload(): void {
        preloadUiKit(this);
    }

    create(): void {
        void this.waitForFonts().then(() => this.scene.start('preload'));
    }

    private async waitForFonts(): Promise<void> {
        const loads = Promise.all(FONT_FACES.map((face) => document.fonts.load(face)));
        const timeout = new Promise<void>((resolve) => {
            setTimeout(resolve, FONT_TIMEOUT_MS);
        });
        try {
            // Never block the game on fonts: after the timeout, text uses the fallback.
            await Promise.race([loads, timeout]);
        } catch {
            // A failed font load also falls back.
        }
    }
}
