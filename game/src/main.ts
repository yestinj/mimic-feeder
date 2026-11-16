import '@fontsource/grenze-gotisch/latin-700.css';
import '@fontsource/barlow/latin-400.css';
import '@fontsource/barlow/latin-700.css';
import './style.css';
import * as Phaser from 'phaser';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from './config';
import { MENU_CURSOR } from './ui/cursor';
import { AchievementsScene } from './scenes/AchievementsScene';
import { BootScene } from './scenes/BootScene';
import { CountdownScene } from './scenes/CountdownScene';
import { CreditsScene } from './scenes/CreditsScene';
import { GameScene } from './scenes/GameScene';
import { HighScoresScene } from './scenes/HighScoresScene';
import { HowToPlayScene } from './scenes/HowToPlayScene';
import { HudScene } from './scenes/HudScene';
import { PauseScene } from './scenes/PauseScene';
import { PreloadScene } from './scenes/PreloadScene';
import { ResultsScene } from './scenes/ResultsScene';
import { SettingsScene } from './scenes/SettingsScene';
import { SystemScene } from './scenes/SystemScene';
import { TitleScene } from './scenes/TitleScene';
import { UnlockScene } from './scenes/UnlockScene';
import { applySavedMute } from './audio';
import { showNotice } from './notice';
import { loadProfile } from './profile';
import { STRINGS } from './strings';
import { installTestHook } from './testHook';
import { COLOURS } from './theme';

/**
 * True if the browser will give the game a WebGL context. It may not: with
 * hardware acceleration off, on some remote or locked-down machines. The game
 * needs one (its blurs, glows and particles have no canvas equivalent).
 */
function webglAvailable(): boolean {
    try {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
        // Hand the test context straight back: browsers only allow a few at once.
        context?.getExtension('WEBGL_lose_context')?.loseContext();
        return context !== null;
    } catch {
        return false;
    }
}

function start(): void {
    const game = new Phaser.Game({
        type: Phaser.WEBGL,
        parent: 'game',
        width: DESIGN_WIDTH,
        height: DESIGN_HEIGHT,
        backgroundColor: COLOURS.ink,
        scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        // Load images with plain <img> requests. Phaser's default (XHR + blob: URLs)
        // would need blob: in the CSP's img-src.
        loader: { imageLoadType: 'HTMLImageElement' },
        // Listed bottom to top: the HUD draws over the game, the pause menu and new-ability card over both,
        // and the menu screens (How to Play, Achievements, High Scores, Settings, Credits) over whichever screen opened them.
        scene: [BootScene, PreloadScene, TitleScene, GameScene, HudScene, PauseScene, UnlockScene, ResultsScene, CountdownScene, SettingsScene, HighScoresScene, AchievementsScene, HowToPlayScene, CreditsScene, SystemScene],
    });
    game.events.once(Phaser.Core.Events.READY, () => {
        applySavedMute(game);
        game.input.setDefaultCursor(MENU_CURSOR);
    });
    installTestHook(game);
}

// The save first: settings (mute, volumes, motion) apply from the first frame.
loadProfile();

// Without WebGL, say so: Phaser would throw and leave a blank page.
if (webglAvailable()) {
    try {
        start();
    } catch (error) {
        // Phaser couldn't get its own context after all ("Cannot create WebGL context"). Anything
        // else is a fault of the game's, not the browser's, and is left to surface as it is.
        if (!(error instanceof Error && /webgl/i.test(error.message))) {
            throw error;
        }
        console.error(error);
        showNotice(STRINGS.noWebgl.title, STRINGS.noWebgl.text);
    }
} else {
    showNotice(STRINGS.noWebgl.title, STRINGS.noWebgl.text);
}
