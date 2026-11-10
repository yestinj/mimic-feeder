import '@fontsource/grenze-gotisch/latin-700.css';
import '@fontsource/barlow/latin-400.css';
import '@fontsource/barlow/latin-700.css';
import './style.css';
import * as Phaser from 'phaser';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from './config';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { HudScene } from './scenes/HudScene';
import { PauseScene } from './scenes/PauseScene';
import { PreloadScene } from './scenes/PreloadScene';
import { ResultsScene } from './scenes/ResultsScene';
import { SystemScene } from './scenes/SystemScene';
import { TitleScene } from './scenes/TitleScene';
import { UnlockScene } from './scenes/UnlockScene';
import { installTestHook } from './testHook';
import { COLOURS } from './theme';

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
    // Listed bottom to top: the HUD draws over the game, the pause menu and new-ability card over both.
    scene: [BootScene, PreloadScene, TitleScene, GameScene, HudScene, PauseScene, UnlockScene, ResultsScene, SystemScene],
});
installTestHook(game);
