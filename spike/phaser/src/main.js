import * as Phaser from 'phaser';
import { WIDTH, HEIGHT } from './config.js';
import { BootScene } from './BootScene.js';
import { PlayScene } from './PlayScene.js';
import { HudScene } from './HudScene.js';

const game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent: 'game',
    width: WIDTH,
    height: HEIGHT,
    backgroundColor: '#000000',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    // Load images with plain <img> requests. The default (XHR + blob: URLs)
    // would need `blob:` in the CSP's img-src.
    loader: { imageLoadType: 'HTMLImageElement' },
    scene: [BootScene, PlayScene, HudScene]
});

// Exposed for the spike's browser checks only.
window.__spikeGame = game;
