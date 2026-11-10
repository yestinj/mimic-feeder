import '@fontsource/cinzel/latin-700.css';
import '@fontsource/alegreya-sans/latin-400.css';
import '@fontsource/alegreya-sans/latin-700.css';
import './style.css';
import * as Phaser from 'phaser';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from './config';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { TitleScene } from './scenes/TitleScene';
import { COLOURS } from './theme';

new Phaser.Game({
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
    scene: [BootScene, PreloadScene, TitleScene],
});
